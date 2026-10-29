/**
 * KmsOps website server
 * - Public site:        /            /product/:slug
 * - Admin panel:        /admin
 * - Storage:            JSON files in ./data (no database)
 * - Uploaded images:    ./uploads (served at /uploads)
 */
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');

const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const ENQUIRY_FILE = path.join(DATA_DIR, 'enquiries.json');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_BACKUPS = 30;

for (const dir of [DATA_DIR, BACKUP_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });

// ---------- JSON file helpers ----------
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function backupContent() {
  if (!fs.existsSync(CONTENT_FILE)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(CONTENT_FILE, path.join(BACKUP_DIR, `content-${stamp}.json`));
  const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('content-')).sort();
  while (backups.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, backups.shift()));
}

// ---------- Password hashing ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, { salt, hash }) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function ensureAdmin() {
  if (fs.existsSync(ADMIN_FILE)) return;
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe@123';
  writeJson(ADMIN_FILE, { username, ...hashPassword(password), mustChange: !process.env.ADMIN_PASSWORD });
  console.log(`\n  Admin account created -> username: "${username}"  password: "${password}"`);
  console.log('  Change it after first login (Admin > Account).\n');
}
ensureAdmin();

// ---------- Sessions (in memory, httpOnly cookie) ----------
const sessions = new Map();

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function getSession(req) {
  const token = parseCookies(req).kms_admin;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s || s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  s.expires = Date.now() + SESSION_TTL_MS;
  return { token, ...s };
}

function requireAdmin(req, res, next) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Not logged in' });
  req.admin = s;
  next();
}

// Simple brute-force protection for login
const loginAttempts = new Map();
function tooManyAttempts(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return false;
  }
  return rec.count >= 8;
}
function recordFailure(ip) {
  const rec = loginAttempts.get(ip) || { count: 0, first: Date.now() };
  rec.count++;
  loginAttempts.set(ip, rec);
}

// ---------- Uploads ----------
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif']);
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.png';
      const base = path.basename(file.originalname, path.extname(file.originalname))
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
      cb(null, `${base}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype))
});

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Public content (hidden items filtered out)
app.get('/api/content', (req, res) => {
  const c = readJson(CONTENT_FILE, {});
  const visible = arr => (Array.isArray(arr) ? arr.filter(x => x.visible !== false) : []);
  const byOrder = arr => arr.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  res.json({
    ...c,
    products: byOrder(visible(c.products)),
    services: byOrder(visible(c.services)),
    industries: byOrder(visible(c.industries)),
    workflows: byOrder(visible(c.workflows)),
    testimonials: visible(c.testimonials),
    faqs: visible(c.faqs)
  });
});

// Contact / enquiry form
app.post('/api/enquiry', (req, res) => {
  const clean = (v, max) => String(v ?? '').trim().slice(0, max);
  const e = {
    id: crypto.randomUUID(),
    name: clean(req.body.name, 120),
    email: clean(req.body.email, 160),
    phone: clean(req.body.phone, 40),
    company: clean(req.body.company, 160),
    interest: clean(req.body.interest, 160),
    message: clean(req.body.message, 3000),
    createdAt: new Date().toISOString(),
    read: false
  };
  if (!e.name || (!e.email && !e.phone)) return res.status(400).json({ error: 'Please share your name and an email or phone number.' });
  if (e.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  const list = readJson(ENQUIRY_FILE, []);
  list.unshift(e);
  writeJson(ENQUIRY_FILE, list.slice(0, 5000));
  res.json({ ok: true });
});

// ---------- Admin API ----------
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const admin = readJson(ADMIN_FILE, null);
  const { username = '', password = '' } = req.body || {};
  if (!admin || username !== admin.username || !verifyPassword(String(password), admin)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: admin.username, expires: Date.now() + SESSION_TTL_MS });
  res.setHeader('Set-Cookie', `kms_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${req.secure ? '; Secure' : ''}`);
  res.json({ ok: true, username: admin.username, mustChange: !!admin.mustChange });
});

app.post('/api/admin/logout', (req, res) => {
  const s = getSession(req);
  if (s) sessions.delete(s.token);
  res.setHeader('Set-Cookie', 'kms_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  const admin = readJson(ADMIN_FILE, {});
  res.json({ username: req.admin.username, mustChange: !!admin.mustChange });
});

app.post('/api/admin/account', requireAdmin, (req, res) => {
  const admin = readJson(ADMIN_FILE, null);
  const { currentPassword = '', newPassword = '', newUsername } = req.body || {};
  if (!verifyPassword(String(currentPassword), admin)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const username = String(newUsername || admin.username).trim() || admin.username;
  writeJson(ADMIN_FILE, { username, ...hashPassword(String(newPassword)), mustChange: false });
  for (const [t, s] of sessions) if (t !== req.admin.token) sessions.delete(t);
  sessions.get(req.admin.token).username = username;
  res.json({ ok: true });
});

app.get('/api/admin/content', requireAdmin, (req, res) => res.json(readJson(CONTENT_FILE, {})));

app.put('/api/admin/content', requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !body.settings) {
    return res.status(400).json({ error: 'Invalid content payload' });
  }
  backupContent();
  body.updatedAt = new Date().toISOString();
  writeJson(CONTENT_FILE, body);
  res.json({ ok: true, updatedAt: body.updatedAt });
});

app.get('/api/admin/backups', requireAdmin, (req, res) => {
  res.json(fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('content-')).sort().reverse());
});

app.post('/api/admin/backups/:name/restore', requireAdmin, (req, res) => {
  const name = path.basename(req.params.name);
  const file = path.join(BACKUP_DIR, name);
  if (!name.startsWith('content-') || !fs.existsSync(file)) return res.status(404).json({ error: 'Backup not found' });
  const data = readJson(file, null);
  if (!data) return res.status(400).json({ error: 'Backup is unreadable' });
  backupContent();
  writeJson(CONTENT_FILE, data);
  res.json({ ok: true });
});

app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.array('images', 20)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    const files = (req.files || []).map(f => `/uploads/${f.filename}`);
    if (!files.length) return res.status(400).json({ error: 'No valid images (jpg, png, webp, gif, svg, avif) received' });
    res.json({ files });
  });
});

app.get('/api/admin/uploads', requireAdmin, (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR)
    .filter(f => !f.startsWith('.'))
    .map(f => ({ url: `/uploads/${f}`, size: fs.statSync(path.join(UPLOAD_DIR, f)).size, mtime: fs.statSync(path.join(UPLOAD_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  res.json(files);
});

app.delete('/api/admin/uploads/:name', requireAdmin, (req, res) => {
  const file = path.join(UPLOAD_DIR, path.basename(req.params.name));
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

app.get('/api/admin/enquiries', requireAdmin, (req, res) => res.json(readJson(ENQUIRY_FILE, [])));

app.patch('/api/admin/enquiries/:id', requireAdmin, (req, res) => {
  const list = readJson(ENQUIRY_FILE, []);
  const e = list.find(x => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  e.read = !!req.body.read;
  writeJson(ENQUIRY_FILE, list);
  res.json({ ok: true });
});

app.delete('/api/admin/enquiries/:id', requireAdmin, (req, res) => {
  writeJson(ENQUIRY_FILE, readJson(ENQUIRY_FILE, []).filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

// ---------- Pages & static ----------
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));
app.get('/product/:slug', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'product.html')));
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  // uploaded SVGs must never run scripts
  setHeaders: res => res.setHeader('Content-Security-Policy', "script-src 'none'; sandbox")
}));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`KmsOps running ->  http://localhost:${PORT}`);
  console.log(`Admin panel     ->  http://localhost:${PORT}/admin`);
});

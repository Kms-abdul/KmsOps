/**
 * KmsOps website server
 * - Public site:        /            /product/:slug
 * - Admin panel:        /admin
 * - Storage:            see storage.js (Vercel Blob on Vercel, local files otherwise)
 * - Uploaded images:    served at /uploads/<file>
 *
 * Runs locally with `npm start`; on Vercel the exported app is used.
 */
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const store = require('./storage');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ON_VERCEL = !!process.env.VERCEL;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
// Vercel rejects request bodies over 4.5 MB, so keep uploads under that there
const MAX_UPLOAD_BYTES = ON_VERCEL ? 4 * 1024 * 1024 : 10 * 1024 * 1024;

// Wrap async route handlers so errors reach the error middleware
const a = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

// ---------- Admin account (cached briefly; storage reads are network calls on Vercel) ----------
let adminCache = null;
async function getAdmin() {
  if (adminCache && adminCache.at > Date.now() - 30_000) return adminCache.value;
  let admin = await store.readJson('admin.json', null);
  if (!admin) {
    const username = process.env.ADMIN_USER || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe@123';
    admin = { username, ...hashPassword(password), mustChange: !process.env.ADMIN_PASSWORD };
    await store.writeJson('admin.json', admin);
    console.log(`Admin account created -> username: "${username}"${process.env.ADMIN_PASSWORD ? '' : `  password: "${password}"`}`);
  }
  adminCache = { value: admin, at: Date.now() };
  return admin;
}

async function saveAdmin(admin) {
  await store.writeJson('admin.json', admin);
  adminCache = { value: admin, at: Date.now() };
}

// ---------- Sessions: stateless signed cookie ----------
// Signed with SESSION_SECRET (if set) plus the password hash, so changing the
// password signs everyone out.
const sessionKey = admin => `${process.env.SESSION_SECRET || ''}:${admin.hash}`;
const sign = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64url');

function issueToken(admin) {
  const payload = Buffer.from(JSON.stringify({ u: admin.username, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload, sessionKey(admin))}`;
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

async function getSession(req) {
  const token = parseCookies(req).kms_admin;
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const admin = await getAdmin();
  const expected = Buffer.from(sign(payload, sessionKey(admin)));
  const given = Buffer.from(sig || '');
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now() || data.u !== admin.username) return null;
    return { username: data.u, admin };
  } catch {
    return null;
  }
}

function setSessionCookie(req, res, value, maxAgeSec) {
  const secure = req.secure || ON_VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kms_admin=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${secure}`);
}

const requireAdmin = a(async (req, res, next) => {
  const s = await getSession(req);
  if (!s) return res.status(401).json({ error: 'Not logged in' });
  req.admin = s;
  next();
});

// Simple brute-force protection for login (per server instance)
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
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 20 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype))
});

function uploadName(original) {
  const ext = path.extname(original).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.png';
  const base = path.basename(original, path.extname(original))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
  return `${base}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}${ext}`;
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
if (ON_VERCEL) app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Setup check — shows which storage is active, never any secrets
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    storage: store.kind,
    vercel: ON_VERCEL,
    blobEnvNames: Object.keys(process.env).filter(k => k.includes('BLOB')).sort(),
    adminUserSet: !!process.env.ADMIN_USER,
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
    sessionSecretSet: !!process.env.SESSION_SECRET
  });
});

// Public content (hidden items filtered out)
app.get('/api/content', a(async (req, res) => {
  const c = await store.readJson('content.json', {});
  const visible = arr => (Array.isArray(arr) ? arr.filter(x => x.visible !== false) : []);
  const byOrder = arr => arr.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ...c,
    products: byOrder(visible(c.products)),
    services: byOrder(visible(c.services)),
    industries: byOrder(visible(c.industries)),
    workflows: byOrder(visible(c.workflows)),
    testimonials: visible(c.testimonials),
    faqs: visible(c.faqs)
  });
}));

// Ads for embedding in other apps (/ads page). Falls back to the visible
// applications when no custom ads exist. ?exclude=<slug> hides an app's own ads.
app.get('/api/ads', a(async (req, res) => {
  const c = await store.readJson('content.json', {});
  const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const exclude = slugify(req.query.exclude);
  // matches the app's page URL, its name, or a page URL starting with it ("kitchora" -> "kitchora-ops-vercel-app")
  const isExcluded = (slug, name) => !!exclude && [slugify(slug), slugify(name)].some(v => v === exclude || v.startsWith(`${exclude}-`));
  const products = (c.products || []).filter(p => p.visible !== false);
  const custom = (c.ads || []).filter(x => x.visible !== false);
  const ads = (custom.length ? custom.map(x => {
    const p = products.find(p => p.slug === x.product);
    return {
      id: x.id, title: x.title, text: x.text, buttonText: x.buttonText || 'Learn more',
      image: x.image || (p && (p.coverImage || (p.gallery || [])[0])) || '',
      icon: p?.icon || '', accent: x.accent || p?.accent || '', product: x.product || '', productName: p?.name || '',
      link: x.link || (p ? `/product/${p.slug}` : '/')
    };
  }) : products.map(p => ({
    id: p.id, title: p.name, text: p.tagline, buttonText: `Explore ${p.name}`,
    image: p.coverImage || (p.gallery || [])[0] || '', icon: p.icon || '', accent: p.accent || '',
    product: p.slug, productName: p.name, link: `/product/${p.slug}`, category: p.category || ''
  }))).filter(x => !isExcluded(x.product, x.productName));
  // short CDN cache: partner apps can send a lot of traffic
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.json({ brand: c.settings?.brand || 'KMS Ops', ads, panel: buildPanel(c, products, isExcluded) });
}));

// Content for the large brand / solutions panels shown beside a partner app's login
function buildPanel(c, products, isExcluded) {
  const s = c.settings || {};
  const host = products.find(p => isExcluded(p.slug, p.name));
  const first = arr => (arr || []).filter(Boolean).slice(0, 3).join(', ');
  const solutions = products.map(p => ({
    title: p.category || p.name, text: first(p.features), icon: p.icon || '◆', accent: p.accent || '#1D6FE0', link: `/product/${p.slug}`
  }));
  const services = (c.services || []).filter(x => x.visible !== false);
  if (services.length) solutions.push({ title: 'Accounting & Tax', text: first(services.map(x => x.title)), icon: '🧾', accent: '#F2B227', link: '/#services' });
  const flows = (c.workflows || []).filter(x => x.visible !== false);
  if (flows.length) solutions.push({ title: 'Business Automation', text: first(flows.map(x => x.title)), icon: '⚙️', accent: '#E9468A', link: '/#workflows' });
  const industries = (c.industries || []).filter(x => x.visible !== false).length;
  return {
    brand: s.brand || 'KMS Ops',
    brandFull: s.brandFull ?? 'Key Management Solutions',
    motto: s.brandMotto || 'Build • Automate • Operate',
    chips: s.panelChips || 'Technology • People • Growth',
    text: s.panelText || 'Technology and business solutions designed to simplify the way organizations work.',
    script: s.panelScript || 'Empowering Businesses Across Industries',
    ecoTitle: s.panelEcoTitle || 'One Ecosystem. | Multiple Solutions.',
    ecoText: s.panelEcoText || 'From restaurants to education, inventory, HR, accounting and more — KMS Ops helps businesses operate smarter.',
    solutions: solutions.slice(0, 6),
    stats: [
      industries && { value: `${industries}+`, label: 'Industries' },
      ...(c.stats || []).slice(0, 1).map(x => ({ value: `${x.value}${x.suffix || ''}`, label: String(x.label || '').split(' ')[0] })),
      { value: 'Scalable', label: 'Solutions' }
    ].filter(Boolean),
    host: host ? { name: host.name, icon: host.icon || '', accent: host.accent || '', image: host.coverImage || (host.gallery || [])[0] || '' } : null
  };
}

// Contact / enquiry form
app.post('/api/enquiry', a(async (req, res) => {
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
  const list = await store.readJson('enquiries.json', []);
  list.unshift(e);
  await store.writeJson('enquiries.json', list.slice(0, 5000));
  res.json({ ok: true });
}));

// ---------- Admin API ----------
app.post('/api/admin/login', a(async (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const admin = await getAdmin();
  const { username = '', password = '' } = req.body || {};
  if (username !== admin.username || !verifyPassword(String(password), admin)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  loginAttempts.delete(ip);
  setSessionCookie(req, res, issueToken(admin), SESSION_TTL_MS / 1000);
  res.json({ ok: true, username: admin.username, mustChange: !!admin.mustChange });
}));

app.post('/api/admin/logout', (req, res) => {
  setSessionCookie(req, res, '', 0);
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, mustChange: !!req.admin.admin.mustChange });
});

app.post('/api/admin/account', requireAdmin, a(async (req, res) => {
  const admin = req.admin.admin;
  const { currentPassword = '', newPassword = '', newUsername } = req.body || {};
  if (!verifyPassword(String(currentPassword), admin)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const username = String(newUsername || admin.username).trim() || admin.username;
  const updated = { username, ...hashPassword(String(newPassword)), mustChange: false };
  await saveAdmin(updated);
  // other sessions are now invalid; keep this one signed in
  setSessionCookie(req, res, issueToken(updated), SESSION_TTL_MS / 1000);
  res.json({ ok: true });
}));

app.get('/api/admin/content', requireAdmin, a(async (req, res) => res.json(await store.readJson('content.json', {}))));

app.put('/api/admin/content', requireAdmin, a(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !body.settings) {
    return res.status(400).json({ error: 'Invalid content payload' });
  }
  await store.backupContent();
  body.updatedAt = new Date().toISOString();
  await store.writeJson('content.json', body);
  res.json({ ok: true, updatedAt: body.updatedAt });
}));

app.get('/api/admin/backups', requireAdmin, a(async (req, res) => res.json(await store.listBackups())));

app.post('/api/admin/backups/:name/restore', requireAdmin, a(async (req, res) => {
  const name = path.basename(req.params.name);
  if (!/^content-[\w-]+\.json$/.test(name)) return res.status(404).json({ error: 'Backup not found' });
  const data = await store.readBackup(name);
  if (!data) return res.status(404).json({ error: 'Backup not found or unreadable' });
  await store.backupContent();
  await store.writeJson('content.json', data);
  res.json({ ok: true });
}));

app.post('/api/admin/upload', requireAdmin, (req, res, next) => {
  upload.array('images', 20)(req, res, async err => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `Image is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` : err.message;
      return res.status(400).json({ error: msg });
    }
    try {
      const files = [];
      for (const f of req.files || []) {
        const name = uploadName(f.originalname);
        await store.saveUpload(name, f.buffer, f.mimetype);
        files.push(`/uploads/${name}`);
      }
      if (!files.length) return res.status(400).json({ error: 'No valid images (jpg, png, webp, gif, svg, avif) received' });
      res.json({ files });
    } catch (e) { next(e); }
  });
});

app.get('/api/admin/uploads', requireAdmin, a(async (req, res) => {
  const files = (await store.listUploads())
    .map(f => ({ url: `/uploads/${f.name}`, size: f.size, mtime: f.mtime }))
    .sort((x, y) => y.mtime - x.mtime);
  res.json(files);
}));

app.delete('/api/admin/uploads/:name', requireAdmin, a(async (req, res) => {
  await store.deleteUpload(path.basename(req.params.name));
  res.json({ ok: true });
}));

app.get('/api/admin/enquiries', requireAdmin, a(async (req, res) => res.json(await store.readJson('enquiries.json', []))));

app.patch('/api/admin/enquiries/:id', requireAdmin, a(async (req, res) => {
  const list = await store.readJson('enquiries.json', []);
  const e = list.find(x => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  e.read = !!req.body.read;
  await store.writeJson('enquiries.json', list);
  res.json({ ok: true });
}));

app.delete('/api/admin/enquiries/:id', requireAdmin, a(async (req, res) => {
  const list = await store.readJson('enquiries.json', []);
  await store.writeJson('enquiries.json', list.filter(x => x.id !== req.params.id));
  res.json({ ok: true });
}));

// ---------- Uploaded images ----------
app.get('/uploads/:name', a(async (req, res) => {
  // uploaded SVGs must never run scripts
  res.setHeader('Content-Security-Policy', "script-src 'none'; sandbox");
  const ok = await store.streamUpload(path.basename(req.params.name), res);
  if (!ok) res.status(404).end();
}));

// ---------- Pages & static (on Vercel, public/ is served by the CDN and vercel.json rewrites) ----------
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));
app.get('/product/:slug', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'product.html')));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((req, res) => res.redirect('/'));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.status) return res.status(err.status).json({ error: err.message });
  // Blob SDK errors carry no secrets and explain storage problems (permissions, store setup)
  if (/^Blob|Vercel Blob/.test(`${err.name} ${err.message}`)) return res.status(502).json({ error: `Storage error: ${err.message}` });
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KmsOps running (${store.kind} storage) ->  http://localhost:${PORT}`);
    console.log(`Admin panel     ->  http://localhost:${PORT}/admin`);
  });
}

module.exports = app;

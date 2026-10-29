/**
 * Storage layer with two drivers:
 * - Vercel Blob (private store) when BLOB_READ_WRITE_TOKEN is set — used on Vercel
 * - Local files in ./data and ./uploads otherwise — used for `npm start`
 *
 * JSON documents:  content.json, admin.json, enquiries.json, backups/content-*.json
 * Images:          uploads/<file>, always served by the app at /uploads/<file>
 */
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const MAX_BACKUPS = 30;
const SEED_CONTENT = path.join(__dirname, 'data', 'content.json');
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

function seedFor(name, fallback) {
  // content.json in the repo is the starting content until the first publish
  if (name === 'content.json') {
    try { return JSON.parse(fs.readFileSync(SEED_CONTENT, 'utf8')); } catch { /* ignore */ }
  }
  return fallback;
}

// ---------------- Local file driver ----------------
function localDriver() {
  const DATA_DIR = path.join(__dirname, 'data');
  const BACKUP_DIR = path.join(DATA_DIR, 'backups');
  const UPLOAD_DIR = path.join(__dirname, 'uploads');
  for (const dir of [DATA_DIR, BACKUP_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });

  const file = name => path.join(DATA_DIR, name);
  const writeFile = (f, data) => {
    const tmp = `${f}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, f);
  };

  return {
    kind: 'local',
    uploadDir: UPLOAD_DIR,
    async readJson(name, fallback) {
      try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return seedFor(name, fallback); }
    },
    async writeJson(name, data) {
      writeFile(file(name), JSON.stringify(data, null, 2));
    },
    async backupContent() {
      if (!fs.existsSync(file('content.json'))) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(file('content.json'), path.join(BACKUP_DIR, `content-${stamp}.json`));
      const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('content-')).sort();
      while (backups.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, backups.shift()));
    },
    async listBackups() {
      return fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('content-')).sort().reverse();
    },
    async readBackup(name) {
      try { return JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, name), 'utf8')); } catch { return null; }
    },
    async saveUpload(name, buffer) {
      fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
    },
    async listUploads() {
      return fs.readdirSync(UPLOAD_DIR).filter(f => !f.startsWith('.')).map(f => {
        const st = fs.statSync(path.join(UPLOAD_DIR, f));
        return { name: f, size: st.size, mtime: st.mtimeMs };
      });
    },
    async deleteUpload(name) {
      const f = path.join(UPLOAD_DIR, name);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    },
    async streamUpload(name, res) {
      const f = path.join(UPLOAD_DIR, name);
      if (!fs.existsSync(f)) return false;
      res.sendFile(f);
      return true;
    }
  };
}

// ---------------- Vercel Blob driver (private store) ----------------
function blobDriver() {
  const blob = require('@vercel/blob');
  const ACCESS = 'private';

  async function listAll(prefix) {
    const out = [];
    let cursor;
    do {
      const r = await blob.list({ prefix, cursor, limit: 1000 });
      out.push(...r.blobs);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  }

  async function readText(pathname, fresh) {
    const r = await blob.get(pathname, { access: ACCESS, useCache: !fresh });
    if (!r || !r.stream) return null;
    return new Response(r.stream).text();
  }

  return {
    kind: 'blob',
    // fresh=false lets public reads use the CDN cache (may lag a publish by up to ~60s)
    async readJson(name, fallback, { fresh = true } = {}) {
      const text = await readText(`data/${name}`, fresh);
      if (text == null) return seedFor(name, fallback);
      try { return JSON.parse(text); } catch { return seedFor(name, fallback); }
    },
    async writeJson(name, data) {
      await blob.put(`data/${name}`, JSON.stringify(data, null, 2), {
        access: ACCESS, addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 60
      });
    },
    async backupContent() {
      const current = await readText('data/content.json', true);
      if (current == null) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await blob.put(`data/backups/content-${stamp}.json`, current, {
        access: ACCESS, addRandomSuffix: false, contentType: 'application/json'
      });
      const backups = (await listAll('data/backups/content-')).sort((a, b) => a.pathname.localeCompare(b.pathname));
      const extra = backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS));
      if (extra.length) await blob.del(extra.map(b => b.url));
    },
    async listBackups() {
      return (await listAll('data/backups/content-')).map(b => b.pathname.split('/').pop()).sort().reverse();
    },
    async readBackup(name) {
      const text = await readText(`data/backups/${name}`, true);
      try { return text == null ? null : JSON.parse(text); } catch { return null; }
    },
    async saveUpload(name, buffer, contentType) {
      await blob.put(`uploads/${name}`, buffer, { access: ACCESS, addRandomSuffix: false, contentType });
    },
    async listUploads() {
      return (await listAll('uploads/')).map(b => ({ name: b.pathname.slice('uploads/'.length), size: b.size, mtime: new Date(b.uploadedAt).getTime() }));
    },
    async deleteUpload(name) {
      await blob.del(`uploads/${name}`).catch(() => {});
    },
    async streamUpload(name, res) {
      const r = await blob.get(`uploads/${name}`, { access: ACCESS });
      if (!r || !r.stream) return false;
      res.setHeader('Content-Type', r.blob.contentType || 'application/octet-stream');
      // file names are unique, so the CDN and browsers can keep them forever
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      Readable.fromWeb(r.stream).pipe(res);
      return true;
    }
  };
}

module.exports = USE_BLOB ? blobDriver() : localDriver();

'use strict';
/**
 * Servidor de la invitación. Sin dependencias externas: solo Node.js.
 *   node server.js        (puerto 3000 por defecto; cambia con PORT=8080)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, tx, getSettings, setSetting, hashPassword, verifyPassword, DB_PATH } = require('./db');
const { GROUPS, FIELD_BY_KEY } = require('./schema');
const { resolveMapsUrl } = require('./maps');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ===================== utilidades HTTP ===================== */
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function clientIp(req) {
  if (process.env.TRUST_PROXY) {
    const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (f) return f;
  }
  return req.socket.remoteAddress || 'x';
}

const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  if (++b.n > max) throw new HttpError(429, 'Demasiados intentos. Espera un momento e inténtalo otra vez.');
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 60000).unref();

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { tooBig = true; return; } // se descarta el resto sin guardarlo
      chunks.push(c);
    });
    req.on('end', () => (tooBig ? reject(new HttpError(413, 'El archivo es demasiado grande.')) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

async function readJson(req, limit = 256 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try {
    const o = JSON.parse(buf.toString('utf8'));
    return o && typeof o === 'object' ? o : {};
  } catch (_) { throw new HttpError(400, 'Datos inválidos.'); }
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { /* cookie dañada */ } }
  }
  return out;
}

/* ===================== archivos estáticos ===================== */
function serveStatic(req, res, baseDir, rel, cacheControl) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Método no permitido');
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch (_) { throw new HttpError(400, 'Ruta inválida'); }
  if (decoded.includes('\0')) throw new HttpError(400, 'Ruta inválida');
  const abs = path.resolve(baseDir, decoded);
  if (abs !== baseDir && !abs.startsWith(baseDir + path.sep)) throw new HttpError(403, 'Prohibido');
  if (path.basename(abs).startsWith('.')) throw new HttpError(404, 'No encontrado');

  let file = abs;
  let st;
  try { st = fs.statSync(file); } catch (_) { throw new HttpError(404, 'No encontrado'); }
  if (st.isDirectory()) {
    file = path.join(abs, 'index.html');
    try { st = fs.statSync(file); } catch (_) { throw new HttpError(404, 'No encontrado'); }
  }

  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const total = st.size;
  const etag = `W/"${total}-${Math.floor(st.mtimeMs)}"`;
  const headers = {
    'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': cacheControl,
    'Last-Modified': st.mtime.toUTCString(), ETag: etag,
  };

  // Soporte de "Range": imprescindible para que el audio funcione en iPhone/Safari
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m && (m[1] !== '' || m[2] !== '')) {
      let start = m[1] === '' ? NaN : Number(m[1]);
      let end = m[2] === '' ? NaN : Number(m[2]);
      if (Number.isNaN(start)) { start = Math.max(0, total - end); end = total - 1; }
      else if (Number.isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    }
  }
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  res.writeHead(200, { ...headers, 'Content-Length': total });
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

/* ===================== sesión de administrador ===================== */
const SESSION_HOURS = 12;
function isAdmin(req) {
  const t = parseCookies(req).adm;
  if (!t) return false;
  const h = crypto.createHash('sha256').update(t).digest('hex');
  return !!db.prepare("SELECT 1 AS ok FROM admin_sessions WHERE token_hash = ? AND expires_at > datetime('now')").get(h);
}

function requireAdmin(req) {
  if (!isAdmin(req)) throw new HttpError(401, 'Sesión no válida. Inicia sesión otra vez.');
  // Protección extra contra peticiones falsas entre sitios (CSRF)
  if (req.method !== 'GET' && req.headers['x-admin'] !== '1') throw new HttpError(403, 'Petición no permitida.');
}

function isHttps(req) {
  return !!req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').includes('https');
}

/* ===================== validación de ajustes ===================== */
const SAFE_URL = /^(\/(uploads|img|audio)\/[\w.\-]+|https?:\/\/[^\s"'()<>\\]+)$/i;

function normalizeValue(field, raw) {
  let v = typeof raw === 'string' ? raw : String(raw ?? '');
  v = v.replace(/\r\n/g, '\n');
  const bad = (msg) => { throw new HttpError(400, `${field.label}: ${msg}`); };
  switch (field.type) {
    case 'text': return v.trim().slice(0, field.max || 200);
    case 'textarea': return v.trim().slice(0, 3000);
    case 'image':
    case 'audio':
      v = v.trim();
      if (v !== '' && !SAFE_URL.test(v)) bad('la dirección del archivo no es válida.');
      return v.slice(0, 500);
    case 'mapsurl':
      v = v.trim();
      if (v !== '' && !/^https?:\/\/\S+$/i.test(v) && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v)) bad('pega un enlace de Google Maps válido.');
      return v.slice(0, 1500);
    case 'coord': {
      v = v.trim();
      const n = Number(v);
      const lim = field.axis === 'lat' ? 90 : 180;
      if (v === '' || !Number.isFinite(n) || Math.abs(n) > lim) bad(`debe ser un número entre -${lim} y ${lim}.`);
      return String(n);
    }
    case 'datetime':
      v = v.trim();
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) || Number.isNaN(Date.parse(v + ':00Z'))) bad('fecha y hora no válidas.');
      return v;
    case 'tz':
      v = v.trim();
      if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(v)) bad('usa el formato -04:00.');
      return v;
    case 'range': {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n)) bad('número no válido.');
      return String(Math.min(100, Math.max(0, n)));
    }
    case 'select':
      if (!field.options.some(([val]) => val === v)) bad('opción no válida.');
      return v;
    case 'phone':
      v = v.replace(/\D/g, '');
      if (v !== '' && (v.length < 6 || v.length > 16)) bad('número no válido (con código de país, solo dígitos).');
      return v;
    default: return v.slice(0, 500);
  }
}

/* ===================== subida de archivos ===================== */
function sniff(buf) {
  if (buf.length < 12) return null;
  const s4 = buf.subarray(0, 4).toString('latin1');
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: 'image', ext: '.jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: 'image', ext: '.png' };
  if (s4 === 'GIF8') return { kind: 'image', ext: '.gif' };
  if (s4 === 'RIFF') {
    const t = buf.subarray(8, 12).toString('latin1');
    if (t === 'WEBP') return { kind: 'image', ext: '.webp' };
    if (t === 'WAVE') return { kind: 'audio', ext: '.wav' };
  }
  if (s4 === 'OggS') return { kind: 'audio', ext: '.ogg' };
  if (buf.subarray(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { kind: 'audio', ext: '.mp3' };
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (['M4A ', 'M4B ', 'mp42', 'mp41', 'isom', 'iso2', 'dash'].includes(brand)) return { kind: 'audio', ext: '.m4a' };
  }
  return null;
}

async function handleUpload(req, res, url) {
  const kind = url.searchParams.get('kind') === 'audio' ? 'audio' : 'image';
  const limit = kind === 'audio' ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
  const buf = await readBody(req, limit);
  const info = sniff(buf);
  if (!info || info.kind !== kind) {
    throw new HttpError(400, kind === 'audio'
      ? 'El archivo no es un audio válido (usa MP3, M4A, OGG o WAV).'
      : 'El archivo no es una imagen válida (usa JPG, PNG, WEBP o GIF).');
  }
  const name = crypto.randomBytes(12).toString('hex') + info.ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return json(res, 201, { url: '/uploads/' + name, size: buf.length });
}

function deleteUploadIfUnused(url) {
  if (!/^\/uploads\/[\w.\-]+$/.test(url || '')) return;
  const inCarousel = db.prepare('SELECT COUNT(*) AS n FROM carousel_images WHERE url = ?').get(url).n;
  const inSettings = db.prepare('SELECT COUNT(*) AS n FROM settings WHERE value = ?').get(url).n;
  if (inCarousel + inSettings === 0) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(url))); } catch (_) { /* ya no existía */ }
  }
}

/* ===================== estadísticas del dashboard ===================== */
function tzMinutes() {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(getSettings().countdown_tz || '-04:00');
  if (!m) return -240;
  return (Number(m[2]) * 60 + Number(m[3])) * (m[1] === '-' ? -1 : 1);
}

function dashboard() {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const views = one('SELECT COUNT(*) AS n FROM visits').n;
  const unique = one('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits').n;
  const repeat = one('SELECT COUNT(*) AS n FROM (SELECT visitor_id FROM visits GROUP BY visitor_id HAVING COUNT(*) > 1)').n;
  const openedViews = one('SELECT COUNT(*) AS n FROM visits WHERE opened = 1').n;
  const openedUnique = one('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits WHERE opened = 1').n;
  const locationUnique = one('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits WHERE location_granted = 1').n;
  const confirmed = one('SELECT COUNT(*) AS n FROM rsvps WHERE attending = 1').n;
  const declined = one('SELECT COUNT(*) AS n FROM rsvps WHERE attending = 0').n;
  const companions = one('SELECT COALESCE(SUM(companions), 0) AS n FROM rsvps WHERE attending = 1').n;
  const pending = one('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits WHERE visitor_id NOT IN (SELECT visitor_id FROM rsvps)').n;

  // Visitas de los últimos 14 días (en la zona horaria del evento)
  const off = tzMinutes();
  const mod = `${off >= 0 ? '+' : ''}${off} minutes`;
  const rows = db.prepare(
    `SELECT date(created_at, ?) AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS people
     FROM visits WHERE created_at >= datetime('now', '-16 days') GROUP BY day`
  ).all(mod);
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() + off * 60000 - i * 86400000).toISOString().slice(0, 10);
    days.push({ day: d, views: byDay[d]?.views || 0, people: byDay[d]?.people || 0 });
  }

  const recent = db.prepare(
    `SELECT v.id, v.visitor_id, v.created_at, v.opened, v.location_granted,
            (SELECT COUNT(*) FROM visits x WHERE x.visitor_id = v.visitor_id) AS total,
            EXISTS(SELECT 1 FROM rsvps r WHERE r.visitor_id = v.visitor_id) AS confirmed
     FROM visits v ORDER BY v.id DESC LIMIT 40`
  ).all().map((r) => ({ ...r, visitor: r.visitor_id.replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase() }));
  for (const r of recent) delete r.visitor_id;

  return { views, unique, repeat, reentries: views - unique, openedViews, openedUnique, locationUnique, confirmed, declined, companions, totalPeople: confirmed + companions, pending, days, recent };
}

/* ===================== rutas de la API ===================== */
async function handleApi(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  const ip = clientIp(req);

  /* ---------- API pública ---------- */
  if (m === 'GET' && p === '/api/content') {
    const s = getSettings();
    delete s.admin_password_hash;
    const carousel = db.prepare('SELECT id, url, caption FROM carousel_images ORDER BY position, id').all();
    return json(res, 200, { ...s, carousel, serverNow: Date.now() });
  }

  if (m === 'POST' && p === '/api/visit') {
    rateLimit('visit:' + ip, 60, 60000);
    const b = await readJson(req);
    if (!/^[\w-]{8,64}$/.test(String(b.visitorId || ''))) throw new HttpError(400, 'Visitante inválido');
    const r = db.prepare('INSERT INTO visits (visitor_id, user_agent) VALUES (?, ?)')
      .run(b.visitorId, String(req.headers['user-agent'] || '').slice(0, 200));
    return json(res, 201, { id: Number(r.lastInsertRowid) });
  }

  if (m === 'POST' && p === '/api/visit/event') {
    rateLimit('visitev:' + ip, 60, 60000);
    const b = await readJson(req);
    const id = Number(b.visitId);
    if (!Number.isInteger(id) || !/^[\w-]{8,64}$/.test(String(b.visitorId || ''))) throw new HttpError(400, 'Datos inválidos');
    if (b.event === 'location') {
      db.prepare('UPDATE visits SET location_granted = 1 WHERE id = ? AND visitor_id = ?').run(id, b.visitorId);
    } else if (b.event === 'open') {
      db.prepare("UPDATE visits SET opened = 1, opened_at = datetime('now') WHERE id = ? AND visitor_id = ?").run(id, b.visitorId);
    } else throw new HttpError(400, 'Evento inválido');
    return json(res, 200, { ok: true });
  }

  if (m === 'POST' && p === '/api/rsvp') {
    rateLimit('rsvp:' + ip, 15, 10 * 60000);
    const b = await readJson(req);
    const vid = String(b.visitorId || '');
    const name = String(b.fullName || '').replace(/\s+/g, ' ').trim();
    if (!/^[\w-]{8,64}$/.test(vid)) throw new HttpError(400, 'Visitante inválido');
    if (name.length < 2 || name.length > 100) throw new HttpError(400, 'Escribe tu nombre completo.');
    const attending = b.attending === true || b.attending === 1 || b.attending === '1' ? 1 : 0;
    let comp = Math.floor(Number(b.companions) || 0);
    if (!attending) comp = 0;
    if (comp < 0 || comp > 20) throw new HttpError(400, 'El número de acompañantes debe estar entre 0 y 20.');
    tx(() => {
      const prev = db.prepare('SELECT id FROM rsvps WHERE visitor_id = ? AND lower(full_name) = lower(?)').get(vid, name);
      if (prev) {
        db.prepare("UPDATE rsvps SET attending = ?, companions = ?, full_name = ?, updated_at = datetime('now') WHERE id = ?").run(attending, comp, name, prev.id);
      } else {
        if (db.prepare('SELECT COUNT(*) AS n FROM rsvps WHERE visitor_id = ?').get(vid).n >= 10) throw new HttpError(429, 'Demasiadas confirmaciones desde este dispositivo.');
        db.prepare('INSERT INTO rsvps (visitor_id, full_name, attending, companions) VALUES (?, ?, ?, ?)').run(vid, name, attending, comp);
      }
    });
    return json(res, 200, { ok: true, attending: !!attending });
  }

  /* ---------- Administración ---------- */
  if (m === 'POST' && p === '/api/admin/login') {
    rateLimit('login:' + ip, 8, 10 * 60000);
    const b = await readJson(req);
    const stored = getSettings().admin_password_hash;
    if (!verifyPassword(b.password, stored)) throw new HttpError(401, 'Contraseña incorrecta.');
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare("DELETE FROM admin_sessions WHERE expires_at < datetime('now')").run();
    db.prepare(`INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, datetime('now', '+${SESSION_HOURS} hours'))`)
      .run(crypto.createHash('sha256').update(token).digest('hex'));
    res.setHeader('Set-Cookie', `adm=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${isHttps(req) ? '; Secure' : ''}`);
    return json(res, 200, { ok: true });
  }

  if (m === 'GET' && p === '/api/admin/me') return json(res, 200, { admin: isAdmin(req) });

  if (p.startsWith('/api/admin/')) {
    requireAdmin(req);

    if (m === 'POST' && p === '/api/admin/logout') {
      const t = parseCookies(req).adm;
      if (t) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(crypto.createHash('sha256').update(t).digest('hex'));
      res.setHeader('Set-Cookie', 'adm=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return json(res, 200, { ok: true });
    }

    if (m === 'GET' && p === '/api/admin/dashboard') return json(res, 200, dashboard());

    if (m === 'GET' && p === '/api/admin/schema') {
      const s = getSettings();
      return json(res, 200, { groups: GROUPS, values: Object.fromEntries(Object.keys(FIELD_BY_KEY).map((k) => [k, s[k] ?? ''])) });
    }

    if (m === 'PUT' && p === '/api/admin/settings') {
      const body = await readJson(req, 1024 * 1024);
      const input = body.values && typeof body.values === 'object' ? body.values : {};
      const current = getSettings();
      const clean = {};
      for (const [k, v] of Object.entries(input)) {
        const f = FIELD_BY_KEY[k];
        if (!f) throw new HttpError(400, `Campo desconocido: ${k}`);
        clean[k] = normalizeValue(f, v);
      }
      const warnings = [];
      // Si cambió un enlace de Google Maps, se recalculan las coordenadas
      for (const pre of ['loc1', 'loc2']) {
        const urlKey = `${pre}_maps_url`;
        if (urlKey in clean && clean[urlKey] !== '' && clean[urlKey] !== current[urlKey]) {
          const found = await resolveMapsUrl(clean[urlKey]);
          if (found) {
            clean[`${pre}_lat`] = found.lat.toFixed(6);
            clean[`${pre}_lng`] = found.lng.toFixed(6);
          } else {
            warnings.push(`No pude obtener las coordenadas del enlace de "${pre === 'loc1' ? 'Primera' : 'Segunda'} ubicación". Revisa el enlace o escribe la latitud y longitud a mano.`);
          }
        }
      }
      const oldFiles = ['block1_image', 'block1_image2', 'block1_image3', 'block2_image', 'farewell_image', 'music_file'].filter((k) => k in clean && clean[k] !== current[k]).map((k) => current[k]);
      tx(() => { for (const [k, v] of Object.entries(clean)) setSetting(k, v); });
      oldFiles.forEach(deleteUploadIfUnused);
      const now = getSettings();
      return json(res, 200, { ok: true, warnings, values: Object.fromEntries(Object.keys(clean).map((k) => [k, now[k]])) });
    }

    if (m === 'POST' && p === '/api/admin/resolve-map') {
      const b = await readJson(req);
      const found = await resolveMapsUrl(b.url);
      return json(res, 200, found ? { ok: true, lat: found.lat, lng: found.lng } : { ok: false });
    }

    if (m === 'POST' && p === '/api/admin/upload') return handleUpload(req, res, url);

    if (m === 'GET' && p === '/api/admin/carousel') {
      return json(res, 200, { images: db.prepare('SELECT id, url FROM carousel_images ORDER BY position, id').all() });
    }
    if (m === 'POST' && p === '/api/admin/carousel') {
      const b = await readJson(req);
      const u = String(b.url || '').trim();
      if (!SAFE_URL.test(u)) throw new HttpError(400, 'Dirección de imagen no válida.');
      if (db.prepare('SELECT COUNT(*) AS n FROM carousel_images').get().n >= 60) throw new HttpError(400, 'Máximo 60 fotos en el carrusel.');
      const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM carousel_images').get().p;
      const r = db.prepare('INSERT INTO carousel_images (url, position) VALUES (?, ?)').run(u, pos);
      return json(res, 201, { id: Number(r.lastInsertRowid), url: u });
    }
    if (m === 'PUT' && p === '/api/admin/carousel/order') {
      const b = await readJson(req);
      const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isInteger) : [];
      tx(() => { const up = db.prepare('UPDATE carousel_images SET position = ? WHERE id = ?'); ids.forEach((id, i) => up.run(i + 1, id)); });
      return json(res, 200, { ok: true });
    }
    let mm;
    if (m === 'DELETE' && (mm = /^\/api\/admin\/carousel\/(\d+)$/.exec(p))) {
      const row = db.prepare('SELECT url FROM carousel_images WHERE id = ?').get(Number(mm[1]));
      db.prepare('DELETE FROM carousel_images WHERE id = ?').run(Number(mm[1]));
      if (row) deleteUploadIfUnused(row.url);
      return json(res, 200, { ok: true });
    }

    if (m === 'GET' && p === '/api/admin/rsvps') {
      const rows = db.prepare('SELECT id, full_name, attending, companions, created_at, updated_at FROM rsvps ORDER BY id DESC').all();
      return json(res, 200, { rsvps: rows });
    }
    if (m === 'DELETE' && (mm = /^\/api\/admin\/rsvps\/(\d+)$/.exec(p))) {
      db.prepare('DELETE FROM rsvps WHERE id = ?').run(Number(mm[1]));
      return json(res, 200, { ok: true });
    }

    if (m === 'POST' && p === '/api/admin/password') {
      rateLimit('pw:' + ip, 8, 10 * 60000);
      const b = await readJson(req);
      if (!verifyPassword(b.current, getSettings().admin_password_hash)) throw new HttpError(400, 'La contraseña actual no es correcta.');
      const next = String(b.next || '').trim();
      if (next.length < 6) throw new HttpError(400, 'La nueva contraseña debe tener al menos 6 caracteres.');
      setSetting('admin_password_hash', hashPassword(next));
      return json(res, 200, { ok: true });
    }
  }

  throw new HttpError(404, 'No encontrado');
}

/* ===================== servidor ===================== */
const server = http.createServer(async (req, res) => {
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'geolocation=(self)');
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p.startsWith('/api/')) return await handleApi(req, res, url);
    if (p === '/admin' || p === '/admin/') return serveStatic(req, res, PUBLIC_DIR, 'admin/index.html', 'no-cache');
    if (p.startsWith('/uploads/')) return serveStatic(req, res, UPLOADS_DIR, p.slice('/uploads/'.length), 'public, max-age=31536000, immutable');
    return serveStatic(req, res, PUBLIC_DIR, p === '/' ? 'index.html' : p.slice(1), 'no-cache');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (res.headersSent) return res.end();
    if (req.url.startsWith('/api/')) return json(res, status, { error: status === 500 ? 'Error interno del servidor.' : e.message });
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'No encontrado' : e.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Invitación lista  →  http://localhost:${PORT}`);
  console.log(`  Panel admin       →  http://localhost:${PORT}/admin   (contraseña: graduado)`);
  console.log(`  Base de datos     →  ${DB_PATH}\n`);
});

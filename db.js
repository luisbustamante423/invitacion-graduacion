'use strict';
/**
 * Base de datos: invitacion.db (SQLite)
 *
 * Tablas:
 *   settings         -> todo el contenido editable (textos, imágenes, enlaces, etc.)
 *   carousel_images  -> fotos del carrusel 3D, con su orden
 *   visits           -> una fila por cada vez que alguien entra (aunque sea la misma persona)
 *   rsvps            -> confirmaciones de asistencia
 *   admin_sessions   -> sesiones activas del panel de administración
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { FIELDS } = require('./schema');

let Database;
try {
  ({ DatabaseSync: Database } = require('node:sqlite')); // Node 22.13+ (sin instalar nada)
} catch (_) {
  try {
    Database = require('better-sqlite3'); // alternativa: npm install better-sqlite3
  } catch (e) {
    console.error(
      '\n[ERROR] No se encontró un motor SQLite.\n' +
        '  Opción A: usa Node.js 22.13 o superior (trae SQLite integrado).\n' +
        '  Opción B: ejecuta "npm install better-sqlite3" y vuelve a iniciar.\n'
    );
    process.exit(1);
  }
}

const DB_PATH = process.env.INVITACION_DB || path.join(__dirname, 'invitacion.db');
const db = new Database(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS carousel_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL,
  caption    TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id       TEXT NOT NULL,
  location_granted INTEGER NOT NULL DEFAULT 0,
  opened           INTEGER NOT NULL DEFAULT 0,
  opened_at        TEXT,
  user_agent       TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);

CREATE TABLE IF NOT EXISTS rsvps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  full_name  TEXT NOT NULL,
  attending  INTEGER NOT NULL DEFAULT 1,
  companions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rsvps_visitor ON rsvps(visitor_id);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
`);

/* ---------- utilidades ---------- */
function getSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, String(value));
}

function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* ya revertido */ }
    throw e;
  }
}

/* ---------- contraseña (se guarda con hash, no en texto plano) ---------- */
const normalizePw = (s) => String(s || '').trim().toLowerCase(); // "graduado" en cualquier combinación de mayúsculas

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(normalizePw(pw), salt, 64);
  return salt.toString('hex') + ':' + h.toString('hex');
}

function verifyPassword(pw, stored) {
  const [s, h] = String(stored || '').split(':');
  if (!s || !h) return false;
  const calc = crypto.scryptSync(normalizePw(pw), Buffer.from(s, 'hex'), 64);
  const exp = Buffer.from(h, 'hex');
  return calc.length === exp.length && crypto.timingSafeEqual(calc, exp);
}

/* ---------- datos iniciales (solo se crean si no existen) ---------- */
tx(() => {
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const f of FIELDS) ins.run(f.key, f.def ?? '');
  if (!db.prepare("SELECT 1 AS x FROM settings WHERE key = 'admin_password_hash'").get()) {
    ins.run('admin_password_hash', hashPassword('graduado'));
  }
  const n = db.prepare('SELECT COUNT(*) AS n FROM carousel_images').get().n;
  if (n === 0) {
    const add = db.prepare('INSERT INTO carousel_images (url, position) VALUES (?, ?)');
    for (let i = 1; i <= 6; i++) add.run(`/img/ejemplo-foto-${i}.svg`, i);
  }
});

module.exports = { db, tx, getSettings, setSetting, hashPassword, verifyPassword, normalizePw, DB_PATH };

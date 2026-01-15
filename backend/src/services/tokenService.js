const crypto = require('crypto');
const db = require('../db_mysql');
const { jwt } = require('../config');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// parse simple durations like '15m', '7d', '30m'
function parseDurationToMs(s) {
  if (!s || typeof s !== 'string') return 0;
  const m = s.match(/^(\d+)([smhd])$/);
  if (!m) {
    // fallback: ms in minutes
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n * 1000;
  }
  const v = Number(m[1]);
  const unit = m[2];
  switch (unit) {
    case 's': return v * 1000;
    case 'm': return v * 60 * 1000;
    case 'h': return v * 60 * 60 * 1000;
    case 'd': return v * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

async function createRefreshToken(userId) {
  const raw = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresMs = parseDurationToMs(jwt.refreshExpires || '7d');
  const expiresAt = new Date(Date.now() + expiresMs);
  await db.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked, created_at) VALUES (?,?,?,?,NOW())', [userId, tokenHash, expiresAt, 0]);
  return { refreshToken: raw, expiresAt };
}

async function verifyRefreshToken(raw) {
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const rows = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1', [tokenHash]);
  const row = rows && rows[0];
  if (!row) return null;
  if (row.revoked || new Date(row.expires_at) <= new Date()) return null;
  return row;
}

async function revokeRefreshToken(raw) {
  if (!raw) return false;
  const tokenHash = hashToken(raw);
  await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [tokenHash]);
  return true;
}

module.exports = { createRefreshToken, verifyRefreshToken, revokeRefreshToken };

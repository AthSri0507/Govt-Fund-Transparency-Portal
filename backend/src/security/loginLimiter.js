// Simple in-memory login limiter keyed by IP + email.
// For production, replace with Redis for shared state across instances.

const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

function makeKey(ip, email) {
  const e = (email || '').toLowerCase();
  return `${ip}:${e}`;
}

function now() {
  return Date.now();
}

function checkLogin(ip, email) {
  const k = makeKey(ip, email);
  const rec = attempts.get(k);
  if (!rec) return { ok: true };
  if (rec.lockUntil && now() < rec.lockUntil) {
    return { ok: false, wait: rec.lockUntil - now() };
  }
  return { ok: true };
}

function recordFailure(ip, email) {
  const k = makeKey(ip, email);
  const rec = attempts.get(k) || { count: 0 };
  rec.count = (rec.count || 0) + 1;
  rec.last = now();
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockUntil = now() + LOCK_TIME_MS;
    rec.count = 0; // reset after locking
  }
  attempts.set(k, rec);
}

function clear(ip, email) {
  const k = makeKey(ip, email);
  attempts.delete(k);
}

module.exports = { checkLogin, recordFailure, clear };

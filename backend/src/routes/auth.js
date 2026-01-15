const express = require('express');
const bcrypt = require('bcrypt');
const { sign } = require('../middleware/auth');
const db = require('../db_mysql');
const { validateBody, Joi } = require('../middleware/validate');
const loginLimiter = require('../security/loginLimiter');
const tokenService = require('../services/tokenService');
const { jwt: jwtCfg } = require('../config');

const router = express.Router();

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required()
});

const registerSchema = Joi.object({
  name: Joi.string().trim().min(3).max(255).pattern(/^[A-Za-z\s]+$/).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().trim().pattern(/^\d{10}$/).required(),
  city: Joi.string().trim().min(1).max(100).pattern(/^[A-Za-z\s]+$/).required(),
  state: Joi.string().trim().min(1).max(100).pattern(/^[A-Za-z\s]+$/).required(),
  id_type: Joi.string().valid('Aadhaar', 'Voter ID', 'Driving License').optional(),
  id_number: Joi.string().trim().min(6).max(20).optional()
}).with('id_type', 'id_number').with('id_number', 'id_type');

// POST /auth/login
router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body || {};
  try {
    // Rate-limit check (IP + email key)
    const chk = loginLimiter.checkLogin(req.ip || req.connection.remoteAddress || '0.0.0.0', email);
    if (!chk.ok) {
      const waitMs = chk.wait || 0;
      return res.status(429).json({ message: 'Too many failed attempts. Try again later.', retry_after_ms: waitMs });
    }

    const rows = await db.query('SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ?', [email]);
    const user = rows && rows[0];
    // Always respond with generic message on auth failures to avoid enumeration
    if (!user) {
      loginLimiter.recordFailure(req.ip || req.connection.remoteAddress || '0.0.0.0', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.is_active === 0) return res.status(403).json({ message: 'Account disabled' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      loginLimiter.recordFailure(req.ip || req.connection.remoteAddress || '0.0.0.0', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // success → clear any failure state
    loginLimiter.clear(req.ip || req.connection.remoteAddress || '0.0.0.0', email);
    const token = sign({ id: user.id, role: user.role, email: user.email });
    try {
      const { refreshToken, expiresAt } = await tokenService.createRefreshToken(user.id);
      return res.json({ accessToken: token, refreshToken, refresh_expires_at: expiresAt, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (e) {
      console.error('failed to create refresh token', e);
      return res.json({ accessToken: token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/register
router.post('/register', validateBody(registerSchema), async (req, res) => {
  let { name, email, password, phone, city, state, id_type, id_number } = req.body || {};
  try {
    // email uniqueness check
    const rows = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows && rows[0]) return res.status(409).json({ message: 'Email already registered' });
    // enforce password strength server-side as well (ensure at least one number and one special char)
    const pwdRe = /(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/;
    if (!pwdRe.test(password)) return res.status(400).json({ message: 'Password must be at least 8 characters and include a number and special character' });

    // normalize optional fields to NULL
    phone = phone || null;
    city = city || null;
    state = state || null;
    id_type = id_type || null;
    id_number = id_number || null;

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query('INSERT INTO users (name, email, password_hash, role, phone, city, state, id_type, id_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())', [name, email, hash, 'Citizen', phone, city, state, id_type, id_number]);
    const insertId = result && (result.insertId || (result[0] && result[0].insertId));
    const newUserRows = await db.query('SELECT id, name, email, role, phone, city, state, id_type FROM users WHERE id = ?', [insertId]);
    const user = newUserRows && newUserRows[0];
    // Note: registration still returns an access token for compatibility with existing flows
    const token = sign({ id: user.id, role: user.role, email: user.email });
    try {
      const { refreshToken, expiresAt } = await tokenService.createRefreshToken(user.id);
      return res.status(201).json({ accessToken: token, refreshToken, refresh_expires_at: expiresAt, user });
    } catch (e) {
      console.error('failed to create refresh token for new user', e);
      return res.status(201).json({ accessToken: token, user });
    }
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/refresh - exchange a refresh token for a new access token (rotates refresh token)
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken required' });
  try {
    const row = await tokenService.verifyRefreshToken(refreshToken);
    if (!row) return res.status(401).json({ message: 'Invalid or expired refresh token' });
    // load user
    const uRows = await db.query('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [row.user_id]);
    const user = uRows && uRows[0];
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    if (user.is_active === 0) return res.status(403).json({ message: 'Account disabled' });
    // rotate: revoke old token and issue a new one
    await tokenService.revokeRefreshToken(refreshToken);
    const { refreshToken: newRefresh, expiresAt } = await tokenService.createRefreshToken(user.id);
    const access = sign({ id: user.id, role: user.role, email: user.email });
    return res.json({ accessToken: access, refreshToken: newRefresh, refresh_expires_at: expiresAt });
  } catch (e) {
    console.error('refresh error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/logout - revoke a refresh token
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken required' });
  try {
    await tokenService.revokeRefreshToken(refreshToken);
    return res.json({ message: 'Logged out' });
  } catch (e) {
    console.error('logout error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

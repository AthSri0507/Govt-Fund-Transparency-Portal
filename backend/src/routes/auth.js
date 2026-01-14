const express = require('express');
const bcrypt = require('bcrypt');
const { sign } = require('../middleware/auth');
const db = require('../db_mysql');

const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email and password required' });
  try {
    const rows = await db.query('SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ?', [email]);
    const user = rows && rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (user.is_active === 0) return res.status(403).json({ message: 'Account disabled' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = sign({ id: user.id, role: user.role, email: user.email });
    return res.json({ accessToken: token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'name, email and password required' });
  try {
    const rows = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows && rows[0]) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, NOW())', [name, email, hash, 'Citizen']);
    const insertId = result && result.insertId;
    const newUserRows = await db.query('SELECT id, name, email, role FROM users WHERE id = ?', [insertId]);
    const user = newUserRows && newUserRows[0];
    const token = sign({ id: user.id, role: user.role, email: user.email });
    return res.status(201).json({ accessToken: token, user });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

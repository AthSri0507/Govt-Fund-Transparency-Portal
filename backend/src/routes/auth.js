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
    const rows = await db.query('SELECT id, name, email, password_hash, role FROM users WHERE email = ?', [email]);
    const user = rows && rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = sign({ id: user.id, role: user.role, email: user.email });
    return res.json({ accessToken: token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const jwt = require('jsonwebtoken');
const { jwt: jwtCfg } = require('../config');

function sign(payload, options = {}) {
  return jwt.sign(payload, jwtCfg.secret, { expiresIn: jwtCfg.accessExpires, ...options });
}

function verify(token) {
  return jwt.verify(token, jwtCfg.secret);
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = verify(token);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const userRole = String(req.user.role).toLowerCase();
    const allowed = allowedRoles.map(r => String(r).toLowerCase());
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { sign, verify, requireAuth, requireRole };

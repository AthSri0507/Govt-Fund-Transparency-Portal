/**
 * Biometric Authentication Routes
 * Handles face embedding enrollment and verification for officials/admins
 */

const express = require('express');
const { sign } = require('../middleware/auth');
const db = require('../db_mysql');
const { validateBody, Joi } = require('../middleware/validate');
const biometricService = require('../services/biometricService');
const tokenService = require('../services/tokenService');

const router = express.Router();

// Validation schemas
const enrollSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
  embedding: Joi.array().items(Joi.number()).min(64).max(1024).required(),
  tempToken: Joi.string().required() // Temporary token from login
});

const verifySchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
  embedding: Joi.array().items(Joi.number()).min(64).max(1024).required(),
  tempToken: Joi.string().required() // Temporary token from login
});

// In-memory store for temporary tokens (short-lived, per-session)
// In production, consider using Redis with TTL
const tempTokenStore = new Map();
const TEMP_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a temporary token for biometric flow
 */
function generateTempToken(userId, email, role) {
  const token = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TEMP_TOKEN_TTL;
  tempTokenStore.set(token, { userId, email, role, expiresAt });
  
  // Cleanup expired tokens periodically
  setTimeout(() => tempTokenStore.delete(token), TEMP_TOKEN_TTL + 1000);
  
  return token;
}

/**
 * Validate and consume temporary token
 */
function validateTempToken(token, expectedUserId) {
  const data = tempTokenStore.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    tempTokenStore.delete(token);
    return null;
  }
  if (data.userId !== expectedUserId) return null;
  return data;
}

/**
 * Consume (invalidate) a temporary token
 */
function consumeTempToken(token) {
  tempTokenStore.delete(token);
}

/**
 * POST /api/auth/biometric-enroll
 * Enroll face embedding for official/admin users
 */
router.post('/biometric-enroll', validateBody(enrollSchema), async (req, res) => {
  try {
    const { userId, embedding, tempToken } = req.body;
    
    // Validate temporary token
    const tokenData = validateTempToken(tempToken, userId);
    if (!tokenData) {
      return res.status(401).json({ message: 'Invalid or expired session. Please login again.' });
    }
    
    // Verify user exists and role requires biometric
    const rows = await db.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [userId]
    );
    const user = rows && rows[0];
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.is_active === 0) {
      return res.status(403).json({ message: 'Account disabled' });
    }
    
    // Only allow official/admin roles
    if (!biometricService.requiresBiometric(user.role)) {
      return res.status(403).json({ message: 'Biometric enrollment not required for this role' });
    }
    
    // Store the embedding
    await biometricService.storeEmbedding(userId, embedding);
    
    // Consume temp token
    consumeTempToken(tempToken);
    
    // Issue full JWT and refresh token
    const accessToken = sign({ id: user.id, role: user.role, email: user.email });
    
    try {
      const { refreshToken, expiresAt } = await tokenService.createRefreshToken(user.id);
      return res.json({
        message: 'Biometric enrollment successful',
        accessToken,
        refreshToken,
        refresh_expires_at: expiresAt,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    } catch (e) {
      console.error('Failed to create refresh token after enrollment', e);
      return res.json({
        message: 'Biometric enrollment successful',
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }
  } catch (err) {
    console.error('Biometric enrollment error:', err);
    return res.status(500).json({ message: 'Server error during enrollment' });
  }
});

/**
 * POST /api/auth/biometric-verify
 * Verify face embedding for official/admin users during login
 */
router.post('/biometric-verify', validateBody(verifySchema), async (req, res) => {
  try {
    const { userId, embedding, tempToken } = req.body;
    
    // Validate temporary token
    const tokenData = validateTempToken(tempToken, userId);
    if (!tokenData) {
      return res.status(401).json({ message: 'Invalid or expired session. Please login again.' });
    }
    
    // Verify user exists
    const rows = await db.query(
      'SELECT id, name, email, role, is_active, biometric_enabled FROM users WHERE id = ?',
      [userId]
    );
    const user = rows && rows[0];
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.is_active === 0) {
      return res.status(403).json({ message: 'Account disabled' });
    }
    
    // Only allow official/admin roles
    if (!biometricService.requiresBiometric(user.role)) {
      return res.status(403).json({ message: 'Biometric verification not required for this role' });
    }
    
    // Verify the embedding
    const result = await biometricService.verifyEmbedding(userId, embedding);
    
    if (!result.success) {
      return res.status(401).json({ 
        message: 'Biometric verification failed. Face does not match.',
        similarity: result.similarity 
      });
    }
    
    // Consume temp token
    consumeTempToken(tempToken);
    
    // Issue full JWT and refresh token
    const accessToken = sign({ id: user.id, role: user.role, email: user.email });
    
    try {
      const { refreshToken, expiresAt } = await tokenService.createRefreshToken(user.id);
      return res.json({
        message: 'Biometric verification successful',
        accessToken,
        refreshToken,
        refresh_expires_at: expiresAt,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    } catch (e) {
      console.error('Failed to create refresh token after verification', e);
      return res.json({
        message: 'Biometric verification successful',
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }
  } catch (err) {
    console.error('Biometric verification error:', err);
    return res.status(500).json({ message: 'Server error during verification' });
  }
});

// Export generateTempToken for use in auth.js login route
module.exports = router;
module.exports.generateTempToken = generateTempToken;

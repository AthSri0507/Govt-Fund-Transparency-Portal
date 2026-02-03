/**
 * Biometric Service
 * Handles face embedding storage, comparison, and verification
 * Uses cosine similarity for embedding comparison
 */

const db = require('../db_mysql');

// Similarity threshold for face matching (0.0 to 1.0)
// Higher = stricter matching, Lower = more lenient
const SIMILARITY_THRESHOLD = 0.65;

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {number[]} embedding1 - First embedding vector
 * @param {number[]} embedding2 - Second embedding vector
 * @returns {number} Similarity score between 0 and 1
 */
function cosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2) return 0;
  if (embedding1.length !== embedding2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (norm1 * norm2);
}

/**
 * Parse embedding from stored string format
 * @param {string} embeddingStr - JSON stringified embedding
 * @returns {number[]|null} Parsed embedding array or null
 */
function parseEmbedding(embeddingStr) {
  if (!embeddingStr) return null;
  try {
    const parsed = JSON.parse(embeddingStr);
    if (Array.isArray(parsed) && parsed.every(v => typeof v === 'number')) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Validate embedding format
 * @param {any} embedding - Embedding to validate
 * @returns {boolean} True if valid embedding format
 */
function validateEmbedding(embedding) {
  if (!embedding) return false;
  if (!Array.isArray(embedding)) return false;
  if (embedding.length < 64 || embedding.length > 1024) return false; // typical face embedding sizes
  return embedding.every(v => typeof v === 'number' && !isNaN(v));
}

/**
 * Store face embedding for a user
 * @param {number} userId - User ID
 * @param {number[]} embedding - Face embedding array
 * @returns {Promise<boolean>} Success status
 */
async function storeEmbedding(userId, embedding) {
  if (!validateEmbedding(embedding)) {
    throw new Error('Invalid embedding format');
  }
  
  const embeddingStr = JSON.stringify(embedding);
  await db.query(
    'UPDATE users SET face_embedding = ?, biometric_enabled = TRUE WHERE id = ?',
    [embeddingStr, userId]
  );
  return true;
}

/**
 * Get stored embedding for a user
 * @param {number} userId - User ID
 * @returns {Promise<number[]|null>} Stored embedding or null
 */
async function getStoredEmbedding(userId) {
  const rows = await db.query(
    'SELECT face_embedding FROM users WHERE id = ?',
    [userId]
  );
  if (!rows || !rows[0] || !rows[0].face_embedding) {
    return null;
  }
  return parseEmbedding(rows[0].face_embedding);
}

/**
 * Verify a face embedding against stored embedding
 * @param {number} userId - User ID
 * @param {number[]} embedding - Face embedding to verify
 * @returns {Promise<{success: boolean, similarity: number}>} Verification result
 */
async function verifyEmbedding(userId, embedding) {
  if (!validateEmbedding(embedding)) {
    return { success: false, similarity: 0, error: 'Invalid embedding format' };
  }
  
  const storedEmbedding = await getStoredEmbedding(userId);
  if (!storedEmbedding) {
    return { success: false, similarity: 0, error: 'No stored embedding found' };
  }
  
  const similarity = cosineSimilarity(embedding, storedEmbedding);
  const success = similarity >= SIMILARITY_THRESHOLD;
  
  return { success, similarity };
}

/**
 * Check if user has biometric enabled
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if biometric is enabled
 */
async function isBiometricEnabled(userId) {
  const rows = await db.query(
    'SELECT biometric_enabled FROM users WHERE id = ?',
    [userId]
  );
  if (!rows || !rows[0]) return false;
  return Boolean(rows[0].biometric_enabled);
}

/**
 * Check if user role requires biometric
 * @param {string} role - User role
 * @returns {boolean} True if role requires biometric
 */
function requiresBiometric(role) {
  const normalizedRole = String(role).toLowerCase();
  return normalizedRole === 'official' || normalizedRole === 'admin';
}

/**
 * Reset biometric data for a user (admin function)
 * Clears face embedding and disables biometric so user can re-enroll
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function resetBiometric(userId) {
  await db.query(
    'UPDATE users SET face_embedding = NULL, biometric_enabled = FALSE WHERE id = ?',
    [userId]
  );
  return true;
}

module.exports = {
  storeEmbedding,
  getStoredEmbedding,
  verifyEmbedding,
  isBiometricEnabled,
  requiresBiometric,
  resetBiometric,
  validateEmbedding,
  cosineSimilarity,
  SIMILARITY_THRESHOLD
};

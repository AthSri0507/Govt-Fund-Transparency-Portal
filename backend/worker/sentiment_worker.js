/**
 * Polling-based Sentiment Worker
 * - Runs in an infinite loop
 * - Polls MongoDB every POLL_INTERVAL_MS (10-20s) for unprocessed feedback
 * - Atomically claims exactly one record at a time (idempotent, crash-safe)
 * - Runs sentiment analysis and stores result
 * - Marks document as processed: true
 * - Logs idle, job start, and job finish events
 */

const { getMongo, closeMongo } = require('../src/db_mongo');
const db = require('../src/db_mysql');
const Sentiment = require('sentiment');

const sentiment = new Sentiment();

// Configurable polling interval (default 15 seconds, within 10-20s range)
const POLL_INTERVAL_MS = parseInt(process.env.SENTIMENT_POLL_MS, 10) || 15000;
// Stale claim timeout: if a record has been "processing" for > this time, reclaim it (crash recovery)
const STALE_CLAIM_MS = parseInt(process.env.SENTIMENT_STALE_MS, 10) || 60000;

/**
 * Atomically claim exactly one unprocessed document.
 * Uses findOneAndUpdate to guarantee no two workers process the same record.
 * Also reclaims records stuck in "processing" state for > STALE_CLAIM_MS (crash recovery).
 * @param {string|number|undefined} targetCommentId - optional specific comment to process
 * @returns {object|null} The claimed document or null if none available
 */
async function claimOne(targetCommentId) {
  const mongo = await getMongo();
  const coll = mongo.collection('raw_feedback');

  const staleThreshold = new Date(Date.now() - STALE_CLAIM_MS);

  // Filter: unprocessed OR stale "processing" claims (crash recovery)
  const filter = {
    $or: [
      { processed: { $in: [false, null] } },
      { processed: 'processing', processing_started_at: { $lt: staleThreshold } }
    ]
  };

  if (typeof targetCommentId !== 'undefined' && targetCommentId !== null) {
    filter.comment_id = Number(targetCommentId);
  }

  const res = await coll.findOneAndUpdate(
    filter,
    { $set: { processed: 'processing', processing_started_at: new Date() } },
    { returnDocument: 'after' }
  );

  // MongoDB driver v4+ returns doc directly; older versions return { value: doc }
  return res && (res.value !== undefined ? res.value : res);
}

/**
 * Process a single claimed document: run sentiment analysis, store result, mark processed.
 * @param {object} doc - The MongoDB document to process
 * @returns {boolean} true if processing succeeded
 */
async function processDocument(doc) {
  const mongo = await getMongo();
  const coll = mongo.collection('raw_feedback');

  console.log(`[WORKER] Job started: _id=${doc._id}, comment_id=${doc.comment_id}`);

  try {
    const result = sentiment.analyze(doc.text || '');
    const summary = {
      score: result.score,
      comparative: result.comparative,
      tokens: result.tokens || [],
      processed_at: new Date()
    };

    // If linked to MySQL comment, update the cached sentiment there first
    if (doc.comment_id) {
      try {
        const upd = await db.query(
          'UPDATE comments SET sentiment_summary_cached = ? WHERE id = ?',
          [JSON.stringify(summary), doc.comment_id]
        );

        // mysql2 returns OkPacket with affectedRows
        if (upd && typeof upd.affectedRows === 'number' && upd.affectedRows === 0) {
          console.warn(`[WORKER] MySQL update affected 0 rows for comment_id=${doc.comment_id}, reverting claim`);
          await coll.updateOne(
            { _id: doc._id },
            { $set: { processed: false }, $unset: { processing_started_at: '' } }
          );
          return false;
        }
      } catch (mysqlErr) {
        console.error(`[WORKER] MySQL update failed for comment_id=${doc.comment_id}:`, mysqlErr.message);
        // Revert claim so it can be retried
        try {
          await coll.updateOne(
            { _id: doc._id },
            { $set: { processed: false }, $unset: { processing_started_at: '' } }
          );
        } catch (revertErr) {
          console.error('[WORKER] Failed to revert claim after MySQL error:', revertErr.message);
        }
        return false;
      }
    }

    // Mark as processed in MongoDB (final commit)
    await coll.updateOne(
      { _id: doc._id },
      { $set: { processed: true, sentiment: summary }, $unset: { processing_started_at: '' } }
    );

    console.log(`[WORKER] Job finished: _id=${doc._id}, score=${summary.score}`);
    return true;
  } catch (err) {
    console.error(`[WORKER] Processing failed for _id=${doc._id}:`, err.message);
    // Revert claim on unexpected error
    try {
      await coll.updateOne(
        { _id: doc._id },
        { $set: { processed: false }, $unset: { processing_started_at: '' } }
      );
    } catch (revertErr) {
      console.error('[WORKER] Failed to revert claim after processing error:', revertErr.message);
    }
    return false;
  }
}

/**
 * Process exactly one unprocessed feedback record (claim + process).
 * @param {string|number|undefined} targetCommentId - optional specific comment
 * @returns {boolean} true if a record was processed
 */
async function processOne(targetCommentId) {
  const doc = await claimOne(targetCommentId);
  if (!doc) return false;
  return processDocument(doc);
}

/**
 * Main polling loop. Runs forever until process is killed.
 * - Polls every POLL_INTERVAL_MS
 * - If work exists, processes one record immediately, then continues
 * - If no work, sleeps for the interval (no CPU waste)
 * - Logs when idle
 */
async function runLoop() {
  console.log(`[WORKER] Sentiment worker started. Polling every ${POLL_INTERVAL_MS}ms, stale claim timeout ${STALE_CLAIM_MS}ms`);

  // Graceful shutdown handling
  let running = true;
  const shutdown = async (signal) => {
    console.log(`[WORKER] Received ${signal}, shutting down gracefully...`);
    running = false;
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    while (running) {
      try {
        const doc = await claimOne();

        if (!doc) {
          console.log('[WORKER] No work found, sleeping...');
          await sleep(POLL_INTERVAL_MS);
          continue;
        }

        // Process the claimed document
        await processDocument(doc);

        // Small delay before checking for more work (prevents tight loop if many records)
        await sleep(100);
      } catch (loopErr) {
        console.error('[WORKER] Loop error:', loopErr.message);
        await sleep(POLL_INTERVAL_MS);
      }
    }
  } finally {
    console.log('[WORKER] Cleaning up connections...');
    try { await closeMongo(); } catch (e) { /* ignore */ }
    try {
      const pool = db.getPool();
      if (pool && typeof pool.end === 'function') await pool.end();
    } catch (e) { /* ignore */ }
    console.log('[WORKER] Shutdown complete.');
  }
}

/**
 * Sleep helper
 * @param {number} ms - milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI entry point
if (require.main === module) {
  const once = process.argv.includes('--once');

  if (once) {
    // Single-shot mode for testing
    processOne()
      .then(did => {
        console.log(did ? '[WORKER] Processed one record.' : '[WORKER] No records to process.');
        process.exit(0);
      })
      .catch(err => {
        console.error('[WORKER] Error:', err.message);
        process.exit(1);
      });
  } else {
    // Infinite polling loop (default)
    runLoop().catch(err => {
      console.error('[WORKER] Fatal error:', err.message);
      process.exit(1);
    });
  }
}

module.exports = { processOne, runLoop, claimOne, processDocument };

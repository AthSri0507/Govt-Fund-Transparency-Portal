const { getMongo, closeMongo } = require('../src/db_mongo');
const db = require('../src/db_mysql');
console.log('WORKER DB:', require('../src/config').mysql.database);
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

async function processOne(targetCommentId) {
  const mongo = await getMongo();
  const coll = mongo.collection('raw_feedback');
  // Atomically claim one unprocessed document to avoid double-processing
  // Claim one unprocessed document atomically. Use a flexible filter and return the updated document.
  const filter = { processed: { $in: [false, null] } };
  if (typeof targetCommentId !== 'undefined' && targetCommentId !== null) {
    // ensure numeric id matches stored comment_id type
    filter.comment_id = Number(targetCommentId);
  }
  const res = await coll.findOneAndUpdate(
    filter,
    { $set: { processed: 'processing', processing_started_at: new Date() } },
    { returnDocument: 'after' }
  );
  const doc = res && res.value;
  if (!doc) return false;
  try {
    console.log('Worker: claimed raw_feedback _id=', doc._id, 'comment_id=', doc.comment_id);
    const result = sentiment.analyze(doc.text || '');
    const summary = {
      score: result.score,
      comparative: result.comparative,
      tokens: result.tokens || [],
      processed_at: new Date()
    };
    // If there's a linked comment in MySQL, write sentiment cache first.
    if (doc.comment_id) {
      try {
        const upd = await db.query('UPDATE comments SET sentiment_summary_cached = ? WHERE id = ?', [JSON.stringify(summary), doc.comment_id]);
        console.log('Worker: MySQL update result for comment_id=', doc.comment_id, 'upd=', upd);
        try {
          const verify = await db.query('SELECT sentiment_summary_cached FROM comments WHERE id = ?', [doc.comment_id]);
          console.log('Worker: post-update verification for comment_id=', doc.comment_id, 'row=', verify && verify[0]);
        } catch (vErr) {
          console.error('Worker: verification SELECT failed:', vErr);
        }
        // For mysql2, update returns an OkPacket object with affectedRows
        if (upd && typeof upd.affectedRows === 'number' && upd.affectedRows === 0) {
          console.error('MySQL update affected 0 rows for comment_id=', doc.comment_id);
          // revert processing flag so another worker can retry
          await coll.updateOne({ _id: doc._id }, { $set: { processed: false }, $unset: { processing_started_at: '' } });
          return true;
        }
      } catch (e) {
        console.error('Failed to update comments table with sentiment:', e);
        // revert processing flag so another worker can retry
        try {
          await coll.updateOne({ _id: doc._id }, { $set: { processed: false }, $unset: { processing_started_at: '' } });
        } catch (uerr) {
          console.error('Failed to revert processing flag after MySQL error:', uerr);
        }
        return true;
      }
    }

    // Only after MySQL write succeeds (or if no comment_id), mark Mongo doc processed
    await coll.updateOne({ _id: doc._id }, { $set: { processed: true, sentiment: summary }, $unset: { processing_started_at: '' } });
    return true;
  } catch (err) {
    console.error('Sentiment processing failed for', doc._id, err);
    return false;
  }
}

async function runLoop(interval = 5000) {
  console.log('Sentiment worker starting, polling every', interval, 'ms');
  try {
    while (true) {
      try {
        const did = await processOne();
        if (!did) await new Promise(r => setTimeout(r, interval));
      } catch (e) {
        console.error('Worker error:', e);
        await new Promise(r => setTimeout(r, interval));
      }
    }
  } finally {
    try { await closeMongo(); } catch (e) {}
    try { const pool = db.getPool(); if (pool && pool.end) await pool.end(); } catch (e) {}
  }
}

// CLI
if (require.main === module) {
  const once = process.argv.includes('--once');
  if (once) {
    processOne().then(() => process.exit(0)).catch(() => process.exit(1));
  } else {
    const msIndex = process.argv.findIndex(a => a === '--interval');
    const interval = msIndex >= 0 ? Number(process.argv[msIndex + 1]) || 5000 : 5000;
    runLoop(interval).catch(err => {
      console.error('Worker crashed:', err);
      process.exit(1);
    });
  }
}

module.exports = { processOne, runLoop };

(async function main() {
  try {
    // run migrations and seeds in-process to ensure DB state
    try { await require('../migrations/run-migrations')(); } catch (e) { console.error('migrations error (continuing):', e.message || e); }
    try { await require('../seeds/seed_users')(); } catch (e) { console.error('seeds error (continuing):', e.message || e); }

    // Call the insights computation directly to avoid any worker-level racing
    const { computeInsightsForProject } = require('../src/insights/insights');
    await computeInsightsForProject(1);

    const { getMongo, closeMongo } = require('../src/db_mongo');
    const mongo = await getMongo();
    const doc = await mongo.collection('feedback_insights').findOne({ project_id: 1 });
    console.log('INSIGHTS_DOC:', JSON.stringify(doc, null, 2));
    console.log('Insights computed and stored successfully.');
    await closeMongo();
  } catch (err) {
    console.error('script error', err);
    process.exitCode = 1;
  }
})();

const { computeInsightsForProject } = require('../src/insights/insights');
const db = require('../src/db_mysql');

async function runOnce(projectId) {
  if (projectId) {
    console.log('Insights worker: computing for project', projectId);
    const out = await computeInsightsForProject(projectId);
    console.log('Insights result:', out.summary_text);
    return;
  }
  // compute for all projects that have comments
  const rows = await db.query('SELECT DISTINCT project_id FROM comments');
  for (const r of rows) {
    try {
      await computeInsightsForProject(r.project_id);
      console.log('Insights worker: done project', r.project_id);
    } catch (e) {
      console.error('Insights worker error for project', r.project_id, e);
    }
  }
}

if (require.main === module) {
  const argIndex = process.argv.indexOf('--project');
  const projectId = argIndex >= 0 ? Number(process.argv[argIndex + 1]) : null;
  const once = process.argv.includes('--once');
  if (once) {
    runOnce(projectId).then(() => process.exit(0)).catch(() => process.exit(1));
  } else {
    // simple loop every minute
    (async function loop() {
      while (true) {
        try {
          await runOnce(projectId);
        } catch (e) {
          console.error('Insights worker loop error:', e);
        }
        await new Promise(r => setTimeout(r, 60000));
      }
    })();
  }

}

module.exports = { runOnce };

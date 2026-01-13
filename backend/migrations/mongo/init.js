/**
 * Initialize MongoDB collections/indexes for the project.
 * WARNING: This script will connect to the MongoDB configured in .env and create a collection
 * if it doesn't exist. Do NOT run against critical DBs without backup.
 */
const { MongoClient } = require('mongodb');
const { mongodbUri } = require('../../src/config');

async function run() {
  const client = new MongoClient(mongodbUri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db();
  const coll = db.collection('raw_feedback');
  // create indexes to support polling and project queries
  await coll.createIndex({ processed: 1 });
  await coll.createIndex({ project_id: 1 });
  console.log('Mongo init complete');
  await client.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

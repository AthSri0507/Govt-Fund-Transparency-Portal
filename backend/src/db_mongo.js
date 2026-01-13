const { MongoClient } = require('mongodb');
const { mongodbUri } = require('./config');

let client;
async function getMongo() {
  if (!client) {
    client = new MongoClient(mongodbUri, { useUnifiedTopology: true });
    await client.connect();
  }
  return client.db();
}

async function closeMongo() {
  if (client) {
    try {
      await client.close();
    } catch (e) {}
    client = null;
  }
}

module.exports = { getMongo, closeMongo };

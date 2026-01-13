/**
 * Simple migration runner: executes all .sql files in migrations/mysql in lexical order.
 * WARNING: this script will connect to the database configured in `.env`. Do NOT run
 * it against production or databases you care about. Use a dedicated DB/user as documented.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { mysql: mysqlCfg } = require('../src/config');

async function run() {
  const dir = path.join(__dirname, 'mysql');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const conn = await mysql.createConnection({
    host: mysqlCfg.host,
    port: mysqlCfg.port,
    user: mysqlCfg.user,
    password: mysqlCfg.password,
    database: mysqlCfg.database,
    multipleStatements: true
  });
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      console.log('Running', f);
      await conn.query(sql);
    }
    console.log('Migrations complete');
  } finally {
    await conn.end();
  }
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

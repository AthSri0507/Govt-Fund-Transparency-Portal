/**
 * Seed script to insert test users (admin, official, citizen).
 * WARNING: this writes to the configured MySQL database. Ensure `.env` points to a dedicated DB.
 */
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { mysql: mysqlCfg } = require('../src/config');

async function run() {
  const conn = await mysql.createConnection({
    host: mysqlCfg.host,
    port: mysqlCfg.port,
    user: mysqlCfg.user,
    password: mysqlCfg.password,
    database: mysqlCfg.database
  });
  try {
    const saltRounds = 10;
    const users = [
      { name: 'Admin User', email: 'admin@example.com', password: 'AdminPass123!', role: 'Admin' },
      { name: 'Official User', email: 'official@example.com', password: 'OfficialPass123!', role: 'Official' },
      { name: 'Citizen User', email: 'citizen@example.com', password: 'CitizenPass123!', role: 'Citizen' }
    ];
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, saltRounds);
      await conn.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
        [u.name, u.email, hash, u.role]
      );
      console.log('Seeded', u.email);
    }
    console.log('Seeding complete');
  } finally {
    await conn.end();
  }
}
module.exports = run;

if (require.main === module) {
  run().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}

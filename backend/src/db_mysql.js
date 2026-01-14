const mysql = require('mysql2/promise');
const { mysql: mysqlCfg } = require('./config');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: mysqlCfg.host,
      port: mysqlCfg.port,
      user: mysqlCfg.user,
      password: mysqlCfg.password,
      database: mysqlCfg.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    try {
      console.log('MySQL pool created (singleton)');
      console.log('Connected to DB:', mysqlCfg.database);
    } catch (e) {}
  }
  return pool;
}

module.exports = {
  query: async (sql, params) => {
    const p = getPool();
    const [rows] = await p.execute(sql, params);
    return rows;
  },
  getPool
};

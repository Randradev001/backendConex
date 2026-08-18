const sql = require('mssql');
const { buildSqlServerConfig } = require('../config/sqlServerConfig');

const config = buildSqlServerConfig();

let pool;
async function getPool() {
  if (pool) { if (!pool.connected) await pool.connect(); return pool; }
  pool = new sql.ConnectionPool(config);
  pool.on('error', (e) => console.error('SQL pool error', e));
  await pool.connect();
  return pool;
}
module.exports = { sql, getPool };

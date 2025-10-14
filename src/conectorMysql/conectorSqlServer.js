require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.SQLSERVER_HOST,            // p.ej. DESKTOP-70APVBM
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  database: process.env.SQLSERVER_DATABASE,
  port: 1433,
  options: {
    instanceName: process.env.SQLSERVER_INSTANCE, // <-- CLAVE AQUÍ
    encrypt: process.env.SQLSERVER_ENCRYPT === 'false',
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT === 'true',
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool;
async function getPool() {
  if (pool) { if (!pool.connected) await pool.connect(); return pool; }
  pool = new sql.ConnectionPool(config);
  pool.on('error', (e) => console.error('SQL pool error', e));
  await pool.connect();
  return pool;
}
module.exports = { sql, getPool };

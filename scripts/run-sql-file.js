const fs = require('fs');
const path = require('path');
const sql = require('mssql');

require('dotenv').config();

const [fileArg, databaseArg] = process.argv.slice(2);
if (!fileArg || !databaseArg) {
  console.error('Uso: node scripts/run-sql-file.js <archivo.sql> <base-datos>');
  process.exit(1);
}

const filePath = path.resolve(fileArg);
const batches = fs.readFileSync(filePath, 'utf8')
  .split(/^\s*GO\s*$/gim)
  .map((batch) => batch.trim())
  .filter(Boolean);

const config = {
  server: process.env.SQLSERVER_HOST,
  port: Number(process.env.SQLSERVER_PORT || 1433),
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  database: databaseArg,
  options: {
    instanceName: process.env.SQLSERVER_INSTANCE,
    encrypt: process.env.SQLSERVER_ENCRYPT !== 'false',
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT === 'true'
  },
  requestTimeout: 120000
};

const run = async () => {
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) {
      const result = await pool.request().query(batch);
      for (const rows of result.recordsets || []) {
        if (rows.length) console.table(rows);
      }
    }
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

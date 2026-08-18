const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { buildSqlServerConfig } = require('../src/config/sqlServerConfig');

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

const config = buildSqlServerConfig({ database: databaseArg });
config.requestTimeout = 120000;

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

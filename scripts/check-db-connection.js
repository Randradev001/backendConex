const { getPool, sql } = require('../src/conectorMysql/conectorSqlServer');

const run = async () => {
  const pool = await getPool();
  try {
    const result = await pool.request().query(`
      SELECT
        @@SERVERNAME AS serverName,
        DB_NAME() AS databaseName,
        SUSER_SNAME() AS loginName
    `);

    console.table(result.recordset);

    await pool.request()
      .input('probe', sql.Int, 1)
      .query('SELECT @probe AS probe');

    console.log('Conexion SQL Server OK.');
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

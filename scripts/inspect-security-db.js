const { getPool } = require('../src/conectorMysql/conectorSqlServer');

const inspect = async () => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      c.name AS columnName,
      t.name AS dataType,
      c.max_length AS maxLength,
      c.is_nullable AS nullable
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('USUARIOS')
    ORDER BY c.column_id;

    SELECT
      COUNT(*) AS userCount,
      MIN(LEN(UsuClave)) AS minPasswordLength,
      MAX(LEN(UsuClave)) AS maxPasswordLength,
      SUM(CASE WHEN UsuClave IS NULL OR LTRIM(RTRIM(UsuClave)) = '' THEN 1 ELSE 0 END) AS emptyPasswords
    FROM USUARIOS;
  `);

  console.log(JSON.stringify(result.recordsets, null, 2));
  await pool.close();
};

inspect().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

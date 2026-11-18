const { getPool, sql } = require('../src/conectorMysql/conectorSqlServer');
const { hashPassword } = require('../src/services/password.service');

const [, , loginArg, password] = process.argv;
const login = String(loginArg || '').trim().toUpperCase();

if (!login || !password) {
  console.error('Uso: node scripts/reset-user-password.js LOGIN NUEVA_CLAVE');
  process.exit(1);
}

if (login.length > 10) {
  console.error('El login no puede superar 10 caracteres.');
  process.exit(1);
}

const run = async () => {
  const pool = await getPool();
  const modern = await hashPassword(password);
  const transaction = new sql.Transaction(pool);

  await transaction.begin();
  try {
    const update = await new sql.Request(transaction)
      .input('login', sql.VarChar(10), login)
      .input('salt', sql.VarChar(64), modern.salt)
      .input('hash', sql.VarChar(256), modern.hash)
      .query(`
        UPDATE SEGUSUCRED
        SET PasswordSalt=@salt,
            PasswordHash=@hash,
            MigradoDesdeGX=0,
            FechaCambio=SYSUTCDATETIME()
        WHERE RTRIM(UsuLogin)=@login
      `);

    if (!update.rowsAffected[0]) {
      await new sql.Request(transaction)
        .input('login', sql.VarChar(10), login)
        .input('salt', sql.VarChar(64), modern.salt)
        .input('hash', sql.VarChar(256), modern.hash)
        .query(`
          INSERT INTO SEGUSUCRED
            (UsuLogin, PasswordSalt, PasswordHash, MigradoDesdeGX, FechaCambio)
          VALUES
            (@login, @salt, @hash, 0, SYSUTCDATETIME())
        `);
    }

    await transaction.commit();
    console.log(`Clave actualizada para ${login}.`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error('No fue posible actualizar la clave:', error.message);
  process.exit(1);
});

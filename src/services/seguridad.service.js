const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashSessionToken
} = require('./password.service');

class SecurityError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const normalizeLogin = (value) => String(value || '').trim().toUpperCase();
const clean = (value) => (typeof value === 'string' ? value.trim() : value);

const mapUser = (row) => ({
  login: clean(row.UsuLogin),
  nombre: clean(row.Usunom),
  correo: clean(row.UsuCorreo),
  cargo: clean(row.UsuCargo),
  nivelSeguridad: row.UsuNseg,
  expira: row.UsuExpira
});

const getUser = async (pool, login) => {
  const result = await pool.request()
    .input('login', sql.VarChar(10), login)
    .query(`
      SELECT TOP (1) UsuLogin, Usunom, UsuClave, UsuCorreo, UsuCargo, UsuNseg, UsuExpira
      FROM USUARIOS
      WHERE RTRIM(UsuLogin) = @login
    `);
  return result.recordset[0];
};

const verifyCredentials = async (pool, user, password) => {
  const credential = await pool.request()
    .input('login', sql.VarChar(10), clean(user.UsuLogin))
    .query(`
      SELECT PasswordSalt, PasswordHash
      FROM SEGUSUCRED
      WHERE UsuLogin = @login
    `);

  if (credential.recordset[0]) {
    return verifyPassword(password, credential.recordset[0].PasswordSalt, credential.recordset[0].PasswordHash);
  }

  // Compatibilidad de migracion: VeriUsu comparaba directamente UsuClave.
  if (password !== clean(user.UsuClave)) return false;

  const modern = await hashPassword(password);
  await pool.request()
    .input('login', sql.VarChar(10), clean(user.UsuLogin))
    .input('salt', sql.VarChar(64), modern.salt)
    .input('hash', sql.VarChar(256), modern.hash)
    .query(`
      INSERT INTO SEGUSUCRED (UsuLogin, PasswordSalt, PasswordHash, MigradoDesdeGX, FechaCambio)
      VALUES (@login, @salt, @hash, 1, SYSUTCDATETIME())
    `);
  return true;
};

const getCompanies = async (pool, login) => {
  const result = await pool.request()
    .input('login', sql.VarChar(10), login)
    .query(`
      SELECT DISTINCT A.GECODEMP AS EmpCod, COALESCE(NULLIF(RTRIM(E.EmpNom), ''), CONCAT('Empresa ', A.GECODEMP)) AS EmpNom
      FROM ASIGSIST A
      LEFT JOIN DEFEMP E ON E.EmpCod = A.GECODEMP
      WHERE RTRIM(A.AsgSisLogin) = @login
      ORDER BY A.GECODEMP
    `);
  return result.recordset.map((row) => ({ empCod: row.EmpCod, nombre: clean(row.EmpNom) }));
};

const getPermissions = async (pool, login, empCod) => {
  const request = pool.request()
    .input('login', sql.VarChar(10), login)
    .input('empCod', sql.Int, empCod);

  const [systems, modules, programs, actions] = await Promise.all([
    request.query(`SELECT SistCod FROM ASIGSIST WHERE GECODEMP=@empCod AND RTRIM(AsgSisLogin)=@login`),
    pool.request().input('login', sql.VarChar(10), login).input('empCod', sql.Int, empCod)
      .query(`SELECT SistCod, AsigMod AS Modcod FROM ASIG WHERE GECODEMP=@empCod AND RTRIM(AsigUsu)=@login`),
    pool.request().input('login', sql.VarChar(10), login).input('empCod', sql.Int, empCod)
      .query(`SELECT SistCod, Modcod, ProgCod FROM ASIGPROG WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login`),
    pool.request().input('login', sql.VarChar(10), login).input('empCod', sql.Int, empCod)
      .query(`SELECT SistCod, Modcod, ProgCod, ProgOPCod FROM ASIGPROG1 WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login`)
  ]);

  return {
    sistemas: systems.recordset,
    modulos: modules.recordset,
    programas: programs.recordset,
    acciones: actions.recordset
  };
};

const createSession = async (pool, login, empCod, remember) => {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const hours = remember ? Number(process.env.SESSION_REMEMBER_HOURS || 720) : Number(process.env.SESSION_HOURS || 12);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  await pool.request()
    .input('tokenHash', sql.VarChar(64), tokenHash)
    .input('login', sql.VarChar(10), login)
    .input('empCod', sql.Int, empCod)
    .input('expiresAt', sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO SEGSESION (TokenHash, UsuLogin, EmpCod, FechaCreacion, FechaExpiracion, UltimoUso, Revocada)
      VALUES (@tokenHash, @login, @empCod, SYSUTCDATETIME(), @expiresAt, SYSUTCDATETIME(), 0)
    `);

  return { token, expiresAt };
};

const login = async ({ login: rawLogin, password, empCod, remember = false }) => {
  const loginName = normalizeLogin(rawLogin);
  if (!loginName || !password) throw new SecurityError(400, 'VALIDATION_ERROR', 'Usuario y clave son obligatorios.');
  if (loginName.length > 10) throw new SecurityError(400, 'VALIDATION_ERROR', 'El usuario admite hasta 10 caracteres.');

  const pool = await getPool();
  const user = await getUser(pool, loginName);
  if (!user || !(await verifyCredentials(pool, user, String(password)))) {
    throw new SecurityError(401, 'INVALID_CREDENTIALS', 'Usuario o clave incorrectos.');
  }
  if (user.UsuExpira && new Date(user.UsuExpira) < new Date()) {
    throw new SecurityError(403, 'USER_EXPIRED', 'El usuario se encuentra vencido.');
  }

  const companies = await getCompanies(pool, loginName);
  if (!companies.length) throw new SecurityError(403, 'NO_COMPANY', 'El usuario no tiene empresas asignadas.');
  if (!empCod && companies.length > 1) {
    return { requiresCompany: true, companies, user: mapUser(user) };
  }

  const selected = Number(empCod || companies[0].empCod);
  const company = companies.find((item) => item.empCod === selected);
  if (!company) throw new SecurityError(403, 'INVALID_COMPANY', 'La empresa no esta asignada al usuario.');

  const session = await createSession(pool, loginName, selected, Boolean(remember));
  return {
    requiresCompany: false,
    token: session.token,
    expiresAt: session.expiresAt,
    user: mapUser(user),
    company,
    permissions: await getPermissions(pool, loginName, selected)
  };
};

const getSession = async (token) => {
  if (!token) return null;
  const pool = await getPool();
  const result = await pool.request()
    .input('tokenHash', sql.VarChar(64), hashSessionToken(token))
    .query(`
      SELECT S.TokenHash, S.UsuLogin, S.EmpCod, S.FechaExpiracion,
             U.Usunom, U.UsuCorreo, U.UsuCargo, U.UsuNseg, U.UsuExpira,
             E.EmpNom
      FROM SEGSESION S
      INNER JOIN USUARIOS U ON U.UsuLogin = S.UsuLogin
      LEFT JOIN DEFEMP E ON E.EmpCod = S.EmpCod
      WHERE S.TokenHash = @tokenHash AND S.Revocada = 0 AND S.FechaExpiracion > SYSUTCDATETIME()
    `);
  const row = result.recordset[0];
  if (!row) return null;

  await pool.request().input('tokenHash', sql.VarChar(64), row.TokenHash)
    .query('UPDATE SEGSESION SET UltimoUso=SYSUTCDATETIME() WHERE TokenHash=@tokenHash');

  return {
    tokenHash: row.TokenHash,
    expiresAt: row.FechaExpiracion,
    user: mapUser(row),
    company: { empCod: row.EmpCod, nombre: clean(row.EmpNom) || `Empresa ${row.EmpCod}` },
    permissions: await getPermissions(pool, clean(row.UsuLogin), row.EmpCod)
  };
};

const logout = async (token) => {
  if (!token) return;
  const pool = await getPool();
  await pool.request().input('tokenHash', sql.VarChar(64), hashSessionToken(token))
    .query('UPDATE SEGSESION SET Revocada=1 WHERE TokenHash=@tokenHash');
};

const changePassword = async (loginName, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword || String(newPassword).length < 8) {
    throw new SecurityError(400, 'VALIDATION_ERROR', 'La nueva clave debe tener al menos 8 caracteres.');
  }
  const pool = await getPool();
  const user = await getUser(pool, loginName);
  if (!user || !(await verifyCredentials(pool, user, String(currentPassword)))) {
    throw new SecurityError(401, 'INVALID_CREDENTIALS', 'La clave actual no es correcta.');
  }
  const modern = await hashPassword(String(newPassword));
  await pool.request()
    .input('login', sql.VarChar(10), loginName)
    .input('salt', sql.VarChar(64), modern.salt)
    .input('hash', sql.VarChar(256), modern.hash)
    .query(`
      UPDATE SEGUSUCRED
      SET PasswordSalt=@salt, PasswordHash=@hash, MigradoDesdeGX=0, FechaCambio=SYSUTCDATETIME()
      WHERE UsuLogin=@login
    `);
};

module.exports = { SecurityError, login, getSession, logout, changePassword };

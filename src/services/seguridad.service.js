const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashSessionToken
} = require('./password.service');
const { getAuthorizedMenu } = require('./seguridadMenu.service');

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

const calculateRutDv = (rutNumber) => {
  let sum = 0;
  let multiplier = 2;

  for (const digit of String(rutNumber).split('').reverse()) {
    sum += Number(digit) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  if (result === 11) return '0';
  if (result === 10) return 'K';
  return String(result);
};

const parseRut = (value) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/\./g, '').replace(/\s/g, '');
  const match = normalized.match(/^(\d{1,9})-?([0-9K])$/);
  if (!match) throw new SecurityError(400, 'VALIDATION_ERROR', 'Ingrese un RUT valido con digito verificador.');

  const rutNumber = Number(match[1]);
  const rutDv = match[2];
  if (!rutNumber || calculateRutDv(rutNumber) !== rutDv) {
    throw new SecurityError(400, 'VALIDATION_ERROR', 'El RUT ingresado no es valido.');
  }

  return { rutNumber, rutDv };
};

const mapUser = (row) => ({
  login: clean(row.UsuLogin),
  nombre: clean(row.Usunom),
  correo: clean(row.UsuCorreo),
  cargo: clean(row.UsuCargo),
  estado: row.UsuEstado,
  perfil: clean(row.UsuPerfil),
  tipo: row.UsuTipo,
  nivelSeguridad: Number(row.UsuNseg || 0),
  roles: row.roles || []
});

const getUsers = async (pool, login, empCod) => {
  const request = pool.request()
    .input('login', sql.VarChar(10), login)
  const whereCompany = empCod ? 'AND UE.GECODEMP=@empCod' : '';
  if (empCod) request.input('empCod', sql.Int, empCod);
  const result = await request.query(`
      SELECT UE.GECODEMP, U.UsuLogin, U.Usunom, U.UsuClave, U.UsuCorreo, U.UsuCargo,
             U.UsuNseg, UE.UsuEstado, UE.UsuPerfil, UE.UsuTipo, RTRIM(E.EmpNom) AS EmpNom
      FROM USUARIOS U
      INNER JOIN SEGUSUEMP UE ON UE.UsuLogin=U.UsuLogin
      INNER JOIN DEFEMP E ON E.EmpCod=UE.GECODEMP
      WHERE RTRIM(U.UsuLogin) = @login
        ${whereCompany}
    `);
  return result.recordset;
};

const getUsersByRut = async (pool, rutNumber, empCod) => {
  const request = pool.request().input('rutNumber', sql.Decimal(9, 0), rutNumber);
  const whereCompany = empCod ? 'AND UE.GECODEMP=@empCod' : '';
  if (empCod) request.input('empCod', sql.Int, empCod);

  const result = await request.query(`
    SELECT UE.GECODEMP, U.UsuLogin, U.Usunom, U.UsuClave, U.UsuRut, U.UsuDV,
           U.UsuCorreo, U.UsuCargo, U.UsuNseg, UE.UsuEstado, UE.UsuPerfil, UE.UsuTipo,
           RTRIM(E.EmpNom) AS EmpNom
    FROM USUARIOS U
    INNER JOIN SEGUSUEMP UE ON UE.UsuLogin=U.UsuLogin
    INNER JOIN DEFEMP E ON E.EmpCod=UE.GECODEMP
    WHERE U.UsuRut=@rutNumber
      ${whereCompany}
  `);
  return result.recordset;
};

const getRoles = async (pool, empCod, login) => {
  const result = await pool.request().input('empCod', sql.Int, empCod).input('login', sql.VarChar(10), login).query(`
    SELECT RTRIM(ROLCod) AS ROLCod FROM URolesPorUser
    WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login
  `);
  return result.recordset.map((row) => clean(row.ROLCod));
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

const getCompanies = async (pool, users) => {
  const companies = new Map();
  for (const user of users) {
    companies.set(Number(user.GECODEMP), { empCod: Number(user.GECODEMP), nombre: clean(user.EmpNom) });
  }
  return [...companies.values()];
};

const getPermissions = async (pool, login, empCod) => {
  const request = pool.request()
    .input('login', sql.VarChar(10), login)
    .input('empCod', sql.Int, empCod);

  const [systems, modules, programs, actions] = await Promise.all([
    request.query(`
      SELECT DISTINCT SistCod FROM (
        SELECT SistCod FROM ASIGSIST WHERE GECODEMP=@empCod AND RTRIM(AsgSisLogin)=@login
        UNION
        SELECT T.SistCod FROM URolesPorUser R INNER JOIN ASIG T
          ON T.GECODEMP=0 AND RTRIM(REPLACE(T.AsigUsu,CHAR(160),' '))=RTRIM(R.ROLCod)
        WHERE R.GECODEMP=@empCod AND RTRIM(R.UsuLogin)=@login
        UNION
        SELECT T.SistCod FROM URolesPorUser R INNER JOIN ASIGPROG T
          ON T.GECODEMP=0 AND RTRIM(T.UsuLogin)=RTRIM(R.ROLCod)
        WHERE R.GECODEMP=@empCod AND RTRIM(R.UsuLogin)=@login
      ) P
    `),
    pool.request().input('login', sql.VarChar(10), login).input('empCod', sql.Int, empCod)
      .query(`
        SELECT DISTINCT SistCod, Modcod FROM (
          SELECT SistCod, AsigMod AS Modcod FROM ASIG
          WHERE GECODEMP=@empCod AND RTRIM(REPLACE(AsigUsu,CHAR(160),' '))=@login
          UNION
          SELECT T.SistCod, T.AsigMod FROM URolesPorUser R INNER JOIN ASIG T
            ON T.GECODEMP=0 AND RTRIM(REPLACE(T.AsigUsu,CHAR(160),' '))=RTRIM(R.ROLCod)
          WHERE R.GECODEMP=@empCod AND RTRIM(R.UsuLogin)=@login
        ) P
      `),
    pool.request().input('login', sql.VarChar(10), login).input('empCod', sql.Int, empCod)
      .query(`
        SELECT DISTINCT SistCod, Modcod, ProgCod FROM (
          SELECT SistCod, Modcod, ProgCod FROM ASIGPROG
          WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login
          UNION
          SELECT T.SistCod, T.Modcod, T.ProgCod FROM URolesPorUser R INNER JOIN ASIGPROG T
            ON T.GECODEMP=0 AND RTRIM(T.UsuLogin)=RTRIM(R.ROLCod)
          WHERE R.GECODEMP=@empCod AND RTRIM(R.UsuLogin)=@login
        ) P
      `),
    pool.request().input('login', sql.VarChar(10), login).input('empCod', sql.Int, empCod)
      .query(`
        SELECT DISTINCT SistCod, Modcod, ProgCod, ProgOPCod FROM (
          SELECT SistCod, Modcod, ProgCod, ProgOPCod FROM ASIGPROG1
          WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login
          UNION
          SELECT T.SistCod, T.Modcod, T.ProgCod, T.ProgOPCod FROM URolesPorUser R INNER JOIN ASIGPROG1 T
            ON T.GECODEMP=0 AND RTRIM(T.UsuLogin)=RTRIM(R.ROLCod)
          WHERE R.GECODEMP=@empCod AND RTRIM(R.UsuLogin)=@login
        ) P
      `)
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

const login = async ({ rut, password, empCod, remember = false }) => {
  const { rutNumber } = parseRut(rut);
  if (!password) throw new SecurityError(400, 'VALIDATION_ERROR', 'RUT y clave son obligatorios.');

  const pool = await getPool();
  const candidates = await getUsersByRut(pool, rutNumber, empCod ? Number(empCod) : null);
  const validUsers = [];
  for (const candidate of candidates) {
    if (candidate.UsuEstado === 1 && await verifyCredentials(pool, candidate, String(password))) validUsers.push(candidate);
  }
  if (!validUsers.length) {
    throw new SecurityError(401, 'INVALID_CREDENTIALS', 'Usuario o clave incorrectos.');
  }

  const companies = await getCompanies(pool, validUsers);
  if (!companies.length) throw new SecurityError(403, 'NO_COMPANY', 'El usuario no tiene empresas asignadas.');
  if (!empCod && companies.length > 1) {
    return { requiresCompany: true, companies, user: mapUser(validUsers[0]) };
  }

  const selected = Number(empCod || companies[0].empCod);
  const company = companies.find((item) => item.empCod === selected);
  if (!company) throw new SecurityError(403, 'INVALID_COMPANY', 'La empresa no esta asignada al usuario.');

  const user = validUsers.find((item) => Number(item.GECODEMP) === selected);
  const loginName = normalizeLogin(user.UsuLogin);
  user.roles = await getRoles(pool, selected, loginName);
  const session = await createSession(pool, loginName, selected, Boolean(remember));
  const [permissions, menu] = await Promise.all([
    getPermissions(pool, loginName, selected),
    getAuthorizedMenu(pool, selected, loginName)
  ]);
  return {
    requiresCompany: false,
    token: session.token,
    expiresAt: session.expiresAt,
    user: mapUser(user),
    company,
    permissions,
    menu
  };
};

const getSession = async (token) => {
  if (!token) return null;
  const pool = await getPool();
  const result = await pool.request()
    .input('tokenHash', sql.VarChar(64), hashSessionToken(token))
    .query(`
      SELECT S.TokenHash, S.UsuLogin, S.EmpCod, S.FechaExpiracion,
             U.Usunom, U.UsuCorreo, U.UsuCargo, U.UsuNseg,
             UE.UsuEstado, UE.UsuPerfil, UE.UsuTipo, E.EmpNom
      FROM SEGSESION S
      INNER JOIN USUARIOS U ON U.UsuLogin=S.UsuLogin
      INNER JOIN SEGUSUEMP UE ON UE.GECODEMP=S.EmpCod AND UE.UsuLogin=S.UsuLogin
      LEFT JOIN DEFEMP E ON E.EmpCod=S.EmpCod
      WHERE S.TokenHash = @tokenHash AND S.Revocada = 0 AND S.FechaExpiracion > SYSUTCDATETIME()
    `);
  const row = result.recordset[0];
  if (!row) return null;

  await pool.request().input('tokenHash', sql.VarChar(64), row.TokenHash)
    .query('UPDATE SEGSESION SET UltimoUso=SYSUTCDATETIME() WHERE TokenHash=@tokenHash');

  row.roles = await getRoles(pool, row.EmpCod, clean(row.UsuLogin));
  const loginName = clean(row.UsuLogin);
  const [permissions, menu] = await Promise.all([
    getPermissions(pool, loginName, row.EmpCod),
    getAuthorizedMenu(pool, row.EmpCod, loginName)
  ]);
  return {
    tokenHash: row.TokenHash,
    expiresAt: row.FechaExpiracion,
    user: mapUser(row),
    company: { empCod: row.EmpCod, nombre: clean(row.EmpNom) || `Empresa ${row.EmpCod}` },
    permissions,
    menu
  };
};

const logout = async (token) => {
  if (!token) return;
  const pool = await getPool();
  await pool.request().input('tokenHash', sql.VarChar(64), hashSessionToken(token))
    .query('UPDATE SEGSESION SET Revocada=1 WHERE TokenHash=@tokenHash');
};

const changePassword = async (loginName, empCod, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword || String(newPassword).length < 8) {
    throw new SecurityError(400, 'VALIDATION_ERROR', 'La nueva clave debe tener al menos 8 caracteres.');
  }
  const pool = await getPool();
  const user = (await getUsers(pool, loginName, empCod))[0];
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

module.exports = { SecurityError, login, getSession, logout, changePassword, parseRut };

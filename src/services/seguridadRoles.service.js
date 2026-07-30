const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { SecurityError } = require('./seguridad.service');

const normalizeRole = (value) => {
  const role = String(value || '').trim().toUpperCase();
  if (!role) throw new SecurityError(400, 'VALIDATION_ERROR', 'Debe indicar el rol.');
  if (role.length > 10) throw new SecurityError(400, 'VALIDATION_ERROR', 'El rol admite hasta 10 caracteres.');
  return role;
};

const normalizeLogin = (value) => {
  const login = String(value || '').trim().toUpperCase();
  if (!login) throw new SecurityError(400, 'VALIDATION_ERROR', 'Debe indicar el usuario.');
  if (login.length > 10) throw new SecurityError(400, 'VALIDATION_ERROR', 'El usuario admite hasta 10 caracteres.');
  return login;
};

const positiveInteger = (value, label) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new SecurityError(400, 'VALIDATION_ERROR', `${label} debe ser un entero mayor que cero.`);
  }
  return number;
};

const normalizeRows = (rows, fields, label) => {
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) throw new SecurityError(400, 'VALIDATION_ERROR', `${label} debe ser una lista.`);

  const unique = new Map();
  for (const row of rows) {
    const normalized = {};
    for (const field of fields) normalized[field] = positiveInteger(row?.[field], field);
    unique.set(fields.map((field) => normalized[field]).join('|'), normalized);
  }
  return [...unique.values()];
};

const moduleKey = ({ SistCod, Modcod }) => `${SistCod}|${Modcod}`;
const programKey = ({ SistCod, Modcod, ProgCod }) => `${SistCod}|${Modcod}|${ProgCod}`;

const assertRoleExists = async (requestFactory, role) => {
  const result = await requestFactory().input('role', sql.VarChar(10), role)
    .query('SELECT TOP (1) ROLCod, ROLNombre FROM UROLES WHERE RTRIM(ROLCod)=@role');
  if (!result.recordset.length) throw new SecurityError(404, 'ROLE_NOT_FOUND', 'El rol indicado no existe.');
  return result.recordset[0];
};

const bindRoleContext = (request, { empCod, login, role, actor }) => request
  .input('empCod', sql.Int, empCod)
  .input('login', sql.VarChar(10), login)
  .input('role', sql.VarChar(10), role)
  .input('actor', sql.VarChar(10), actor);

// Los permisos de rol se unen en lectura; nunca se copian sobre los permisos GX8 directos.
const materializeRolePermissions = async () => {};

const removeRoleAssignment = async (transaction, context) => {
  const assignment = await bindRoleContext(transaction.request(), context).query(`
    SELECT TOP (1) 1 AS found
    FROM URolesPorUser
    WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login AND RTRIM(ROLCod)=@role
  `);
  if (!assignment.recordset.length) throw new SecurityError(404, 'NOT_FOUND', 'La asignacion del rol no existe.');

  await bindRoleContext(transaction.request(), context).query(`
    DELETE FROM URolesPorUser
    WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login AND RTRIM(ROLCod)=@role;
  `);
};

const getUserRoles = async (loginValue, context) => {
  const login = normalizeLogin(loginValue);
  const pool = await getPool();
  const result = await pool.request()
    .input('empCod', sql.Int, context.empCod)
    .input('login', sql.VarChar(10), login)
    .query(`
      SELECT TOP (1) RTRIM(U.UsuLogin) AS UsuLogin, RTRIM(U.Usunom) AS Usunom
      FROM USUARIOS U
      INNER JOIN SEGUSUEMP UE ON UE.UsuLogin=U.UsuLogin
      WHERE UE.GECODEMP=@empCod AND RTRIM(U.UsuLogin)=@login;

      SELECT
        RTRIM(R.ROLCod) AS ROLCod,
        RTRIM(R.ROLNombre) AS ROLNombre,
        CAST(CASE WHEN RXU.ROLCod IS NULL THEN 0 ELSE 1 END AS bit) AS assigned,
        RXU.RXUFecCrea
      FROM UROLES R
      LEFT JOIN URolesPorUser RXU
        ON RXU.GECODEMP=@empCod AND RTRIM(RXU.UsuLogin)=@login
        AND RTRIM(RXU.ROLCod)=RTRIM(R.ROLCod)
      ORDER BY R.ROLCod;

      SELECT
        (SELECT COUNT(*) FROM ASIGSIST WHERE GECODEMP=@empCod AND RTRIM(AsgSisLogin)=@login) AS systems,
        (SELECT COUNT(*) FROM ASIG WHERE GECODEMP=@empCod AND RTRIM(AsigUsu)=@login) AS modules,
        (SELECT COUNT(*) FROM ASIGPROG WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login) AS programs
    `);

  const user = result.recordsets[0]?.[0];
  if (!user) throw new SecurityError(404, 'USER_NOT_FOUND', 'El usuario no existe en la empresa autenticada.');

  const roles = result.recordsets[1] || [];
  const direct = result.recordsets[2]?.[0] || {};
  return {
    data: {
      user,
      roles,
      totals: {
        assignedRoles: roles.filter((role) => Boolean(role.assigned)).length,
        directSystems: Number(direct.systems || 0),
        directModules: Number(direct.modules || 0),
        directPrograms: Number(direct.programs || 0)
      }
    }
  };
};

const getRolePermissions = async (roleValue) => {
  const role = normalizeRole(roleValue);
  const pool = await getPool();
  const roleRow = await assertRoleExists(() => pool.request(), role);

  const [systems, modules, programs, selectedPrograms, users] = await Promise.all([
    pool.request().query('SELECT SistCod, RTRIM(SistNombre) AS SistNombre FROM SISTEMAS ORDER BY SistCod'),
    pool.request().query('SELECT SistCod, Modcod, RTRIM(ModDes) AS ModDes FROM MODULOS ORDER BY SistCod, Modcod'),
    pool.request().query('SELECT SistCod, Modcod, ProgCod, RTRIM(ProgDes) AS ProgDes FROM PROGRAM ORDER BY SistCod, Modcod, ProgCod'),
    pool.request().input('role', sql.VarChar(10), role)
      .query('SELECT SistCod, Modcod, ProgCod FROM ASIGPROG WHERE GECODEMP=0 AND RTRIM(UsuLogin)=@role ORDER BY SistCod, Modcod, ProgCod'),
    pool.request().input('role', sql.VarChar(10), role)
      .query('SELECT COUNT(*) AS total FROM URolesPorUser WHERE RTRIM(ROLCod)=@role')
  ]);

  return {
    data: {
      role: { ROLCod: String(roleRow.ROLCod).trim(), ROLNombre: String(roleRow.ROLNombre || '').trim() },
      assignedUsers: Number(users.recordset[0]?.total || 0),
      systems: systems.recordset,
      modules: modules.recordset,
      programs: programs.recordset,
      selected: {
        programs: selectedPrograms.recordset
      }
    }
  };
};

const saveRolePermissions = async (roleValue, payload, context) => {
  const role = normalizeRole(roleValue);
  const moduleMap = new Map();
  const programMap = new Map(normalizeRows(payload.programs, ['SistCod', 'Modcod', 'ProgCod'], 'Programas').map((row) => [programKey(row), row]));

  // En permisosRol16 el rol se arma con programas; sistema y modulo son su jerarquia.
  for (const program of programMap.values()) {
    const module = { SistCod: program.SistCod, Modcod: program.Modcod };
    moduleMap.set(moduleKey(module), module);
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await assertRoleExists(() => transaction.request(), role);
    const validPrograms = await transaction.request().query('SELECT SistCod, Modcod, ProgCod FROM PROGRAM');
    const validProgramKeys = new Set(validPrograms.recordset.map(programKey));

    if ([...programMap.keys()].some((key) => !validProgramKeys.has(key))) {
      throw new SecurityError(400, 'INVALID_PROGRAM', 'El rol contiene un programa que no existe.');
    }

    // ASIGPROG1 queda fuera del rol mientras no se migren los niveles de accion.
    await transaction.request().input('role', sql.VarChar(10), role).query(`
      DELETE FROM ASIGPROG1 WHERE GECODEMP=0 AND RTRIM(UsuLogin)=@role;
      DELETE FROM ASIGPROG WHERE GECODEMP=0 AND RTRIM(UsuLogin)=@role;
      DELETE FROM ASIG WHERE GECODEMP=0 AND RTRIM(AsigUsu)=@role;
    `);

    for (const module of moduleMap.values()) {
      await transaction.request().input('role', sql.VarChar(10), role).input('actor', sql.VarChar(10), context.login)
        .input('system', sql.Int, module.SistCod).input('module', sql.Int, module.Modcod)
        .query('INSERT INTO ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig) VALUES (0,@role,@system,@module,@actor)');
    }
    for (const program of programMap.values()) {
      await transaction.request().input('role', sql.VarChar(10), role).input('actor', sql.VarChar(10), context.login)
        .input('system', sql.Int, program.SistCod).input('module', sql.Int, program.Modcod).input('program', sql.Int, program.ProgCod)
        .query('INSERT INTO ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC) VALUES (0,@role,@system,@module,@program,@actor)');
    }

    const users = await transaction.request().input('role', sql.VarChar(10), role)
      .query('SELECT COUNT(*) AS total FROM URolesPorUser WHERE RTRIM(ROLCod)=@role');
    await transaction.commit();
    return {
      message: 'Programas del rol guardados correctamente.',
      data: {
        modules: moduleMap.size,
        programs: programMap.size,
        assignedUsers: Number(users.recordset[0]?.total || 0)
      }
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const reapplyRolePermissions = async (roleValue, payload, context) => {
  const role = normalizeRole(roleValue);
  const targetLogin = String(payload?.UsuLogin || '').trim().toUpperCase();
  if (targetLogin.length > 10) throw new SecurityError(400, 'VALIDATION_ERROR', 'El usuario admite hasta 10 caracteres.');

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await assertRoleExists(() => transaction.request(), role);
    const request = transaction.request().input('role', sql.VarChar(10), role);
    let where = 'RTRIM(ROLCod)=@role';
    if (targetLogin) {
      request.input('empCod', sql.Int, context.empCod).input('login', sql.VarChar(10), targetLogin);
      where += ' AND GECODEMP=@empCod AND RTRIM(UsuLogin)=@login';
    }
    const targets = await request.query(`SELECT DISTINCT GECODEMP, RTRIM(UsuLogin) AS UsuLogin FROM URolesPorUser WHERE ${where} ORDER BY GECODEMP, UsuLogin`);
    if (targetLogin && !targets.recordset.length) {
      throw new SecurityError(404, 'ROLE_ASSIGNMENT_NOT_FOUND', 'El usuario no tiene asignado este rol.');
    }

    await transaction.commit();
    return {
      message: targets.recordset.length === 1
        ? 'Los permisos efectivos del usuario ya reflejan la plantilla vigente.'
        : `La plantilla vigente aplica a ${targets.recordset.length} usuarios.`,
      data: { updatedUsers: targets.recordset.length }
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  materializeRolePermissions,
  removeRoleAssignment,
  getUserRoles,
  getRolePermissions,
  saveRolePermissions,
  reapplyRolePermissions
};

const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { SecurityError } = require('./seguridad.service');
const {
  positiveInteger,
  normalizeLogin,
  normalizeAssignment,
  buildAssignmentPlan,
  programKey
} = require('./seguridadAsignaciones.rules');

const assertUserInCompany = async (requestFactory, login, empCod) => {
  const result = await requestFactory()
    .input('login', sql.VarChar(10), login)
    .input('empCod', sql.Int, empCod)
    .query(`
      SELECT TOP (1) RTRIM(U.UsuLogin) AS UsuLogin, RTRIM(U.Usunom) AS Usunom
      FROM USUARIOS U
      INNER JOIN SEGUSUEMP UE ON UE.UsuLogin=U.UsuLogin
      WHERE UE.GECODEMP=@empCod AND RTRIM(U.UsuLogin)=@login
    `);
  if (!result.recordset.length) {
    throw new SecurityError(404, 'USER_NOT_FOUND', 'El usuario no existe en la empresa autenticada.');
  }
  return result.recordset[0];
};

const assertSystemExists = async (requestFactory, systemCode) => {
  const result = await requestFactory().input('system', sql.Int, systemCode).query(`
    SELECT TOP (1) SistCod, RTRIM(SistNombre) AS SistNombre
    FROM SISTEMAS
    WHERE SistCod=@system
  `);
  if (!result.recordset.length) throw new SecurityError(404, 'SYSTEM_NOT_FOUND', 'El sistema indicado no existe.');
  return result.recordset[0];
};

const getUserAssignments = async (loginValue, context) => {
  const login = normalizeLogin(loginValue);
  const pool = await getPool();
  const [user, systems] = await Promise.all([
    assertUserInCompany(() => pool.request(), login, context.empCod),
    pool.request()
      .input('login', sql.VarChar(10), login)
      .input('empCod', sql.Int, context.empCod)
      .query(`
        SELECT
          S.SistCod,
          RTRIM(S.SistNombre) AS SistNombre,
          CAST(CASE WHEN SS.SistCod IS NOT NULL OR ISNULL(MA.assignedModules,0) > 0 OR ISNULL(PA.assignedPrograms,0) > 0 THEN 1 ELSE 0 END AS bit) AS assigned,
          ISNULL(MA.assignedModules,0) AS assignedModules,
          ISNULL(PA.assignedPrograms,0) AS assignedPrograms,
          ISNULL(MC.totalModules,0) AS totalModules,
          ISNULL(PC.totalPrograms,0) AS totalPrograms
        FROM SISTEMAS S
        LEFT JOIN (
          SELECT DISTINCT SistCod
          FROM ASIGSIST
          WHERE GECODEMP=@empCod AND RTRIM(AsgSisLogin)=@login
        ) SS ON SS.SistCod=S.SistCod
        LEFT JOIN (
          SELECT SistCod, COUNT(*) AS assignedModules
          FROM ASIG
          WHERE GECODEMP=@empCod AND RTRIM(AsigUsu)=@login
          GROUP BY SistCod
        ) MA ON MA.SistCod=S.SistCod
        LEFT JOIN (
          SELECT SistCod, COUNT(*) AS assignedPrograms
          FROM ASIGPROG
          WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login
          GROUP BY SistCod
        ) PA ON PA.SistCod=S.SistCod
        LEFT JOIN (SELECT SistCod, COUNT(*) AS totalModules FROM MODULOS GROUP BY SistCod) MC ON MC.SistCod=S.SistCod
        LEFT JOIN (SELECT SistCod, COUNT(*) AS totalPrograms FROM PROGRAM GROUP BY SistCod) PC ON PC.SistCod=S.SistCod
        ORDER BY S.SistCod
      `)
  ]);

  const rows = systems.recordset;
  return {
    data: {
      user,
      systems: rows,
      totals: {
        systems: rows.filter((row) => Boolean(row.assigned)).length,
        modules: rows.reduce((total, row) => total + Number(row.assignedModules || 0), 0),
        programs: rows.reduce((total, row) => total + Number(row.assignedPrograms || 0), 0)
      }
    }
  };
};

const getSystemAssignments = async (loginValue, systemValue, context) => {
  const login = normalizeLogin(loginValue);
  const systemCode = positiveInteger(systemValue, 'SistCod');
  const pool = await getPool();
  const [user, system, modules, programs] = await Promise.all([
    assertUserInCompany(() => pool.request(), login, context.empCod),
    assertSystemExists(() => pool.request(), systemCode),
    pool.request()
      .input('login', sql.VarChar(10), login)
      .input('empCod', sql.Int, context.empCod)
      .input('system', sql.Int, systemCode)
      .query(`
        SELECT
          M.SistCod,
          M.Modcod,
          RTRIM(M.ModDes) AS ModDes,
          CAST(CASE WHEN A.AsigMod IS NOT NULL OR ISNULL(AP.assignedPrograms,0) > 0 THEN 1 ELSE 0 END AS bit) AS assigned,
          ISNULL(AP.assignedPrograms,0) AS assignedPrograms,
          ISNULL(PC.totalPrograms,0) AS totalPrograms
        FROM MODULOS M
        LEFT JOIN ASIG A
          ON A.GECODEMP=@empCod AND RTRIM(A.AsigUsu)=@login
          AND A.SistCod=M.SistCod AND A.AsigMod=M.Modcod
        LEFT JOIN (
          SELECT Modcod, COUNT(*) AS assignedPrograms
          FROM ASIGPROG
          WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login AND SistCod=@system
          GROUP BY Modcod
        ) AP ON AP.Modcod=M.Modcod
        LEFT JOIN (
          SELECT Modcod, COUNT(*) AS totalPrograms
          FROM PROGRAM
          WHERE SistCod=@system
          GROUP BY Modcod
        ) PC ON PC.Modcod=M.Modcod
        WHERE M.SistCod=@system
        ORDER BY M.Modcod
      `),
    pool.request()
      .input('login', sql.VarChar(10), login)
      .input('empCod', sql.Int, context.empCod)
      .input('system', sql.Int, systemCode)
      .query(`
        SELECT
          P.SistCod,
          P.Modcod,
          P.ProgCod,
          RTRIM(P.ProgDes) AS ProgDes,
          CAST(CASE WHEN AP.ProgCod IS NULL THEN 0 ELSE 1 END AS bit) AS assigned
        FROM PROGRAM P
        LEFT JOIN ASIGPROG AP
          ON AP.GECODEMP=@empCod AND RTRIM(AP.UsuLogin)=@login
          AND AP.SistCod=P.SistCod AND AP.Modcod=P.Modcod AND AP.ProgCod=P.ProgCod
        WHERE P.SistCod=@system
        ORDER BY P.Modcod, P.ProgCod
      `)
  ]);

  const systemAssignment = await pool.request()
    .input('login', sql.VarChar(10), login)
    .input('empCod', sql.Int, context.empCod)
    .input('system', sql.Int, systemCode)
    .query(`
      SELECT TOP (1) 1 AS assigned
      FROM ASIGSIST
      WHERE GECODEMP=@empCod AND RTRIM(AsgSisLogin)=@login AND SistCod=@system
    `);

  const moduleRows = modules.recordset;
  const programRows = programs.recordset;
  const assigned = Boolean(systemAssignment.recordset.length)
    || moduleRows.some((row) => Boolean(row.assigned))
    || programRows.some((row) => Boolean(row.assigned));

  return {
    data: {
      user,
      system: { ...system, assigned },
      modules: moduleRows,
      programs: programRows,
      totals: {
        modules: moduleRows.filter((row) => Boolean(row.assigned)).length,
        programs: programRows.filter((row) => Boolean(row.assigned)).length
      }
    }
  };
};

const validateTarget = (target, validModules, validPrograms) => {
  const moduleKeys = new Set(validModules.map((row) => Number(row.Modcod)));
  const programKeys = new Set(validPrograms.map(programKey));

  for (const module of target.modules) {
    if (!moduleKeys.has(module.Modcod)) {
      throw new SecurityError(400, 'INVALID_MODULE', `El modulo ${module.Modcod} no pertenece al sistema.`);
    }
    for (const ProgCod of module.programs) {
      if (!programKeys.has(programKey({ Modcod: module.Modcod, ProgCod }))) {
        throw new SecurityError(400, 'INVALID_PROGRAM', `El programa ${ProgCod} no pertenece al modulo ${module.Modcod}.`);
      }
    }
  }
};

const saveSystemAssignments = async (loginValue, systemValue, payload, context) => {
  const login = normalizeLogin(loginValue);
  const systemCode = positiveInteger(systemValue, 'SistCod');
  const target = normalizeAssignment(payload);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  let committed = false;

  try {
    await assertUserInCompany(() => transaction.request(), login, context.empCod);
    await assertSystemExists(() => transaction.request(), systemCode);

    const validModules = await transaction.request().input('system', sql.Int, systemCode)
      .query('SELECT Modcod FROM MODULOS WHERE SistCod=@system');
    const validPrograms = await transaction.request().input('system', sql.Int, systemCode)
      .query('SELECT Modcod, ProgCod FROM PROGRAM WHERE SistCod=@system');
    const currentSystem = await transaction.request()
      .input('empCod', sql.Int, context.empCod).input('login', sql.VarChar(10), login).input('system', sql.Int, systemCode)
      .query('SELECT TOP (1) 1 AS assigned FROM ASIGSIST WHERE GECODEMP=@empCod AND RTRIM(AsgSisLogin)=@login AND SistCod=@system');
    const currentModules = await transaction.request()
      .input('empCod', sql.Int, context.empCod).input('login', sql.VarChar(10), login).input('system', sql.Int, systemCode)
      .query('SELECT AsigMod AS Modcod FROM ASIG WHERE GECODEMP=@empCod AND RTRIM(AsigUsu)=@login AND SistCod=@system');
    const currentPrograms = await transaction.request()
      .input('empCod', sql.Int, context.empCod).input('login', sql.VarChar(10), login).input('system', sql.Int, systemCode)
      .query('SELECT Modcod, ProgCod FROM ASIGPROG WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login AND SistCod=@system');

    validateTarget(target, validModules.recordset, validPrograms.recordset);
    const plan = buildAssignmentPlan({
      assigned: Boolean(currentSystem.recordset.length),
      modules: currentModules.recordset,
      programs: currentPrograms.recordset
    }, target);

    for (const program of plan.removePrograms) {
      const request = transaction.request()
        .input('empCod', sql.Int, context.empCod)
        .input('login', sql.VarChar(10), login)
        .input('system', sql.Int, systemCode)
        .input('module', sql.Int, program.Modcod)
        .input('program', sql.Int, program.ProgCod);
      // ASIGPROG1 es el nivel dos de la transaccion GX y debe desaparecer con su programa padre.
      await request.query(`
        DELETE FROM ASIGPROG1
        WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login AND SistCod=@system AND Modcod=@module AND ProgCod=@program;
        DELETE FROM ASIGPROG
        WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login AND SistCod=@system AND Modcod=@module AND ProgCod=@program;
      `);
    }

    for (const Modcod of plan.removeModules) {
      await transaction.request()
        .input('empCod', sql.Int, context.empCod)
        .input('login', sql.VarChar(10), login)
        .input('system', sql.Int, systemCode)
        .input('module', sql.Int, Modcod)
        .query('DELETE FROM ASIG WHERE GECODEMP=@empCod AND RTRIM(AsigUsu)=@login AND SistCod=@system AND AsigMod=@module');
    }

    if (!target.assigned) {
      await transaction.request()
        .input('empCod', sql.Int, context.empCod)
        .input('login', sql.VarChar(10), login)
        .input('system', sql.Int, systemCode)
        .query('DELETE FROM ASIGSIST WHERE GECODEMP=@empCod AND RTRIM(AsgSisLogin)=@login AND SistCod=@system');
    } else {
      if (plan.assignSystem) {
        await transaction.request()
          .input('empCod', sql.Int, context.empCod)
          .input('login', sql.VarChar(10), login)
          .input('system', sql.Int, systemCode)
          .query('INSERT INTO ASIGSIST (GECODEMP,AsgSisLogin,SistCod) VALUES (@empCod,@login,@system)');
      }

      for (const Modcod of plan.addModules) {
        await transaction.request()
          .input('empCod', sql.Int, context.empCod)
          .input('login', sql.VarChar(10), login)
          .input('actor', sql.VarChar(10), context.login)
          .input('system', sql.Int, systemCode)
          .input('module', sql.Int, Modcod)
          .query('INSERT INTO ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig) VALUES (@empCod,@login,@system,@module,@actor)');
      }

      for (const program of plan.addPrograms) {
        await transaction.request()
          .input('empCod', sql.Int, context.empCod)
          .input('login', sql.VarChar(10), login)
          .input('actor', sql.VarChar(10), context.login)
          .input('system', sql.Int, systemCode)
          .input('module', sql.Int, program.Modcod)
          .input('program', sql.Int, program.ProgCod)
          .query('INSERT INTO ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC) VALUES (@empCod,@login,@system,@module,@program,@actor)');
      }
    }

    await transaction.commit();
    committed = true;
  } catch (error) {
    if (!committed) await transaction.rollback();
    throw error;
  }

  const result = await getSystemAssignments(login, systemCode, context);
  return {
    message: target.assigned ? 'Asignaciones del sistema guardadas correctamente.' : 'Sistema y asignaciones directas quitados correctamente.',
    data: result.data
  };
};

module.exports = { getUserAssignments, getSystemAssignments, saveSystemAssignments };

const assert = require('assert');

const { getConfiguredDatabase } = require('../src/config/sqlServerConfig');
const { getPool, sql } = require('../src/conectorMysql/conectorSqlServer');
const { hashPassword } = require('../src/services/password.service');
const security = require('../src/services/seguridad.service');
const securityCatalogs = require('../src/services/seguridadCatalogos.service');
const securityRoles = require('../src/services/seguridadRoles.service');
const masters = require('../src/controllers/maestrosController');

const LOGIN = 'MIGTEST';
const CRUD_LOGIN = 'MIGCRUD';
const ROLE = 'MIGROLE';
const RUT = 90123456;
const CRUD_RUT = 90234567;
const PASSWORD = 'ConexTest#2026';
const CLIENT_CODE = 99998;
const AGENT_CODE = 998;
const CONSIGNEE_CODE = 998;
const MASTER_RUT = 90345678;

const calculateRutDv = (rut) => {
  let value = rut;
  let factor = 2;
  let sum = 0;
  while (value > 0) {
    sum += (value % 10) * factor;
    value = Math.floor(value / 10);
    factor = factor === 7 ? 2 : factor + 1;
  }
  const result = 11 - (sum % 11);
  if (result === 11) return '0';
  if (result === 10) return 'K';
  return String(result);
};

const cleanup = async (pool) => {
  await pool.request()
    .input('login', sql.VarChar(10), LOGIN)
    .input('crudLogin', sql.VarChar(10), CRUD_LOGIN)
    .input('role', sql.VarChar(10), ROLE)
    .query(`
    DELETE FROM SEGSESION WHERE RTRIM(UsuLogin) IN (@login,@crudLogin);
    DELETE FROM URolesPorUser WHERE RTRIM(UsuLogin) IN (@login,@crudLogin);
    DELETE FROM ASIGPROG1 WHERE GECODEMP=1 AND RTRIM(UsuLogin) IN (@login,@crudLogin);
    DELETE FROM ASIGPROG WHERE GECODEMP=1 AND RTRIM(UsuLogin) IN (@login,@crudLogin);
    DELETE FROM ASIG WHERE GECODEMP=1 AND RTRIM(REPLACE(AsigUsu,CHAR(160),' ')) IN (@login,@crudLogin);
    DELETE FROM ASIGSIST WHERE GECODEMP=1 AND RTRIM(AsgSisLogin) IN (@login,@crudLogin);
    DELETE FROM SEGUSUCRED WHERE RTRIM(UsuLogin) IN (@login,@crudLogin);
    DELETE FROM SEGUSUEMP WHERE RTRIM(UsuLogin) IN (@login,@crudLogin);
    DELETE FROM USUARIOS WHERE RTRIM(UsuLogin) IN (@login,@crudLogin);
    DELETE FROM ASIGPROG1 WHERE GECODEMP=0 AND RTRIM(UsuLogin)=@role;
    DELETE FROM ASIGPROG WHERE GECODEMP=0 AND RTRIM(UsuLogin)=@role;
    DELETE FROM ASIG WHERE GECODEMP=0 AND RTRIM(AsigUsu)=@role;
    DELETE FROM UROLES WHERE RTRIM(ROLCod)=@role;
    DELETE FROM CALIBRES WHERE EmpCod=1 AND Calibre IN ('MIGCALA','MIGCALB');
    DELETE FROM ENVCAT1 WHERE EmpCod=1 AND Catcod=32000;
    DELETE FROM PRODUCTORES1 WHERE EmpCod=1 AND CuarCod=999999;
    DELETE FROM CLIENTES WHERE EmpCod=1 AND CliCod=${CLIENT_CODE};
    DELETE FROM AGENTES WHERE EmpCod=1 AND AgeCod=${AGENT_CODE};
    DELETE FROM CONSIG WHERE EmpCod=1 AND ConsCod=${CONSIGNEE_CODE};
    `);
};

const captureResponse = () => {
  const state = { status: 200, body: null };
  return {
    state,
    response: {
      status(code) { state.status = code; return this; },
      json(body) { state.body = body; return body; }
    }
  };
};

const run = async () => {
  assert.strictEqual(getConfiguredDatabase(), 'CONEX_MIGRACION', 'La verificacion solo se ejecuta sobre CONEX_MIGRACION.');
  const pool = await getPool();
  const rutDv = calculateRutDv(RUT);

  await cleanup(pool);
  try {
    const modern = await hashPassword(PASSWORD);
    await pool.request()
      .input('login', sql.VarChar(10), LOGIN)
      .input('rut', sql.Int, RUT)
      .input('dv', sql.VarChar(1), rutDv)
      .input('salt', sql.VarChar(64), modern.salt)
      .input('hash', sql.VarChar(256), modern.hash)
      .query(`
        INSERT INTO USUARIOS (UsuLogin,UsuClave,UsuRut,UsuDV,Usunom,UsuCargo,usucrea,UsuNseg,UsuCorreo)
        VALUES (@login,NULL,@rut,@dv,'Usuario verificacion','QA','MIGRACION',999,'qa@conex.local');
        INSERT INTO SEGUSUEMP (GECODEMP,UsuLogin,UsuEstado,UsuPerfil,UsuTipo,EsPrincipal,UsuCrea)
        VALUES (1,@login,1,'ADMIN',1,1,'MIGRACION');
        INSERT INTO SEGUSUCRED (UsuLogin,PasswordSalt,PasswordHash,MigradoDesdeGX,FechaCambio)
        VALUES (@login,@salt,@hash,0,SYSUTCDATETIME());
        INSERT INTO URolesPorUser (GECODEMP,UsuLogin,ROLCod,RXUFecCrea)
        VALUES (1,@login,'ADMINFULL',SYSUTCDATETIME());
        INSERT INTO ASIGSIST (GECODEMP,AsgSisLogin,SistCod) VALUES (1,@login,1);
        INSERT INTO ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig) VALUES (1,@login,1,1,'MIGRACION');
        INSERT INTO ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC) VALUES (1,@login,1,1,1,'MIGRACION');
      `);

    const login = await security.login({ rut: `${RUT}-${rutDv}`, password: PASSWORD });
    assert.strictEqual(login.company.empCod, 1);
    assert(login.user.roles.includes('ADMINFULL'));
    assert(login.permissions.programas.some((item) => Number(item.ProgCod) === 1));
    assert(login.menu.length > 0);

    const session = await security.getSession(login.token);
    assert(session);
    assert.strictEqual(session.user.login.trim(), LOGIN);

    const userCatalog = await securityCatalogs.list('usuarios', {}, { empCod: 1, login: LOGIN });
    assert(userCatalog.data.some((item) => item.UsuLogin.trim() === LOGIN));

    const crudDv = calculateRutDv(CRUD_RUT);
    await securityCatalogs.insert('usuarios', {
      UsuLogin: CRUD_LOGIN,
      UsuClave: PASSWORD,
      UsuRut: CRUD_RUT,
      UsuDV: crudDv,
      Usunom: 'Usuario CRUD',
      UsuCargo: 'QA',
      UsuCorreo: 'crud@conex.local',
      UsuEstado: 1,
      UsuTipo: 0
    }, { empCod: 1, login: LOGIN });
    await securityCatalogs.update('usuarios', {
      UsuLogin: CRUD_LOGIN,
      Usunom: 'Usuario CRUD actualizado'
    }, { empCod: 1, login: LOGIN });
    const crudCatalog = await securityCatalogs.list('usuarios', { q: CRUD_LOGIN }, { empCod: 1, login: LOGIN });
    assert.strictEqual(crudCatalog.data[0].Usunom.trim(), 'Usuario CRUD actualizado');
    await securityCatalogs.remove('usuarios', { UsuLogin: CRUD_LOGIN }, { empCod: 1, login: LOGIN });

    const candidate = await pool.request().query(`
      SELECT TOP (1) SistCod, Modcod, ProgCod
      FROM PROGRAM
      WHERE NOT (SistCod=1 AND Modcod=1 AND ProgCod=1)
      ORDER BY SistCod, Modcod, ProgCod
    `);
    assert(candidate.recordset[0], 'La base debe contener al menos dos programas para verificar roles.');
    const roleProgram = candidate.recordset[0];

    await securityCatalogs.insert('roles', {
      ROLCod: ROLE,
      ROLNombre: 'Rol verificacion'
    }, { empCod: 1, login: LOGIN });
    await securityRoles.saveRolePermissions(ROLE, { programs: [roleProgram] }, { empCod: 1, login: LOGIN });
    await securityCatalogs.insert('rolesUsuarios', {
      UsuLogin: LOGIN,
      ROLCod: ROLE
    }, { empCod: 1, login: LOGIN });

    const roleDefinition = await securityRoles.getRolePermissions(ROLE);
    assert.strictEqual(roleDefinition.data.selected.programs.length, 1);
    assert.strictEqual(Object.hasOwn(roleDefinition.data, 'actions'), false);

    const roleStorage = await pool.request().input('role', sql.VarChar(10), ROLE).query(`
      SELECT
        (SELECT COUNT(*) FROM ASIG WHERE GECODEMP=0 AND RTRIM(AsigUsu)=@role) AS Modulos,
        (SELECT COUNT(*) FROM ASIGPROG WHERE GECODEMP=0 AND RTRIM(UsuLogin)=@role) AS Programas,
        (SELECT COUNT(*) FROM ASIGPROG1 WHERE GECODEMP=0 AND RTRIM(UsuLogin)=@role) AS Acciones
    `);
    assert.strictEqual(roleStorage.recordset[0].Modulos, 1);
    assert.strictEqual(roleStorage.recordset[0].Programas, 1);
    assert.strictEqual(roleStorage.recordset[0].Acciones, 0);

    const sessionWithRole = await security.getSession(login.token);
    assert(sessionWithRole.user.roles.includes(ROLE));
    assert(sessionWithRole.permissions.programas.some((item) =>
      Number(item.SistCod) === Number(roleProgram.SistCod)
      && Number(item.Modcod) === Number(roleProgram.Modcod)
      && Number(item.ProgCod) === Number(roleProgram.ProgCod)
    ));

    const capture = captureResponse();
    await masters.listEspecies({ context: { empCod: 1, login: LOGIN }, query: {} }, capture.response);
    assert.strictEqual(capture.state.status, 200);
    assert.strictEqual(capture.state.body.success, true);
    assert(capture.state.body.count > 0);

    const masterRutDv = calculateRutDv(MASTER_RUT);
    const invalidAgentCapture = captureResponse();
    await masters.insertAgente({
      context: { empCod: 1, login: LOGIN },
      body: { AgeCod: AGENT_CODE, Agerut: MASTER_RUT, AgeDv: masterRutDv === '0' ? '1' : '0', AgeNom: 'MIG AGENTE' }
    }, invalidAgentCapture.response);
    assert.strictEqual(invalidAgentCapture.state.status, 400);

    const clientInsertCapture = captureResponse();
    await masters.insertCliente({
      context: { empCod: 1, login: LOGIN },
      body: {
        EmpCod: 2,
        CliCod: CLIENT_CODE,
        Clirut: MASTER_RUT,
        CliDv: masterRutDv,
        CliNom: 'MIG CLIENTE',
        Clidirec: 'DIRECCION QA'
      }
    }, clientInsertCapture.response);
    assert.strictEqual(clientInsertCapture.state.status, 201);
    assert.strictEqual(clientInsertCapture.state.body.key.EmpCod, 1);

    const clientUpdateCapture = captureResponse();
    await masters.updateCliente({
      context: { empCod: 1, login: LOGIN },
      body: { CliCod: CLIENT_CODE, CliNom: 'MIG CLIENTE EDIT' }
    }, clientUpdateCapture.response);
    assert.strictEqual(clientUpdateCapture.state.status, 200);
    assert.strictEqual(clientUpdateCapture.state.body.rowsAffected, 1);

    const clientListCapture = captureResponse();
    await masters.listClientes({
      context: { empCod: 1, login: LOGIN },
      query: { CliNom: 'CLIENTE EDIT' }
    }, clientListCapture.response);
    assert.strictEqual(clientListCapture.state.status, 200);
    assert(clientListCapture.state.body.data.some((row) => Number(row.CliCod) === CLIENT_CODE));

    const agentInsertCapture = captureResponse();
    await masters.insertAgente({
      context: { empCod: 1, login: LOGIN },
      body: { AgeCod: AGENT_CODE, Agerut: MASTER_RUT, AgeDv: masterRutDv, AgeNom: 'MIG AGENTE', AgecodMP: 12345 }
    }, agentInsertCapture.response);
    assert.strictEqual(agentInsertCapture.state.status, 201);

    const agentUpdateCapture = captureResponse();
    await masters.updateAgente({
      context: { empCod: 1, login: LOGIN },
      body: { AgeCod: AGENT_CODE, AgeNom: 'MIG AGENTE EDIT' }
    }, agentUpdateCapture.response);
    assert.strictEqual(agentUpdateCapture.state.status, 200);
    assert.strictEqual(agentUpdateCapture.state.body.rowsAffected, 1);

    const consigneeInsertCapture = captureResponse();
    await masters.insertConsignatario({
      context: { empCod: 1, login: LOGIN },
      body: { ConsCod: CONSIGNEE_CODE, ConsNom: 'MIG CONSIGNATARIO' }
    }, consigneeInsertCapture.response);
    assert.strictEqual(consigneeInsertCapture.state.status, 201);

    const consigneeUpdateCapture = captureResponse();
    await masters.updateConsignatario({
      context: { empCod: 1, login: LOGIN },
      body: { ConsCod: CONSIGNEE_CODE, ConsNom: 'MIG CONSIGNATARIO EDIT' }
    }, consigneeUpdateCapture.response);
    assert.strictEqual(consigneeUpdateCapture.state.status, 200);
    assert.strictEqual(consigneeUpdateCapture.state.body.rowsAffected, 1);

    for (const [handler, body] of [
      [masters.deleteCliente, { CliCod: CLIENT_CODE }],
      [masters.deleteAgente, { AgeCod: AGENT_CODE }],
      [masters.deleteConsignatario, { ConsCod: CONSIGNEE_CODE }]
    ]) {
      const deleteCapture = captureResponse();
      await handler({ context: { empCod: 1, login: LOGIN }, body }, deleteCapture.response);
      assert.strictEqual(deleteCapture.state.status, 200);
      assert.strictEqual(deleteCapture.state.body.rowsAffected, 1);
    }

    const speciesCode = capture.state.body.data[0].Especod;
    const varietiesCapture = captureResponse();
    await masters.listVariedades({ context: { empCod: 1, login: LOGIN }, query: { Especod: speciesCode } }, varietiesCapture.response);
    assert.strictEqual(varietiesCapture.state.status, 200);
    assert(varietiesCapture.state.body.data.length > 0);
    assert(varietiesCapture.state.body.data.every((row) => Number(row.Especod) === Number(speciesCode)));

    const calibresCapture = captureResponse();
    await masters.listCalibres({ context: { empCod: 1, login: LOGIN }, query: { Especod: speciesCode } }, calibresCapture.response);
    assert.strictEqual(calibresCapture.state.status, 200);
    assert(calibresCapture.state.body.data.length > 0);
    assert(calibresCapture.state.body.data.every((row) => Number(row.Especod) === Number(speciesCode)));

    const insertCalibreCapture = captureResponse();
    await masters.insertCalibre({
      context: { empCod: 1, login: LOGIN },
      body: { Especod: speciesCode, Calibre: 'MIGCALA' }
    }, insertCalibreCapture.response);
    assert.strictEqual(insertCalibreCapture.state.status, 201);

    const updateCalibreCapture = captureResponse();
    await masters.updateCalibre({
      context: { empCod: 1, login: LOGIN },
      body: { Especod: speciesCode, Calibre: 'MIGCALB', OriginalCalibre: 'MIGCALA' }
    }, updateCalibreCapture.response);
    assert.strictEqual(updateCalibreCapture.state.status, 200);
    assert.strictEqual(updateCalibreCapture.state.body.rowsAffected, 1);

    const renamedCalibre = await pool.request().input('species', sql.Int, speciesCode).query(`
      SELECT
        (SELECT COUNT(*) FROM CALIBRES WHERE EmpCod=1 AND Especod=@species AND Calibre='MIGCALA') AS Anterior,
        (SELECT COUNT(*) FROM CALIBRES WHERE EmpCod=1 AND Especod=@species AND Calibre='MIGCALB') AS Actual
    `);
    assert.strictEqual(renamedCalibre.recordset[0].Anterior, 0);
    assert.strictEqual(renamedCalibre.recordset[0].Actual, 1);

    const deleteCalibreCapture = captureResponse();
    await masters.deleteCalibre({
      context: { empCod: 1, login: LOGIN },
      body: { Especod: speciesCode, Calibre: 'MIGCALB' }
    }, deleteCalibreCapture.response);
    assert.strictEqual(deleteCalibreCapture.state.status, 200);

    const envasesCapture = captureResponse();
    await masters.listEnvases({ context: { empCod: 1, login: LOGIN }, query: {} }, envasesCapture.response);
    assert.strictEqual(envasesCapture.state.status, 200);
    assert(envasesCapture.state.body.data.length > 0);
    const envCode = envasesCapture.state.body.data[0].EnvCod;

    const categoriesCapture = captureResponse();
    await masters.listCategoriasEnvase({ context: { empCod: 1, login: LOGIN }, query: { EnvCod: envCode } }, categoriesCapture.response);
    assert.strictEqual(categoriesCapture.state.status, 200);
    assert(categoriesCapture.state.body.data.every((row) => Number(row.EnvCod) === Number(envCode)));

    const insertCategoryCapture = captureResponse();
    await masters.insertCategoriaEnvase({
      context: { empCod: 1, login: LOGIN },
      body: { EnvCod: envCode, Catcod: 32000, CatNom: 'MIG CAT', CatNomC: 'MIG' }
    }, insertCategoryCapture.response);
    assert.strictEqual(insertCategoryCapture.state.status, 201);

    const updateCategoryCapture = captureResponse();
    await masters.updateCategoriaEnvase({
      context: { empCod: 1, login: LOGIN },
      body: { EnvCod: envCode, Catcod: 32000, CatNom: 'MIG CAT EDIT', CatNomC: 'MIGE' }
    }, updateCategoryCapture.response);
    assert.strictEqual(updateCategoryCapture.state.status, 200);
    assert.strictEqual(updateCategoryCapture.state.body.rowsAffected, 1);

    const deleteCategoryCapture = captureResponse();
    await masters.deleteCategoriaEnvase({
      context: { empCod: 1, login: LOGIN },
      body: { EnvCod: envCode, Catcod: 32000 }
    }, deleteCategoryCapture.response);
    assert.strictEqual(deleteCategoryCapture.state.status, 200);

    const producersCapture = captureResponse();
    await masters.listProductores({ context: { empCod: 1, login: LOGIN }, query: {} }, producersCapture.response);
    assert.strictEqual(producersCapture.state.status, 200);
    assert(producersCapture.state.body.data.length > 0);
    const producerCode = String(producersCapture.state.body.data[0].ProdCod).trim();

    const quartersCapture = captureResponse();
    await masters.listCuarteles({ context: { empCod: 1, login: LOGIN }, query: { ProdCod: producerCode } }, quartersCapture.response);
    assert.strictEqual(quartersCapture.state.status, 200);
    assert(quartersCapture.state.body.data.every((row) => String(row.ProdCod).trim() === producerCode));

    const insertQuarterCapture = captureResponse();
    await masters.insertCuartel({
      context: { empCod: 1, login: LOGIN },
      body: { ProdCod: producerCode, CuarCod: 999999, CuarNom: 'MIG CUARTEL', CuarnomC: 'MIG' }
    }, insertQuarterCapture.response);
    assert.strictEqual(insertQuarterCapture.state.status, 201);

    const updateQuarterCapture = captureResponse();
    await masters.updateCuartel({
      context: { empCod: 1, login: LOGIN },
      body: { ProdCod: producerCode, CuarCod: 999999, CuarNom: 'MIG CUARTEL EDIT', CuarnomC: 'MIGE' }
    }, updateQuarterCapture.response);
    assert.strictEqual(updateQuarterCapture.state.status, 200);
    assert.strictEqual(updateQuarterCapture.state.body.rowsAffected, 1);

    const deleteQuarterCapture = captureResponse();
    await masters.deleteCuartel({
      context: { empCod: 1, login: LOGIN },
      body: { ProdCod: producerCode, CuarCod: 999999 }
    }, deleteQuarterCapture.response);
    assert.strictEqual(deleteQuarterCapture.state.status, 200);

    await security.logout(login.token);
    console.log('Verificacion CONEX: login, sesion, menu, Seguridad y maestros OK.');
  } finally {
    await cleanup(pool);
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

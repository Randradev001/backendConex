const assert = require('node:assert/strict');
const { getPool, sql } = require('../src/conectorMysql/conectorSqlServer');
const { reapplyRolePermissions } = require('../src/services/seguridadRoles.service');

// Ejecuta el SQL del servicio exclusivamente contra tablas temporales.
const temporarySql = (statement) => statement.replace(
  /\b(ASIGPROG1|ASIGPROG|ASIGSIST|ASIG|URolesPorUser|UROLES)\b/g,
  '#$1'
);

const withFixture = async (pool, verify) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await transaction.request().batch(`
      SELECT TOP (0) * INTO #ASIGSIST FROM dbo.ASIGSIST;
      SELECT TOP (0) * INTO #ASIG FROM dbo.ASIG;
      SELECT TOP (0) * INTO #ASIGPROG FROM dbo.ASIGPROG;
      SELECT TOP (0) * INTO #ASIGPROG1 FROM dbo.ASIGPROG1;
      ALTER TABLE #ASIGSIST ADD PRIMARY KEY (GECODEMP, AsgSisLogin, SistCod);
      ALTER TABLE #ASIG ADD PRIMARY KEY (GECODEMP, AsigUsu, SistCod, AsigMod);
      ALTER TABLE #ASIGPROG ADD PRIMARY KEY (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod);
      ALTER TABLE #ASIGPROG1 ADD PRIMARY KEY (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgOPCod);
      CREATE TABLE #UROLES (ROLCod varchar(10) PRIMARY KEY, ROLNombre varchar(50));
      CREATE TABLE #URolesPorUser (GECODEMP int, UsuLogin varchar(10), ROLCod varchar(10));

      INSERT #UROLES VALUES ('PRUEBA', 'Rol de prueba'), ('OTRO', 'Otro rol');
      INSERT #URolesPorUser VALUES (1,'USR_A','PRUEBA'), (2,'USR_B','PRUEBA'),
        (1,'USR_A','OTRO'), (1,'AJENO','OTRO');
      INSERT #ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
      VALUES (0,'PRUEBA',110,2,2,'ORIGINAL'), (0,'PRUEBA',110,2,3,'ORIGINAL'),
        (0,'PRUEBA',100,15,20,'ORIGINAL'), (0,'OTRO',9,8,7,'ORIGINAL'),
        (1,'USR_A',9,8,7,'ORIGINAL'), (2,'USR_B',9,8,7,'ORIGINAL'),
        (2,'USR_A',9,8,7,'ORIGINAL'), (1,'AJENO',9,8,7,'ORIGINAL');
      INSERT #ASIGSIST (GECODEMP,AsgSisLogin,SistCod)
        SELECT DISTINCT GECODEMP,UsuLogin,SistCod FROM #ASIGPROG;
      INSERT #ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
        SELECT DISTINCT GECODEMP,UsuLogin,SistCod,Modcod,'ORIGINAL' FROM #ASIGPROG;
      INSERT #ASIGPROG1 (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgOPCod)
      VALUES (0,'PRUEBA',110,2,2,1), (0,'PRUEBA',999,1,1,1),
        (1,'USR_A',9,8,7,9), (2,'USR_B',9,8,7,9), (1,'AJENO',9,8,7,9);
    `);

    const snapshot = async () => {
      const result = await transaction.request().query(`
        SELECT * FROM #ASIGSIST ORDER BY GECODEMP,AsgSisLogin,SistCod;
        SELECT * FROM #ASIG ORDER BY GECODEMP,AsigUsu,SistCod,AsigMod;
        SELECT * FROM #ASIGPROG ORDER BY GECODEMP,UsuLogin,SistCod,Modcod,ProgCod;
        SELECT * FROM #ASIGPROG1 ORDER BY GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgOPCod;
        SELECT * FROM #URolesPorUser ORDER BY GECODEMP,UsuLogin,ROLCod;
      `);
      return result.recordsets.map((rows) => rows.map((row) => Object.fromEntries(
        Object.entries(row).map(([name, value]) => [name, typeof value === 'string' ? value.trimEnd() : value])
      )));
    };
    const options = (failUser) => ({
      poolProvider: async () => pool,
      transactionFactory: () => ({
        begin: async () => transaction.request().query('SAVE TRANSACTION RoleRebuildTest'),
        commit: async () => {},
        rollback: async () => transaction.request().query('ROLLBACK TRANSACTION RoleRebuildTest'),
        request() {
          const request = transaction.request();
          const values = {};
          return {
            input(name, type, value) {
              values[name] = value;
              request.input(name, type, value);
              return this;
            },
            async query(statement) {
              const result = await request.query(temporarySql(statement));
              if (values.login === failUser && /DELETE FROM/.test(statement)) {
                throw new Error('Fallo simulado despues de reemplazar el segundo usuario');
              }
              return result;
            }
          };
        }
      })
    });
    await verify({ transaction, snapshot, options });
  } finally {
    await transaction.rollback();
  }
};

const run = async () => {
  const pool = await getPool();
  const context = { empCod: 1, login: 'ADMIN' };
  try {
    await withFixture(pool, async ({ snapshot, options }) => {
      const before = await snapshot();
      const result = await reapplyRolePermissions('PRUEBA', {}, context, options());
      const after = await snapshot();
      assert.equal(result.data.updatedUsers, 2);
      for (const [company, user] of [[1, 'USR_A'], [2, 'USR_B']]) {
        const programs = after[2].filter((row) => row.GECODEMP === company && row.UsuLogin === user);
        assert.deepEqual(programs.map(({ SistCod, Modcod, ProgCod }) => [SistCod, Modcod, ProgCod]),
          [[100,15,20], [110,2,2], [110,2,3]]);
        assert.ok(programs.every((row) => row.ProgUsuC === 'ADMIN'));
        assert.equal(after[0].filter((row) => row.GECODEMP === company && row.AsgSisLogin === user).length, 2);
        assert.equal(after[1].filter((row) => row.GECODEMP === company && row.AsigUsu === user).length, 2);
        assert.deepEqual(after[3].filter((row) => row.GECODEMP === company && row.UsuLogin === user)
          .map(({ SistCod, ProgOPCod }) => [SistCod, ProgOPCod]), [[110,1]]);
      }
      const isUnchanged = (row) => row.GECODEMP === 0 || row.UsuLogin === 'AJENO'
        || row.AsgSisLogin === 'AJENO' || row.AsigUsu === 'AJENO'
        || (row.GECODEMP === 2 && [row.UsuLogin,row.AsgSisLogin,row.AsigUsu].includes('USR_A'));
      for (let index = 0; index < 4; index++) {
        assert.deepEqual(after[index].filter(isUnchanged), before[index].filter(isUnchanged));
      }
      assert.deepEqual(after[4], before[4]);
    });
    console.log('OK: reemplazo completo, jerarquia sin duplicados, otras empresas/usuarios y plantillas intactas.');

    await withFixture(pool, async ({ snapshot, options }) => {
      const before = await snapshot();
      await reapplyRolePermissions('PRUEBA', { UsuLogin: 'USR_A', GECODEMP: 2 }, context, options());
      const after = await snapshot();
      for (let index = 0; index < 4; index++) {
        assert.deepEqual(after[index].filter((row) => row.GECODEMP !== 1), before[index].filter((row) => row.GECODEMP !== 1));
      }
      assert.equal(after[2].filter((row) => row.GECODEMP === 1 && row.UsuLogin === 'USR_A').length, 3);
    });
    console.log('OK: reaplicacion individual respeta la empresa de sesion.');

    await withFixture(pool, async ({ transaction, snapshot, options }) => {
      await transaction.request().query("DELETE FROM #ASIGPROG1 WHERE GECODEMP=0 AND UsuLogin='PRUEBA'; DELETE FROM #ASIGPROG WHERE GECODEMP=0 AND UsuLogin='PRUEBA';");
      await reapplyRolePermissions('PRUEBA', {}, context, options());
      const after = await snapshot();
      for (let index = 0; index < 4; index++) {
        assert.equal(after[index].filter((row) => (row.GECODEMP === 1 && [row.UsuLogin,row.AsgSisLogin,row.AsigUsu].includes('USR_A'))
          || (row.GECODEMP === 2 && [row.UsuLogin,row.AsgSisLogin,row.AsigUsu].includes('USR_B'))).length, 0);
      }
    });
    console.log('OK: rol vacio deja sin permisos a sus usuarios.');

    await withFixture(pool, async ({ snapshot, options }) => {
      const before = await snapshot();
      await assert.rejects(reapplyRolePermissions('PRUEBA', {}, context, options('USR_B')), /Fallo simulado/);
      assert.deepEqual(await snapshot(), before);
    });
    console.log('OK: fallo en el segundo usuario revierte los cambios de todos.');
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

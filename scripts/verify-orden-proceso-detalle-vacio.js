const assert = require('node:assert/strict');
const { getPool, sql } = require('../src/conectorMysql/conectorSqlServer');
const { update } = require('../src/services/ordenesProceso.service');

// La orden real se lee como muestra; todas las escrituras se redirigen a tablas temporales.
const run = async () => {
  const [company, season, order] = process.argv.slice(2);
  assert.ok(Number.isInteger(Number(company)) && Number(company) > 0 && season && Number.isInteger(Number(order)) && Number(order) > 0,
    'Uso: node scripts/verify-orden-proceso-detalle-vacio.js <empresa> <temporada> <orden>');
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      await transaction.request().batch(`
        SELECT TOP (0) * INTO #ORDPROC FROM dbo.ORDPROC;
        SELECT TOP (0) * INTO #ORDPROC1 FROM dbo.ORDPROC1;
        SELECT TOP (0) * INTO #MOVFRUT FROM dbo.MOVFRUT;
        SELECT TOP (0) * INTO #MOVFRUT1 FROM dbo.MOVFRUT1;
      `);
      await transaction.request().input('company', sql.SmallInt, Number(company))
        .input('season', sql.Char(9), season).input('order', sql.Decimal(10, 0), Number(order)).query(`
          INSERT #ORDPROC SELECT * FROM dbo.ORDPROC WHERE EmpCod=@company AND TempCod=@season AND Ordpnum=@order;
          INSERT #ORDPROC1 SELECT * FROM dbo.ORDPROC1 WHERE EmpCod=@company AND TempCod=@season AND Ordpnum=@order;
          INSERT #MOVFRUT SELECT * FROM dbo.MOVFRUT WHERE EmpCod=@company AND TempCod=@season AND OriCod=90 AND MovTDoc=90 AND MovNGuia=@order;
          INSERT #MOVFRUT1 SELECT * FROM dbo.MOVFRUT1 WHERE EmpCod=@company AND TempCod=@season AND OriCod=90 AND MovTDoc=90 AND MovNGuia=@order;
        `);
      const before = (await transaction.request().query('SELECT *, CONVERT(char(10),OrdpFecha,23) AS ProcessDate FROM #ORDPROC')).recordset[0];
      assert.ok(before, 'La orden indicada debe existir.');
      assert.equal(Number(before.OrdpEstado), 0, 'Use una orden ingresada como muestra.');
      const options = {
        poolProvider: async () => pool,
        transactionFactory: () => ({
          begin: async () => transaction.request().query('SAVE TRANSACTION EmptyOrderDetailTest'),
          commit: async () => {},
          rollback: async () => transaction.request().query('ROLLBACK TRANSACTION EmptyOrderDetailTest')
        }),
        requestFactory: () => {
          const request = transaction.request();
          return {
            input(name, type, value) { request.input(name, type, value); return this; },
            query: (statement) => request.query(statement.replace(/\b(ORDPROC1|ORDPROC|MOVFRUT1|MOVFRUT)\b/g, '#$1'))
          };
        }
      };
      const result = await update(Number(company), 'TEST', season, Number(order), {
        process: { date: before.ProcessDate, variety: before.VarCod, exporter: before.ExpCod, label: before.OrdpCodEti.trim() },
        lots: []
      }, options);
      assert.deepEqual(result.totals, { env: 0, kilos: 0 });
      assert.deepEqual(result.details, []);
      const after = await transaction.request().query(`
        SELECT * FROM #ORDPROC;
        SELECT COUNT(*) AS total FROM #ORDPROC1;
        SELECT COUNT(*) AS total FROM #MOVFRUT;
        SELECT COUNT(*) AS total FROM #MOVFRUT1;
      `);
      const header = after.recordsets[0][0];
      for (const name of ['EmpCod', 'TempCod', 'Ordpnum', 'ProdCod', 'Especod', 'VarCod', 'ExpCod', 'OrdpCodEti', 'OrdpEstado']) {
        assert.equal(header[name], before[name], `La cabecera debe conservar ${name}.`);
      }
      assert.equal(Number(header.OrdpTotEnv), 0);
      assert.equal(Number(header.OrdpTotKilos), 0);
      assert.ok(after.recordsets.slice(1).every((rows) => rows[0].total === 0));
      console.log('OK: guardado sin detalles, cabecera conservada, totales cero y salida por proceso eliminada en tablas temporales.');
    } finally {
      await transaction.rollback();
    }
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

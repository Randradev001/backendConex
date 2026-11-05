const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OrdenesProcesoError,
  buildQuadrature,
  finalizeQuadrature,
  getProcessReport,
  normalizeCommercialRows,
  reopenQuadrature,
  setProcessActive
} = require('../src/services/ordenesProceso.service');

test('arma el informe GX con cabecera, lotes, detalle agrupado y rendimiento', async () => {
  let statement = '';
  const recordsets = [
    [{ TempCod: '2017-2018 ', Ordpnum: 174, OrdpEstado: 5, OrdpTotKilos: 1000, OrdpKilosExp: 850 }],
    [{ Ordp1Nlote: 12001 }, { Ordp1Nlote: 12002 }],
    [{ EnvNom: 'CAJA', CatNom: 'CAT 1', Calibre: 'XL', Cajas: 80, Kilos: 850 }],
    [{ EmpNom: 'CONEX', EmpRut: 12345678, EmpDV: '9' }]
  ];
  const poolProvider = async () => ({
    request: () => ({
      input() { return this; },
      async query(queryText) { statement = queryText; return { recordsets }; }
    })
  });

  const result = await getProcessReport(1, '2017-2018', 174, { poolProvider });

  assert.equal(result.order.Ordpnum, 174);
  assert.equal(result.lots.length, 2);
  assert.equal(result.detail[0].Calibre, 'XL');
  assert.equal(result.company.EmpNom, 'CONEX');
  assert.equal(result.yieldPercentage, 85);
  assert.match(statement, /LEFT JOIN ENVCAT e/);
  assert.match(statement, /LEFT JOIN ENVCAT1 k/);
  assert.doesNotMatch(statement, /c\.EnvNom|c\.CatNom/);
});

test('limita el informe de proceso a ordenes finalizadas o cuadradas', async () => {
  const poolProvider = async () => ({
    request: () => ({
      input() { return this; },
      async query() { return { recordsets: [[{ Ordpnum: 174, OrdpEstado: 1 }], [], [], []] }; }
    })
  });

  await assert.rejects(
    getProcessReport(1, '2017-2018', 174, { poolProvider }),
    (error) => error instanceof OrdenesProcesoError && error.code === 'PROCESS_REPORT_NOT_AVAILABLE'
  );
});

const dependencies = (responses) => {
  const queries = [];
  const transaction = {
    begin: async () => {},
    commit: async () => { transaction.committed = true; },
    rollback: async () => { transaction.rolledBack = true; }
  };
  return {
    queries,
    transaction,
    options: {
      poolProvider: async () => ({}),
      transactionFactory: () => transaction,
      requestFactory: () => ({
        input() { return this; },
        async query(statement) {
          queries.push(statement);
          return responses.shift();
        }
      })
    }
  };
};

test('inicia una orden ingresada y registra los datos de apertura', async () => {
  const deps = dependencies([{ recordset: [{ OrdpEstado: 0 }] }, { recordset: [] }, { recordset: [] }]);
  const result = await setProcessActive(1, 'OPERADOR', '2017-2018', 25, true, deps.options);

  assert.equal(result.state, 1);
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[2], /OrdpEstado=1/);
  assert.match(deps.queries[2], /OrdpFecA=GETDATE\(\)/);
  assert.match(deps.queries[2], /OrdpLoginA=@Login/);
});

test('rechaza iniciar una segunda orden activa en la misma temporada', async () => {
  const deps = dependencies([{ recordset: [{ OrdpEstado: 0 }] }, { recordset: [{ Ordpnum: 24 }] }]);

  await assert.rejects(
    setProcessActive(1, 'OPERADOR', '2017-2018', 25, true, deps.options),
    (error) => error instanceof OrdenesProcesoError && error.code === 'ACTIVE_ORDER_EXISTS'
  );
  assert.equal(deps.transaction.rolledBack, true);
});

test('reactiva una orden terminada para continuar la lectura de cajas', async () => {
  const deps = dependencies([{ recordset: [{ OrdpEstado: 4 }] }, { recordset: [] }, { recordset: [] }]);
  const result = await setProcessActive(1, 'OPERADOR', '2017-2018', 25, true, deps.options);

  assert.equal(result.state, 1);
  assert.equal(result.message, 'Orden 25 reactivada para continuar la lectura.');
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[2], /OrdpEstado=1/);
  assert.match(deps.queries[2], /OrdpHHFinP=NULL/);
});

test('desactiva solamente una orden activa y registra el termino', async () => {
  const deps = dependencies([{ recordset: [{ OrdpEstado: 1 }] }, { recordset: [] }]);
  const result = await setProcessActive(1, 'OPERADOR', '2017-2018', 25, false, deps.options);

  assert.equal(result.state, 0);
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[1], /OrdpEstado=0/);
  assert.match(deps.queries[1], /OrdpHHFinP=GETDATE\(\)/);
});

test('calcula la cuadratura comparando kilos procesados, leidos y comerciales', () => {
  const result = buildQuadrature(
    {
      TempCod: '2017-2018 ', Ordpnum: 174, OrdpEstado: 4, Especod: 1, EspeNom: 'CEREZA ', VarCod: 2,
      VarNom: 'BING ', ProdCod: '000007', ProdNom: 'PRODUCTOR', OrdpTotEnv: 1000, OrdpTotKilos: 10000,
      OrdpEnvCom: 20, OrdpKilosCom: 250, OrdpDesecho: 0
    },
    [{ speciesCode: 1, speciesName: 'CEREZA', varietyCode: 2, varietyName: 'BING', readContainers: 900, readKilos: 8500, records: 900 }]
  );

  assert.equal(result.totals.readContainers, 900);
  assert.equal(result.totals.readKilos, 8500);
  assert.equal(result.totals.projectedWasteKilos, 1250);
  assert.equal(result.totals.containerDifference, 80);
  assert.equal(result.totals.yieldPercentage, 85);
  assert.equal(result.status, 'pending');
  assert.equal(result.species[0].kilosPercentage, 100);
});

test('marca sobrelectura cuando las salidas superan los kilos procesados', () => {
  const result = buildQuadrature(
    { TempCod: '2017-2018', Ordpnum: 175, OrdpEstado: 4, OrdpTotEnv: 10, OrdpTotKilos: 100, OrdpEnvCom: 0, OrdpKilosCom: 0 },
    [{ speciesCode: 1, readContainers: 11, readKilos: 101, records: 11 }]
  );

  assert.equal(result.status, 'over-reading');
  assert.equal(result.totals.projectedWasteKilos, -1);
});

test('advierte lecturas con kilos negativos sin ocultar el dato de origen', () => {
  const result = buildQuadrature(
    { TempCod: '2017-2018', Ordpnum: 176, OrdpEstado: 4, OrdpTotEnv: 10, OrdpTotKilos: 100 },
    [{ speciesCode: 1, readContainers: 1, readKilos: -0.8, records: 1 }]
  );

  assert.equal(result.status, 'invalid-readings');
  assert.equal(result.totals.readKilos, -0.8);
});

test('normaliza lineas comerciales y rechaza clasificaciones repetidas', () => {
  const rows = normalizeCommercialRows([
    { speciesCode: 1, varietyCode: 2, containers: 3, kilos: '12,34', observation: ' Comercial ' }
  ]);
  assert.deepEqual(rows, [{ speciesCode: 1, varietyCode: 2, containers: 3, kilos: 12.34, observation: 'Comercial' }]);

  assert.throws(
    () => normalizeCommercialRows([
      { speciesCode: 1, varietyCode: 2, containers: 1, kilos: 10 },
      { speciesCode: 1, varietyCode: 2, containers: 2, kilos: 20 }
    ]),
    (error) => error instanceof OrdenesProcesoError && error.code === 'DUPLICATE_COMMERCIAL_LINE'
  );
  assert.throws(
    () => normalizeCommercialRows([{ speciesCode: 1, varietyCode: 3, containers: 1, kilos: 12.345 }]),
    (error) => error instanceof OrdenesProcesoError && error.code === 'VALIDATION_ERROR'
  );
});

test('cuadra una orden terminada y graba cabecera y fruta comercial en una transaccion', async () => {
  const deps = dependencies([
    { recordset: [{ OrdpEstado: 4, OrdpFecha: new Date('2026-10-26'), OrdpTotEnv: 100, OrdpTotKilos: 1000 }] },
    { recordset: [] },
    { recordset: [{ readContainers: 80, readKilos: 800, invalidReadings: 0, readingRecords: 80 }] },
    { recordset: [{ VarCod: 2 }] },
    { recordset: [] },
    { recordset: [] }
  ]);
  const result = await finalizeQuadrature(1, 'OPERADOR', '2017-2018', 174, {
    commercial: [{ speciesCode: 1, varietyCode: 2, containers: 10, kilos: 150 }]
  }, deps.options);

  assert.equal(result.state, 5);
  assert.equal(result.totals.wasteKilos, 50);
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[4], /OrdpEstado=5/);
  assert.match(deps.queries[5], /INSERT FCOMERCIAL/);
});

test('revierte la cuadratura cuando las salidas superan los kilos procesados', async () => {
  const deps = dependencies([
    { recordset: [{ OrdpEstado: 4, OrdpFecha: new Date('2026-10-26'), OrdpTotEnv: 10, OrdpTotKilos: 100 }] },
    { recordset: [] },
    { recordset: [{ readContainers: 11, readKilos: 101, invalidReadings: 0, readingRecords: 11 }] }
  ]);

  await assert.rejects(
    finalizeQuadrature(1, 'OPERADOR', '2017-2018', 175, { commercial: [] }, deps.options),
    (error) => error instanceof OrdenesProcesoError && error.code === 'QUADRATURE_OVER_READING'
  );
  assert.equal(deps.transaction.rolledBack, true);
});

test('exige confirmacion expresa para cuadrar una orden sin lecturas', async () => {
  const deps = dependencies([
    { recordset: [{ OrdpEstado: 4, OrdpFecha: new Date('2026-10-26'), OrdpTotEnv: 10, OrdpTotKilos: 100 }] },
    { recordset: [] },
    { recordset: [{ readContainers: 0, readKilos: 0, invalidReadings: 0, readingRecords: 0 }] }
  ]);

  await assert.rejects(
    finalizeQuadrature(1, 'OPERADOR', '2017-2018', 176, { commercial: [] }, deps.options),
    (error) => error instanceof OrdenesProcesoError && error.code === 'READINGS_CONFIRMATION_REQUIRED'
  );
  assert.equal(deps.transaction.rolledBack, true);
});

test('reabre una cuadratura, registra auditoria y elimina solamente sus movimientos automaticos', async () => {
  const deps = dependencies([
    { recordset: [{ OrdpEstado: 5, OrdpEnvExp: 80, OrdpKilosExp: 800, OrdpEnvCom: 10, OrdpKilosCom: 150, OrdpDesecho: 50 }] },
    { recordset: [] },
    { recordset: [] }
  ]);
  const result = await reopenQuadrature(1, 'SUPERVISOR', '2017-2018', 174, {
    reason: 'Correccion solicitada por control de calidad'
  }, deps.options);

  assert.equal(result.state, 4);
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[1], /'REOPEN'/);
  assert.match(deps.queries[2], /DELETE FROM FCOMERCIAL/);
  assert.match(deps.queries[2], /TMcod=1 AND TMSCod=50/);
  assert.match(deps.queries[2], /OrdpEstado=4/);
});

test('rechaza reapertura sin motivo suficiente', async () => {
  await assert.rejects(
    reopenQuadrature(1, 'SUPERVISOR', '2017-2018', 174, { reason: 'corto' }),
    (error) => error instanceof OrdenesProcesoError && error.code === 'VALIDATION_ERROR'
  );
});

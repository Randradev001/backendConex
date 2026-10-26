const test = require('node:test');
const assert = require('node:assert/strict');

const { OrdenesProcesoError, buildQuadrature, setProcessActive } = require('../src/services/ordenesProceso.service');

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

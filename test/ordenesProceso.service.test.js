const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OrdenesProcesoError,
  create,
  buildQuadrature,
  finalizeQuadrature,
  getProcessReport,
  normalizeCommercialRows,
  processDateValue,
  reopenQuadrature,
  setProcessActive,
  update
} = require('../src/services/ordenesProceso.service');

test('conserva la fecha civil de la orden sin retroceder un día por UTC', () => {
  const date = processDateValue('2026-11-25');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 10);
  assert.equal(date.getDate(), 25);
  assert.equal(date.getHours(), 12);
  assert.throws(() => processDateValue('2026-02-30'), /fecha del proceso/i);
});

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
  const inputs = [];
  const transaction = {
    begin: async () => {},
    commit: async () => { transaction.committed = true; },
    rollback: async () => { transaction.rolledBack = true; }
  };
  return {
    queries,
    inputs,
    transaction,
    options: {
      poolProvider: async () => ({}),
      transactionFactory: () => transaction,
      requestFactory: () => ({
        values: {},
        input(name, _type, value) { this.values[name] = value; return this; },
        async query(statement) {
          queries.push(statement);
          inputs.push(this.values);
          return responses.shift();
        }
      })
    }
  };
};

const updateBody = (lots) => ({
  process: { date: '2026-11-12', variety: 4, exporter: 2, label: 'POLCURA16' },
  lots
});
const updateDependencies = (responses) => {
  const deps = dependencies([]);
  deps.inputs = [];
  deps.options.requestFactory = () => {
    const inputs = {};
    return {
      input(name, _type, value) { inputs[name] = value; return this; },
      async query(statement) {
        deps.queries.push(statement);
        deps.inputs.push(inputs);
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return response || { recordset: [] };
      }
    };
  };
  return deps;
};

test('editar permite quitar todos los detalles conservando productor y especie de cabecera', async () => {
  const deps = updateDependencies([{ recordset: [{ ProdCod: '34', Especod: 1, OrdpEstado: 0 }] }]);
  const result = await update(1, 'MANDRADE', '2017-2018', 6, updateBody([]), deps.options);

  assert.deepEqual(result.details, []);
  assert.deepEqual(result.totals, { env: 0, kilos: 0 });
  assert.equal(deps.transaction.committed, true);
  assert.equal(deps.inputs[2].Producer, '34');
  assert.equal(deps.inputs[2].Species, 1);
  assert.equal(deps.inputs[2].TotEnv, 0);
  assert.equal(deps.inputs[2].TotKilos, 0);
  assert.equal(deps.queries.length, 3);
  assert.match(deps.queries[1], /DELETE FROM ORDPROC1/);
  assert.match(deps.queries[1], /DELETE FROM MOVFRUT1/);
  assert.match(deps.queries[1], /DELETE FROM MOVFRUT/);
  assert.ok(deps.queries.every((statement) => !/INSERT/.test(statement)));
  assert.ok(deps.inputs.every((input) => input.EmpCod === 1 && input.TempCod === '2017-2018' && input.Ordpnum === 6));
});

test('editar conserva el guardado de los lotes restantes y sus movimientos', async () => {
  const deps = updateDependencies([
    { recordset: [{ ProdCod: '34', Especod: 1, OrdpEstado: 0 }] },
    { recordset: [{ producer: '34', species: 1, variety: 4, containers: 500, kilos: 1450, usedContainers: 0, usedKilos: 0 }] }
  ]);
  const result = await update(1, 'MANDRADE', '2017-2018', 6, updateBody([{ lot: 14, containers: 100, kilos: 290 }]), deps.options);

  assert.equal(result.details.length, 1);
  assert.equal(result.details[0].lot, 14);
  assert.deepEqual(result.totals, { env: 100, kilos: 290 });
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[4], /INSERT ORDPROC1/);
  assert.match(deps.queries[5], /INSERT MOVFRUT /);
  assert.match(deps.queries[6], /INSERT MOVFRUT1/);
});

test('vaciar el detalle no permite editar una orden en proceso', async () => {
  const deps = updateDependencies([{ recordset: [{ ProdCod: '34', Especod: 1, OrdpEstado: 1 }] }]);
  await assert.rejects(
    update(1, 'MANDRADE', '2017-2018', 6, updateBody([]), deps.options),
    (error) => error.code === 'ORDER_NOT_EDITABLE'
  );
  assert.equal(deps.transaction.rolledBack, true);
  assert.equal(deps.queries.length, 1);
});

test('revierte la eliminacion de detalles si falla la actualizacion de cabecera', async () => {
  const deps = updateDependencies([
    { recordset: [{ ProdCod: '34', Especod: 1, OrdpEstado: 0 }] },
    { recordset: [] },
    new Error('Fallo SQL')
  ]);
  await assert.rejects(update(1, 'MANDRADE', '2017-2018', 6, updateBody([]), deps.options), /Fallo SQL/);
  assert.equal(deps.transaction.rolledBack, true);
  assert.equal(deps.transaction.committed, undefined);
});

test('editar exige una lista explicita para no borrar detalles por un payload incompleto', async () => {
  const deps = updateDependencies([]);
  await assert.rejects(
    update(1, 'MANDRADE', '2017-2018', 6, updateBody(undefined), deps.options),
    (error) => error.code === 'VALIDATION_ERROR'
  );
  assert.equal(deps.queries.length, 0);
});

test('crear una orden nueva sigue exigiendo al menos un lote', async () => {
  await assert.rejects(
    create(1, 'MANDRADE', { tempCod: '2017-2018', ...updateBody([]) }),
    (error) => error.code === 'VALIDATION_ERROR' && /al menos un lote/.test(error.message)
  );
});

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

test('termina solamente una orden activa, la cierra y registra el termino', async () => {
  const deps = dependencies([{ recordset: [{ OrdpEstado: 1 }] }, { recordset: [] }]);
  const result = await setProcessActive(1, 'OPERADOR', '2017-2018', 25, false, deps.options);

  assert.equal(result.state, 4);
  assert.equal(result.message, 'Orden 25 terminada correctamente.');
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[1], /OrdpEstado=4/);
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
  assert.equal(result.totals.projectedWasteKilos, 0);
  assert.equal(result.totals.shrinkageKilos, 1250);
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
  assert.equal(result.totals.shrinkageKilos, -1);
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
  assert.deepEqual(rows, [{ speciesCode: 1, varietyCode: 2, classification: 'commercial', containers: 3, kilos: 12.34, observation: 'Comercial' }]);

  assert.throws(
    () => normalizeCommercialRows([
      { speciesCode: 1, varietyCode: 2, classification: 'waste', containers: 1, kilos: 10 },
      { speciesCode: 1, varietyCode: 2, classification: 'waste', containers: 2, kilos: 20 }
    ]),
    (error) => error instanceof OrdenesProcesoError && error.code === 'DUPLICATE_COMMERCIAL_LINE'
  );
  assert.throws(
    () => normalizeCommercialRows([{ speciesCode: 1, varietyCode: 3, containers: 1, kilos: 12.345 }]),
    (error) => error instanceof OrdenesProcesoError && error.code === 'VALIDATION_ERROR'
  );
});

test('acepta la misma especie y variedad cuando comercial y desecho son distintos', () => {
  const rows = normalizeCommercialRows([
    { speciesCode: 1, varietyCode: 2, classification: 'commercial', containers: 1, kilos: 150 },
    { speciesCode: 1, varietyCode: 2, classification: 'waste', containers: 0, kilos: 50 }
  ]);
  assert.deepEqual(rows.map((row) => row.classification), ['commercial', 'waste']);
});

test('cuadra por kilos, conserva merma y numera el ingreso comercial tras movimientos existentes', async () => {
  const deps = dependencies([
    { recordset: [{ OrdpEstado: 4, OrdpFecha: new Date('2026-10-26'), OrdpTotEnv: 100, OrdpTotKilos: 1000 }] },
    { recordset: [] },
    { recordset: [{ readContainers: 80, readKilos: 800, invalidReadings: 0, readingRecords: 80 }] },
    { recordset: [{ VarCod: 2 }] },
    { recordset: [] },
    { recordset: [{ nextNumber: 7 }] },
    { recordset: [] },
    { recordset: [] }
  ]);
  const result = await finalizeQuadrature(1, 'OPERADOR', '2017-2018', 174, {
    classifications: [
      { speciesCode: 1, varietyCode: 2, classification: 'commercial', containers: 10, kilos: 150 },
      { classification: 'waste', containers: 10, kilos: 20 }
    ]
  }, deps.options);

  assert.equal(result.state, 5);
  assert.equal(result.totals.wasteKilos, 20);
  assert.equal(result.totals.shrinkageKilos, 30);
  assert.equal(result.totals.wasteContainers, 10);
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[4], /OrdpEstado=5/);
  assert.match(deps.queries[5], /MAX\(FCONumI\)/);
  assert.match(deps.queries[6], /INSERT FCOMERCIAL/);
  assert.equal(deps.inputs[6].LineNumber, 8);
  assert.equal(deps.inputs[6].Kilos, 150);
  assert.equal(deps.inputs[6].Observation, 'Ingreso por Proceso - Sistema');
  assert.equal(deps.inputs[7].WasteContainers, 10);
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

test('cuadra con merma y envases informativos sin crear ingreso comercial', async () => {
  const deps = dependencies([
    { recordset: [{ OrdpEstado: 4, OrdpFecha: new Date('2026-10-26'), OrdpTotEnv: 10, OrdpTotKilos: 100 }] },
    { recordset: [] },
    { recordset: [{ readContainers: 20, readKilos: 40, invalidReadings: 0, readingRecords: 20 }] },
    { recordset: [] },
    { recordset: [] }
  ]);
  const result = await finalizeQuadrature(1, 'OPERADOR', '2017-2018', 175, {
    classifications: [{ classification: 'waste', containers: 3, kilos: 10 }]
  }, deps.options);
  assert.equal(result.totals.shrinkageKilos, 50);
  assert.equal(result.totals.wasteContainers, 3);
  assert.equal(deps.queries.some((query) => /INSERT FCOMERCIAL/.test(query)), false);
  assert.equal(deps.transaction.committed, true);
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

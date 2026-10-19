const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RepaletizajeError,
  defaultRange,
  listFilters,
  statusLabel,
  normalizeNewFolioPayload,
  normalizeLowerPayload,
  normalizeRaisePayload,
  applyPendingLowerAdjustments,
  mergeRaisePoolAvailability,
  buildRaiseDetails,
  finalizeRepaletizaje
} = require('../src/modules/repaletizaje/repaletizaje.service');

test('conserva el rango GX inicial de 30 días', () => {
  assert.deepEqual(defaultRange(new Date('2026-10-01T12:00:00')), {
    from: '2026-09-01',
    to: '2026-10-01'
  });
});

test('permite ajustar fechas y conserva Todos como estado sin filtro', () => {
  const filters = listFilters({ from: '01/10/2026', to: '06/10/2026', status: '9', repNum: '12' });
  assert.deepEqual(filters, {
    from: '2026-10-01',
    to: '2026-10-06',
    status: null,
    repNum: 12,
    repNumF: null,
    page: 1,
    pageSize: 25
  });
});

test('conserva los estados históricos de Repaletizaje', () => {
  assert.equal(statusLabel(0), 'En proceso');
  assert.equal(statusLabel(1), 'Finalizado');
  assert.equal(statusLabel(5), 'Anulado');
  assert.throws(() => listFilters({ status: 3 }), RepaletizajeError);
});

test('RepAgregar exige un folio nuevo y conserva los atributos del pool PSR', () => {
  const payload = normalizeNewFolioPayload({
    folio: '0000001234',
    requestNumber: '32',
    heightCode: '2',
    baseCode: '1',
    lines: [{ corr: 1, species: 7, variety: 12, product: 'CSG-1', container: 5, category: 2, caliber: '00J', boxes: 3 }]
  });
  assert.deepEqual(payload, {
    mode: 'new',
    folio: '0000001234',
    requestNumber: 32,
    heightCode: 2,
    baseCode: 1,
    lines: [{ corr: 1, boxes: 3, species: 7, variety: 12, product: 'CSG-1', container: 5, category: 2, caliber: '00J' }]
  });
  assert.throws(() => normalizeNewFolioPayload({ ...payload, folio: 'FOLIO-1' }), RepaletizajeError);
  assert.throws(() => normalizeNewFolioPayload({ ...payload, lines: [{ ...payload.lines[0], boxes: 0 }] }), RepaletizajeError);
});

test('rechaza filtros con rango invertido', () => {
  assert.throws(
    () => listFilters({ from: '2026-10-02', to: '2026-10-01' }),
    RepaletizajeError
  );
});

test('valida la acción Bajar cajas como movimientos positivos por detalle', () => {
  assert.deepEqual(normalizeLowerPayload({ folio: '000123', lines: [{ corr: '2', boxes: '4' }] }), {
    folio: '000123',
    lines: [{ corr: 2, boxes: 4 }]
  });
  assert.throws(() => normalizeLowerPayload({ folio: '000123', lines: [{ corr: 2, boxes: 0 }] }), RepaletizajeError);
  assert.throws(() => normalizeLowerPayload({ folio: '000123', lines: [{ corr: 2, boxes: 2 }, { corr: 2, boxes: 1 }] }), RepaletizajeError);
});

test('valida la acción Subir cajas como movimientos positivos por detalle', () => {
  assert.deepEqual(normalizeRaisePayload({ folio: '000123', lines: [{ corr: '2', boxes: '4' }] }), {
    folio: '000123',
    lines: [{ corr: 2, boxes: 4 }]
  });
  assert.throws(() => normalizeRaisePayload({ folio: '000123', lines: [{ corr: 2, boxes: 0 }] }), RepaletizajeError);
  assert.throws(() => normalizeRaisePayload({ folio: '000123', lines: [{ corr: 2, boxes: 2 }, { corr: 2, boxes: 1 }] }), RepaletizajeError);
});

test('Subir cajas relaciona el pool disponible aunque el folio no esté en el repaletizaje', () => {
  const details = mergeRaisePoolAvailability([
    { corr: 1, species: 7, variety: 12, product: 'CSG-1 ', container: 5, category: 2, caliber: '00J ', reservedBoxes: 0, occupiedBoxes: 0 },
    { corr: 2, species: 8, variety: 1, product: 'OTRO', container: 5, category: 2, caliber: '00J', reservedBoxes: 4, occupiedBoxes: 1 }
  ], [
    { species: 7, variety: 12, product: 'csg-1', container: 5, category: 2, caliber: '00j', reservedBoxes: 10, occupiedBoxes: 3 }
  ]);

  assert.equal(details[0].reservedBoxes, 10);
  assert.equal(details[0].occupiedBoxes, 3);
  assert.equal(details[1].reservedBoxes, 4);
  assert.equal(details[1].occupiedBoxes, 1);
});

test('Subir cajas conserva el saldo de Sol3CajasDes si no hay fila PSR para la sesión', () => {
  const details = mergeRaisePoolAvailability([
    { corr: 1, originalBoxes: 0, repalletizedBoxes: 0, discountedBoxes: 127 }
  ], []);

  assert.equal(details[0].reservedBoxes, 127);
  assert.equal(details[0].availableBoxes, 127);
});

test('Subir cajas no reemplaza el detalle del folio por filas PSR de otro folio', () => {
  const details = buildRaiseDetails([
    { corr: 1, product: '4', species: 1, variety: 1, container: 2, category: 1, caliber: 'XJJL', discountedBoxes: 22 }
  ], [
    { species: 1, variety: 1, product: '32', container: 2, category: 1, caliber: '0SPD', reservedBoxes: 10, occupiedBoxes: 10 },
    { species: 1, variety: 1, product: '36', container: 2, category: 1, caliber: '0JJD', reservedBoxes: 12, occupiedBoxes: 12 }
  ]);

  assert.deepEqual(details.map((row) => row.product), ['4']);
  assert.equal(details[0].availableBoxes, 22);
});

test('Subir cajas muestra filas del pool aunque sus atributos aún no existan en el folio', () => {
  const details = buildRaiseDetails([], [
    { species: 1, variety: 1, product: '1', container: 2, category: 1, caliber: 'XJJD', varietyName: 'BING', reservedBoxes: 10, occupiedBoxes: 8 }
  ]);

  assert.equal(details.length, 1);
  assert.equal(details[0].corr, 1);
  assert.equal(details[0].availableBoxes, 2);
  assert.equal(details[0].varietyName, 'BING');
});

test('Subir cajas agrupa filas duplicadas del pool por sus atributos', () => {
  const details = buildRaiseDetails([], [
    { species: 1, variety: 1, product: '1', container: 2, category: 1, caliber: 'XJJD', varietyName: 'BING', reservedBoxes: 10, occupiedBoxes: 8 },
    { species: 1, variety: 1, product: '1', container: 2, category: 1, caliber: 'XJJD', varietyName: 'BING', reservedBoxes: 6, occupiedBoxes: 2 }
  ]);

  assert.equal(details.length, 1);
  assert.equal(details[0].reservedBoxes, 16);
  assert.equal(details[0].occupiedBoxes, 10);
  assert.equal(details[0].availableBoxes, 6);
});

test('Subir cajas nunca expone dos filas con el mismo correlativo', () => {
  const details = buildRaiseDetails([
    { corr: 1, species: 1, variety: 7, product: '1', container: 2, category: 1, caliber: '00JJ' },
    { corr: 1, species: 1, variety: 8, product: '1', container: 2, category: 1, caliber: '00JJ' }
  ], [
    { species: 1, variety: 7, product: '1', container: 2, category: 1, caliber: '00JJ', reservedBoxes: 10, occupiedBoxes: 8 },
    { species: 1, variety: 8, product: '1', container: 2, category: 1, caliber: '00JJ', reservedBoxes: 6, occupiedBoxes: 2 }
  ]);

  assert.equal(details.length, 1);
  assert.equal(details[0].corr, 1);
});

test('Bajar cajas replica el ajuste pendiente del XPZ en Cajas Des', () => {
  const adjusted = applyPendingLowerAdjustments([
    { corr: 1, originalBoxes: 10, repalletizedBoxes: 8, discountedBoxes: 18 },
    { corr: 2, originalBoxes: 5, repalletizedBoxes: 2, discountedBoxes: 7 }
  ], new Map([[1, -3]]));

  assert.equal(adjusted[0].discountedBoxes, 15);
  assert.equal(adjusted[0].lowerableBoxes, 3);
  assert.equal(adjusted[1].discountedBoxes, 7);
  assert.equal(adjusted[1].lowerableBoxes, 7);
});

test('Bajar cajas bloquea un detalle con movimiento positivo pendiente como en el XPZ', () => {
  const adjusted = applyPendingLowerAdjustments([
    { corr: 1, repalletizedBoxes: 8, discountedBoxes: 18 }
  ], new Map([[1, 8]]));

  assert.equal(adjusted[0].discountedBoxes, 26);
  assert.equal(adjusted[0].lowerableBoxes, 0);
});

test('Finalizar replica FinRepa para un folio nuevo creando SOLICITUDES2 y SOLICITUDES3', async () => {
  const statements = [];
  const responses = [
    { recordset: [{ tempCod: '2026-2027' }] },
    { recordset: [{ status: 0 }] },
    { recordset: [{ folio: '0000009999', requestNumber: 32, species: 7, repalletizedBoxes: 4, heightCode: 2, baseCode: 1, actionType: 1 }] },
    { recordset: [{ REP0Fol: '0000009999', requestNumber: 32, species: 7, repalletizedBoxes: 4, actionType: 1, Rep1Corr: 1, REP1FecPro: '2026-10-15', REP1Espe: 7, REP1Var: 12, REP1Prod: 'CSG-1', REP1Env: 5, REP1Cat: 2, REP1Cal: '00J', REP1CajasRep: 4 }] },
    { recordset: [{ weight: 5, tare: 1 }] },
    { recordset: [] },
    { recordset: [] },
    { recordset: [] },
    { recordset: [] },
    { recordset: [] },
    { recordset: [] }
  ];
  const transaction = {
    _aborted: false,
    async begin() {},
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; }
  };
  const requestFactory = () => {
    const inputs = {};
    return {
      input(name, _type, value) { inputs[name] = value; return this; },
      async query(queryText) {
        statements.push({ query: queryText, inputs: { ...inputs } });
        const response = responses.shift();
        if (!response) throw new Error(`Respuesta no preparada para: ${queryText}`);
        return response;
      }
    };
  };

  const result = await finalizeRepaletizaje(1, 7, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory,
    nextNumber: async () => 14
  });

  assert.deepEqual(result, { repNum: 7, repNumF: 14, status: 1 });
  assert.equal(transaction.committed, true);
  assert.equal(transaction.rolledBack, undefined);
  assert.equal(statements.filter(({ query }) => /INSERT INTO SOLICITUDES3/i.test(query)).length, 1);
  assert.equal(statements.filter(({ query }) => /INSERT INTO SOLICITUDES2/i.test(query)).length, 1);
  assert.match(statements.find(({ query }) => /UPDATE REPALETIZAJE SET/i.test(query)).query, /REPEstado=1,REPNumF=@RepNumF/);
  assert.equal(statements.some(({ query }) => /DELETE FROM PS_SALREP/i.test(query)), false);
});

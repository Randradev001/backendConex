const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');

const {
  IngresoTarjasError, normalizeFolio, listFilters, listTarjas, createTarja, updateTarja, deleteTarja, readImportRows, resolveImportRow, importFoliosExcel
} = require('../src/modules/ingresoTarjas/ingresoTarjas.service');

const dependencies = ({ usedBoxes = 2, editing = false, destinationExists = true } = {}) => {
  const statements = [];
  const transaction = {
    async begin() {},
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; }
  };
  const requestFactory = () => ({
    values: {},
    input(name, _type, value) { this.values[name] = value; return this; },
    async query(statement) {
      statements.push({ statement, values: { ...this.values } });
      if (/FROM TEMP01 WITH/.test(statement)) return { recordset: [{ TempCod: '2017-2018' }] };
      if (/FROM FOLIOSPROC WITH/.test(statement)) return { recordset: editing ? [{ FPFolio: '0000000073', FPOrigen: 0, FPIns: 0, FPDesOri: 0, FPDesOT: 0, FPDesUsda: 0 }] : [] };
      if (/FROM ORDPROC WITH/.test(statement)) return { recordset: [{ ExpCod: 2, Especod: 1, VarCod: 3, ProdCod: 'P001' }] };
      if (/FROM ORDPROC1 d WITH/.test(statement)) return { recordset: [{ assignedBoxes: 10, ExpCod: 2, Especod: 1, VarCod: 3, orderProducer: 'P001', MovFecha: new Date('2026-09-20'), Mov1Espe: 1, Mov1Var: 3, movementProducer: 'P001' }] };
      if (/FROM DESTINOS/.test(statement)) return { recordset: destinationExists ? [{ DestCod: 228 }] : [] };
      if (/SELECT TOP 1 EnvPeso,EnvDestare,EnvUso/.test(statement)) return { recordsets: [[{ EnvPeso: 5, EnvDestare: 0.5, EnvUso: 1 }], [{ Catcod: 1 }], [{ Calibre: 'XL' }], [{ ProdCod: 'P001' }]] };
      if (/SUM\(d\.FP2Cajas\)/.test(statement)) return { recordset: [{ usedBoxes }] };
      return { recordset: [] };
    }
  });
  return { statements, transaction, options: { poolProvider: async () => ({}), transactionFactory: () => transaction, requestFactory } };
};

const payload = (boxes = 5) => ({
  folio: '73', status: 10, entryDate: '2026-09-30', orderNumber: 146, exporterCode: 2, speciesCode: 1,
  labelCode: 1, heightCode: 1, palletBaseCode: 1, destinationCode: 228, boxNumber: 11987, service: 'SAG',
  details: [{ lot: 394, movementDate: '2026-09-20', producerCode: 'P001', speciesCode: 1, varietyCode: 3, containerCode: 4, categoryCode: 1, caliber: 'XL', boxes }]
});

test('completa el folio a diez posiciones', () => {
  assert.equal(normalizeFolio('73'), '0000000073');
});

test('conserva el folio de búsqueda para coincidencia parcial', () => {
  assert.equal(listFilters({ from: '2026-09-01', to: '2026-09-30', folio: '73' }).folio, '73');
});

test('consulta el folio con coincidencia parcial', async () => {
  let statement = '';
  const request = {
    values: {},
    input(name, _type, value) {
      this.values[name] = value;
      return this;
    },
    async query(sqlText) {
      statement = sqlText;
      return { recordsets: [[], [{ total: 0, totalBoxes: 0, totalKilos: 0 }], [{ tempCod: '2017-2018' }]] };
    }
  };
  await listTarjas(1, { from: '2026-09-01', to: '2026-09-30', folio: '73' }, { poolProvider: async () => ({ request: () => request }) });
  assert.equal(request.values.Folio, '73');
  assert.match(statement, /RTRIM\(h\.FPFolio\) LIKE '%' \+ @Folio \+ '%'/);
});

test('guarda cabecera y detalle usando temporada activa y kilos calculados', async () => {
  const deps = dependencies({ usedBoxes: 2 });
  const result = await createTarja(1, payload(5), deps.options);
  assert.equal(result.folio, '0000000073');
  assert.equal(result.tempCod, '2017-2018');
  assert.equal(result.totalBoxes, 5);
  assert.equal(result.totalKilos, 22.5);
  assert.equal(deps.transaction.committed, true);
  const headerInsert = deps.statements.find(({ statement }) => /INSERT FOLIOSPROC \(/.test(statement));
  assert.match(headerInsert.statement, /COALESCE\(@EntryDate,CAST\(GETDATE\(\) AS date\)\)/);
  assert.equal(headerInsert.values.EntryDate, '2026-09-30');
  assert.equal(headerInsert.values.Destination, 228);
  assert.equal(headerInsert.values.BoxNumber, 11987);
  assert.equal(headerInsert.values.Service, 'SAG');
  const detailInsert = deps.statements.find(({ statement }) => /INSERT FOLIOSPROC1/.test(statement));
  assert.equal(detailInsert.values.Kilos, 22.5);
  assert.equal(detailInsert.values.Lot, 394);
});

test('rechaza un destino que no existe', async () => {
  const deps = dependencies({ destinationExists: false });
  await assert.rejects(() => createTarja(1, payload(5), deps.options), (error) => {
    assert.equal(error.code, 'INVALID_DESTINATION');
    return true;
  });
  assert.equal(deps.transaction.rolledBack, true);
});

test('la carga Excel acepta lote cero y marca el origen como carga de folios', async () => {
  const deps = dependencies();
  const importedPayload = { ...payload(5), orderNumber: null, details: [{ ...payload(5).details[0], lot: 0 }] };
  await createTarja(1, importedPayload, { ...deps.options, allowZeroLot: true, origin: 5 });
  const headerInsert = deps.statements.find(({ statement }) => /INSERT FOLIOSPROC \(/.test(statement));
  const detailInsert = deps.statements.find(({ statement }) => /INSERT FOLIOSPROC1/.test(statement));
  assert.equal(headerInsert.values.Origin, 5);
  assert.equal(detailInsert.values.Lot, 0);
});

test('el ingreso manual permite guardar el numero de lote en cero', async () => {
  const deps = dependencies();
  const manualPayload = { ...payload(5), orderNumber: null, details: [{ ...payload(5).details[0], lot: 0 }] };
  const result = await createTarja(1, manualPayload, deps.options);
  assert.equal(result.orderNumber, null);
  assert.equal(result.details, 1);
  const detailInsert = deps.statements.find(({ statement }) => /INSERT FOLIOSPROC1/.test(statement));
  assert.equal(detailInsert.values.Lot, 0);
});

test('lee el formato xlsx, conserva el primer folio repetido y reporta el duplicado', async () => {
  const filePath = path.join(os.tmpdir(), `conex-import-test-${Date.now()}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Carga de folios');
  sheet.addRow(['N° de Folio', 'Codigo Exportadora', 'Fecha Proceso', 'Codigo Productor', 'Codigo Especie', 'Codigo Variedad', 'Codigo Envase', 'Codigo Categoria', 'Calibre', 'Cajas']);
  sheet.addRow([73, 'EXP', '15/12/2023', 'PROD', 'ESP', 'VAR', 'ENV', 'CAT', '230', 5]);
  sheet.addRow([73, 'EXP', '15/12/2023', 'PROD', 'ESP', 'VAR', 'ENV', 'CAT', '230', 6]);
  await workbook.xlsx.writeFile(filePath);
  try {
    const result = await readImportRows(filePath);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rowCount, 2);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0].message, /primera fila/);
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});

test('resuelve los codigos internos del formato contra los catalogos', () => {
  const maps = {
    exporters: new Map([['2', 2]]),
    producers: new Map([['P001', 'P001']]),
    species: new Map([['1', 1]]),
    varieties: new Map([['1|3', 3]]),
    containers: new Map([['4', 4]]),
    categories: new Map([['4|1', 1]]),
    calibers: new Map([['1|230', '230']])
  };
  const result = resolveImportRow({ folio: '73', exporterCode: '2', processDate: '15/12/2023', producerCode: 'P001', speciesCode: '1', varietyCode: '3', containerCode: '4', categoryCode: '1', caliber: '230', boxes: 5 }, maps);
  assert.equal(result.folio, '0000000073');
  assert.equal(result.details[0].lot, 0);
  assert.equal(result.details[0].producerCode, 'P001');
  assert.equal(result.details[0].boxes, 5);
});

test('carga un folio xlsx valido en una transaccion y reporta filas invalidas', async () => {
  const filePath = path.join(os.tmpdir(), `conex-import-service-${Date.now()}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Carga de folios');
  sheet.addRow(['N° de Folio', 'Codigo Exportadora', 'Fecha Proceso', 'Codigo Productor', 'Codigo Especie', 'Codigo Variedad', 'Codigo Envase', 'Codigo Categoria', 'Calibre', 'Cajas']);
  sheet.addRow([73, '2', '15/12/2023', 'P001', '1', '3', '4', '1', '230', 5]);
  sheet.addRow([74, 'NO_EXISTE', '15/12/2023', 'P001', '1', '3', '4', '1', '230', 5]);
  await workbook.xlsx.writeFile(filePath);
  const deps = dependencies();
  const catalogPool = {
    request() {
      return {
        input() { return this; },
        async query() {
          return {
            recordsets: [
              [{ internalCode: 2, externalCode: '2' }],
              [{ internalCode: 'P001', externalCode: 'P001' }],
              [{ internalCode: 1, externalCode: '1' }],
              [{ speciesCode: 1, internalCode: 3, externalCode: '3' }],
              [{ internalCode: 4, externalCode: '4' }],
              [{ containerCode: 4, internalCode: 1, externalCode: '1' }],
              [{ speciesCode: 1, caliber: '230' }]
            ]
          };
        }
      };
    }
  };
  try {
    const result = await importFoliosExcel(1, filePath, { ...deps.options, poolProvider: async () => catalogPool });
    assert.equal(result.loaded, 1);
    assert.equal(result.rejected, 1);
    assert.equal(result.errors[0].folio, '74');
    assert.equal(deps.transaction.committed, true);
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});

test('permite guardar un lote sin orden asociada', async () => {
  const deps = dependencies();
  const noOrder = { ...payload(5), orderNumber: null };
  const result = await createTarja(1, noOrder, deps.options);
  assert.equal(result.orderNumber, null);
  assert.equal(deps.transaction.committed, true);
  const headerInsert = deps.statements.find(({ statement }) => /INSERT FOLIOSPROC \(/.test(statement));
  assert.equal(headerInsert.values.OrderNumber, null);
  assert.ok(!deps.statements.some(({ statement }) => /FROM ORDPROC WITH/.test(statement)));
});

test('rechaza cajas que superan el saldo de la orden y lote', async () => {
  const deps = dependencies({ usedBoxes: 8 });
  await assert.rejects(
    createTarja(1, payload(3), deps.options),
    (error) => error instanceof IngresoTarjasError && error.code === 'LOT_BALANCE_EXCEEDED'
  );
  assert.equal(deps.transaction.rolledBack, true);
  assert.equal(deps.transaction.committed, undefined);
});

test('rechaza valores que exceden los largos físicos del detalle', async () => {
  const base = { ...payload(3), orderNumber: null, details: [{ ...payload(3).details[0], lot: 0 }] };
  await assert.rejects(
    createTarja(1, { ...base, details: [{ ...base.details[0], lot: '12345678901' }] }, dependencies().options),
    (error) => error.code === 'VALIDATION_ERROR' && /lote debe ser un número entero/.test(error.message)
  );
  await assert.rejects(
    createTarja(1, { ...base, details: [{ ...base.details[0], producerCode: '1234567' }] }, dependencies().options),
    (error) => error.code === 'VALIDATION_ERROR' && /productor admite hasta 6/.test(error.message)
  );
  await assert.rejects(
    createTarja(1, { ...base, details: [{ ...base.details[0], caliber: '12345678901' }] }, dependencies().options),
    (error) => error.code === 'VALIDATION_ERROR' && /calibre admite hasta 10/.test(error.message)
  );
});

test('modifica cabecera y reemplaza el detalle en una sola transaccion', async () => {
  const deps = dependencies({ editing: true });
  const result = await updateTarja(1, '73', payload(4), deps.options);
  assert.equal(result.updated, true);
  assert.equal(deps.transaction.committed, true);
  assert.ok(deps.statements.some(({ statement }) => /DELETE FROM FOLIOSPROC1/.test(statement)));
  assert.ok(deps.statements.some(({ statement }) => /UPDATE FOLIOSPROC SET/.test(statement)));
  assert.ok(deps.statements.some(({ statement }) => /INSERT FOLIOSPROC1/.test(statement)));
});

test('elimina cabecera y detalle manual cuando no tienen uso posterior', async () => {
  const statements = [];
  const transaction = { async begin() {}, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
  const requestFactory = () => ({
    input() { return this; },
    async query(statement) {
      statements.push(statement);
      if (/SELECT TOP 1 h\.TempCod/.test(statement)) {
        return { recordset: [{ TempCod: '2017-2018', FPOrigen: 0, FPIns: 0, FPDesOri: 0, FPDesOT: 0, FPDesUsda: 0 }] };
      }
      return { recordset: [] };
    }
  });
  const result = await deleteTarja(1, '73', { poolProvider: async () => ({}), transactionFactory: () => transaction, requestFactory });
  assert.equal(result.folio, '0000000073');
  assert.equal(transaction.committed, true);
  assert.ok(statements.some((statement) => /DELETE FROM FOLIOSPROC1/.test(statement) && /DELETE FROM FOLIOSPROC WHERE/.test(statement)));
});


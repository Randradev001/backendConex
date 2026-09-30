const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLegacyBoxCode } = require('../src/impresion-worker/barcode');
const { createImpresionService, variableValues, formatDate, unresolvedVariables } = require('../src/impresion-worker/impresion.service');
const { createImpresionRepository } = require('../src/impresion-worker/impresion.repository');
const { PRINT_STATUS } = require('../src/impresion-worker/constants');
const { printerPrintPermission } = require('../src/impresion-worker/impresion.routes');
const { createImpresionHttpService, printerPayload, testVariables } = require('../src/impresion-worker/impresion.http.service');

const design = {
  schemaVersion: 1, name: 'Caja', description: '', widthMm: 100, heightMm: 50,
  dpi: 203, widthDots: 799, heightDots: 400,
  elements: [
    { id: 'codigo', type: 'text', xDots: 10, yDots: 10, content: '{{codigo}}', font: '0' },
    { id: 'productor', type: 'text', xDots: 10, yDots: 40, content: '{{productor}}', font: '0' }
  ],
  variables: [{ name: 'codigo' }, { name: 'productor' }]
};

const context = {
  empCod: 1, machine: 2, lineId: 2, lineState: 1, caliber: '00JD', envCode: 2,
  categoryCode: 34, personCode: 6000, processNumber: 160, processDate: new Date('2017-11-29T12:00:00Z'),
  producerCode: '7', producerName: 'PRODUCTOR SELECCIONADO',
  caliberCode: 7, printerIp: '192.168.1.51', printerPort: 9100, printerTimeoutMs: 1000,
  labelCode: 'LAVINA16', labelVersion: 2, labelDesign: design
};

test('compone el código histórico de caja con anchos fijos', () => {
  assert.equal(buildLegacyBoxCode({ boxNumber: 123, envCode: 2, categoryCode: 34, caliberCode: 7, machine: 2, line: 2, person: 6000 }), '0001230020340070202600>60');
});

test('completa todas las variables que CONFIGETI puede generar para VINASA', () => {
  const values = variableValues({
    ...context,
    speciesName: 'CEREZAS', speciesExternalName: 'CHERRIES', varietyName: 'BING',
    producerExternalCode: 'CSG:88510', producerSecondaryName: 'PREDIO NORTE',
    producerCommune: 'CODEGUA', producerProvince: 'CACHAPOAL',
    containerName: '5 KG', containerExternalName: 'MN5G 5.00 KG',
    categoryName: 'EXPORTACION', categoryExternalName: 'EXPORT',
    dateFormatType: 3, dateSeparator: '-'
  }, '000123');

  assert.equal(values.especie_externa, 'CHERRIES');
  assert.equal(values.productor_codigo, 'CSG:88510');
  assert.equal(values.productor_secundario, 'PREDIO NORTE');
  assert.equal(values.categoria_externa, 'EXPORT');
  assert.equal(values.calibre, '00JD');
  assert.equal(values.calibre_sin_ceros, 'JD');
  assert.equal(values.fecha, '2017-11-29');
  assert.equal(formatDate(context.processDate, 4, '.'), '2017.29.11');
});

test('detecta marcadores que el worker no pudo resolver', () => {
  assert.deepEqual(unresolvedVariables('^FD{{linimpre_3}} {{codigo}} {{linimpre_3}}^FS'), ['linimpre_3', 'codigo']);
});

test('imprime una orden y recién entonces la marca procesada', async () => {
  const calls = [];
  const repository = {
    claimNext: async () => ({ id: 20, lineId: 2 }), loadContext: async () => context,
    nextBoxNumber: async () => 123,
    savePrepared: async (id, value) => calls.push(['prepared', id, value]),
    markPrinted: async (id) => calls.push(['printed', id]), finish: async (...args) => calls.push(['finish', ...args])
  };
  const printer = { send: async (value) => calls.push(['send', value]) };
  const service = createImpresionService({ repository, printer, logger: {} });
  const result = await service.processNext();

  assert.equal(result.status, PRINT_STATUS.PRINTED);
  assert.deepEqual(calls.map((call) => call[0]), ['prepared', 'send', 'printed']);
  assert.match(calls[0][2].zpl, /0001230020340070202600>60/);
  assert.match(calls[0][2].zpl, /PRODUCTOR SELECCIONADO/);
});

test('el contexto de impresión obtiene el productor guardado en la orden activa', async () => {
  let statement = '';
  const request = {
    input() { return this; },
    async query(value) {
      statement = value;
      return {
        recordset: [{
          EmpCod: 1, LinMaquina: 1, LinID: 1, LinEstado: 1, Calibre: 'XL', EnvCod: 2,
          Catcod: 34, Especod: 1, LConfCodPer: 6000, Ordpnum: 176, OrdpFecha: new Date('2026-09-29'),
          ProdCod: '7', VarCod: 17, EspeNom: 'CEREZAS', VarNom: 'BING',
          OrderProducerName: 'PRODUCTOR DE LA ORDEN', ProdComuna: 'TENO', ProdProvincia: 'CURICÓ',
          EnvNom: '5 KG', EnvNomExt: 'CAJA 5 KG', CatNom: 'EXPORTACIÓN', CalCod: 7,
          CIMPNombre: 'Zebra 1', CIMPIP: '192.168.1.51', EtiCod: 'LAVINA16',
          EtiVersion: 2, EtiDesignJson: JSON.stringify(design)
        }]
      };
    }
  };
  const repository = createImpresionRepository({ poolProvider: async () => ({ request: () => request }), empCod: 1 });

  const loaded = await repository.loadContext({ lineId: 1 });

  assert.equal(loaded.producerCode, '7');
  assert.equal(loaded.producerName, 'PRODUCTOR DE LA ORDEN');
  assert.match(statement, /p\.ProdCod=o\.ProdCod/);
  assert.match(statement, /AS OrderProducerName/);
  assert.match(statement, /cfg\.ConfLinea=1/);
});

test('una falla después de comenzar el envío queda incierta y no impresa', async () => {
  const calls = [];
  const repository = {
    claimNext: async () => ({ id: 21, lineId: 2 }), loadContext: async () => context,
    nextBoxNumber: async () => 124, savePrepared: async () => {}, markPrinted: async () => assert.fail('No debe confirmar'),
    finish: async (...args) => calls.push(args)
  };
  const printer = { send: async () => { const error = new Error('Conexión cortada'); error.uncertain = true; throw error; } };
  const result = await createImpresionService({ repository, printer, logger: {} }).processNext();

  assert.equal(result.status, PRINT_STATUS.UNCERTAIN);
  assert.equal(calls[0][1], PRINT_STATUS.UNCERTAIN);
});

test('una línea inactiva no consume correlativo ni envía ZPL', async () => {
  let sent = false;
  const repository = {
    claimNext: async () => ({ id: 22, lineId: 2 }), loadContext: async () => ({ ...context, lineState: 0 }),
    nextBoxNumber: async () => assert.fail('No debe consumir correlativo'), savePrepared: async () => {},
    markPrinted: async () => {}, finish: async (id, status) => assert.equal(status, PRINT_STATUS.LINE_INACTIVE)
  };
  const result = await createImpresionService({ repository, printer: { send: async () => { sent = true; } }, logger: {} }).processNext();
  assert.equal(result.status, PRINT_STATUS.LINE_INACTIVE);
  assert.equal(sent, false);
});

test('no envía una etiqueta que conserva variables técnicas sin resolver', async () => {
  let sent = false;
  const rawDesign = {
    ...design,
    elements: [{ id: 'legacy', type: 'text', xDots: 10, yDots: 10, content: '{{linimpre_3}}', font: '0' }],
    variables: [{ name: 'linimpre_3' }]
  };
  const calls = [];
  const repository = {
    claimNext: async () => ({ id: 23, lineId: 2 }), loadContext: async () => ({ ...context, labelDesign: rawDesign }),
    nextBoxNumber: async () => 125, savePrepared: async () => assert.fail('No debe guardar ZPL incompleto'),
    markPrinted: async () => assert.fail('No debe confirmar'), finish: async (...args) => calls.push(args)
  };
  const result = await createImpresionService({
    repository,
    printer: { send: async () => { sent = true; } },
    logger: {}
  }).processNext();

  assert.equal(result.status, PRINT_STATUS.FAILED);
  assert.equal(sent, false);
  assert.match(calls[0][2], /linimpre_3/);
});

test('la prueba del diseñador usa muestras y envía la versión a la IP elegida', async () => {
  const sent = [];
  const request = {
    input() { return this; },
    async query() {
      return { recordset: [{ PrinterName: 'Zebra línea 1', PrinterIp: '192.168.1.51', EtiActiva: true, EtiDesignJson: JSON.stringify(design) }] };
    }
  };
  const service = createImpresionHttpService({
    poolProvider: async () => ({ request: () => request }),
    send: async (payload) => sent.push(payload)
  });
  const result = await service.printLabelTest(1, { printerId: 1, labelCode: 'LAVINA16', version: 2, design });

  assert.equal(result.printed, true);
  assert.equal(sent[0].host, '192.168.1.51');
  assert.match(sent[0].zpl, /00000100203400701016000/);
});

test('la prueba del diseñador muestra el calibre VINASA y no un marcador técnico', () => {
  const values = testVariables({ variables: [{ name: 'calibre_sin_ceros' }, { name: 'codigo' }] });

  assert.equal(values.calibre_sin_ceros, 'XLD');
  assert.equal(values.codigo, '00000100203400701016000');
});

test('la impresión directa rechaza variables desconocidas antes de enviar', async () => {
  let sent = false;
  const rawDesign = {
    ...design,
    elements: [{ id: 'legacy', type: 'text', xDots: 10, yDots: 10, content: '{{variable_desconocida}}', font: '0' }],
    variables: [{ name: 'variable_desconocida' }]
  };
  const request = {
    input() { return this; },
    async query() {
      return { recordset: [{ PrinterName: 'Zebra línea 1', PrinterIp: '192.168.1.51', EtiActiva: true, EtiDesignJson: JSON.stringify(rawDesign) }] };
    }
  };
  const service = createImpresionHttpService({
    poolProvider: async () => ({ request: () => request }),
    send: async () => { sent = true; }
  });

  await assert.rejects(
    () => service.printLabelTest(1, { printerId: 1, labelCode: 'POLCURA16', version: 2 }),
    (error) => error.code === 'UNRESOLVED_LABEL_VARIABLES' && /variable_desconocida/.test(error.message)
  );
  assert.equal(sent, false);
});

test('valida la configuración IPv4 de una impresora por línea', () => {
  assert.deepEqual(printerPayload({ id: 2, name: 'Zebra producción', ip: '192.168.1.51' }), {
    id: 2, name: 'Zebra producción', ip: '192.168.1.51'
  });
  assert.throws(() => printerPayload({ id: 2, name: 'Zebra', ip: '192.168.1.999' }), /IP no es válida/);
});

test('crea una impresora usando exclusivamente la empresa autenticada', async () => {
  const calls = [];
  const request = {
    input(name, type, value) { calls.push([name, value]); return this; },
    async query(statement) { calls.push(statement); return { recordset: [], rowsAffected: [1] }; }
  };
  const service = createImpresionHttpService({ poolProvider: async () => ({ request: () => request }) });
  const result = await service.createPrinter(3, { id: 4, name: 'Zebra 2', ip: '10.0.0.25' });

  assert.equal(result.created, true);
  assert.deepEqual(calls.find(([name]) => name === 'EmpCod'), ['EmpCod', 3]);
  assert.match(calls.find((value) => typeof value === 'string'), /INSERT dbo\.ConfImpresoras/);
});

test('el maestro de impresoras lista todas las líneas de la empresa aunque no estén configuradas', async () => {
  const calls = [];
  const request = {
    input(name, type, value) { calls.push([name, value]); return this; },
    async query(statement) {
      calls.push(statement);
      return {
        recordset: [
          { id: 1, machine: 1, lineDescription: 'LINEA 1   ', lineActive: 1, name: 'Zebra 1   ', ip: '192.168.1.51  ' },
          { id: 2, machine: 2, lineDescription: 'LINEA 2   ', lineActive: 0, name: null, ip: null }
        ]
      };
    }
  };
  const service = createImpresionHttpService({ poolProvider: async () => ({ request: () => request }) });
  const result = await service.listPrinterLines(3);

  assert.deepEqual(calls.find(([name]) => name === 'EmpCod'), ['EmpCod', 3]);
  assert.match(calls.find((value) => typeof value === 'string'), /FROM dbo\.LINEAS l/);
  assert.deepEqual(result.rows, [
    { id: 1, machine: 1, lineDescription: 'LINEA 1', lineActive: true, configured: true, name: 'Zebra 1', ip: '192.168.1.51' },
    { id: 2, machine: 2, lineDescription: 'LINEA 2', lineActive: false, configured: false, name: '', ip: '' }
  ]);
});

test('reclama la cola en READ COMMITTED aunque el pool reutilice una conexión serializable', async () => {
  let statement = '';
  const request = {
    input() { return this; },
    async query(value) { statement = value; return { recordset: [] }; }
  };
  const repository = createImpresionRepository({ poolProvider: async () => ({ request: () => request }) });

  assert.equal(await repository.claimNext('worker-test'), null);
  assert.match(statement, /SET TRANSACTION ISOLATION LEVEL READ COMMITTED/);
  assert.match(statement, /UPDLOCK, READPAST, READCOMMITTEDLOCK, ROWLOCK/);
});

test('el maestro puede encolar la etiqueta con su permiso propio de impresoras', () => {
  let allowed = false;
  const req = { auth: { permissions: { programas: [{ SistCod: 100, Modcod: 6, ProgCod: 12 }] } } };
  const res = { status: () => ({ json: () => assert.fail('No debe responder 403') }) };

  printerPrintPermission(req, res, () => { allowed = true; });

  assert.equal(allowed, true);
});

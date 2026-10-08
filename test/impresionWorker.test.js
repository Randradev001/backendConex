const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLegacyBoxCode } = require('../src/impresion-worker/barcode');
const { createImpresionService } = require('../src/impresion-worker/impresion.service');
const { PRINT_STATUS } = require('../src/impresion-worker/constants');
const { createImpresionHttpService, printerPayload } = require('../src/impresion-worker/impresion.http.service');

const design = {
  schemaVersion: 1, name: 'Caja', description: '', widthMm: 100, heightMm: 50,
  dpi: 203, widthDots: 799, heightDots: 400,
  elements: [{ id: 'codigo', type: 'text', xDots: 10, yDots: 10, content: '{{codigo}}', font: '0' }],
  variables: [{ name: 'codigo' }]
};

const context = {
  empCod: 1, machine: 2, lineId: 2, lineState: 1, caliber: '00JD', envCode: 2,
  categoryCode: 34, personCode: 6000, processNumber: 160, processDate: new Date('2017-11-29T12:00:00Z'),
  caliberCode: 7, printerIp: '192.168.1.51', printerPort: 9100, printerTimeoutMs: 1000,
  labelCode: 'LAVINA16', labelVersion: 2, labelDesign: design
};

test('compone el código histórico de caja con anchos fijos', () => {
  assert.equal(buildLegacyBoxCode({ boxNumber: 123, envCode: 2, categoryCode: 34, caliberCode: 7, machine: 2, line: 2, person: 6000 }), '0001230020340070202600>60');
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
});

test('entrega al worker un ZPL de folio ya preparado', async () => {
  const calls = [];
  const repository = {
    claimNext: async () => null,
    claimNextFolio: async () => ({ id: 30, printerIp: '192.168.1.60', printerPort: 9100, zpl: '^XA FOLIO ^XZ' }),
    markFolioPrinted: async (id) => calls.push(['printed', id]),
    finishFolio: async (...args) => calls.push(['finish', ...args])
  };
  const printer = { send: async (value) => calls.push(['send', value]) };
  const result = await createImpresionService({ repository, printer, logger: {} }).processNext();
  assert.equal(result.status, PRINT_STATUS.PRINTED);
  assert.deepEqual(calls.map((call) => call[0]), ['send', 'printed']);
  assert.equal(calls[0][1].zpl, '^XA FOLIO ^XZ');
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

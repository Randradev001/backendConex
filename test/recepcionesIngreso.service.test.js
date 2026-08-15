const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeKey, normalizePayload, normalizeBoardFilters, round2, calculateReceptionWeights } = require('../src/services/recepcionesIngreso.service');

const valid = () => ({
  tempCod: '2017-2018', origin: 1, docType: 1, guide: 99, producer: 'P001', date: '2026-08-04',
  observation: 'manual', details: [{ quarter: 1, species: 2, variety: 3, container: 4, condition: 1, containers: 10, grossKilos: 125.55 }]
});

test('normaliza una recepcion manual sin aceptar empresa', () => {
  const result = normalizePayload({ ...valid(), empCod: 999 });
  assert.equal(result.tempCod, '2017-2018');
  assert.equal(result.details[0].lot, null);
  assert.equal(result.movementType, 1);
  assert.equal(result.movementSubtype, 1);
  assert.equal(Object.hasOwn(result, 'empCod'), false);
});

test('rechaza movimientos que no son recepcion de fruta 1/1', () => {
  assert.throws(() => normalizePayload({ ...valid(), movementType: 2, movementSubtype: 1 }), /movimiento 1\/1/);
});

test('rechaza recepcion sin detalles y lotes repetidos', () => {
  assert.throws(() => normalizePayload({ ...valid(), details: [] }), /al menos un lote/);
  const item = valid().details[0];
  assert.throws(() => normalizePayload({ ...valid(), details: [{ ...item, lot: 10 }, { ...item, lot: 10 }] }), /repetir un lote/);
});

test('rechaza valores de peso y cantidad no positivos', () => {
  assert.throws(() => normalizePayload({ ...valid(), details: [{ ...valid().details[0], containers: 0 }] }), /envases/);
  assert.throws(() => normalizePayload({ ...valid(), details: [{ ...valid().details[0], grossKilos: 0 }] }), /kilos brutos/);
});

test('valida la clave GeneXus completa', () => {
  assert.deepEqual(normalizeKey(valid()), { tempCod: '2017-2018', origin: 1, docType: 1, guide: 99, producer: 'P001' });
  assert.throws(() => normalizeKey({ ...valid(), producer: '' }), /productor/);
});

test('redondea calculos de peso a dos decimales', () => assert.equal(round2(10.005), 10.01));

test('calcula peso neto como numero de envases por kilos brutos unitarios', () => {
  assert.deepEqual(calculateReceptionWeights(12, 8.5), { weight: 8.5, grossKilos: 102, netKilos: 102 });
});

test('normaliza filtros del tablero de lotes con ventana de seis dias por defecto', () => {
  const result = normalizeBoardFilters({ to: '2026-08-11' });
  assert.equal(result.from.toISOString().slice(0, 10), '2026-08-06');
  assert.equal(result.to.toISOString().slice(0, 10), '2026-08-11');
});

test('el hoy del tablero usa la fecha local aunque UTC ya sea el dia siguiente', () => {
  const localNight = new Date(2026, 7, 11, 23, 42, 0);
  const result = normalizeBoardFilters({}, localNight);
  assert.equal(result.to.toISOString().slice(0, 10), '2026-08-11');
});

test('rechaza rangos demasiado extensos para el tablero de lotes', () => {
  assert.throws(() => normalizeBoardFilters({ from: '2026-07-01', to: '2026-08-11' }), /maximo de 31 dias/);
});

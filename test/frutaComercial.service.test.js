const test = require('node:test');
const assert = require('node:assert/strict');
const { listFilters, normalizePayload } = require('../src/modules/frutaComercial/frutaComercial.service');

const validPayload = () => ({
  fcoNumI: '1234567890',
  fcoFecha: '2026-10-21',
  tmCod: 1,
  tmsCod: 1,
  speciesCode: 12,
  kilos: '99999999.99',
  observation: 'Registro manual'
});

test('Fruta Comercial acepta los máximos del XPZ para los campos editables', () => {
  const result = normalizePayload(validPayload());
  assert.equal(result.entryNumber, 1234567890);
  assert.equal(result.kilos, 99999999.99);
  assert.equal(result.observation, 'Registro manual');
});

test('Fruta Comercial rechaza números de ingreso de más de 10 dígitos', () => {
  assert.throws(() => normalizePayload({ ...validPayload(), fcoNumI: '12345678901' }), /N° ingreso/);
});

test('Fruta Comercial rechaza kilos con más de dos decimales o fuera del máximo', () => {
  assert.throws(() => normalizePayload({ ...validPayload(), kilos: '1.234' }), /Kilos/);
  assert.throws(() => normalizePayload({ ...validPayload(), kilos: '100000000' }), /Kilos/);
});

test('Fruta Comercial limita la observación a 50 caracteres y conserva los filtros GX8', () => {
  assert.throws(() => normalizePayload({ ...validPayload(), observation: 'x'.repeat(51) }), /Observación/);
  const filters = listFilters({ from: '2026-10-01', to: '2026-10-21', process: '0', species: '0', movement: '-1', page: '1', pageSize: '25' });
  assert.equal(filters.process, 0);
  assert.equal(filters.species, 0);
  assert.equal(filters.movement, -1);
});

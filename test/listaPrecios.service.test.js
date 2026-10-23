const test = require('node:test');
const assert = require('node:assert/strict');

const { ListaPreciosError, listFilters, parseRecord } = require('../src/modules/listaPrecios/listaPrecios.service');

test('lista de precios conserva el rango inicial de treinta días', () => {
  const filters = listFilters({}, new Date('2026-10-22T12:00:00-03:00'));
  assert.equal(filters.from, '2026-09-22');
  assert.equal(filters.to, '2026-10-22');
});

test('lista de precios admite intervalos abiertos', () => {
  const onlyTo = listFilters({ from: '', to: '2026-10-22' });
  const onlyFrom = listFilters({ from: '2026-10-01', to: '' });
  const noDates = listFilters({ from: '', to: '' });
  assert.equal(onlyTo.from, null);
  assert.equal(onlyFrom.to, null);
  assert.equal(noDates.from, null);
  assert.equal(noDates.to, null);
});

test('lista de precios rechaza un rango invertido', () => {
  assert.throws(
    () => listFilters({ from: '2026-10-23', to: '2026-10-22' }),
    (error) => error instanceof ListaPreciosError && error.code === 'VALIDATION_ERROR'
  );
});

test('lista de precios valida estados de indicadores', () => {
  assert.equal(listFilters({ status: 'por-vencer' }).status, 'por-vencer');
  assert.equal(listFilters({ status: 'anulado' }).status, 'anulado');
  assert.throws(() => listFilters({ status: 'desconocido' }), ListaPreciosError);
});

test('transacción de precios conserva la clave y normaliza sus valores editables', () => {
  const record = parseRecord({
    clientCode: 0, speciesCode: 1, caliber: ' 00jl ', packageCode: 2,
    validFrom: '2026-11-01', validTo: '2026-11-30', currencyCode: 1,
    price: '25,50', appliesToAll: true
  });
  assert.equal(record.caliber, '00JL');
  assert.equal(record.price, 25.5);
  assert.equal(record.appliesToAll, 1);
});

test('transacción de precios permite hasta cuatro decimales', () => {
  const base = { clientCode: 0, speciesCode: 1, caliber: '00JL', packageCode: 2, validFrom: '2026-11-01', validTo: '2026-11-30', currencyCode: 1, appliesToAll: false };
  assert.equal(parseRecord({ ...base, price: '25,1234' }).price, 25.1234);
  assert.throws(() => parseRecord({ ...base, price: '25.12345' }), ListaPreciosError);
});

test('transacción de precios respeta los límites GX8 de sus campos', () => {
  const base = { clientCode: 0, speciesCode: 1, caliber: '00JL', packageCode: 2, validFrom: '2026-11-01', validTo: '2026-11-30', currencyCode: 1, price: 25, appliesToAll: false };
  assert.equal(parseRecord({ ...base, clientCode: 99999 }).clientCode, 99999);
  assert.throws(() => parseRecord({ ...base, clientCode: 100000 }), ListaPreciosError);
  assert.throws(() => parseRecord({ ...base, speciesCode: 1000 }), ListaPreciosError);
  assert.throws(() => parseRecord({ ...base, packageCode: 1000 }), ListaPreciosError);
  assert.throws(() => parseRecord({ ...base, currencyCode: 100 }), ListaPreciosError);
  assert.throws(() => parseRecord({ ...base, caliber: '12345678901' }), ListaPreciosError);
  assert.equal(parseRecord({ ...base, price: '999999999,9999' }).price, 999999999.9999);
  assert.throws(() => parseRecord({ ...base, price: '1000000000' }), ListaPreciosError);
});

test('transacción de precios permite moneda con código cero', () => {
  const record = parseRecord({
    clientCode: 0, speciesCode: 1, caliber: '00JL', packageCode: 2,
    validFrom: '2026-11-01', validTo: '2026-11-30', currencyCode: 0,
    price: 25, appliesToAll: false
  });
  assert.equal(record.currencyCode, 0);
});

test('transacción de precios exige precio positivo y vigencia válida', () => {
  const base = { clientCode: 0, speciesCode: 1, caliber: '00JL', packageCode: 2, validFrom: '2026-11-01', validTo: '2026-11-30', currencyCode: 1, appliesToAll: false };
  assert.throws(() => parseRecord({ ...base, price: 0 }), ListaPreciosError);
  assert.throws(() => parseRecord({ ...base, price: 10, validTo: '2026-10-31' }), ListaPreciosError);
});

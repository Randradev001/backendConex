const test = require('node:test');
const assert = require('node:assert/strict');
const { CapturaCajasError, generateBoxes, parseCodigoCaja, permission } = require('../src/modules/capturaCajas/capturaCajas.service');

test('interpreta el código GX8 de 23 dígitos', () => {
  assert.deepEqual(parseCodigoCaja('12345641800128001020153'), { codigo: '12345641800128001020153', caja: 123456, envase: 418, categoria: 1, calibreCodigo: 280, maquina: 1, linea: 2, persona: 153 });
});
test('rechaza códigos que no cumplen el largo histórico', () => {
  assert.throws(() => parseCodigoCaja('123'), (error) => error instanceof CapturaCajasError && error.code === 'INVALID_BOX_CODE');
});
test('usa el programa histórico CAPCajas02', () => assert.deepEqual(permission, { sistema: 100, modulo: 8, programa: 1 }));
test('limita la generación masiva a mil cajas', async () => {
  await assert.rejects(
    generateBoxes(1, 'PRUEBA', '2017-2018', 174, { desde: 1, hasta: 1001, envase: 1, categoria: 1, calibreCodigo: 46, maquina: 1, linea: 1, persona: 1 }),
    (error) => error instanceof CapturaCajasError && error.code === 'INVALID_RANGE'
  );
});

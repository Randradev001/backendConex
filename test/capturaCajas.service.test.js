const test = require('node:test');
const assert = require('node:assert/strict');
const { CapturaCajasError, generateBoxes, parseCodigoCaja, permission } = require('../src/modules/capturaCajas/capturaCajas.service');
const { readPermission, writePermission } = require('../src/modules/capturaCajas/capturaCajas.routes');

test('interpreta el código GX8 de 23 dígitos', () => {
  assert.deepEqual(parseCodigoCaja('12345641800128001020153'), { codigo: '12345641800128001020153', caja: 123456, envase: 418, categoria: 1, calibreCodigo: 280, maquina: 1, linea: 2, persona: 153 });
});
test('rechaza códigos que no cumplen el largo histórico', () => {
  assert.throws(() => parseCodigoCaja('123'), (error) => error instanceof CapturaCajasError && error.code === 'INVALID_BOX_CODE');
});
test('usa el programa histórico CAPCajas02', () => assert.deepEqual(permission, { sistema: 100, modulo: 8, programa: 1 }));
test('el ADM de órdenes puede consultar lecturas sin recibir permiso de escritura de captura', () => {
  let allowed = false;
  const req = { auth: { permissions: { programas: [{ SistCod: 110, Modcod: 2, ProgCod: 2 }] } } };
  const res = { status: () => ({ json: () => assert.fail('No debe responder 403') }) };

  readPermission(req, res, () => { allowed = true; });

  assert.equal(allowed, true);
});
test('el permiso del ADM no habilita altas ni cambios en CAPCAJAS', () => {
  let statusCode;
  const req = { auth: { permissions: { programas: [{ SistCod: 110, Modcod: 2, ProgCod: 2 }] } } };
  const res = { status: (value) => { statusCode = value; return { json: () => {} }; } };

  writePermission(req, res, () => assert.fail('No debe habilitar escritura'));

  assert.equal(statusCode, 403);
});
test('limita la generación masiva a mil cajas', async () => {
  await assert.rejects(
    generateBoxes(1, 'PRUEBA', '2017-2018', 174, { desde: 1, hasta: 1001, envase: 1, categoria: 1, calibreCodigo: 46, maquina: 1, linea: 1, persona: 1 }),
    (error) => error instanceof CapturaCajasError && error.code === 'INVALID_RANGE'
  );
});

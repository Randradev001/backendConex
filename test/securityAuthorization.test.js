const test = require('node:test');
const assert = require('node:assert/strict');

const { hasPermission, requireAnyPermission } = require('../src/middleware/securityAuthorization');

const permissions = {
  programas: [
    { SistCod: 100, Modcod: 1, ProgCod: 16 },
    { SistCod: 100, Modcod: 1, ProgCod: 32 }
  ],
  acciones: []
};

test('reconoce un programa autorizado aunque los codigos lleguen como texto', () => {
  assert.equal(hasPermission(permissions, { sistema: '100', modulo: '1', programa: '16' }), true);
  assert.equal(hasPermission(permissions, { sistema: 100, modulo: 1, programa: 15 }), false);
});

test('requireAnyPermission permite consultar una cabecera desde su programa relacionado', () => {
  const middleware = requireAnyPermission([
    { sistema: 100, modulo: 1, programa: 15 },
    { sistema: 100, modulo: 1, programa: 16 }
  ]);
  let nextCalled = false;

  middleware({ auth: { permissions } }, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('requireAnyPermission responde 403 cuando ningun programa esta asignado', () => {
  const middleware = requireAnyPermission([
    { sistema: 100, modulo: 1, programa: 30 },
    { sistema: 100, modulo: 1, programa: 31 }
  ]);
  let responseBody;
  const res = {
    status(statusCode) {
      assert.equal(statusCode, 403);
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    }
  };

  middleware({ auth: { permissions } }, res, () => assert.fail('No debe continuar'));

  assert.equal(responseBody.code, 'FORBIDDEN');
});

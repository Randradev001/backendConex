const test = require('node:test');
const assert = require('node:assert/strict');

const { hasPermission, requireAnyPermission, requireSecurityAdmin } = require('../src/middleware/securityAuthorization');

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

test('el programa autorizado habilita sus acciones sin depender de ASIGPROG1', () => {
  assert.equal(hasPermission(permissions, { sistema: 100, modulo: 1, programa: 16, accion: 1 }), true);
  assert.equal(hasPermission(permissions, { sistema: 100, modulo: 1, programa: 15, accion: 1 }), false);
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

const response = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

const withAdminEnv = (values, callback) => {
  const names = ['SECURITY_ADMIN_LOGINS', 'SECURITY_ADMIN_ROLES', 'SECURITY_ADMIN_MIN_LEVEL'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  names.forEach((name) => {
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
  });
  try {
    callback();
  } finally {
    names.forEach((name) => {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    });
  }
};

test('ADMINFULL administra seguridad sin depender del nivel', () => withAdminEnv({}, () => {
  const res = response();
  let called = false;
  requireSecurityAdmin({ auth: { user: { login: 'usuario', nivelSeguridad: 0, roles: ['adminfull'] } } }, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.statusCode, null);
}));

test('un nivel alto no administra seguridad sin umbral configurado', () => withAdminEnv({}, () => {
  const res = response();
  requireSecurityAdmin({ auth: { user: { login: 'usuario', nivelSeguridad: 999, roles: [] } } }, res, () => assert.fail('No debe autorizar por nivel.'));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'SECURITY_ADMIN_REQUIRED');
}));

test('el umbral legado funciona solamente cuando se configura', () => withAdminEnv({ SECURITY_ADMIN_MIN_LEVEL: '900' }, () => {
  const res = response();
  let called = false;
  requireSecurityAdmin({ auth: { user: { login: 'usuario', nivelSeguridad: 900, roles: [] } } }, res, () => { called = true; });
  assert.equal(called, true);
}));

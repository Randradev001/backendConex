const test = require('node:test');
const assert = require('node:assert/strict');

const { retainedRoleActions } = require('../src/services/seguridadRoles.service');

test('conserva acciones de programas retenidos al guardar la plantilla del rol', () => {
  const actions = [
    { SistCod: 100, Modcod: 2, ProgCod: 1, ProgOPCod: 1 },
    { SistCod: 100, Modcod: 2, ProgCod: 1, ProgOPCod: 2 },
    { SistCod: 100, Modcod: 2, ProgCod: 32, ProgOPCod: 3 }
  ];

  assert.deepEqual(
    retainedRoleActions(actions, [{ SistCod: 100, Modcod: 2, ProgCod: 1 }]),
    actions.slice(0, 2)
  );
});

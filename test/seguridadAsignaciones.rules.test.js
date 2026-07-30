const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeAssignment,
  normalizeLogin,
  buildAssignmentPlan
} = require('../src/services/seguridadAsignaciones.rules');

test('normaliza modulos repetidos y une sus programas sin duplicados', () => {
  const result = normalizeAssignment({
    assigned: true,
    modules: [
      { Modcod: 20, programs: [3, 1, 3] },
      { modCod: 10, programas: [{ ProgCod: 8 }] },
      { Modcod: 20, programs: [2] }
    ]
  });

  assert.deepEqual(result, {
    assigned: true,
    modules: [
      { Modcod: 10, programs: [8] },
      { Modcod: 20, programs: [1, 2, 3] }
    ]
  });
});

test('quitar el sistema descarta cualquier seleccion hija recibida', () => {
  assert.deepEqual(normalizeAssignment({ assigned: false, modules: [{ Modcod: 1, programs: [1] }] }), {
    assigned: false,
    modules: []
  });
});

test('valida el usuario y los codigos positivos', () => {
  assert.equal(normalizeLogin('  usuario  '), 'USUARIO');
  assert.throws(() => normalizeAssignment({ assigned: true, modules: [{ Modcod: 0 }] }), (error) => {
    assert.equal(error.code, 'VALIDATION_ERROR');
    return true;
  });
});

test('calcula solo las diferencias de una reasignacion', () => {
  const plan = buildAssignmentPlan({
    assigned: true,
    modules: [{ Modcod: 10 }, { Modcod: 20 }],
    programs: [
      { Modcod: 10, ProgCod: 1 },
      { Modcod: 10, ProgCod: 2 },
      { Modcod: 20, ProgCod: 3 }
    ]
  }, {
    assigned: true,
    modules: [
      { Modcod: 10, programs: [2, 4] },
      { Modcod: 30, programs: [] }
    ]
  });

  assert.deepEqual(plan, {
    assignSystem: false,
    removeSystem: false,
    addModules: [30],
    removeModules: [20],
    addPrograms: [{ Modcod: 10, ProgCod: 4 }],
    removePrograms: [
      { Modcod: 10, ProgCod: 1 },
      { Modcod: 20, ProgCod: 3 }
    ]
  });
});

test('quitar un sistema planifica la eliminacion completa de sus hijos', () => {
  const plan = buildAssignmentPlan({
    assigned: true,
    modules: [{ Modcod: 2 }],
    programs: [{ Modcod: 2, ProgCod: 7 }]
  }, { assigned: false, modules: [] });

  assert.equal(plan.removeSystem, true);
  assert.deepEqual(plan.removeModules, [2]);
  assert.deepEqual(plan.removePrograms, [{ Modcod: 2, ProgCod: 7 }]);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { retainedRoleActions, reapplyRolePermissions } = require('../src/services/seguridadRoles.service');
const { sql } = require('../src/conectorMysql/conectorSqlServer');

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

const reapplyDependencies = (targets, { failUser, roleExists = true } = {}) => {
  const queries = [];
  const transaction = {
    async begin(isolation) { this.isolation = isolation; },
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; },
    request() {
      const inputs = {};
      return {
        input(name, _type, value) { inputs[name] = value; return this; },
        async query(statement) {
          queries.push({ statement, inputs });
          if (/FROM UROLES/.test(statement)) return { recordset: roleExists ? [{ ROLCod: 'OPERADOR' }] : [] };
          if (/FROM URolesPorUser/.test(statement)) return { recordset: targets };
          if (inputs.login === failUser) throw new Error('Fallo al cargar los programas');
          return { recordset: [] };
        }
      };
    }
  };
  return {
    queries,
    transaction,
    options: { poolProvider: async () => ({}), transactionFactory: () => transaction }
  };
};

test('actualizar rol reemplaza permisos de todos sus usuarios en sus respectivas empresas', async () => {
  const deps = reapplyDependencies([
    { GECODEMP: 1, UsuLogin: 'USUARIO1 ' },
    { GECODEMP: 2, UsuLogin: 'USUARIO2' }
  ]);
  const result = await reapplyRolePermissions('operador', {}, { empCod: 1, login: 'ADMIN' }, deps.options);

  assert.equal(result.data.updatedUsers, 2);
  assert.equal(deps.transaction.isolation, sql.ISOLATION_LEVEL.SERIALIZABLE);
  assert.equal(deps.transaction.committed, true);
  assert.equal(deps.transaction.rolledBack, undefined);
  assert.match(deps.queries[1].statement, /GECODEMP>0/);
  assert.doesNotMatch(deps.queries[1].statement, /GECODEMP=@empCod/);
  assert.deepEqual(deps.queries.slice(2).map(({ inputs }) => inputs), [
    { empCod: 1, login: 'USUARIO1', role: 'OPERADOR', actor: 'ADMIN' },
    { empCod: 2, login: 'USUARIO2', role: 'OPERADOR', actor: 'ADMIN' }
  ]);
  for (const { statement } of deps.queries.slice(2)) {
    const deletedTables = [...statement.matchAll(/DELETE FROM (\w+) WHERE GECODEMP=@empCod/g)].map((match) => match[1]);
    assert.deepEqual(deletedTables, ['ASIGPROG1', 'ASIGPROG', 'ASIG', 'ASIGSIST']);
    assert.doesNotMatch(statement, /DELETE FROM URolesPorUser|ProgTipo/);
  }
});

test('reaplicar desde un usuario limita la seleccion a su empresa de sesion', async () => {
  const deps = reapplyDependencies([{ GECODEMP: 3, UsuLogin: 'USUARIO1' }]);
  await reapplyRolePermissions('OPERADOR', { UsuLogin: 'usuario1', GECODEMP: 9 }, { empCod: 3, login: 'ADMIN' }, deps.options);

  assert.match(deps.queries[1].statement, /GECODEMP=@empCod AND RTRIM\(UsuLogin\)=@login/);
  assert.deepEqual(deps.queries[1].inputs, { role: 'OPERADOR', empCod: 3, login: 'USUARIO1' });
});

test('revierte toda la actualizacion si falla la carga de cualquier usuario', async () => {
  const deps = reapplyDependencies([
    { GECODEMP: 1, UsuLogin: 'USUARIO1' },
    { GECODEMP: 1, UsuLogin: 'USUARIO2' }
  ], { failUser: 'USUARIO2' });
  await assert.rejects(reapplyRolePermissions('OPERADOR', {}, { empCod: 1, login: 'ADMIN' }, deps.options), /Fallo al cargar/);
  assert.equal(deps.transaction.committed, undefined);
  assert.equal(deps.transaction.rolledBack, true);
});

test('un usuario sin ese rol no pierde permisos', async () => {
  const deps = reapplyDependencies([]);
  await assert.rejects(
    reapplyRolePermissions('OPERADOR', { UsuLogin: 'USUARIO1' }, { empCod: 1, login: 'ADMIN' }, deps.options),
    (error) => error.code === 'ROLE_ASSIGNMENT_NOT_FOUND'
  );
  assert.equal(deps.queries.length, 2);
  assert.equal(deps.transaction.rolledBack, true);
});

test('un rol sin usuarios informa cero actualizaciones sin ejecutar borrados', async () => {
  const deps = reapplyDependencies([]);
  const result = await reapplyRolePermissions('OPERADOR', {}, { empCod: 1, login: 'ADMIN' }, deps.options);
  assert.equal(result.data.updatedUsers, 0);
  assert.equal(deps.queries.length, 2);
  assert.equal(deps.transaction.committed, true);
});

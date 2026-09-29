const test = require('node:test');
const assert = require('node:assert/strict');

const { OrdenesProcesoError, setProcessActive } = require('../src/services/ordenesProceso.service');

const dependencies = (responses) => {
  const queries = [];
  const transaction = {
    begin: async () => {},
    commit: async () => { transaction.committed = true; },
    rollback: async () => { transaction.rolledBack = true; }
  };
  return {
    queries,
    transaction,
    options: {
      poolProvider: async () => ({}),
      transactionFactory: () => transaction,
      requestFactory: () => ({
        input() { return this; },
        async query(statement) {
          queries.push(statement);
          return responses.shift();
        }
      })
    }
  };
};

test('inicia una orden ingresada y registra los datos de apertura', async () => {
  const deps = dependencies([{ recordset: [{ OrdpEstado: 0 }] }, { recordset: [] }, { recordset: [] }]);
  const result = await setProcessActive(1, 'OPERADOR', '2017-2018', 25, true, deps.options);

  assert.equal(result.state, 1);
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[2], /OrdpEstado=1/);
  assert.match(deps.queries[2], /OrdpFecA=GETDATE\(\)/);
  assert.match(deps.queries[2], /OrdpLoginA=@Login/);
});

test('rechaza iniciar una segunda orden activa en la misma temporada', async () => {
  const deps = dependencies([{ recordset: [{ OrdpEstado: 0 }] }, { recordset: [{ Ordpnum: 24 }] }]);

  await assert.rejects(
    setProcessActive(1, 'OPERADOR', '2017-2018', 25, true, deps.options),
    (error) => error instanceof OrdenesProcesoError && error.code === 'ACTIVE_ORDER_EXISTS'
  );
  assert.equal(deps.transaction.rolledBack, true);
});

test('desactiva solamente una orden activa y registra el termino', async () => {
  const deps = dependencies([{ recordset: [{ OrdpEstado: 1 }] }, { recordset: [] }]);
  const result = await setProcessActive(1, 'OPERADOR', '2017-2018', 25, false, deps.options);

  assert.equal(result.state, 0);
  assert.equal(deps.transaction.committed, true);
  assert.match(deps.queries[1], /OrdpEstado=0/);
  assert.match(deps.queries[1], /OrdpHHFinP=GETDATE\(\)/);
});

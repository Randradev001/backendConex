const { test } = require('node:test');
const assert = require('node:assert/strict');
const connector = require('../src/conectorMysql/conectorSqlServer');
let inputs;
let query;
connector.getPool = async () => ({ request() {
  inputs = {};
  return { input(name, _type, value) { inputs[name] = value; return this; }, async query(text) {
    query = text;
    return { recordset: Array.from({ length: 501 }, (_, i) => ({ Ordpnum: i + 1 })) };
  } };
} });
const { listOrdenesProcesoAdm } = require('../src/controllers/maestrosController');
async function invoke(params = {}) {
  let status = 200;
  let body;
  await listOrdenesProcesoAdm({ query: { TempCod: '2017-2018', ...params }, context: { empCod: 1 } }, {
    status(value) { status = value; return this; }, json(value) { body = value; }
  });
  return { status, body };
}
test('listado conserva más de 500 resultados y usa empresa de sesión', async () => {
  const result = await invoke({ EmpCod: 999, limit: 500 });
  assert.equal(result.status, 200);
  assert.equal(result.body.count, 501);
  assert.equal(inputs.EmpCod, 1);
  assert.doesNotMatch(query, /SELECT TOP \(@Limit\)/i);
});
test('fechas abiertas, filtros combinados y estado cero', async () => {
  for (const [From, To] of [['', '2026-10-21'], ['2026-09-21', ''], ['', '']]) {
    const result = await invoke({ From, To, Especod: '1', VarCod: '2', OrdpEstado: '0', q: '175' });
    assert.equal(result.status, 200);
    assert.equal(inputs.From === null, From === '');
    assert.equal(inputs.To === null, To === '');
    assert.equal(inputs.OrdpEstado, 0);
    assert.equal(inputs.Especod, 1);
    assert.equal(inputs.VarCod, 2);
    assert.equal(inputs.q, '%175%');
    assert.match(query, /@To IS NULL OR o.OrdpFecha<DATEADD\(day,1,@To\)/);
  }
});
test('rechaza rango invertido, fecha inválida y temporada ausente', async () => {
  for (const params of [{ From: '2026-10-22', To: '2026-10-21' }, { From: '2026-02-30' }, { TempCod: '' }]) {
    assert.equal((await invoke(params)).status, 400);
  }
});

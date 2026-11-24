const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCommuneCatalog, getCommuneNumericId, getCommuneByNumericId } = require('../src/catalogs/chileComunas');

test('despliega comunas aunque la tabla SQL esté vacía', () => {
  const rows = buildCommuneCatalog({ databaseRows: [], limit: 1000 });
  assert.ok(rows.length >= 340);
  assert.deepEqual(rows.find((row) => row.Comdesc === 'CODEGUA'), { ComCod: '06,01,04', Comdesc: 'CODEGUA' });
});

test('busca y combina comunas de productores sin duplicar el catálogo', () => {
  const rows = buildCommuneCatalog({
    databaseRows: [{ ComCod: '', Comdesc: 'CODEGUA' }, { ComCod: '', Comdesc: 'COMUNA OPERACIONAL' }],
    q: 'comuna',
    limit: 1000
  });
  assert.deepEqual(rows, [{ ComCod: '', Comdesc: 'COMUNA OPERACIONAL' }]);
});

test('convierte nombre e identificador numérico sin depender de Fact_Comunas', () => {
  const id = getCommuneNumericId('CODEGUA');
  assert.ok(Number.isInteger(id));
  assert.equal(getCommuneByNumericId(id).Comdesc, 'CODEGUA');
  assert.equal(getCommuneNumericId('COMUNA INEXISTENTE'), null);
  assert.equal(getCommuneByNumericId(9999), null);
});

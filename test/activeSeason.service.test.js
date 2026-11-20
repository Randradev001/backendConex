const test = require('node:test');
const assert = require('node:assert/strict');
const { getActiveSeason, ActiveSeasonError } = require('../src/services/activeSeason.service');

const source = (rows) => ({
  request: () => ({
    input() { return this; },
    async query() { return { recordset: rows }; }
  })
});

test('devuelve la unica temporada activa de la empresa', async () => {
  const active = await getActiveSeason(source([{ tempCod: '2026-2027', description: 'Temporada 2026-2027' }]), 1);
  assert.equal(active.tempCod, '2026-2027');
});

test('rechaza cero o mas de una temporada activa', async () => {
  await assert.rejects(() => getActiveSeason(source([]), 1), ActiveSeasonError);
  await assert.rejects(() => getActiveSeason(source([{ tempCod: 'A' }, { tempCod: 'B' }]), 1), ActiveSeasonError);
});

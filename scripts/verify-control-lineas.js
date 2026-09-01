const assert = require('node:assert/strict');
const { getPool } = require('../src/conectorMysql/conectorSqlServer');
const { listControlLines, listControlLineCatalogs } = require('../src/services/controlLineas.service');

const run = async () => {
  const pool = await getPool();
  const companyResult = await pool.request().query('SELECT TOP (1) EmpCod FROM LINEAS ORDER BY EmpCod;');
  const empCod = Number(companyResult.recordset[0]?.EmpCod);
  assert.ok(Number.isInteger(empCod) && empCod > 0, 'No existen lineas para verificar.');

  const result = await listControlLines(empCod, { poolProvider: async () => pool });
  assert.ok(result.lines.length > 0, 'El tablero no devolvio lineas.');
  assert.equal(result.summary.total, result.lines.length);
  assert.equal(result.summary.active + result.summary.inactive, result.summary.total);
  assert.ok(result.lines.every((line) => Number.isInteger(line.machine) && Number.isInteger(line.line)));
  assert.ok(result.machines.length > 0, 'El tablero no devolvio filtros de maquina.');
  assert.ok(result.production && typeof result.production === 'object', 'El tablero no devolvio el indicador de produccion.');
  assert.ok(Number.isInteger(result.production.activeProcessCount) && result.production.activeProcessCount >= 0);
  assert.ok(Number.isInteger(result.production.processedBoxes) && result.production.processedBoxes >= 0);
  const catalogs = await listControlLineCatalogs(empCod, { poolProvider: async () => pool });
  for (const name of ['species', 'calibers', 'containers', 'categories']) {
    assert.ok(catalogs[name].length > 0, `El catalogo ${name} esta vacio.`);
  }

  console.log(JSON.stringify({
    empCod,
    summary: result.summary,
    production: result.production,
    machines: result.machines.length,
    catalogs: Object.fromEntries(Object.entries(catalogs).map(([name, rows]) => [name, rows.length]))
  }));
  await pool.close();
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

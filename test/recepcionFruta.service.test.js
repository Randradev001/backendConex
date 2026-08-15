const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeFilters, summarySql, detailSql } = require('../src/services/recepcionFruta.service');

test('normaliza filtros GX y limita la paginacion', () => {
  const filters = normalizeFilters({
    tempCod: ' 2017-2018 ', from: '2017-01-01', to: '2017-12-31', producer: ' GG ',
    origin: '2', quarter: '15', species: '3', page: '2', limit: '5000'
  });
  assert.equal(filters.tempCod, '2017-2018');
  assert.equal(filters.producer, null);
  assert.equal(filters.origin, 2);
  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 1000);
});

test('rechaza rangos de fecha invertidos', () => {
  assert.throws(
    () => normalizeFilters({ from: '2026-08-05', to: '2026-08-04' }),
    /fecha desde no puede ser posterior/
  );
});

test('la consulta detallada usa la fecha de cabecera y no Mov1Fecha', () => {
  const query = detailSql();
  assert.match(query, /h\.MovFecha>=@FromDate/);
  assert.match(query, /h\.MovFecha<DATEADD\(day,1,@ToDate\)/);
  assert.doesNotMatch(query, /d\.Mov1Fecha/);
  assert.match(query, /h\.EmpCod=@EmpCod AND h\.TMcod=1 AND h\.TMSCod=1/);
});

test('el detalle conserva la llave completa del lote y enlaza el ultimo control vigente', () => {
  const query = detailSql();
  assert.match(query, /d\.Mov1Nlote/);
  assert.match(query, /OUTER APPLY/);
  assert.match(query, /c\.MovTDoc=d\.MovTDoc AND c\.MovNGuia=d\.MovNGuia AND c\.MovProd=d\.MovProd/);
  assert.match(query, /c\.Mov1Nlote=d\.Mov1Nlote AND c\.CalRecEstado<>'A'/);
  assert.match(query, /quality\.CalRecPorCalidad AS qualityPercentage/);
  assert.match(query, /ORDER BY c\.CalRecFecha DESC,c\.CalRecHora DESC,c\.CalRecId DESC/);
  assert.doesNotMatch(query, /GROUP BY/);
});

test('el resumen lista lotes y cuenta como pendiente todo control no finalizado', () => {
  const query = summarySql();
  assert.match(query, /STRING_AGG\(CONVERT\(varchar\(20\),d\.Mov1Nlote\)/);
  assert.match(query, /quality\.CalRecEstado='F' THEN 'F' ELSE 'P'/);
  assert.match(query, /quality\.CalRecId/);
  assert.match(query, /quality\.CalRecPorCalidad/);
  assert.match(query, /COALESCE\(quality\.CalRecEstado,''\)<>'F'/);
  assert.match(query, /c\.Mov1Nlote=d\.Mov1Nlote AND c\.CalRecEstado<>'A'/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPackingReport, renderPackingPdf } = require('../src/modules/packingList/packingList.pdf');
const connector = require('../src/conectorMysql/conectorSqlServer');
const history = [];
let packingType = 1;
let missing = false;
let sources = [{ DORNum: 321 }];
let lines;
const baseRow = { speciesCode: 1, speciesName: 'Manzanas', varietyCode: 10, varietyName: 'Gala',
  containerCode: 1, containerName: 'Caja cartón', categoryCode: 1, categoryName: 'Primera', caliber: '100',
  producerName: 'Productor de prueba', processDate: '2026-11-10', folio: '0000000001', correlation: 1, boxes: 10 };
class Request {
  constructor() { this.inputs = {}; }
  input(name, _type, value) { this.inputs[name] = value; return this; }
  async query(query) {
    history.push({ query, inputs: { ...this.inputs } });
    if (query.includes('FROM TEMP01')) return { recordset: [{ tempCod: '2026-2027' }] };
    if (query.includes('FROM PACKLIST p')) return { recordset: missing ? [] : [{ PackNumI: 7, PackTipo: packingType, PackNumG: 99, PackFecha: '2026-11-11' }] };
    if (query.includes('FROM DESORIGEN WHERE')) return { recordset: sources };
    if (query.includes('FROM DESORIGEN2 d')) return { recordset: lines };
    throw new Error('Consulta inesperada');
  }
}
const original = connector.getPool;
connector.getPool = async () => ({ request: () => new Request() });
const service = require('../src/modules/packingList/packingList.service');
connector.getPool = original;

test.beforeEach(() => { packingType = 1; missing = false; sources = [{ DORNum: 321 }]; lines = [{ ...baseRow }]; history.length = 0; });

test('Packing01 conserva líneas y cuenta folios por especie; Packing02 agrupa por claves completas', () => {
  const rows = [baseRow, { ...baseRow, correlation: 2, boxes: 20 },
    { ...baseRow, folio: '0000000002', categoryCode: 2, boxes: 5 },
    { ...baseRow, speciesCode: 2, speciesName: 'Peras', varietyCode: 20, boxes: 7 },
    { ...baseRow, varietyCode: 11, boxes: 2 }];
  const data = buildPackingReport({ header: {}, details: rows, report: 'packing02', tempCod: '2026-2027' });
  assert.deepEqual(data.totals, { boxes: 44, pallets: 3 });
  assert.equal(data.groups[0].rows.length, 4);
  assert.equal(data.groups[0].pallets, 2);
  assert.equal(data.groups[0].boxes, 37);
  assert.equal(data.groups[0].varieties.length, 2);
  assert.equal(data.groups[0].varieties[0].boxes, 35);
  assert.deepEqual(data.groups[0].varieties[0].rows.map((r) => r.boxes), [30, 5]);
});

test('resuelve número final a clave interna y consulta todas las líneas con empresa, temporada y tipo', async () => {
  for (const type of [1, 2, 3]) {
    packingType = type;
    const report = await service.getReportData(8, 7, 'packing02');
    assert.equal(report.totals.boxes, 10);
    const query = history.at(-1);
    assert.deepEqual(query.inputs, { EmpCod: 8, TempCod: '2026-2027', PackTipo: type, DORNum: 321 });
    assert.match(query.query, /d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=@PackTipo AND d.DORNum=@DORNum/);
    assert.doesNotMatch(query.query, /TOP|OFFSET/i);
  }
});

test('rechaza reporte desconocido, packing ajeno y tipo comercial', async () => {
  await assert.rejects(service.getReportData(1, 7, 'packing01_OT'), /reporte.*válido/);
  assert.equal(history.length, 0);
  missing = true;
  await assert.rejects(service.getReportData(1, 7), { code: 'NOT_FOUND' });
  missing = false;
  packingType = 4;
  await assert.rejects(service.getReportData(1, 7), { code: 'UNSUPPORTED_PACKING_TYPE' });
});

test('no genera un PDF engañoso cuando falta el origen, está duplicado o no tiene líneas', async () => {
  sources = [];
  await assert.rejects(service.getReportData(1, 7), { code: 'SOURCE_NOT_FOUND' });
  sources = [{ DORNum: 1 }, { DORNum: 2 }];
  await assert.rejects(service.getReportData(1, 7), { code: 'AMBIGUOUS_SOURCE' });
  sources = [{ DORNum: 1 }];
  lines = [];
  await assert.rejects(service.getReportData(1, 7), { code: 'EMPTY_REPORT' });
});

test('genera ambos PDFs y pagina un detalle extenso sin perder líneas', async () => {
  for (const report of ['packing01', 'packing02']) {
    const file = await service.getPdf(1, 7, report);
    assert.match(file.filename, /^Packing0[12]_7.pdf$/);
    assert.equal(file.buffer.subarray(0, 5).toString(), '%PDF-');
    assert.equal((file.buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
  }
  const data = buildPackingReport({ header: { PackNumI: 7, PackNumG: 99, companyName: 'Empresa de prueba' },
    details: Array.from({ length: 120 }, (_, i) => ({ ...baseRow, folio: String(i + 1).padStart(10, '0') })), report: 'packing01', tempCod: '2026-2027' });
  assert.equal(data.totals.boxes, 1200);
  assert.equal(data.totals.pallets, 120);
  const pdf = await renderPackingPdf(data);
  assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 2);
});

test('la ruta exige sesión y programa asignado, y usa la empresa de sesión para el PDF', async () => {
  const express = require('express');
  const security = require('../src/services/seguridad.service');
  const originalSession = security.getSession;
  security.getSession = async (token) => token ? {
    company: { empCod: 8 }, user: { login: 'prueba' },
    permissions: { programas: token === 'allowed' ? [{ SistCod: 100, Modcod: 2, ProgCod: 13 }] : [] }
  } : null;
  const app = express();
  app.use('/packing-list', require('../src/modules/packingList/packingList.routes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/packing-list/packings/7/pdf`;
  const cookieName = require('../src/middleware/authContext').COOKIE_NAME;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { Cookie: `${cookieName}=denied` } })).status, 403);
    const response = await fetch(`${url}?report=packing02&EmpCod=99`, { headers: { Cookie: `${cookieName}=allowed` } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/pdf/);
    assert.match(response.headers.get('content-disposition'), /Packing02_7.pdf/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal(history.at(-1).inputs.EmpCod, 8);
  } finally {
    security.getSession = originalSession;
    await new Promise((resolve) => server.close(resolve));
  }
});

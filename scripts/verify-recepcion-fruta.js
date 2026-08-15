require('dotenv').config();

const { PassThrough } = require('node:stream');
const controller = require('../src/controllers/recepcionFrutaController');
const service = require('../src/services/recepcionFruta.service');
const { getPool } = require('../src/conectorMysql/conectorSqlServer');

const collectPdf = async (req) => {
  const res = new PassThrough();
  const chunks = [];
  res.setHeader = () => {};
  res.on('data', (chunk) => chunks.push(chunk));
  const ended = new Promise((resolve, reject) => {
    res.on('end', resolve);
    res.on('error', reject);
  });
  await controller.exportPdf(req, res, (error) => { throw error; });
  await ended;
  return Buffer.concat(chunks);
};

const collectExcel = async (req) => {
  let output;
  const res = {
    setHeader() {},
    send(buffer) { output = buffer; return buffer; }
  };
  await controller.exportExcel(req, res, (error) => { throw error; });
  return output;
};

(async () => {
  const catalogs = await service.listCatalogs(1);
  const season = catalogs.seasons.find((item) => Number(item.active) === 1) || catalogs.seasons[0];
  if (!season) throw new Error('No existe una temporada para verificar.');

  const query = { tempCod: season.value, limit: 5 };
  const [summary, detail] = await Promise.all([
    service.listSummary(1, query),
    service.listDetail(1, query)
  ]);
  if (!summary.rows.length || !detail.rows.length) throw new Error('Las consultas no devolvieron evidencia verificable.');

  const request = { context: { empCod: 1 }, query: { tempCod: season.value, view: 'detail' } };
  const [xlsx, pdf] = await Promise.all([collectExcel(request), collectPdf(request)]);
  if (xlsx.subarray(0, 2).toString() !== 'PK') throw new Error('La exportacion XLSX no tiene una firma ZIP valida.');
  if (pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('La exportacion PDF no tiene una firma valida.');

  console.log(JSON.stringify({
    season: season.value,
    summary: { total: summary.total, sample: summary.rows.length, totals: summary.totals },
    detail: { total: detail.total, sample: detail.rows.length, totals: detail.totals },
    exports: { xlsxBytes: xlsx.length, pdfBytes: pdf.length }
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  const pool = await getPool();
  await pool.close();
});

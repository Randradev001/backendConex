const service = require('../services/ordenesProceso.service');
const PDFDocument = require('pdfkit');
const context = (req) => ({ empCod: Number(req.context?.empCod), login: String(req.context?.login || '') });
const run = (fn) => async (req, res, next) => { try { return await fn(req, res); } catch (e) { if (e instanceof service.OrdenesProcesoError) return res.status(e.status).json({ code: e.code, message: e.message }); return next(e); } };

const clean = (value) => String(value ?? '').trim();
const formatNumber = (value, decimals = 2) => new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value || 0));
const formatDate = (value) => {
  const raw = value instanceof Date ? value.toISOString() : clean(value);
  const [year, month, day] = raw.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '-';
};

const pdf = run(async (req, res) => {
  const data = await service.getOrder(context(req).empCod, req.params.tempCod, req.params.ordpnum);
  const { header, details, company } = data;
  const filename = `orden-proceso-${clean(header.TempCod)}-${header.Ordpnum}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: 'A4', margin: 38, bufferPages: true, info: { Title: `Orden de proceso ${header.Ordpnum}` } });
  doc.pipe(res);
  const green = '#176B3A'; const pale = '#EAF5EE'; const ink = '#172033'; const muted = '#607080';
  const left = doc.page.margins.left; const width = doc.page.width - left - doc.page.margins.right;
  const field = (label, value, x, y, fieldWidth) => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(muted).text(label.toUpperCase(), x, y, { width: fieldWidth });
    doc.font('Helvetica').fontSize(10).fillColor(ink).text(clean(value) || '-', x, y + 11, { width: fieldWidth, ellipsis: true });
  };
  doc.roundedRect(left, 38, width, 104, 7).fill(green);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#FFFFFF').text('ORDEN DE PROCESO CREADA', left + 22, 56);
  doc.font('Helvetica').fontSize(9).text(clean(company?.EmpNom) || `Empresa ${context(req).empCod}`, left + 22, 81);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#D8F0E0').text('NÚMERO DE ORDEN', left + width - 208, 52, { width: 180, align: 'center' });
  doc.fontSize(40).fillColor('#FFFFFF').text(formatNumber(header.Ordpnum, 0), left + width - 208, 68, { width: 180, align: 'center' });
  let y = 165;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(green).text('Información registrada', left, y);
  y += 18;
  doc.roundedRect(left, y, width, 120, 5).fill(pale);
  const col = width / 2;
  field('Temporada', header.TempCod, left + 16, y + 14, col - 28);
  field('Fecha', formatDate(header.OrdpFecha), left + col, y + 14, col - 16);
  field('Productor', `${clean(header.ProdCod)} - ${clean(header.ProdNom)}`, left + 16, y + 50, col - 28);
  field('Especie / variedad', `${clean(header.EspeNom)} / ${clean(header.VarNom)}`, left + col, y + 50, col - 16);
  field('Exportadora', `${header.ExpCod ?? ''} - ${clean(header.ExpNom)}`, left + 16, y + 86, col - 28);
  field('Etiqueta', header.OrdpCodEti, left + col, y + 86, col - 16);
  y += 140;
  doc.roundedRect(left, y, width, 62, 5).fill(green);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#D8F0E0').text('RESUMEN DE LA ORDEN', left + 18, y + 10);
  doc.fontSize(17).fillColor('#FFFFFF').text(`${details.length} lote${details.length === 1 ? '' : 's'}`, left + 18, y + 28, { width: 130 });
  doc.text(`${formatNumber(header.OrdpTotEnv, 0)} envases`, left + 185, y + 28, { width: 145 });
  doc.text(`${formatNumber(header.OrdpTotKilos)} kg`, left + 355, y + 28, { width: 145 });
  y += 86;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(green).text('Lotes seleccionados', left, y);
  y += 20;
  const columns = [
    { label: 'Lote', width: 85, value: (row) => formatNumber(row.Ordp1Nlote, 0) },
    { label: 'Productor', width: 210, value: (row) => clean(row.ProdNom) || clean(header.ProdNom) },
    { label: 'Calidad', width: 75, value: (row) => row.qualityPercentage == null ? '-' : `${formatNumber(row.qualityPercentage)}%` },
    { label: 'Envases', width: 75, value: (row) => formatNumber(row.Ordp1Env, 0) },
    { label: 'Kilos', width: width - 445, value: (row) => formatNumber(row.Ordp1Kilos) }
  ];
  const drawHeader = () => {
    let x = left;
    columns.forEach((column) => { doc.rect(x, y, column.width, 22).fill(green); doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(column.label, x + 6, y + 7, { width: column.width - 12 }); x += column.width; });
    y += 22;
  };
  drawHeader();
  details.forEach((row, index) => {
    if (y + 25 > doc.page.height - 48) { doc.addPage(); y = doc.page.margins.top; drawHeader(); }
    if (index % 2 === 0) doc.rect(left, y, width, 24).fill('#F4F8F5');
    let x = left;
    columns.forEach((column) => { doc.font('Helvetica').fontSize(8.5).fillColor(ink).text(column.value(row), x + 6, y + 7, { width: column.width - 12, ellipsis: true }); x += column.width; });
    y += 24;
  });
  const pages = doc.bufferedPageRange();
  for (let page = 0; page < pages.count; page += 1) {
    doc.switchToPage(page); doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor(muted).text(`${clean(company?.EmpNom) || 'CONEX-CO'} · Orden ${header.Ordpnum} · Página ${page + 1} de ${pages.count}`, left, doc.page.height - 25, { width, align: 'center', lineBreak: false });
  }
  doc.end();
});

module.exports = { lots: run(async (req, res) => res.json(await service.listLots(context(req).empCod, req.query))), create: run(async (req, res) => res.status(201).json(await service.create(context(req).empCod, context(req).login, req.body))), update: run(async (req, res) => res.json(await service.update(context(req).empCod, context(req).login, req.params.tempCod, req.params.ordpnum, req.body))), setActive: run(async (req, res) => res.json(await service.setProcessActive(context(req).empCod, context(req).login, req.params.tempCod, req.params.ordpnum, req.body?.active))), detail: run(async (req, res) => res.json(await service.getOrder(context(req).empCod, req.params.tempCod, req.params.ordpnum))), pdf };

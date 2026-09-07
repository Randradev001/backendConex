const service = require('../services/recepcionesIngreso.service');
const PDFDocument = require('pdfkit');

const context = (req) => {
  const empCod = Number(req.context?.empCod);
  if (!Number.isInteger(empCod) || empCod < 1) throw new service.RecepcionesIngresoError(401, 'COMPANY_CONTEXT_REQUIRED', 'La sesion no tiene empresa valida.');
  return { empCod, login: String(req.context?.login || '').trim() };
};
const key = (req) => ({ tempCod: req.params.tempCod, origin: req.params.origin, docType: req.params.docType, guide: req.params.guide, producer: req.params.producer });
const run = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) {
    if (error instanceof service.RecepcionesIngresoError) return res.status(error.status).json({ code: error.code, message: error.message });
    return next(error);
  }
};

const clean = (value) => String(value ?? '').trim();
const number = (value, decimals = 2) => new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value || 0));
const date = (value) => {
  const raw = value instanceof Date ? value.toISOString() : clean(value);
  const [year, month, day] = raw.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '-';
};

const pdf = run(async (req, res) => {
  const data = await service.getOne(context(req).empCod, key(req));
  const { header, details, company } = data;
  const filename = `recepcion-${clean(header.TempCod)}-${header.MovNGuia}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: 'A4', margin: 38, bufferPages: true, info: { Title: `Recepcion ${header.MovNGuia}` } });
  doc.pipe(res);
  const green = '#176B3A'; const pale = '#EAF5EE'; const ink = '#172033'; const muted = '#607080';
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelValue = (label, value, x, y, fieldWidth) => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(muted).text(label.toUpperCase(), x, y, { width: fieldWidth });
    doc.font('Helvetica').fontSize(10).fillColor(ink).text(clean(value) || '-', x, y + 11, { width: fieldWidth, ellipsis: true });
  };
  doc.roundedRect(doc.page.margins.left, doc.page.margins.top, width, 72, 6).fill(green);
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text('COMPROBANTE DE RECEPCIÓN', 52, 52);
  doc.font('Helvetica').fontSize(9).text(clean(company?.EmpNom) || `Empresa ${context(req).empCod}`, 52, 76);
  doc.font('Helvetica-Bold').fontSize(22).text(`GUÍA ${header.MovNGuia}`, doc.page.margins.left + width - 180, 54, { width: 160, align: 'right' });
  doc.font('Helvetica').fontSize(8).text(`Emitido ${new Date().toLocaleString('es-CL')}`, doc.page.margins.left + width - 180, 83, { width: 160, align: 'right' });
  let y = 128;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(green).text('Información de la recepción', doc.page.margins.left, y);
  y += 18;
  doc.roundedRect(doc.page.margins.left, y, width, 92, 5).fill(pale);
  const col = width / 3;
  labelValue('Temporada', header.TempCod, 50, y + 12, col - 18);
  labelValue('Fecha', date(header.MovFecha), 50 + col, y + 12, col - 18);
  labelValue('Origen', `${header.OriCod} · ${clean(header.OriNom)}`, 50 + col * 2, y + 12, col - 18);
  labelValue('Documento', `${header.MovTDoc} · ${clean(header.TdNom)}`, 50, y + 52, col - 18);
  labelValue('Movimiento', `${header.TMcod}/${header.TMSCod} · ${clean(header.TMNom)} / ${clean(header.TMSNom)}`, 50 + col, y + 52, col - 18);
  labelValue('Productor', `${clean(header.MovProd)} · ${clean(header.ProdNom)}`, 50 + col * 2, y + 52, col - 18);
  y += 110;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(green).text(`Detalle de lotes (${details.length})`, doc.page.margins.left, y);
  y += 20;
  const rowHeight = 72;
  details.forEach((item, index) => {
    if (y + rowHeight > doc.page.height - 105) { doc.addPage(); y = doc.page.margins.top; }
    doc.roundedRect(doc.page.margins.left, y, width, rowHeight - 6, 4).lineWidth(0.6).strokeColor('#CCD9D0').stroke();
    doc.rect(doc.page.margins.left, y, 62, rowHeight - 6).fill(pale);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(muted).text(`LOTE ${index + 1}`, doc.page.margins.left + 8, y + 10, { width: 46, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(green).text(number(item.Mov1Nlote, 0), doc.page.margins.left + 6, y + 27, { width: 50, align: 'center' });
    const x = doc.page.margins.left + 74;
    labelValue('Cuartel', `${item.Mov1Cuar} · ${clean(item.CuarNom)}`, x, y + 9, 120);
    labelValue('Especie / variedad', `${clean(item.EspeNom)} / ${clean(item.VarNom)}`, x + 128, y + 9, 155);
    labelValue('Envase / condición', `${clean(item.EnvNom)} / ${clean(item.ConNom)}`, x + 291, y + 9, 165);
    labelValue('Envases', number(item.Mov1NumE, 0), x, y + 39, 80);
    labelValue('Peso estimado/envase', `${number(item.Mov1Peso)} kg`, x + 90, y + 39, 120);
    labelValue('Kilos brutos', `${number(item.Mov1KilB)} kg`, x + 220, y + 39, 105);
    labelValue('Kilos netos', `${number(item.Mov1KilN)} kg`, x + 335, y + 39, 105);
    y += rowHeight;
  });
  if (y + 120 > doc.page.height - 45) { doc.addPage(); y = doc.page.margins.top; }
  y += 4;
  doc.roundedRect(doc.page.margins.left, y, width, 52, 5).fill(green);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#D8F0E0').text('TOTALES DE RECEPCIÓN', doc.page.margins.left + 14, y + 10);
  doc.fontSize(15).fillColor('#FFFFFF').text(`${number(header.MovTotE, 0)} envases`, doc.page.margins.left + 14, y + 25);
  doc.text(`${number(header.MovTotKilB)} kg brutos`, doc.page.margins.left + 190, y + 25);
  doc.text(`${number(header.MovTotKilN)} kg netos`, doc.page.margins.left + 360, y + 25);
  y += 66;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(muted).text('OBSERVACIÓN', doc.page.margins.left, y);
  doc.font('Helvetica').fontSize(9).fillColor(ink).text(clean(header.MovObs) || 'Sin observaciones.', doc.page.margins.left, y + 13, { width });
  const pages = doc.bufferedPageRange();
  for (let page = 0; page < pages.count; page += 1) {
    doc.switchToPage(page);
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor(muted).text(`${clean(company?.EmpNom) || 'CONEX-CO'} · Recepción ${header.MovNGuia} · Página ${page + 1} de ${pages.count}`, doc.page.margins.left, doc.page.height - 25, { width, align: 'center', lineBreak: false });
  }
  doc.end();
});

module.exports = {
  catalogs: run(async (req, res) => res.json(await service.listCatalogs(context(req).empCod))),
  list: run(async (req, res) => res.json(await service.list(context(req).empCod, req.query))),
  lotBoard: run(async (req, res) => res.json(await service.listLotBoard(context(req).empCod, req.query))),
  qualityCatalogs: run(async (req, res) => res.json(await service.listQualityCatalogs(context(req).empCod, req.query.species))),
  pdf,
  getOne: run(async (req, res) => res.json(await service.getOne(context(req).empCod, key(req)))),
  create: run(async (req, res) => { const ctx = context(req); return res.status(201).json(await service.create(ctx.empCod, ctx.login, req.body)); }),
  update: run(async (req, res) => { const ctx = context(req); return res.json(await service.update(ctx.empCod, ctx.login, key(req), req.body)); }),
  remove: run(async (req, res) => res.json(await service.remove(context(req).empCod, key(req))))
};

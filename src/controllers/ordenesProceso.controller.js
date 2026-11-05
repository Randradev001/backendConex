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
const formatTime = (value) => {
  if (!value) return '-';
  if (value instanceof Date) return value.toTimeString().slice(0, 5);
  const raw = clean(value);
  const match = raw.match(/(?:T|\s)(\d{2}:\d{2})/) || raw.match(/^(\d{2}:\d{2})/);
  return match?.[1] || raw.slice(0, 5) || '-';
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

const quadraturePdf = run(async (req, res) => {
  const data = await service.getQuadrature(context(req).empCod, req.params.tempCod, req.params.ordpnum);
  const filename = `cuadratura-${clean(data.order.tempCod)}-${data.order.ordpnum}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: 'A4', margin: 38, info: { Title: `Cuadratura orden ${data.order.ordpnum}` } });
  doc.pipe(res);
  const green = '#176B3A'; const ink = '#172033'; const muted = '#607080';
  const left = doc.page.margins.left; const width = doc.page.width - left - doc.page.margins.right;
  doc.roundedRect(left, 38, width, 92, 7).fill(green);
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text('CUADRATURA DE PROCESO', left + 20, 55);
  doc.font('Helvetica').fontSize(9).text(`Temporada ${clean(data.order.tempCod)} · ${clean(data.order.speciesName)} / ${clean(data.order.varietyName)}`, left + 20, 84);
  doc.font('Helvetica-Bold').fontSize(34).text(formatNumber(data.order.ordpnum, 0), left + width - 170, 59, { width: 145, align: 'center' });
  let y = 154;
  const metrics = [
    ['Kilos procesados', data.totals.processedKilos], ['Kilos leídos', data.totals.readKilos],
    ['Kilos comerciales', data.totals.commercialKilos], ['Desecho', data.order.state === 5 ? data.totals.storedWasteKilos : data.totals.projectedWasteKilos]
  ];
  metrics.forEach(([label, value], index) => {
    const x = left + index * (width / 4);
    doc.rect(x, y, width / 4 - 5, 58).fill(index === 3 ? '#B45309' : '#EAF5EE');
    doc.font('Helvetica-Bold').fontSize(7).fillColor(index === 3 ? '#FFFFFF' : muted).text(label.toUpperCase(), x + 9, y + 10, { width: width / 4 - 23 });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(index === 3 ? '#FFFFFF' : ink).text(`${formatNumber(value)} kg`, x + 9, y + 29, { width: width / 4 - 23 });
  });
  y += 82;
  const drawTable = (title, rows, columns) => {
    if (y + 62 > doc.page.height - 58) { doc.addPage(); y = 38; }
    doc.font('Helvetica-Bold').fontSize(11).fillColor(green).text(title, left, y); y += 18;
    const drawColumns = () => {
      let headerX = left;
      columns.forEach((column) => { doc.rect(headerX, y, column.width, 21).fill(green); doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF').text(column.label, headerX + 5, y + 7, { width: column.width - 10 }); headerX += column.width; });
      y += 21;
    };
    drawColumns();
    if (!rows.length) { doc.font('Helvetica').fontSize(8.5).fillColor(muted).text('Sin registros', left + 6, y + 7); y += 24; return; }
    rows.forEach((row, index) => {
      if (y + 23 > doc.page.height - 58) { doc.addPage(); y = 38; drawColumns(); }
      if (index % 2 === 0) doc.rect(left, y, width, 23).fill('#F5F8F6');
      let x = left;
      columns.forEach((column) => { doc.font('Helvetica').fontSize(8).fillColor(ink).text(column.value(row), x + 5, y + 7, { width: column.width - 10, ellipsis: true }); x += column.width; });
      y += 23;
    });
    y += 18;
  };
  const tableWidths = [150, 150, 85, width - 385];
  drawTable('Lecturas por especie y variedad', data.species, [
    { label: 'Especie', width: tableWidths[0], value: (row) => row.speciesName || row.speciesCode },
    { label: 'Variedad', width: tableWidths[1], value: (row) => row.varietyName || row.varietyCode },
    { label: 'Cajas', width: tableWidths[2], value: (row) => formatNumber(row.readContainers, 0) },
    { label: 'Kilos', width: tableWidths[3], value: (row) => formatNumber(row.readKilos) }
  ]);
  drawTable('Fruta comercial registrada', data.commercial, [
    { label: 'Especie', width: tableWidths[0], value: (row) => row.speciesName || row.speciesCode },
    { label: 'Variedad', width: tableWidths[1], value: (row) => row.varietyName || row.varietyCode || '-' },
    { label: 'Envases', width: tableWidths[2], value: (row) => formatNumber(row.containers, 0) },
    { label: 'Kilos', width: tableWidths[3], value: (row) => formatNumber(row.kilos) }
  ]);
  doc.font('Helvetica').fontSize(8).fillColor(muted).text(`Estado: ${data.order.state === 5 ? 'Cuadrada' : 'Pendiente'} · Productor: ${clean(data.order.producerName) || clean(data.order.producerCode) || '-'}`, left, doc.page.height - 42, { width });
  doc.end();
});

const writeProcessReportPdf = (doc, data) => {
  const { order, lots, detail, company, yieldPercentage } = data;
  const green = '#176B3A'; const pale = '#EAF5EE'; const ink = '#172033'; const muted = '#607080';
  const left = doc.page.margins.left; const width = doc.page.width - left - doc.page.margins.right;
  let y = 38;
  const ensureSpace = (height, repeatHeader) => {
    if (y + height <= doc.page.height - 48) return;
    doc.addPage(); y = 38;
    if (repeatHeader) repeatHeader();
  };
  const field = (label, value, x, top, fieldWidth) => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(muted).text(label.toUpperCase(), x, top, { width: fieldWidth });
    doc.font('Helvetica').fontSize(9.5).fillColor(ink).text(clean(value) || '-', x, top + 11, { width: fieldWidth, ellipsis: true });
  };

  doc.roundedRect(left, y, width, 94, 7).fill(green);
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text('INFORME DE PROCESO', left + 20, y + 18);
  doc.font('Helvetica').fontSize(9).text(clean(company?.EmpNom) || `Empresa ${order.EmpCod}`, left + 20, y + 47, { width: width - 220 });
  doc.fontSize(8).fillColor('#D8F0E0').text(`${clean(company?.EmpGiro)} · ${clean(company?.EmpDir)}`, left + 20, y + 65, { width: width - 220, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(8).text('NÚMERO DE PROCESO', left + width - 190, y + 14, { width: 166, align: 'center' });
  doc.fontSize(34).fillColor('#FFFFFF').text(formatNumber(order.Ordpnum, 0), left + width - 190, y + 32, { width: 166, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor('#D8F0E0').text(`RUT ${formatNumber(company?.EmpRut, 0)}-${clean(company?.EmpDV)}`, left + width - 190, y + 72, { width: 166, align: 'center' });
  y += 112;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(green).text('Datos del proceso', left, y); y += 18;
  doc.roundedRect(left, y, width, 112, 5).fill(pale);
  const col = width / 3;
  field('Fecha del proceso', formatDate(order.OrdpFecha), left + 14, y + 13, col - 20);
  field('Inicio', formatTime(order.OrdpHHIniP), left + col + 7, y + 13, col - 20);
  field('Fin', formatTime(order.OrdpHHFinP), left + col * 2 + 7, y + 13, col - 20);
  field('Especie', order.EspeNom, left + 14, y + 45, col - 20);
  field('Variedad', order.VarNom, left + col + 7, y + 45, col - 20);
  field('Productor', order.ProdNom, left + col * 2 + 7, y + 45, col - 20);
  field('Provincia', order.ProdProvincia, left + 14, y + 77, col - 20);
  field('Comuna', order.ProdComuna, left + col + 7, y + 77, col - 20);
  field('Temporada', order.TempCod, left + col * 2 + 7, y + 77, col - 20);
  y += 130;
  const lotText = lots.length ? lots.map((row) => formatNumber(row.Ordp1Nlote, 0)).join(', ') : 'Sin lotes asociados';
  doc.font('Helvetica-Bold').fontSize(8).fillColor(muted).text('LOTES', left, y);
  doc.font('Helvetica').fontSize(9).fillColor(ink).text(lotText, left, y + 12, { width });
  y += Math.max(34, doc.heightOfString(lotText, { width }) + 20);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(green).text('Detalle de cajas capturadas', left, y); y += 18;
  const columns = [
    { label: 'Envase', width: 175, value: (row) => clean(row.EnvNom) || clean(row.EnvCod) },
    { label: 'Categoría', width: 145, value: (row) => clean(row.CatNom) || clean(row.Catcod) },
    { label: 'Calibre', width: 80, value: (row) => clean(row.Calibre) || '-' },
    { label: 'Cajas', width: 65, value: (row) => formatNumber(row.Cajas, 0), align: 'right' },
    { label: 'Kilos', width: width - 465, value: (row) => formatNumber(row.Kilos), align: 'right' }
  ];
  const drawHeader = () => {
    let x = left;
    columns.forEach((column) => {
      doc.rect(x, y, column.width, 22).fill(green);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(column.label, x + 6, y + 7, { width: column.width - 12, align: column.align || 'left' });
      x += column.width;
    });
    y += 22;
  };
  drawHeader();
  if (!detail.length) {
    doc.font('Helvetica').fontSize(9).fillColor(muted).text('No existen cajas capturadas para este proceso.', left + 7, y + 8);
    y += 28;
  } else {
    detail.forEach((row, index) => {
      ensureSpace(25, drawHeader);
      if (index % 2 === 0) doc.rect(left, y, width, 24).fill('#F4F8F5');
      let x = left;
      columns.forEach((column) => {
        doc.font('Helvetica').fontSize(8.5).fillColor(ink).text(column.value(row), x + 6, y + 7, { width: column.width - 12, align: column.align || 'left', ellipsis: true });
        x += column.width;
      });
      y += 24;
    });
  }
  y += 18;
  ensureSpace(128);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(green).text('Resumen del proceso', left, y); y += 18;
  const summary = [
    ['Ingresados', `${formatNumber(order.OrdpTotKilos)} kg`],
    ['Exportación', `${formatNumber(order.OrdpKilosExp)} kg`],
    ['Comercial', `${formatNumber(order.OrdpKilosCom)} kg`],
    ['Desecho / diferencia', `${formatNumber(order.OrdpDesecho)} kg`],
    ['Rendimiento', `${formatNumber(yieldPercentage, 3)}%`]
  ];
  const boxWidth = width / summary.length;
  summary.forEach(([label, value], index) => {
    const x = left + index * boxWidth;
    doc.rect(x, y, boxWidth - 4, 56).fill(index === 4 ? green : pale);
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor(index === 4 ? '#D8F0E0' : muted).text(label.toUpperCase(), x + 7, y + 9, { width: boxWidth - 18, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(index === 4 ? '#FFFFFF' : ink).text(value, x + 7, y + 29, { width: boxWidth - 18, align: 'center' });
  });
  y += 66;
  doc.font('Helvetica').fontSize(8).fillColor(muted).text(`Envases exportados: ${formatNumber(order.OrdpEnvExp, 0)} · Kilos exportados: ${formatNumber(order.OrdpKilosExp)} kg`, left, y, { width, align: 'right' });

  const pages = doc.bufferedPageRange();
  for (let page = 0; page < pages.count; page += 1) {
    doc.switchToPage(page); doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor(muted).text(`${clean(company?.EmpNom) || 'CONEX-CO'} · Informe de proceso ${order.Ordpnum} · Página ${page + 1} de ${pages.count}`, left, doc.page.height - 25, { width, align: 'center', lineBreak: false });
  }
  doc.end();
};

const processReportPdf = run(async (req, res) => {
  const data = await service.getProcessReport(context(req).empCod, req.params.tempCod, req.params.ordpnum);
  const filename = `informe-proceso-${clean(data.order.TempCod)}-${data.order.Ordpnum}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: 'Letter', margin: 38, bufferPages: true, info: { Title: `Informe de proceso ${data.order.Ordpnum}` } });
  doc.pipe(res);
  writeProcessReportPdf(doc, data);
});

module.exports = {
  lots: run(async (req, res) => res.json(await service.listLots(context(req).empCod, req.query))),
  create: run(async (req, res) => res.status(201).json(await service.create(context(req).empCod, context(req).login, req.body))),
  update: run(async (req, res) => res.json(await service.update(context(req).empCod, context(req).login, req.params.tempCod, req.params.ordpnum, req.body))),
  setActive: run(async (req, res) => res.json(await service.setProcessActive(context(req).empCod, context(req).login, req.params.tempCod, req.params.ordpnum, req.body?.active))),
  quadrature: run(async (req, res) => res.json(await service.getQuadrature(context(req).empCod, req.params.tempCod, req.params.ordpnum))),
  finalizeQuadrature: run(async (req, res) => res.json(await service.finalizeQuadrature(
    context(req).empCod,
    context(req).login,
    req.params.tempCod,
    req.params.ordpnum,
    req.body
  ))),
  reopenQuadrature: run(async (req, res) => res.json(await service.reopenQuadrature(
    context(req).empCod,
    context(req).login,
    req.params.tempCod,
    req.params.ordpnum,
    req.body
  ))),
  detail: run(async (req, res) => res.json(await service.getOrder(context(req).empCod, req.params.tempCod, req.params.ordpnum))),
  pdf,
  quadraturePdf,
  processReportPdf,
  writeProcessReportPdf
};

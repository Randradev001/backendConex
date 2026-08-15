const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const service = require('../services/recepcionFruta.service');

const getEmpCod = (req) => {
  const empCod = Number(req.context?.empCod);
  if (!Number.isInteger(empCod) || empCod < 1) {
    throw new service.RecepcionFrutaError(401, 'COMPANY_CONTEXT_REQUIRED', 'La sesion no tiene una empresa valida.');
  }
  return empCod;
};

const respondError = (res, next, error) => {
  if (error instanceof service.RecepcionFrutaError) {
    return res.status(error.status).json({ code: error.code, message: error.message });
  }
  return next(error);
};

const list = (view) => async (req, res, next) => {
  try {
    const result = view === 'summary'
      ? await service.listSummary(getEmpCod(req), req.query)
      : await service.listDetail(getEmpCod(req), req.query);
    return res.json(result);
  } catch (error) {
    return respondError(res, next, error);
  }
};

const catalogs = async (req, res, next) => {
  try {
    return res.json(await service.listCatalogs(getEmpCod(req)));
  } catch (error) {
    return respondError(res, next, error);
  }
};

const columnsByView = {
  summary: [
    ['Temporada', 'TempCod'], ['Origen', 'OriNom'], ['Fecha', 'MovFecha'], ['T. Doc.', 'MovTDoc'],
    ['N. Guia', 'MovNGuia'], ['Productor', 'MovProd'], ['Nombre productor', 'ProdNom'], ['Items', 'MovItem'],
    ['Lotes', 'lotsText'], ['Lotes pendientes calidad', 'pendingQualityLots'],
    ['Envases', 'MovTotE'], ['K. Brutos', 'MovTotKilB'], ['K. Netos', 'MovTotKilN']
  ],
  detail: [
    ['Temporada', 'TempCod'], ['Origen', 'OriNom'], ['Fecha', 'MovFecha'], ['Guia', 'MovNGuia'], ['Lote', 'Mov1Nlote'],
    ['Productor', 'MovProd'], ['Nombre productor', 'ProdNom'], ['Cuartel', 'CuarNom'], ['Especie', 'EspeNom'], ['Variedad', 'VarNom'], ['Control calidad', 'qualityStatus'],
    ['Envases', 'Mov1NumE'], ['K. Brutos', 'Mov1KilB'], ['K. Netos', 'Mov1KilN']
  ]
};

const filterDescription = (filters) => [
  filters.tempCod ? `Temporada ${filters.tempCod}` : null,
  filters.from ? `Desde ${filters.from.toISOString().slice(0, 10)}` : null,
  filters.to ? `Hasta ${filters.to.toISOString().slice(0, 10)}` : null,
  filters.origin !== null ? `Origen ${filters.origin}` : null,
  filters.producer ? `Productor ${filters.producer}` : null,
  filters.quarter !== null ? `Cuartel ${filters.quarter}` : null,
  filters.species !== null ? `Especie ${filters.species}` : null
].filter(Boolean).join(' | ');

const exportExcel = async (req, res, next) => {
  try {
    const view = req.query.view === 'summary' ? 'summary' : 'detail';
    const empCod = getEmpCod(req);
    const [result, company] = await Promise.all([service.exportRows(view, empCod, req.query), service.getCompany(empCod)]);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(view === 'summary' ? 'Resumen' : 'Detalle');
    sheet.columns = columnsByView[view].map(([header, key]) => ({ header, key, width: Math.max(header.length + 2, 13) }));
    result.rows.forEach((row) => sheet.addRow(row));
    sheet.insertRows(1, [[company.EmpNom || `Empresa ${empCod}`], [filterDescription(result.filters)], []]);
    sheet.mergeCells(1, 1, 1, sheet.columnCount);
    sheet.mergeCells(2, 1, 2, sheet.columnCount);
    sheet.getRow(1).font = { bold: true, size: 15, color: { argb: 'FF1B5E20' } };
    sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    sheet.autoFilter = { from: 'A4', to: `${sheet.getColumn(sheet.columnCount).letter}4` };
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    columnsByView[view].map(([, key]) => key).filter((key) => ['MovTotKilB', 'MovTotKilN', 'Mov1KilB', 'Mov1KilN'].includes(key)).forEach((key) => {
      const column = sheet.getColumn(key);
      column.numFmt = '#,##0.00';
    });
    ['MovFecha'].forEach((key) => { sheet.getColumn(key).numFmt = 'yyyy-mm-dd'; });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="recepcion-fruta-${view}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return respondError(res, next, error);
  }
};

const exportPdf = async (req, res, next) => {
  try {
    const view = req.query.view === 'summary' ? 'summary' : 'detail';
    const empCod = getEmpCod(req);
    const [result, company] = await Promise.all([service.exportRows(view, empCod, req.query), service.getCompany(empCod)]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recepcion-fruta-${view}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
    doc.pipe(res);
    doc.fontSize(10).fillColor('#222222').text(company.EmpNom || `Empresa ${empCod}`, { align: 'center' });
    doc.fontSize(16).fillColor('#1B5E20').text('Recepcion de fruta', { align: 'center' });
    doc.moveDown(0.4).fontSize(9).fillColor('#222222')
      .text(`Vista: ${view === 'summary' ? 'Resumen' : 'Detalle'} | Registros: ${result.total}`)
      .text(filterDescription(result.filters))
      .text(`Totales: ${result.totals.envases} envases | ${result.totals.kilosBrutos.toFixed(2)} kg brutos | ${result.totals.kilosNetos.toFixed(2)} kg netos`);
    doc.moveDown(0.6);
    const columns = columnsByView[view];
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const width = pageWidth / columns.length;
    const drawRow = (values, header = false) => {
      if (doc.y > doc.page.height - 45) doc.addPage();
      const y = doc.y;
      values.forEach((value, index) => {
        doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(header ? 7 : 6.5)
          .fillColor(header ? '#FFFFFF' : '#222222');
        if (header) doc.rect(doc.page.margins.left + index * width, y - 2, width, 15).fill('#2E7D32');
        doc.fillColor(header ? '#FFFFFF' : '#222222')
          .text(String(value ?? ''), doc.page.margins.left + index * width + 2, y, { width: width - 4, height: 12, ellipsis: true });
      });
      doc.y = y + 15;
    };
    drawRow(columns.map(([header]) => header), true);
    result.rows.forEach((row) => drawRow(columns.map(([, key]) => {
      const value = row[key];
      return value instanceof Date ? value.toISOString().slice(0, 10) : value;
    })));
    doc.end();
  } catch (error) {
    return respondError(res, next, error);
  }
};

module.exports = { catalogs, listSummary: list('summary'), listDetail: list('detail'), exportExcel, exportPdf };

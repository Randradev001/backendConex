const router = require('express').Router();
const ExcelJS = require('exceljs');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const multer = require('multer');
const authContext = require('../../middleware/authContext');
const { requirePermission } = require('../../middleware/securityAuthorization');
const service = require('./ingresoTarjas.service');
const impVentana = require('./impVentana.service');

const MAX_IMPORT_SIZE = 1024 * 1024 * 1024;
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, os.tmpdir()),
    filename: (_req, file, callback) => callback(null, `conex-folios-${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: MAX_IMPORT_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (extension !== '.xlsx') return callback(new service.IngresoTarjasError(400, 'IMPORT_FORMAT_INVALID', 'Solo se aceptan archivos .xlsx.'));
    return callback(null, true);
  }
});

const parseUpload = (req, res, next) => upload.single('file')(req, res, (error) => {
  if (!error) return next();
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ code: 'IMPORT_FILE_TOO_LARGE', message: 'El archivo supera el limite de 1 GB.' });
  }
  if (error instanceof service.IngresoTarjasError) return res.status(error.status).json({ code: error.code, message: error.message });
  return next(error);
});

const run = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error instanceof service.IngresoTarjasError || error instanceof impVentana.ImpVentanaError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    return next(error);
  }
};

const sendImportTemplate = async (_req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Carga de folios');
  sheet.columns = [
    ['N° de Folio', 'folio', 16], ['Codigo Exportadora', 'exporterCode', 22], ['Fecha Proceso', 'processDate', 16],
    ['Codigo Productor', 'producerCode', 22], ['Codigo Especie', 'speciesCode', 18], ['Codigo Variedad', 'varietyCode', 18],
    ['Codigo Envase', 'containerCode', 18], ['Codigo Categoria', 'categoryCode', 19], ['Calibre', 'caliber', 14], ['Cajas', 'boxes', 12]
  ].map(([header, key, width]) => ({ header, key, width }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I'].forEach((column) => { sheet.getColumn(column).numFmt = '@'; });
  sheet.getColumn('C').numFmt = 'dd/mm/yyyy';
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="formato-carga-folios.xlsx"');
  return res.send(Buffer.from(buffer));
};

router.use(authContext, requirePermission(service.permission));
router.get('/form-data', run(async (req, res) => res.json(await service.getFormData(req.context.empCod))));
router.get('/folios', run(async (req, res) => res.json(await service.listTarjas(req.context.empCod, req.query))));
router.get('/print-window/config', run(async (req, res) => res.json(await impVentana.getPrintWindowConfig(req.context.empCod))));
router.get('/print-window/folios', run(async (req, res) => res.json(await impVentana.listPrintWindow(req.context.empCod, req.query))));
router.post('/print-window/print', run(async (req, res) => res.json(await impVentana.printFolios(req.context.empCod, req.body))));
router.get('/import/template', run(sendImportTemplate));
router.post('/import', parseUpload, run(async (req, res) => {
  if (!req.file) throw new service.IngresoTarjasError(400, 'IMPORT_FILE_REQUIRED', 'Seleccione un archivo .xlsx para cargar.');
  try {
    return res.json(await service.importFoliosExcel(req.context.empCod, req.file.path));
  } finally {
    await fs.rm(req.file.path, { force: true }).catch(() => undefined);
  }
}));
router.get('/export/excel', run(async (req, res) => {
  const first = await service.listTarjas(req.context.empCod, { ...req.query, page: 1, pageSize: 200 });
  const rows = [...first.rows];
  for (let page = 2; rows.length < first.total; page += 1) {
    const batch = await service.listTarjas(req.context.empCod, { ...req.query, page, pageSize: 200 });
    rows.push(...batch.rows);
    if (!batch.rows.length) break;
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Folios procesados');
  sheet.columns = [
    ['Folio', 'folio', 15], ['Orden', 'orderNumber', 12], ['Especie', 'speciesName', 24],
    ['Cajas', 'totalBoxes', 12], ['Kilos', 'totalKilos', 14], ['Exportadora', 'exporterName', 28],
    ['Fecha ingreso', 'entryDate', 16], ['Estado', 'status', 11], ['Inspeccion', 'inspection', 12],
    ['Disponible', 'available', 12], ['Origen', 'origin', 10], ['Despacho origen', 'dispatchOrigin', 17],
    ['Despacho OT', 'dispatchOt', 14], ['Despacho USDA', 'dispatchUsda', 17]
  ].map(([header, key, width]) => ({ header, key, width }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.insertRows(1, [[`Folios Procesados · Temporada ${first.tempCod}`], [`Desde ${first.filters.from} hasta ${first.filters.to}`], []]);
  sheet.mergeCells(1, 1, 1, sheet.columnCount);
  sheet.mergeCells(2, 1, 2, sheet.columnCount);
  sheet.getRow(1).font = { bold: true, size: 15, color: { argb: 'FF1B5E20' } };
  sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
  sheet.autoFilter = { from: 'A4', to: `${sheet.getColumn(sheet.columnCount).letter}4` };
  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  sheet.getColumn('totalBoxes').numFmt = '#,##0';
  sheet.getColumn('totalKilos').numFmt = '#,##0.00';
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="folios-procesados.xlsx"');
  return res.send(Buffer.from(buffer));
}));
router.get('/:folio', run(async (req, res) => res.json(await service.getTarja(req.context.empCod, req.params.folio))));
router.post('/', run(async (req, res) => res.status(201).json(await service.createTarja(req.context.empCod, req.body))));
router.put('/:folio', run(async (req, res) => res.json(await service.updateTarja(req.context.empCod, req.params.folio, req.body))));
router.delete('/:folio', run(async (req, res) => res.json(await service.deleteTarja(req.context.empCod, req.params.folio))));

module.exports = router;

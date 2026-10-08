const router = require('express').Router();
const authContext = require('../middleware/authContext');
const { requirePermission, requireAnyPermission } = require('../middleware/securityAuthorization');
const controller = require('./impresion.controller');

const LABEL_PERMISSION = Object.freeze({ sistema: 110, modulo: 1, programa: 1 });
const LINE_PERMISSION = Object.freeze({ sistema: 100, modulo: 6, programa: 11 });
const PRINTER_PERMISSION = Object.freeze({ sistema: 100, modulo: 6, programa: 12 });
const labelPermission = (req, res, next) => {
  const roles = Array.isArray(req.auth?.user?.roles) ? req.auth.user.roles : [];
  if (roles.some((role) => String(role).trim().toUpperCase() === 'ADMINFULL')) return next();
  return requirePermission(LABEL_PERMISSION)(req, res, next);
};
const printerListPermission = (req, res, next) => {
  const roles = Array.isArray(req.auth?.user?.roles) ? req.auth.user.roles : [];
  if (roles.some((role) => String(role).trim().toUpperCase() === 'ADMINFULL')) return next();
  return requireAnyPermission([LABEL_PERMISSION, LINE_PERMISSION, PRINTER_PERMISSION])(req, res, next);
};
const printerWritePermission = requirePermission(PRINTER_PERMISSION);
const printerPrintPermission = requireAnyPermission([LINE_PERMISSION, PRINTER_PERMISSION]);

router.use(authContext);
router.get('/impresoras', printerListPermission, controller.printers);
router.get('/impresoras/lineas', requirePermission(PRINTER_PERMISSION), controller.printerLines);
router.post('/impresoras', printerWritePermission, controller.createPrinter);
router.put('/impresoras/:id', printerWritePermission, controller.updatePrinter);
router.delete('/impresoras/:id', printerWritePermission, controller.deletePrinter);
router.post('/pruebas/etiqueta', labelPermission, controller.printLabelTest);
router.post('/lineas/:machine/:line/simular', printerPrintPermission, controller.simulateLine);

module.exports = router;
module.exports.LABEL_PERMISSION = LABEL_PERMISSION;
module.exports.LINE_PERMISSION = LINE_PERMISSION;
module.exports.PRINTER_PERMISSION = PRINTER_PERMISSION;
module.exports.labelPermission = labelPermission;
module.exports.printerPrintPermission = printerPrintPermission;

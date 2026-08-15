const router = require('express').Router();
const controller = require('../controllers/recepcionFrutaController');
const authContext = require('../middleware/authContext');
const { requirePermission } = require('../middleware/securityAuthorization');

const canConsult = requirePermission({ sistema: 100, modulo: 15, programa: 1 });

router.use(authContext, canConsult);
router.get('/catalogos', controller.catalogs);
router.get('/resumen', controller.listSummary);
router.get('/detalle', controller.listDetail);
router.get('/exportar/excel', controller.exportExcel);
router.get('/exportar/pdf', controller.exportPdf);

module.exports = router;

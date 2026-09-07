const router = require('express').Router();
const controller = require('../controllers/recepcionesIngresoController');
const authContext = require('../middleware/authContext');
const { requirePermission } = require('../middleware/securityAuthorization');

const program = { sistema: 100, modulo: 2, programa: 1 };
const action = (accion) => requirePermission({ ...program, accion });

router.use(authContext, requirePermission(program));
router.get('/catalogos', controller.catalogs);
router.get('/tablero-lotes', controller.lotBoard);
router.get('/calidad/catalogos', controller.qualityCatalogs);
router.get('/', controller.list);
router.post('/', action(1), controller.create);
router.get('/:tempCod/:origin/:docType/:guide/:producer/pdf', controller.pdf);
router.get('/:tempCod/:origin/:docType/:guide/:producer', controller.getOne);
router.put('/:tempCod/:origin/:docType/:guide/:producer', action(2), controller.update);
router.delete('/:tempCod/:origin/:docType/:guide/:producer', action(3), controller.remove);

module.exports = router;

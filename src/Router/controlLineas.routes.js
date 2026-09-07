const router = require('express').Router();
const controller = require('../controllers/controlLineas.controller');
const authContext = require('../middleware/authContext');
const { requirePermission } = require('../middleware/securityAuthorization');

const CONTROL_LINES_PERMISSION = Object.freeze({ sistema: 100, modulo: 6, programa: 11 });

router.use(authContext, requirePermission(CONTROL_LINES_PERMISSION));
router.get('/', controller.list);
router.get('/catalogs', controller.catalogs);
router.post('/', controller.create);
router.put('/:machine/:line', controller.update);

module.exports = router;
module.exports.CONTROL_LINES_PERMISSION = CONTROL_LINES_PERMISSION;

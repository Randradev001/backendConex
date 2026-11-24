const router = require('express').Router();
const authContext = require('../../middleware/authContext');
const { requirePermission } = require('../../middleware/securityAuthorization');
const controller = require('./ordenesProcesoEstado.controller');
const service = require('./ordenesProcesoEstado.service');

router.use(authContext, requirePermission(service.permission));
router.get('/ordenes/:ordpnum', controller.detail);
router.put('/ordenes/:ordpnum/estado', controller.update);

module.exports = router;

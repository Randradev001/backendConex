const router = require('express').Router();
const authContext = require('../middleware/authContext');
const { requirePermission } = require('../middleware/securityAuthorization');
const service = require('../services/dashboardProduccion.service');

const permission = Object.freeze({ sistema: 100, modulo: 15, programa: 20 });

router.use(authContext, requirePermission(permission));
router.get('/', async (req, res, next) => {
  try {
    return res.json({ data: await service.getDashboard(Number(req.context.empCod)) });
  } catch (error) {
    if (error instanceof service.DashboardProduccionError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    return next(error);
  }
});

module.exports = router;
module.exports.permission = permission;

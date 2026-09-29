const router = require('express').Router();
const controller = require('../controllers/ordenesProceso.controller');
const authContext = require('../middleware/authContext');
const { requirePermission } = require('../middleware/securityAuthorization');
// El armador es el alta de ADMOrdProc; hereda su permiso 110/2/2.
const permission = { sistema: 110, modulo: 2, programa: 2 };
const processPermission = (required) => (req, res, next) => {
  const roles = Array.isArray(req.auth?.user?.roles)
    ? req.auth.user.roles.map((role) => String(role).trim().toUpperCase())
    : [];
  if (roles.includes('ADMINFULL')) return next();
  return requirePermission(required)(req, res, next);
};
router.use(authContext, processPermission(permission));
router.get('/lotes', controller.lots);
router.get('/:tempCod/:ordpnum/pdf', controller.pdf);
router.get('/:tempCod/:ordpnum', controller.detail);
router.post('/', processPermission({ ...permission, accion: 1 }), controller.create);
router.put('/:tempCod/:ordpnum', processPermission({ ...permission, accion: 2 }), controller.update);
router.patch('/:tempCod/:ordpnum/estado', processPermission({ ...permission, accion: 2 }), controller.setActive);
module.exports = router;

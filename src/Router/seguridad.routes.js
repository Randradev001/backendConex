const router = require('express').Router();
const SeguridadController = require('../controllers/seguridadController');
const SeguridadCatalogosController = require('../controllers/seguridadCatalogosController');
const authContext = require('../middleware/authContext');
const { requireSecurityAdmin, verifyPermission } = require('../middleware/securityAuthorization');

router.post('/login', SeguridadController.login);
router.get('/session', authContext, SeguridadController.session);
router.get('/menu', authContext, SeguridadController.menu);
router.post('/logout', SeguridadController.logout);
router.put('/password', authContext, SeguridadController.changePassword);
router.post('/verificar-acceso', authContext, verifyPermission);

router.use('/catalogos', authContext, requireSecurityAdmin);
router.get('/catalogos', SeguridadCatalogosController.metadata);
router.get('/catalogos/roles/:role/permisos', SeguridadCatalogosController.getRolePermissions);
router.put('/catalogos/roles/:role/permisos', SeguridadCatalogosController.saveRolePermissions);
router.post('/catalogos/roles/:role/reaplicar', SeguridadCatalogosController.reapplyRolePermissions);
router.get('/catalogos/usuarios/:login/roles', SeguridadCatalogosController.getUserRoles);
router.get('/catalogos/usuarios/:login/asignaciones', SeguridadCatalogosController.getUserAssignments);
router.get('/catalogos/usuarios/:login/asignaciones/:system', SeguridadCatalogosController.getSystemAssignments);
router.put('/catalogos/usuarios/:login/asignaciones/:system', SeguridadCatalogosController.saveSystemAssignments);
router.get('/catalogos/:catalog', SeguridadCatalogosController.list);
router.post('/catalogos/:catalog/insert', SeguridadCatalogosController.insert);
router.put('/catalogos/:catalog/update', SeguridadCatalogosController.update);
router.patch('/catalogos/:catalog/update', SeguridadCatalogosController.update);
router.delete('/catalogos/:catalog/delete', SeguridadCatalogosController.remove);

module.exports = router;

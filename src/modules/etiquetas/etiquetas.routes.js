const router = require('express').Router();
const authContext = require('../../middleware/authContext');
const { requirePermission } = require('../../middleware/securityAuthorization');
const controller = require('./etiquetas.controller');
const { ETIQUETAS_PERMISSION } = require('./etiquetas.service');

const requireConfigEtiquetaPermission = (req, res, next) => {
  const roles = Array.isArray(req.auth?.user?.roles)
    ? req.auth.user.roles.map((role) => String(role).trim().toUpperCase())
    : [];
  if (roles.includes('ADMINFULL')) return next();
  return requirePermission(ETIQUETAS_PERMISSION)(req, res, next);
};

router.use(authContext, requireConfigEtiquetaPermission);
router.get('/catalogo/tipos-etiqueta', controller.listLabelTypes);
router.get('/catalogo', controller.listCatalog);
router.post('/catalogo', controller.createLabel);
router.put('/catalogo/:etiCod', controller.updateLabel);
router.delete('/catalogo/:etiCod', controller.removeLabel);
router.post('/catalogo/:etiCod/versiones', controller.createVersion);
router.get('/catalogo/:etiCod/versiones/:version', controller.getVersion);
router.put('/catalogo/:etiCod/versiones/:version', controller.saveVersion);
router.delete('/catalogo/:etiCod/versiones/:version', controller.removeVersion);
router.post('/catalogo/:etiCod/versiones/:version/importar', controller.importVersionZpl);
router.post('/catalogo/:etiCod/versiones/:version/render', controller.renderVersion);
router.post('/catalogo/:etiCod/versiones/:version/preview', controller.previewVersion);
router.get('/configuraciones', controller.list);
router.get('/configuraciones/:confCod/diseno', controller.get);
router.put('/configuraciones/:confCod/diseno', controller.save);
router.delete('/configuraciones/:confCod/diseno', controller.remove);
router.post('/configuraciones/:confCod/importar', controller.importZpl);
router.post('/configuraciones/:confCod/rescatar-gx8', controller.rescue);
router.post('/configuraciones/:confCod/render', controller.render);
router.post('/configuraciones/:confCod/preview', controller.preview);

module.exports = router;
module.exports.requireConfigEtiquetaPermission = requireConfigEtiquetaPermission;

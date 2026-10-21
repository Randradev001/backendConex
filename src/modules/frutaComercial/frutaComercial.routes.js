const router = require('express').Router();
const authContext = require('../../middleware/authContext');
const { requirePermission } = require('../../middleware/securityAuthorization');
const service = require('./frutaComercial.service');

const run = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error instanceof service.FrutaComercialError) return res.status(error.status).json({ code: error.code, message: error.message });
    return next(error);
  }
};

router.use(authContext);
router.get('/', requirePermission(service.permission), run(async (req, res) => res.json(await service.listFrutaComercial(req.context.empCod, req.query))));
router.get('/form-data', requirePermission(service.permission), run(async (req, res) => res.json(await service.getFormData(req.context.empCod))));
router.get('/:process/:entryNumber', requirePermission(service.permission), run(async (req, res) => res.json(await service.getFrutaComercial(req.context.empCod, req.params.process, req.params.entryNumber))));
router.post('/', requirePermission({ ...service.permission, accion: service.ACTIONS.create }), run(async (req, res) => res.status(201).json(await service.createFrutaComercial(req.context.empCod, req.context.login, req.body))));
router.put('/:process/:entryNumber', requirePermission({ ...service.permission, accion: service.ACTIONS.update }), run(async (req, res) => res.json(await service.updateFrutaComercial(req.context.empCod, req.params.process, req.params.entryNumber, req.body))));
router.patch('/:process/:entryNumber/anular', requirePermission({ ...service.permission, accion: service.ACTIONS.annul }), run(async (req, res) => res.json(await service.annulFrutaComercial(req.context.empCod, req.params.process, req.params.entryNumber))));
// Compatibilidad con el patrón de borrado del XPZ; la etiqueta de UI es Anular.
router.delete('/:process/:entryNumber', requirePermission({ ...service.permission, accion: service.ACTIONS.annul }), run(async (req, res) => res.json(await service.annulFrutaComercial(req.context.empCod, req.params.process, req.params.entryNumber))));

module.exports = router;

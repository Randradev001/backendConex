const router = require('express').Router();
const authContext = require('../../middleware/authContext');
const { requireAnyPermission } = require('../../middleware/securityAuthorization');
const service = require('./packingList.service');

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof service.PackingListError) return res.status(error.status).json({ code: error.code, message: error.message });
    next(error);
  }
};
router.use(authContext, requireAnyPermission([service.permission]));
router.get('/form-data', run(async (req, res) => res.json(await service.getFormData(req.context.empCod))));
router.get('/packings', run(async (req, res) => res.json(await service.list(req.context.empCod, req.query))));
router.get('/sources', run(async (req, res) => res.json(await service.sources(req.context.empCod, req.query.type))));
router.post('/packings', run(async (req, res) => res.status(201).json(await service.create(req.context.empCod, req.context.login, req.body))));
router.get('/packings/:id', run(async (req, res) => res.json(await service.getDetail(req.context.empCod, req.params.id))));
router.put('/packings/:id', run(async (req, res) => res.json(await service.update(req.context.empCod, req.params.id, req.body))));
module.exports = router;

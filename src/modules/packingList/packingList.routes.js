const router = require('express').Router();
const authContext = require('../../middleware/authContext');
const { requireAnyPermission } = require('../../middleware/securityAuthorization');
const service = require('./packingList.service');

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof service.PackingListError)
      return res.status(error.status).json({ code: error.code, message: error.message, field: error.field });
    next(error);
  }
};
router.use(authContext, requireAnyPermission([service.permission]));
router.get('/form-data', run(async (req, res) => res.json(await service.getFormData(req.context.empCod))));
router.get('/packings', run(async (req, res) => res.json(await service.list(req.context.empCod, req.query))));
router.get('/sources', run(async (req, res) => res.json(await service.sources(req.context.empCod, req.query.type))));
router.post('/packings', run(async (req, res) => res.status(201).json(await service.create(req.context.empCod, req.context.login, req.body))));
router.get('/packings/:id', run(async (req, res) => res.json(await service.getDetail(req.context.empCod, req.params.id))));
router.get('/packings/:id/pdf', run(async (req, res) => {
  const file = await service.getPdf(req.context.empCod, req.params.id, req.query.report);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${file.filename}"`);
  res.set('Cache-Control', 'no-store');
  res.send(file.buffer);
}));
router.put('/packings/:id', run(async (req, res) => res.json(await service.update(req.context.empCod, req.params.id, req.body))));
module.exports = router;

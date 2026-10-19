const router = require('express').Router();
const authContext = require('../../middleware/authContext');
const { requirePermission } = require('../../middleware/securityAuthorization');
const service = require('./repaletizaje.service');

const run = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error instanceof service.RepaletizajeError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    return next(error);
  }
};

router.use(authContext, requirePermission(service.permission));

router.get('/', run(async (req, res) => res.json(await service.listRepaletizajes(req.context.empCod, req.query))));
router.get('/form-data', run(async (req, res) => res.json(await service.editorData(req.context.empCod))));
router.get('/source/:folio', run(async (req, res) => res.json(await service.getSourceFolio(req.context.empCod, req.params.folio))));
router.get('/new-folio-check/:folio', run(async (req, res) => res.json(await service.checkNewFolio(req.context.empCod, req.params.folio))));
router.get('/source-lower/:folio', run(async (req, res) => res.json(await service.getLowerSourceFolio(req.context.empCod, req.context.login, req.params.folio, req.query.repNum))));
router.post('/', run(async (req, res) => {
  return res.status(201).json(await service.createRepaletizaje(req.context.empCod, req.context.login, req.body));
}));
router.get('/:repNum/folios', run(async (req, res) => res.json(await service.listRepaletizajeFolios(req.context.empCod, req.params.repNum, req.query))));
router.get('/:repNum/add-source', run(async (req, res) => res.json(await service.getAddSource(req.context.empCod, req.context.login, req.params.repNum))));
router.get('/:repNum/source-raise/:folio', run(async (req, res) => res.json(await service.getRaiseSourceFolio(req.context.empCod, req.context.login, req.params.repNum, req.params.folio))));
router.get('/:repNum', run(async (req, res) => res.json(await service.getRepaletizaje(req.context.empCod, req.params.repNum))));
router.post('/:repNum/folios', run(async (req, res) => {
  return res.json(await service.appendRepaletizajeFolios(req.context.empCod, req.context.login, req.params.repNum, req.body));
}));
router.post('/:repNum/subir-cajas', run(async (req, res) => {
  return res.json(await service.raiseRepaletizajeBoxes(req.context.empCod, req.context.login, req.params.repNum, req.body));
}));
router.post('/:repNum/bajar-cajas', run(async (req, res) => {
  return res.json(await service.lowerRepaletizajeBoxes(req.context.empCod, req.context.login, req.params.repNum, req.body));
}));
router.delete('/:repNum/folios/:folio', run(async (req, res) => {
  return res.json(await service.removeRepaletizajeFolio(req.context.empCod, req.context.login, req.params.repNum, req.params.folio));
}));
router.post('/:repNum/finalize', run(async (req, res) => {
  return res.json(await service.finalizeRepaletizaje(req.context.empCod, req.params.repNum));
}));
router.delete('/:repNum', run(async (req, res) => {
  return res.json(await service.annulRepaletizaje(req.context.empCod, req.params.repNum));
}));
router.get('/:repNum/pdf', run(async (req, res) => {
  const file = await service.generateRepaletizajePdf(req.context.empCod, req.params.repNum);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
  return res.send(file.content);
}));
router.get('/:repNum/archivo', run(async (req, res) => {
  const file = await service.generateRepaletizajeArchive(req.context.empCod, req.params.repNum);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.send(file.content);
}));

module.exports = router;

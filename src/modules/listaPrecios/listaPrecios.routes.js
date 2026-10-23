const router = require('express').Router();
const authContext = require('../../middleware/authContext');
const { requirePermission } = require('../../middleware/securityAuthorization');
const service = require('./listaPrecios.service');

const run = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error instanceof service.ListaPreciosError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    return next(error);
  }
};

router.use(authContext);
router.get('/', requirePermission(service.permission), run(async (req, res) => res.json(await service.listListaPrecios(req.context.empCod, req.query))));
router.get('/catalogs', requirePermission(service.permission), run(async (req, res) => res.json(await service.getListaPreciosCatalogs(req.context.empCod))));
router.post('/', requirePermission({ ...service.permission, accion: service.ACTIONS.create }), run(async (req, res) => res.status(201).json(await service.createListaPrecio(req.context.empCod, req.context.login, req.body))));
router.put('/', requirePermission({ ...service.permission, accion: service.ACTIONS.update }), run(async (req, res) => res.json(await service.updateListaPrecio(req.context.empCod, req.context.login, req.body))));
router.patch('/anular', requirePermission({ ...service.permission, accion: service.ACTIONS.annul }), run(async (req, res) => res.json(await service.annulListaPrecio(req.context.empCod, req.context.login, req.body))));

module.exports = router;

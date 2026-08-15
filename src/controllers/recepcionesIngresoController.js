const service = require('../services/recepcionesIngreso.service');

const context = (req) => {
  const empCod = Number(req.context?.empCod);
  if (!Number.isInteger(empCod) || empCod < 1) throw new service.RecepcionesIngresoError(401, 'COMPANY_CONTEXT_REQUIRED', 'La sesion no tiene empresa valida.');
  return { empCod, login: String(req.context?.login || '').trim() };
};
const key = (req) => ({ tempCod: req.params.tempCod, origin: req.params.origin, docType: req.params.docType, guide: req.params.guide, producer: req.params.producer });
const run = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) {
    if (error instanceof service.RecepcionesIngresoError) return res.status(error.status).json({ code: error.code, message: error.message });
    return next(error);
  }
};

module.exports = {
  catalogs: run(async (req, res) => res.json(await service.listCatalogs(context(req).empCod))),
  list: run(async (req, res) => res.json(await service.list(context(req).empCod, req.query))),
  lotBoard: run(async (req, res) => res.json(await service.listLotBoard(context(req).empCod, req.query))),
  qualityCatalogs: run(async (req, res) => res.json(await service.listQualityCatalogs(context(req).empCod, req.query.species))),
  getOne: run(async (req, res) => res.json(await service.getOne(context(req).empCod, key(req)))),
  create: run(async (req, res) => { const ctx = context(req); return res.status(201).json(await service.create(ctx.empCod, ctx.login, req.body)); }),
  update: run(async (req, res) => { const ctx = context(req); return res.json(await service.update(ctx.empCod, ctx.login, key(req), req.body)); }),
  remove: run(async (req, res) => res.json(await service.remove(context(req).empCod, key(req))))
};

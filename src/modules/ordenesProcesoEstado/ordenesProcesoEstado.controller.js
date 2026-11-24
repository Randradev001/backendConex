const service = require('./ordenesProcesoEstado.service');

const run = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error instanceof service.OrdenesProcesoEstadoError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    return next(error);
  }
};

module.exports = {
  detail: run(async (req, res) => res.json(await service.getOrderState(req.context.empCod, req.params.ordpnum))),
  update: run(async (req, res) => res.json(await service.updateOrderState(req.context.empCod, req.params.ordpnum, req.body?.state)))
};

const service = require('../services/controlLineas.service');

const list = async (req, res, next) => {
  try {
    const result = await service.listControlLines(req.context?.empCod);
    return res.json(result);
  } catch (error) {
    if (error.status && error.code) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    return next(error);
  }
};

const catalogs = async (req, res, next) => {
  try {
    return res.json(await service.listControlLineCatalogs(req.context?.empCod));
  } catch (error) {
    if (error.status && error.code) return res.status(error.status).json({ code: error.code, message: error.message });
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const line = await service.createControlLine(req.context?.empCod, req.context?.login, req.body);
    return res.status(201).json({ success: true, line });
  } catch (error) {
    if (error.status && error.code) return res.status(error.status).json({ code: error.code, message: error.message });
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const line = await service.updateControlLine(
      req.context?.empCod,
      req.context?.login,
      req.params.machine,
      req.params.line,
      req.body
    );
    return res.json({ success: true, line });
  } catch (error) {
    if (error.status && error.code) return res.status(error.status).json({ code: error.code, message: error.message });
    return next(error);
  }
};

module.exports = { list, catalogs, create, update };

const service = require('./etiquetas.service');
const versions = require('./etiquetasVersiones.service');

const respond = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error.status && error.code) {
      return res.status(error.status).json({ code: error.code, message: error.message, details: error.details });
    }
    return next(error);
  }
};

const list = respond(async (req, res) => res.json(
  await service.list(req.context?.empCod)
));

const get = respond(async (req, res) => res.json(
  await service.get(req.context?.empCod, req.params.confCod)
));

const save = respond(async (req, res) => res.json(
  await service.save(req.context?.empCod, req.context?.login, req.params.confCod, req.body || {})
));

const importZpl = respond(async (req, res) => res.json(
  await service.importZpl(req.context?.empCod, req.params.confCod, req.body || {})
));

const rescue = respond(async (req, res) => res.json(
  await service.rescue(req.context?.empCod, req.params.confCod)
));

const render = respond(async (req, res) => res.json(
  await service.render(req.context?.empCod, req.params.confCod, req.body || {})
));

const preview = respond(async (req, res) => {
  const image = await service.preview(req.context?.empCod, req.params.confCod, req.body || {});
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-store');
  return res.send(image);
});

const remove = respond(async (req, res) => res.json(
  await service.remove(req.context?.empCod, req.params.confCod, req.body || {})
));

const listCatalog = respond(async (req, res) => res.json(await versions.list(req.context?.empCod)));
const listLabelTypes = respond(async (req, res) => res.json(await versions.listTypes(req.context?.empCod)));
const createLabel = respond(async (req, res) => res.status(201).json(
  await versions.createLabel(req.context?.empCod, req.context?.login, req.body || {})
));
const updateLabel = respond(async (req, res) => res.json(
  await versions.updateLabel(req.context?.empCod, req.context?.login, req.params.etiCod, req.body || {})
));
const removeLabel = respond(async (req, res) => res.json(
  await versions.removeLabel(req.context?.empCod, req.params.etiCod, req.body || {})
));
const createVersion = respond(async (req, res) => res.status(201).json(
  await versions.createVersion(req.context?.empCod, req.context?.login, req.params.etiCod, req.body || {})
));
const getVersion = respond(async (req, res) => res.json(
  await versions.getVersion(req.context?.empCod, req.params.etiCod, req.params.version)
));
const saveVersion = respond(async (req, res) => res.json(
  await versions.saveVersion(req.context?.empCod, req.context?.login, req.params.etiCod, req.params.version, req.body || {})
));
const removeVersion = respond(async (req, res) => res.json(
  await versions.removeVersion(req.context?.empCod, req.params.etiCod, req.params.version, req.body || {})
));
const importVersionZpl = respond(async (req, res) => res.json(
  await versions.importZpl(req.context?.empCod, req.params.etiCod, req.params.version, req.body || {})
));
const renderVersion = respond(async (req, res) => res.json(
  await versions.render(req.context?.empCod, req.params.etiCod, req.params.version, req.body || {})
));
const previewVersion = respond(async (req, res) => {
  const image = await versions.preview(req.context?.empCod, req.params.etiCod, req.params.version, req.body || {});
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-store');
  return res.send(image);
});

module.exports = {
  list, get, save, importZpl, rescue, render, preview, remove,
  listCatalog, listLabelTypes, createLabel, updateLabel, removeLabel,
  createVersion, getVersion, saveVersion, removeVersion,
  importVersionZpl, renderVersion, previewVersion
};

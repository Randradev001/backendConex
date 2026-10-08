const router = require("express").Router();
const authContext = require("../../middleware/authContext");
const { requirePermission } = require("../../middleware/securityAuthorization");
const service = require("./despachosSAG.service");

const run = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error instanceof service.DespachosSAGError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    return next(error);
  }
};

router.use(authContext, requirePermission(service.permission));

router.get(
  "/form-data",
  run(async (req, res) => res.json(await service.getDespachoFormData(req.context.empCod))),
);

router.get(
  "/despachos",
  run(async (req, res) => res.json(await service.listDespachos(req.context.empCod, req.query))),
);

router.get(
  "/despachos/:dorNum/pdf",
  run(async (req, res) => {
    const file = await service.generateDespachoPdf(req.context.empCod, req.params.dorNum);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
    return res.send(file.content);
  }),
);

router.get(
  "/despachos/:dorNum/archivo",
  run(async (req, res) => {
    const file = await service.generateArchivoDes(req.context.empCod, req.params.dorNum);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    return res.send(file.content);
  }),
);

router.post(
  "/despachos/:dorNum/multipuerto/open",
  run(async (req, res) =>
    res.json(await service.openMultipuerto(req.context.empCod, req.params.dorNum)),
  ),
);

router.put(
  "/despachos/:dorNum/multipuerto",
  run(async (req, res) =>
    res.json(await service.updateMultipuerto(req.context.empCod, req.params.dorNum, req.body)),
  ),
);

router.get(
  "/despachos/:dorNum/multipuerto/archivo",
  run(async (req, res) => {
    const file = await service.generateArchivoMultipuerto(req.context.empCod, req.params.dorNum);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    return res.send(file.content);
  }),
);

router.post(
  "/despachos",
  run(async (req, res) => res.status(201).json(await service.createDespacho(req.context.empCod, req.context.login, req.body))),
);

router.get(
  "/despachos/:dorNum",
  run(async (req, res) =>
    res.json(await service.getDespachoDetail(req.context.empCod, req.params.dorNum, req.query.type || 1)),
  ),
);

router.put(
  "/despachos/:dorNum",
  run(async (req, res) =>
    res.json(await service.updateDespacho(req.context.empCod, req.context.login, req.params.dorNum, req.body)),
  ),
);

router.post(
  "/despachos/:dorNum/finalizar",
  run(async (req, res) =>
    res.json(await service.finalizarDespacho(req.context.empCod, req.params.dorNum, req.query.type || req.body?.dorTipPlani || 1)),
  ),
);

router.delete(
  "/despachos/:dorNum",
  run(async (req, res) =>
    res.json(await service.anularDespacho(req.context.empCod, req.context.login, req.params.dorNum, req.query.type || req.body?.dorTipPlani || 1)),
  ),
);

router.get(
  "/despachos/:dorNum/available-folios",
  run(async (req, res) =>
    res.json(await service.listAvailableDespachoFolios(req.context.empCod, req.params.dorNum, req.query.type || 1, req.query)),
  ),
);

router.post(
  "/despachos/:dorNum/folios",
  run(async (req, res) =>
    res.status(201).json(await service.addFolioToDespacho(req.context.empCod, req.context.login, req.params.dorNum, req.body)),
  ),
);

router.delete(
  "/despachos/:dorNum/folios/:folio",
  run(async (req, res) =>
    res.json(await service.removeFolioFromDespacho(req.context.empCod, req.params.dorNum, req.params.folio, req.body || req.query)),
  ),
);

module.exports = router;

const router = require("express").Router();
const authContext = require("../../middleware/authContext");
const { requirePermission } = require("../../middleware/securityAuthorization");
const service = require("./procesosUSDA.service");

const run = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error instanceof service.ProcesosUSDAError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    return next(error);
  }
};

router.use(authContext, requirePermission(service.permission));

router.get(
  "/form-data",
  run(async (req, res) => res.json(await service.getFormData(req.context.empCod))),
);

router.get(
  "/procesos",
  run(async (req, res) => res.json(await service.listProcesos(req.context.empCod, req.query))),
);

router.post(
  "/procesos",
  run(async (req, res) =>
    res.status(201).json(await service.createProceso(req.context.empCod, req.context.login, req.body)),
  ),
);

router.get(
  "/procesos/availability",
  run(async (req, res) =>
    res.json(
      await service.checkProcesoDisponible(
        req.context.empCod,
        req.query.type,
        req.query.processNumber,
      ),
    ),
  ),
);

router.get(
  "/procesos/:processType/:processNumber",
  run(async (req, res) =>
    res.json(
      await service.getProcesoDetail(
        req.context.empCod,
        req.params.processType,
        req.params.processNumber,
      ),
    ),
  ),
);

router.get(
  "/procesos/:processType/:processNumber/pdf",
  run(async (req, res) => {
    const file = await service.generateProcesoUSDAPdf(
      req.context.empCod,
      req.params.processType,
      req.params.processNumber,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.filename}"`,
    );
    return res.send(file.content);
  }),
);

router.put(
  "/procesos/:processType/:processNumber",
  run(async (req, res) =>
    res.json(
      await service.updateProceso(
        req.context.empCod,
        req.context.login,
        req.params.processType,
        req.params.processNumber,
        req.body,
      ),
    ),
  ),
);

router.get(
  "/procesos/:processType/:processNumber/available-folios",
  run(async (req, res) =>
    res.json(
      await service.listAvailableProcessFolios(
        req.context.empCod,
        req.params.processType,
        req.params.processNumber,
        req.query,
      ),
    ),
  ),
);

router.post(
  "/procesos/:processType/:processNumber/folios",
  run(async (req, res) =>
    res.status(201).json(
      await service.addProcesoFolio(
        req.context.empCod,
        req.context.login,
        req.params.processType,
        req.params.processNumber,
        req.body,
      ),
    ),
  ),
);

router.delete(
  "/procesos/:processType/:processNumber/folios/:folio",
  run(async (req, res) =>
    res.json(
      await service.removeProcesoFolio(
        req.context.empCod,
        req.params.processType,
        req.params.processNumber,
        req.params.folio,
      ),
    ),
  ),
);

router.patch(
  "/procesos/:processType/:processNumber/status",
  run(async (req, res) =>
    res.json(
      await service.changeStatus(
        req.context.empCod,
        req.context.login,
        req.params.processType,
        req.params.processNumber,
        req.body?.status,
      ),
    ),
  ),
);

router.delete(
  "/procesos/:processType/:processNumber",
  run(async (req, res) =>
    res.json(
      await service.anularProceso(
        req.context.empCod,
        req.context.login,
        req.params.processType,
        req.params.processNumber,
      ),
    ),
  ),
);

module.exports = router;

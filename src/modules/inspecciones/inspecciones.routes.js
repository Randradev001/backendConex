const router = require("express").Router();
const authContext = require("../../middleware/authContext");
const { requirePermission } = require("../../middleware/securityAuthorization");
const service = require("./inspecciones.service");

const run = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (error instanceof service.InspeccionesError)
      return res
        .status(error.status)
        .json({ code: error.code, message: error.message });
    return next(error);
  }
};

router.use(authContext, requirePermission(service.permission));
router.get(
  "/form-data",
  run(async (req, res) =>
    res.json(await service.getFormData(req.context.empCod)),
  ),
);
router.get(
  "/solicitudes",
  run(async (req, res) =>
    res.json(await service.listInspecciones(req.context.empCod, req.query)),
  ),
);
router.get(
  "/available-folios",
  run(async (req, res) =>
    res.json(await service.listAvailableFolios(req.context.empCod, req.query)),
  ),
);
router.get(
  "/available-folios/:folio/details",
  run(async (req, res) =>
    res.json(
      await service.getAvailableFolioDetails(req.context.empCod, {
        ...req.query,
        folio: req.params.folio,
      }),
    ),
  ),
);
router.get(
  "/solicitudes/:solNum/archivo",
  run(async (req, res) => {
    const file = await service.generateArchivoIns(
      req.context.empCod,
      req.params.solNum,
    );
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    return res.send(file.content);
  }),
);
router.get(
  "/solicitudes/:solNum/pdf",
  run(async (req, res) => {
    const file = await service.generateSolicitudPdf(
      req.context.empCod,
      req.params.solNum,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.filename}"`,
    );
    return res.send(file.content);
  }),
);
router.get(
  "/solicitudes/:solNum",
  run(async (req, res) =>
    res.json(
      await service.getSolicitudDetalle(req.context.empCod, req.params.solNum),
    ),
  ),
);
router.put(
  "/solicitudes/:solNum",
  run(async (req, res) =>
    res.json(
      await service.updateSolicitud(
        req.context.empCod,
        req.params.solNum,
        req.body,
      ),
    ),
  ),
);
router.patch(
  "/solicitudes/:solNum/status",
  run(async (req, res) =>
    res.json(
      await service.cambiarEstadoSolicitud(
        req.context.empCod,
        req.context.login,
        req.params.solNum,
        req.body?.status,
      ),
    ),
  ),
);
router.post(
  "/solicitudes",
  run(async (req, res) =>
    res
      .status(201)
      .json(
        await service.createSolicitud(
          req.context.empCod,
          req.context.login,
          req.body,
        ),
      ),
  ),
);
router.post(
  "/solicitudes/:solNum/folios",
  run(async (req, res) =>
    res
      .status(201)
      .json(
        await service.addFolioToSolicitud(
          req.context.empCod,
          req.params.solNum,
          req.body?.folio,
        ),
      ),
  ),
);
router.delete(
  "/solicitudes/:solNum/folios/:folio",
  run(async (req, res) =>
    res.json(
      await service.removeFolioFromSolicitud(
        req.context.empCod,
        req.params.solNum,
        req.params.folio,
      ),
    ),
  ),
);
router.delete(
  "/solicitudes/:solNum",
  run(async (req, res) =>
    res.json(
      await service.anularSolicitud(req.context.empCod, req.params.solNum),
    ),
  ),
);

module.exports = router;

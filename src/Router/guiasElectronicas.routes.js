const router = require('express').Router();
const authContext = require('../middleware/authContext');
const { requireAnyPermission } = require('../middleware/securityAuthorization');
const service = require('../services/guiasElectronicas.service');

router.use(authContext, requireAnyPermission([
  { sistema: 130, modulo: 1, programa: 1 },
  { sistema: 70, modulo: 6, programa: 3 },
  { sistema: 100, modulo: 2, programa: 20 }
]));

router.get('/', async (req, res, next) => {
  try {
    const empCod = Number(req.context.empCod);
    if (!Number.isInteger(empCod) || empCod < 1) return res.status(500).json({ message: 'Empresa de sesión inválida.' });
    const rows = await service.listLegacyGuides(empCod);
    return res.json({ data: rows, count: rows.length, source: 'CONEX_LEGACY' });
  } catch (error) {
    return next(error);
  }
});

router.post('/acceso-aperp', async (req, res, next) => {
  try {
    const empCod = Number(req.context.empCod);
    if (!Number.isInteger(empCod) || empCod < 1) return res.status(500).json({ message: 'Empresa de sesión inválida.' });
    return res.status(201).json({ data: await service.issueAperpAccess(empCod, req.context.login) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

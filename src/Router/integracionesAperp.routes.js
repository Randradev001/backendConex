const router = require('express').Router();
const authContext = require('../middleware/authContext');
const service = require('../services/guiasElectronicas.service');

router.use(authContext);

router.post('/ingreso-facturas', async (req, res, next) => {
  try {
    const empCod = Number(req.context.empCod);
    if (!Number.isInteger(empCod) || empCod < 1) return res.status(500).json({ message: 'Empresa de sesión inválida.' });
    return res.status(201).json({ data: await service.issueAperpInvoiceAccess(empCod, req.context.login) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

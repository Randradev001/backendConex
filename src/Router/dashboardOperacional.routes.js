const router = require('express').Router();
const authContext = require('../middleware/authContext');
const service = require('../services/dashboardOperacional.service');

router.use(authContext);
router.get('/', async (req, res, next) => {
  try { return res.json({ data: await service.getDashboard(Number(req.context.empCod)) }); }
  catch (error) { return next(error); }
});

module.exports = router;

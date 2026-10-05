const router = require('express').Router();
const { createPrintAgentAuth } = require('./printAgent.auth');
const { createPrintAgentRepository } = require('./printAgent.repository');
const { createPrintAgentService } = require('./printAgent.service');

const service = createPrintAgentService({ repository: createPrintAgentRepository() });
const auth = createPrintAgentAuth();
const respond = (handler) => async (req, res, next) => {
  try { return await handler(req, res); }
  catch (error) {
    if (error.status && error.code) return res.status(error.status).json({ code: error.code, message: error.message });
    return next(error);
  }
};

router.use(auth);
router.post('/heartbeat', (req, res) => res.json({ ok: true, serverTime: new Date().toISOString() }));
router.post('/jobs/prepare', respond(async (req, res) => res.json(await service.prepare(req.printAgent, req.body))));
router.post('/jobs/:id/result', respond(async (req, res) => res.json(await service.result(req.printAgent, req.params.id, req.body))));

module.exports = router;

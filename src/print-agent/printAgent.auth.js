const crypto = require('node:crypto');
const { buildPrintAgentServerConfig } = require('./printAgent.config');

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const createPrintAgentAuth = ({ configProvider = () => buildPrintAgentServerConfig() } = {}) => (req, res, next) => {
  let config;
  try { config = configProvider(); }
  catch (error) { return res.status(503).json({ code: 'PRINT_AGENT_CONFIG_INVALID', message: error.message }); }
  if (!config.enabled) return res.status(503).json({ code: 'PRINT_AGENT_API_DISABLED', message: 'La API del agente de impresión está deshabilitada.' });

  const authorization = String(req.get('authorization') || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const agentId = String(req.get('x-conex-agent-id') || '').trim();
  const installationId = String(req.get('x-conex-installation-id') || '').trim();
  if (!safeEqual(token, config.token) || !safeEqual(agentId, config.agentId) || !safeEqual(installationId, config.installationId)) {
    return res.status(401).json({ code: 'PRINT_AGENT_UNAUTHORIZED', message: 'Credenciales del agente inválidas.' });
  }
  req.printAgent = { ...config, token: undefined };
  return next();
};

module.exports = { createPrintAgentAuth, safeEqual };

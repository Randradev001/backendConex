const enabledValue = (value) => ['1', 'true', 'yes', 'si'].includes(String(value || '').trim().toLowerCase());
const required = (env, name) => {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`Falta configurar variable de entorno: ${name}`);
  return value;
};

const buildPrintAgentServerConfig = (env = process.env) => {
  const enabled = enabledValue(env.PRINT_AGENT_API_ENABLED);
  if (!enabled) return { enabled: false };
  const token = required(env, 'PRINT_AGENT_TOKEN');
  if (token.length < 24) throw new Error('PRINT_AGENT_TOKEN debe tener al menos 24 caracteres.');
  const empCod = Number(required(env, 'PRINT_AGENT_EMP_COD'));
  if (!Number.isInteger(empCod) || empCod <= 0) throw new Error('PRINT_AGENT_EMP_COD debe ser un entero positivo.');
  return {
    enabled: true,
    agentId: required(env, 'PRINT_AGENT_ID'),
    installationId: required(env, 'PRINT_INSTALLATION_ID'),
    token,
    empCod,
    printerPort: Number(env.PRINT_PORT || 9100),
    printerTimeoutMs: Number(env.PRINT_TIMEOUT_MS || 5000)
  };
};

module.exports = { buildPrintAgentServerConfig, enabledValue };

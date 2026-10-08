require('../src/config/loadEnv');
const { buildPrintConfig } = require('../src/config/printConfig');
const { configuredEnvFile, loadedFiles } = require('../src/config/loadEnv');

try {
  const config = buildPrintConfig();
  const summary = {
    valid: true,
    configuredEnvFile,
    loadedFiles,
    enabled: config.enabled,
    queueSource: config.queueSource,
    contextSource: config.contextSource,
    pollMs: config.pollMs,
    printerPort: config.printerPort,
    printerTimeoutMs: config.printerTimeoutMs
  };
  summary.localQueueDatabase = {
    server: config.database.server,
    name: config.database.name,
    userConfigured: true,
    passwordConfigured: config.database.passwordConfigured,
    empCod: config.empCod
  };
  if (config.contextSource === 'api') {
    summary.api = { url: config.api.url, agentId: config.api.agentId, tokenConfigured: config.api.tokenConfigured };
  }
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(`Configuración de impresión inválida: ${error.message}`);
  process.exitCode = 1;
}

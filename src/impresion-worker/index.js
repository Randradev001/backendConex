require('../config/loadEnv');
const { runWorker } = require('./worker');
const { buildPrintConfig } = require('../config/printConfig');

let printConfig;
try {
  printConfig = buildPrintConfig();
} catch (error) {
  console.error(`Configuración inválida del worker: ${error.message}`);
  process.exitCode = 2;
}

if (printConfig && !printConfig.enabled) {
  console.error('Worker de impresión deshabilitado. Configure PRINT_WORKER_ENABLED=true para iniciarlo.');
  process.exitCode = 2;
} else if (printConfig) {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  runWorker({ signal: controller.signal }).catch((error) => {
    console.error('El worker de impresión terminó por un error no controlado.', error);
    process.exitCode = 1;
  });
}

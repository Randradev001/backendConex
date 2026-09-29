require('../config/loadEnv');
const { runWorker } = require('./worker');

if (!['1', 'true', 'yes', 'si'].includes(String(process.env.PRINT_WORKER_ENABLED || '').toLowerCase())) {
  console.error('Worker de impresión deshabilitado. Configure PRINT_WORKER_ENABLED=true para iniciarlo.');
  process.exitCode = 2;
} else {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  runWorker({ signal: controller.signal }).catch((error) => {
    console.error('El worker de impresión terminó por un error no controlado.', error);
    process.exitCode = 1;
  });
}

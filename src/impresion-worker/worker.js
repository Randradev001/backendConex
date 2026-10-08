const { createImpresionService } = require('./impresion.service');
const printerClient = require('./printerClient');
const { buildPrintConfig } = require('../config/printConfig');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const runWorker = async ({
  repository,
  printer = { send: printerClient.sendZpl },
  logger = console,
  pollMs,
  signal
} = {}) => {
  const config = buildPrintConfig();
  const selectedRepository = repository || (() => {
    const { createImpresionRepository } = require('./impresion.repository');
    return createImpresionRepository({ empCod: config.empCod });
  })();
  const selectedPollMs = pollMs || config.pollMs;
  let service;
  if (config.contextSource === 'api') {
    const { createApiPrintClient } = require('./apiPrintClient');
    const { createPrintSpool } = require('./printSpool');
    const { createRemoteImpresionService } = require('./remoteImpresion.service');
    service = createRemoteImpresionService({
      queue: selectedRepository,
      api: createApiPrintClient({ config }),
      spool: createPrintSpool({ root: config.api.spoolPath }),
      printer,
      logger
    });
  } else {
    service = createImpresionService({ repository: selectedRepository, printer, logger });
  }
  logger.info?.(`Worker de impresión iniciado con cola ${config.queueSource} y datos ${config.contextSource}; consulta cada ${selectedPollMs} ms.`);
  while (!signal?.aborted) {
    const result = await service.processNext();
    if (!result.processed) await delay(selectedPollMs);
  }
};

module.exports = { runWorker, delay };

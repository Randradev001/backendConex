const { createImpresionRepository } = require('./impresion.repository');
const { createImpresionService } = require('./impresion.service');
const printerClient = require('./printerClient');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const runWorker = async ({
  repository = createImpresionRepository(),
  printer = { send: printerClient.sendZpl },
  logger = console,
  pollMs = Number(process.env.PRINT_POLL_MS || 750),
  signal
} = {}) => {
  const service = createImpresionService({ repository, printer, logger });
  logger.info?.(`Worker de impresión iniciado; consulta cada ${pollMs} ms.`);
  while (!signal?.aborted) {
    const result = await service.processNext();
    if (!result.processed) await delay(pollMs);
  }
};

module.exports = { runWorker, delay };

const { PRINT_STATUS } = require('./constants');

const createRemoteImpresionService = ({ queue, api, spool, printer, logger = console }) => {
  const reportSafely = async (preparationId, status, detail) => {
    try { await api.report(preparationId, status, detail); }
    catch (error) { logger.error?.(`No se pudo reportar ${status} para ${preparationId}: ${error.message}`); }
  };

  const processNext = async () => {
    const job = await queue.claimNext(`print-agent-${process.pid}`);
    if (!job) return { processed: false };
    let prepared;
    try {
      prepared = await api.prepare(job);
    } catch (error) {
      if (error.retryable) {
        await queue.releasePending(job.id, error.message);
        logger.error?.(`Backend web temporalmente no disponible para la orden ${job.id}: ${error.message}`);
        return { processed: false, retryable: true };
      }
      const status = error.code === 'PRINT_LINE_INACTIVE' ? PRINT_STATUS.LINE_INACTIVE : PRINT_STATUS.FAILED;
      await queue.finish(job.id, status, error.message);
      return { processed: true, id: job.id, status, error };
    }

    try {
      await queue.savePrepared(job.id, {
        labelCode: prepared.label.code,
        labelVersion: prepared.label.version,
        zpl: prepared.zpl
      });
      await spool.savePrepared(job, prepared);
    } catch (error) {
      await queue.finish(job.id, PRINT_STATUS.FAILED, error.message);
      await reportSafely(prepared.preparationId, 'failed_before_send', error.message);
      return { processed: true, id: job.id, status: PRINT_STATUS.FAILED, error };
    }

    try {
      await printer.send({
        host: prepared.printer.host,
        port: prepared.printer.port,
        timeoutMs: Number(process.env.PRINT_TIMEOUT_MS || 5000),
        zpl: prepared.zpl
      });
      await queue.markPrinted(job.id);
      await reportSafely(prepared.preparationId, 'printed');
      logger.info?.(`Orden de impresión ${job.id} preparada por web y enviada a ${prepared.printer.host}.`);
      return { processed: true, id: job.id, status: PRINT_STATUS.PRINTED };
    } catch (error) {
      const uncertain = Boolean(error?.uncertain);
      const status = uncertain ? PRINT_STATUS.UNCERTAIN : PRINT_STATUS.FAILED;
      await queue.finish(job.id, status, error.message);
      await reportSafely(prepared.preparationId, uncertain ? 'uncertain' : 'failed_before_send', error.message);
      return { processed: true, id: job.id, status, error };
    }
  };

  return { processNext };
};

module.exports = { createRemoteImpresionService };

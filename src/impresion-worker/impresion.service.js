const { generateZpl } = require('../modules/etiquetas/zpl/zplCore');
const { buildLegacyBoxCode } = require('./barcode');
const { PRINT_STATUS } = require('./constants');

const trim = (value) => String(value ?? '').trim();
const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [String(date.getDate()).padStart(2, '0'), String(date.getMonth() + 1).padStart(2, '0'), date.getFullYear()].join('/');
};

const variableValues = (context, code) => ({
  producto: trim(context.speciesName),
  especie: trim(context.speciesName),
  variedad: trim(context.varietyName),
  fecha: formatDate(context.processDate),
  productor: trim(context.producerName || context.producerCode),
  comuna: trim(context.producerCommune),
  provincia: trim(context.producerProvince),
  envase: trim(context.containerName || context.envCode),
  envase_externo: trim(context.containerExternalName || context.containerName || context.envCode),
  categoria: trim(context.categoryName || context.categoryCode),
  calibre: trim(context.caliber),
  codigo: code,
  lote: trim(context.processNumber)
});

const createImpresionService = ({ repository, printer, logger = console, workerId = `printer-${process.pid}` }) => {
  const processNext = async () => {
    const job = await repository.claimNext(workerId);
    if (!job) return { processed: false };

    let delivered = false;
    try {
      const context = await repository.loadContext(job);
      if (Number(context.lineState) !== 1) {
        await repository.finish(job.id, PRINT_STATUS.LINE_INACTIVE, 'La línea está inactiva.');
        return { processed: true, id: job.id, status: PRINT_STATUS.LINE_INACTIVE };
      }

      const boxNumber = await repository.nextBoxNumber(context.empCod);
      const code = buildLegacyBoxCode({
        boxNumber,
        envCode: context.envCode,
        categoryCode: context.categoryCode,
        caliberCode: context.caliberCode,
        machine: context.machine,
        line: context.lineId,
        person: context.personCode
      });
      const values = variableValues(context, code);
      const zpl = generateZpl(context.labelDesign, { variableValues: values });
      await repository.savePrepared(job.id, {
        labelCode: context.labelCode,
        labelVersion: context.labelVersion,
        zpl
      });

      await printer.send({
        host: context.printerIp,
        port: context.printerPort || 9100,
        timeoutMs: context.printerTimeoutMs,
        zpl
      });
      delivered = true;
      await repository.markPrinted(job.id);
      logger.info?.(`Orden de impresión ${job.id} enviada a ${context.printerIp}.`);
      return { processed: true, id: job.id, status: PRINT_STATUS.PRINTED };
    } catch (error) {
      const uncertain = Boolean(error?.uncertain || delivered);
      const status = uncertain ? PRINT_STATUS.UNCERTAIN : PRINT_STATUS.FAILED;
      await repository.finish(job.id, status, error.message).catch((finishError) => logger.error?.(finishError));
      logger.error?.(`Orden de impresión ${job.id}: ${error.message}`);
      return { processed: true, id: job.id, status, error };
    }
  };

  return { processNext };
};

module.exports = { createImpresionService, variableValues, formatDate };

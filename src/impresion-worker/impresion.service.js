const { generateZpl } = require('../modules/etiquetas/zpl/zplCore');
const { buildLegacyBoxCode } = require('./barcode');
const { PRINT_STATUS } = require('./constants');

const trim = (value) => String(value ?? '').trim();
const formatDate = (value, type = 1, separator = '/') => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const parts = {
    1: [day, month, year],
    2: [month, day, year],
    3: [year, month, day],
    4: [year, day, month]
  }[Number(type)] || [day, month, year];
  return parts.join(trim(separator) || '/');
};

const variableValues = (context, code) => ({
  producto: trim(context.speciesName),
  especie: trim(context.speciesName),
  especie_externa: trim(context.speciesExternalName || context.speciesName),
  variedad: trim(context.varietyName),
  fecha: formatDate(context.processDate, context.dateFormatType, context.dateSeparator),
  productor: trim(context.producerName || context.producerCode),
  productor_codigo: trim(context.producerExternalCode || context.producerCode),
  productor_secundario: trim(context.producerSecondaryName || context.producerName || context.producerCode),
  comuna: trim(context.producerCommune),
  provincia: trim(context.producerProvince),
  envase: trim(context.containerName || context.envCode),
  envase_externo: trim(context.containerExternalName || context.containerName || context.envCode),
  categoria: trim(context.categoryName || context.categoryCode),
  categoria_externa: trim(context.categoryExternalName || context.categoryName || context.categoryCode),
  calibre: trim(context.caliber),
  calibre_sin_ceros: trim(context.caliber).replace(/0/g, ''),
  codigo: code,
  lote: trim(context.processNumber)
});

const unresolvedVariables = (zpl) => [...new Set(
  [...String(zpl).matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)].map((match) => match[1].toLowerCase())
)];

const buildPreparedLabel = (context, boxNumber) => {
  const code = buildLegacyBoxCode({
    boxNumber,
    envCode: context.envCode,
    categoryCode: context.categoryCode,
    caliberCode: context.caliberCode,
    machine: context.machine,
    line: context.lineId,
    person: context.personCode
  });
  const zpl = generateZpl(context.labelDesign, { variableValues: variableValues(context, code) });
  const unresolved = unresolvedVariables(zpl);
  if (unresolved.length) throw new Error(`La etiqueta contiene variables sin resolver: ${unresolved.join(', ')}.`);
  return { code, zpl, labelCode: context.labelCode, labelVersion: context.labelVersion };
};

const createImpresionService = ({ repository, printer, logger = console, workerId = `printer-${process.pid}` }) => {
  const processFolio = async (job) => {
    let delivered = false;
    try {
      if (!trim(job.printerIp)) throw new Error('La impresora del folio no tiene una IP configurada.');
      await printer.send({
        host: job.printerIp,
        port: job.printerPort || 9100,
        timeoutMs: job.printerTimeoutMs,
        zpl: job.zpl
      });
      delivered = true;
      await repository.markFolioPrinted(job.id);
      logger.info?.(`Folio de impresión ${job.id} enviado a ${job.printerIp}.`);
      return { processed: true, id: job.id, status: PRINT_STATUS.PRINTED, kind: 'folio' };
    } catch (error) {
      const uncertain = Boolean(error?.uncertain || delivered);
      const status = uncertain ? PRINT_STATUS.UNCERTAIN : PRINT_STATUS.FAILED;
      if (typeof repository.finishFolio === 'function') {
        await repository.finishFolio(job.id, status, error.message).catch((finishError) => logger.error?.(finishError));
      }
      logger.error?.(`Folio de impresión ${job.id}: ${error.message}`);
      return { processed: true, id: job.id, status, error, kind: 'folio' };
    }
  };

  const processNext = async () => {
    const job = await repository.claimNext(workerId);
    if (job) {
      let delivered = false;
      try {
        const context = await repository.loadContext(job);
        if (Number(context.lineState) !== 1) {
          await repository.finish(job.id, PRINT_STATUS.LINE_INACTIVE, 'La línea está inactiva.');
          return { processed: true, id: job.id, status: PRINT_STATUS.LINE_INACTIVE };
        }

        const boxNumber = await repository.nextBoxNumber(context.empCod);
        const prepared = buildPreparedLabel(context, boxNumber);
        await repository.savePrepared(job.id, {
          labelCode: prepared.labelCode,
          labelVersion: prepared.labelVersion,
          zpl: prepared.zpl
        });

        await printer.send({
          host: context.printerIp,
          port: context.printerPort || 9100,
          timeoutMs: context.printerTimeoutMs,
          zpl: prepared.zpl
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
    }

    if (typeof repository.claimNextFolio !== 'function') return { processed: false };
    const folioJob = await repository.claimNextFolio(workerId);
    if (!folioJob) return { processed: false };
    return processFolio(folioJob);
  };

  return { processNext };
};

module.exports = { createImpresionService, variableValues, formatDate, unresolvedVariables, buildPreparedLabel };

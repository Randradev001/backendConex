const { buildPreparedLabel } = require('../impresion-worker/impresion.service');

class PrintAgentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const positiveInteger = (value, name) => {
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0) throw new PrintAgentError(400, 'INVALID_PRINT_JOB', `${name} debe ser un entero positivo.`);
  return result;
};

const validResults = new Set(['printed', 'failed_before_send', 'uncertain', 'rejected_local']);

const createPrintAgentService = ({ repository }) => ({
  async prepare(agent, payload = {}) {
    const localJobId = positiveInteger(payload.localJobId, 'localJobId');
    const lineId = positiveInteger(payload.lineId, 'lineId');
    try {
      return await repository.getOrCreatePreparation({ agent, localJobId, lineId, prepare: buildPreparedLabel });
    } catch (error) {
      if (error.code === 'PRINT_LINE_INACTIVE') throw new PrintAgentError(409, error.code, error.message);
      if (/No existe|no tiene|no está|inválid|variables sin resolver/i.test(error.message)) {
        throw new PrintAgentError(422, 'PRINT_CONTEXT_INVALID', error.message);
      }
      throw error;
    }
  },
  async result(agent, preparationId, payload = {}) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(preparationId || ''))) {
      throw new PrintAgentError(400, 'INVALID_PREPARATION_ID', 'El identificador de preparación no es válido.');
    }
    const status = String(payload.status || '').trim();
    if (!validResults.has(status)) throw new PrintAgentError(400, 'INVALID_PRINT_RESULT', 'Estado de impresión inválido.');
    const updated = await repository.saveResult({ agent, preparationId, status, detail: payload.detail });
    if (!updated) throw new PrintAgentError(404, 'PRINT_PREPARATION_NOT_FOUND', 'La preparación no existe para este agente.');
    return { updated: true, preparationId, status };
  }
});

module.exports = { createPrintAgentService, PrintAgentError, validResults };

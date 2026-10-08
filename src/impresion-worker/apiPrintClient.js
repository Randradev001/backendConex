const crypto = require('node:crypto');

class PrintApiError extends Error {
  constructor(message, { status, code, retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = 'PrintApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const createApiPrintClient = ({ config, fetchImpl = globalThis.fetch } = {}) => {
  if (typeof fetchImpl !== 'function') throw new Error('El runtime no dispone de fetch para consultar el backend web.');
  const request = async (path, body) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.printerTimeoutMs);
    try {
      const response = await fetchImpl(`${config.api.url}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.api.token}`,
          'x-conex-agent-id': config.api.agentId,
          'x-conex-installation-id': config.api.installationId
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new PrintApiError(payload.message || `El backend respondió HTTP ${response.status}.`, {
          status: response.status,
          code: payload.code,
          retryable: response.status >= 500 || response.status === 429
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof PrintApiError) throw error;
      throw new PrintApiError(`No se pudo conectar con el backend web: ${error.message}`, { retryable: true, cause: error });
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    async prepare(job) {
      const prepared = await request('/jobs/prepare', { localJobId: job.id, lineId: job.lineId });
      const checksum = crypto.createHash('sha256').update(String(prepared.zpl || ''), 'utf8').digest('hex');
      if (!prepared.zpl || checksum !== prepared.sha256) {
        throw new PrintApiError('El checksum del ZPL recibido no coincide.', { code: 'PRINT_ZPL_CHECKSUM_MISMATCH' });
      }
      return prepared;
    },
    report(preparationId, status, detail) {
      return request(`/jobs/${encodeURIComponent(preparationId)}/result`, { status, detail });
    },
    heartbeat() { return request('/heartbeat', {}); }
  };
};

module.exports = { createApiPrintClient, PrintApiError };

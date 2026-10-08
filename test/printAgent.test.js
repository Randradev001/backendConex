const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createPrintAgentAuth } = require('../src/print-agent/printAgent.auth');
const { createPrintAgentService } = require('../src/print-agent/printAgent.service');
const { createApiPrintClient } = require('../src/impresion-worker/apiPrintClient');
const { createRemoteImpresionService } = require('../src/impresion-worker/remoteImpresion.service');
const { PRINT_STATUS } = require('../src/impresion-worker/constants');

const agent = {
  enabled: true,
  agentId: 'packing-01',
  installationId: 'planta-01',
  token: 'token-seguro-de-mas-de-24-caracteres',
  empCod: 1,
  printerPort: 9100,
  printerTimeoutMs: 5000
};

test('autentica al agente con token, id e instalación separados de la sesión web', () => {
  let nextCalled = false;
  const req = {
    get(name) {
      return {
        authorization: `Bearer ${agent.token}`,
        'x-conex-agent-id': agent.agentId,
        'x-conex-installation-id': agent.installationId
      }[name];
    }
  };
  const res = { status: () => ({ json: () => assert.fail('No debe rechazar credenciales válidas') }) };
  createPrintAgentAuth({ configProvider: () => agent })(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.printAgent.token, undefined);
  assert.equal(req.printAgent.empCod, 1);
});

test('rechaza un token de agente incorrecto', () => {
  let status;
  const req = { get: (name) => name === 'authorization' ? 'Bearer incorrecto' : name === 'x-conex-agent-id' ? agent.agentId : agent.installationId };
  const res = { status(value) { status = value; return { json: (body) => { assert.equal(body.code, 'PRINT_AGENT_UNAUTHORIZED'); } }; } };
  createPrintAgentAuth({ configProvider: () => agent })(req, res, () => assert.fail('No debe autorizar'));
  assert.equal(status, 401);
});

test('la preparación delega idempotencia al repositorio central', async () => {
  const calls = [];
  const expected = { localJobId: 44, preparationId: 'prep-44', zpl: '^XA^XZ', sha256: 'abc' };
  const service = createPrintAgentService({
    repository: {
      async getOrCreatePreparation(input) { calls.push(input); return expected; },
      async saveResult() { return true; }
    }
  });
  assert.equal(await service.prepare(agent, { localJobId: 44, lineId: 2 }), expected);
  assert.equal(calls[0].agent.empCod, 1);
  assert.equal(calls[0].localJobId, 44);
  assert.equal(calls[0].lineId, 2);
});

test('el cliente valida el checksum del ZPL preparado por la web', async () => {
  const zpl = '^XA^FDPRUEBA^FS^XZ';
  const sha256 = crypto.createHash('sha256').update(zpl).digest('hex');
  const requests = [];
  const client = createApiPrintClient({
    config: {
      printerTimeoutMs: 1000,
      api: { url: 'https://api.conex.cl/print-agent/v1', token: agent.token, agentId: agent.agentId, installationId: agent.installationId }
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ localJobId: 44, preparationId: 'prep-44', zpl, sha256, printer: {}, label: {} }) };
    }
  });
  const prepared = await client.prepare({ id: 44, lineId: 2 });
  assert.equal(prepared.zpl, zpl);
  assert.match(requests[0].options.headers.authorization, /^Bearer /);
  assert.equal(JSON.parse(requests[0].options.body).lineId, 2);
});

test('el worker remoto guarda, imprime localmente y confirma ambos lados', async () => {
  const calls = [];
  const prepared = {
    preparationId: 'prep-44', zpl: '^XA^XZ', sha256: 'abc',
    printer: { host: '192.168.1.50', port: 9100 }, label: { code: 'POLCURA16', version: 4 }
  };
  const queue = {
    claimNext: async () => ({ id: 44, lineId: 2 }),
    savePrepared: async () => calls.push('save-local'),
    markPrinted: async () => calls.push('printed-local'),
    finish: async () => assert.fail('No debe fallar'),
    releasePending: async () => assert.fail('No debe liberar')
  };
  const api = { prepare: async () => prepared, report: async (id, status) => calls.push(`web-${id}-${status}`) };
  const service = createRemoteImpresionService({
    queue, api,
    spool: { savePrepared: async () => calls.push('spool') },
    printer: { send: async (data) => { assert.equal(data.host, '192.168.1.50'); calls.push('send'); } },
    logger: {}
  });
  const result = await service.processNext();
  assert.equal(result.status, PRINT_STATUS.PRINTED);
  assert.deepEqual(calls, ['save-local', 'spool', 'send', 'printed-local', 'web-prep-44-printed']);
});

test('si la web no responde el trabajo vuelve a pendiente sin imprimir', async () => {
  const calls = [];
  const error = new Error('Sin conexión');
  error.retryable = true;
  const service = createRemoteImpresionService({
    queue: {
      claimNext: async () => ({ id: 45, lineId: 2 }),
      releasePending: async (id) => calls.push(`release-${id}`),
      finish: async () => assert.fail('No debe quedar fallido')
    },
    api: { prepare: async () => { throw error; } },
    spool: {}, printer: {}, logger: {}
  });
  const result = await service.processNext();
  assert.equal(result.retryable, true);
  assert.deepEqual(calls, ['release-45']);
});

test('expone heartbeat en la ruta HTTP real del backend', async () => {
  const express = require('express');
  const previous = {
    enabled: process.env.PRINT_AGENT_API_ENABLED,
    id: process.env.PRINT_AGENT_ID,
    installation: process.env.PRINT_INSTALLATION_ID,
    token: process.env.PRINT_AGENT_TOKEN,
    company: process.env.PRINT_AGENT_EMP_COD
  };
  Object.assign(process.env, {
    PRINT_AGENT_API_ENABLED: 'true',
    PRINT_AGENT_ID: agent.agentId,
    PRINT_INSTALLATION_ID: agent.installationId,
    PRINT_AGENT_TOKEN: agent.token,
    PRINT_AGENT_EMP_COD: '1'
  });
  const app = express();
  app.use(express.json());
  app.use('/backendDocker/print-agent/v1', require('../src/print-agent/printAgent.routes'));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/backendDocker/print-agent/v1/heartbeat`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${agent.token}`,
        'x-conex-agent-id': agent.agentId,
        'x-conex-installation-id': agent.installationId
      }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries({
      PRINT_AGENT_API_ENABLED: previous.enabled,
      PRINT_AGENT_ID: previous.id,
      PRINT_INSTALLATION_ID: previous.installation,
      PRINT_AGENT_TOKEN: previous.token,
      PRINT_AGENT_EMP_COD: previous.company
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

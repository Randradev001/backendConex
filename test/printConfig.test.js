const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { buildPrintConfig } = require('../src/config/printConfig');

test('valida el perfil database sin exponer la contraseña', () => {
  const config = buildPrintConfig({
    PRINT_WORKER_ENABLED: 'true', PRINT_QUEUE_SOURCE: 'database', PRINT_CONTEXT_SOURCE: 'database', PRINT_EMP_COD: '3',
    PRINT_POLL_MS: '900', PRINT_PORT: '9100', PRINT_TIMEOUT_MS: '5000',
    DB_SERVER: 'localhost', DB_DATABASE: 'CONEX', DB_USER: 'sa', DB_PASSWORD: 'secreto'
  });

  assert.equal(config.queueSource, 'database');
  assert.equal(config.contextSource, 'database');
  assert.equal(config.empCod, 3);
  assert.deepEqual(config.database, { server: 'localhost', name: 'CONEX', user: 'sa', passwordConfigured: true });
  assert.equal(JSON.stringify(config).includes('secreto'), false);
});

test('acepta los alias SQLSERVER del entorno legado', () => {
  const config = buildPrintConfig({
    PRINT_QUEUE_SOURCE: 'database', PRINT_CONTEXT_SOURCE: 'database',
    SQLSERVER_HOST: 'localhost', SQLSERVER_DATABASE: 'CONEX', SQLSERVER_USER: 'sa', SQLSERVER_PASSWORD: 'secreto'
  });

  assert.deepEqual(config.database, { server: 'localhost', name: 'CONEX', user: 'sa', passwordConfigured: true });
});

test('valida el perfil api y exige HTTPS fuera de localhost', () => {
  const base = {
    PRINT_QUEUE_SOURCE: 'database', PRINT_CONTEXT_SOURCE: 'api',
    DB_SERVER: 'localhost', DB_DATABASE: 'CONEX_LOCAL', DB_USER: 'sa', DB_PASSWORD: 'secreto-local',
    PRINT_API_URL: 'https://api.conex.cl/print', PRINT_AGENT_ID: 'packing-01',
    PRINT_INSTALLATION_ID: 'planta-01', PRINT_AGENT_TOKEN: 'secreto', PRINT_LOCAL_SPOOL: 'C:\\spool'
  };
  assert.equal(buildPrintConfig(base).api.agentId, 'packing-01');
  assert.throws(() => buildPrintConfig({ ...base, PRINT_API_URL: 'http://api.conex.cl/print' }), /HTTPS/);
  assert.equal(buildPrintConfig({ ...base, PRINT_API_URL: 'http://190.3.171.48:3000/print', PRINT_API_ALLOW_INSECURE_HTTP: 'true' }).api.insecureHttp, true);
});

test('CONEX_ENV_FILE carga un perfil aislado sin heredar el .env general', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const output = execFileSync(process.execPath, ['scripts/check-print-config.js'], {
    cwd: projectRoot,
    env: {
      PATH: process.env.PATH,
      CONEX_ENV_FILE: 'test/fixtures/print-profile.env.txt'
    },
    encoding: 'utf8'
  });
  const result = JSON.parse(output);

  assert.equal(result.valid, true);
  assert.equal(result.queueSource, 'database');
  assert.equal(result.contextSource, 'api');
  assert.equal(result.api.agentId, 'agent-test');
  assert.equal(result.api.tokenConfigured, true);
  assert.match(result.loadedFiles[0], /print-profile\.env\.txt$/);
});

test('rechaza una cola remota porque OrdenImpresion pertenece al SQL local del PLC', () => {
  assert.throws(() => buildPrintConfig({ PRINT_QUEUE_SOURCE: 'api' }), /OrdenImpresion local/);
});

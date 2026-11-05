const test = require('node:test');
const assert = require('node:assert/strict');
const connector = require('../src/conectorMysql/conectorSqlServer');
let mode = 2; const history = [];
const original = connector.getPool;
connector.getPool = async () => ({ request: () => ({ inputs: {}, input(name, type, value) { this.inputs[name] = value; return this; }, async query(query) {
  history.push({ query, inputs: this.inputs });
  return { recordset: query.includes('FROM dbo.PARAMGE1') && mode != null ? [{ PAR1Valor1: mode }] : [] };
} }) });
const { issueAperpAccess, issueAperpInvoiceAccess } = require('../src/services/guiasElectronicas.service');
connector.getPool = original;
test('CONEX obtiene 60/15 por empresa de sesión y lo incorpora al ticket', async () => {
  await issueAperpAccess(1, 'TEST');
  assert.equal(history[0].inputs.emp, 1);
  const insert = history.find(({ query }) => query.includes('INSERT INTO integracion.GuiaAcceso'));
  assert.equal(insert.inputs.mode, 2);
  assert.equal(insert.inputs.emp, 1);
});
test('sin modalidad configurada no crea ticket ni selecciona API implícitamente', async () => {
  mode = null; history.length = 0;
  await assert.rejects(issueAperpAccess(2, 'TEST'), { status: 409 });
  assert.equal(history.length, 1);
});
test('Ingreso Facturas emite un ticket acotado sin depender de la modalidad de guías', async () => {
  history.length = 0;
  const result = await issueAperpInvoiceAccess(3, 'FACTURA');
  const insert = history.find(({ query }) => query.includes("'FACTURACION'"));
  assert.equal(result.ticket.length, 43);
  assert.equal(insert.inputs.emp, 3);
  assert.equal(insert.inputs.login, 'FACTURA');
  assert.equal(history.some(({ query }) => query.includes('FROM dbo.PARAMGE1')), false);
});

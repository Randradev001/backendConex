const test = require('node:test');
const assert = require('node:assert/strict');
const connector = require('../src/conectorMysql/conectorSqlServer');
const history = [];
let failExtension = false;
let validExporter = true;
class Transaction {
  async begin() { history.push({ event: 'begin' }); }
  async commit() { history.push({ event: 'commit' }); }
  async rollback() { history.push({ event: 'rollback' }); }
}
class Request {
  constructor(transaction) { this.transaction = transaction; this.inputs = {}; }
  input(name, _type, value) { this.inputs[name] = value; return this; }
  async query(query) {
    history.push({ query, inputs: this.inputs, transaction: this.transaction });
    if (query.includes('TEMP01')) return { recordset: [{ tempCod: '2026-2027' }] };
    if (query.includes('FROM CLIENTES')) return { recordset: [{ CliCod: 1 }] };
    if (query.includes('FROM EXPORT1')) return { recordset: validExporter ? [{ ExpCod: 2 }] : [] };
    if (query.includes('FROM PUERTOS')) return { recordset: [{ PuCod: 1, PuCodHomo: 123 }] };
    if (query.includes('FROM DESTINOS')) return { recordset: [{ DestCod: 1, DestCMP: 0 }] };
    if (query.includes('UPDATE p WITH')) return { rowsAffected: [1] };
    if (query.includes('MERGE integracion.PackingGuiaDatos')) {
      if (failExtension) throw new Error('Extension unavailable');
      return { rowsAffected: [1] };
    }
    throw new Error('Consulta inesperada');
  }
}
const original = { ...connector };
connector.sql = { ...connector.sql, Transaction, Request };
connector.getPool = async () => ({});
const packing = require('../src/modules/packingList/packingList.service');
Object.assign(connector, original);
const input = { clientId: 1, departureDate: '2026-11-15', arrivalDate: '2026-11-16', departureTime: '08:30', exporterId: 2,
  originPortId: 1, driver: 'Ejemplo', carrierRut: '12.345.678-5', transportCompany: 'Transportista',
  vessel: 'Nave', seal1: '775', thermograph1: 'N02NVV-400737', customsDeclaration: '124670039', transferIndicatorDte: 9 };

test('edita cabecera avanzada y extensión en una transacción por empresa y temporada', async () => {
  history.length = 0;
  await packing.update(1, 458, input);
  const update = history.find((entry) => entry.query?.includes('UPDATE p WITH'));
  assert.equal(update.inputs.EmpCod, 1);
  assert.equal(update.inputs.TempCod, '2026-2027');
  assert.equal(update.inputs.exporterId, 2);
  assert.equal(update.inputs.thermograph1, 'N02NVV-400737');
  assert.equal(update.inputs.customsDeclaration, 124670039);
  assert.match(update.query, /ISNULL\(p.PackEstado,0\)=0/);
  assert.equal(history.find((entry) => entry.query?.includes('MERGE')).transaction, update.transaction);
  assert.equal(history.at(-1).event, 'commit');
});

test('catálogo de otra empresa se rechaza antes de escribir', async () => {
  history.length = 0;
  validExporter = false;
  await assert.rejects(packing.update(1, 458, input), /empresa/);
  assert.equal(history.some((entry) => entry.query?.includes('UPDATE p WITH')), false);
  assert.equal(history.at(-1).event, 'rollback');
  validExporter = true;
});

test('una falla de extensión revierte también el cambio de la cabecera', async () => {
  history.length = 0;
  failExtension = true;
  await assert.rejects(packing.update(1, 458, input), /Extension unavailable/);
  assert.equal(history.some((entry) => entry.event === 'commit'), false);
  assert.equal(history.at(-1).event, 'rollback');
  failExtension = false;
});

test('rechaza fechas inexistentes y códigos de despacho fuera de rango', async () => {
  await assert.rejects(packing.update(1, 458, { ...input, departureDate: '2026-02-30' }), /fecha válida/);
  await assert.rejects(packing.update(1, 458, { ...input, transferIndicatorDte: 10 }), /no es válido/);
});

test('valida el dígito verificador de ambos RUT y el formato de DUS', async () => {
  await assert.rejects(packing.update(1, 458, { ...input, driverRut: '12.345.678-9' }), /RUT del chofer/);
  await assert.rejects(packing.update(1, 458, { ...input, carrierRut: '12.345.678-9' }), /RUT del transportista/);
  await assert.rejects(packing.update(1, 458, { ...input, customsDeclaration: '1e4' }), /DUS.*10 dígitos/);
});

test('identifica el campo que debe marcarse en el formulario', async () => {
  await assert.rejects(packing.update(1, 458, { ...input, destinationId: 1 }), {
    field: 'destinationId',
    message: 'El destino no tiene homologación de país.'
  });
  await assert.rejects(packing.update(1, 458, { ...input, driverRut: '12.345.678-9' }), {
    field: 'driverRut'
  });
});

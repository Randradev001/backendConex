const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONTROL_LINES_SQL,
  CONTROL_LINES_CATALOGS_SQL,
  normalizeLine,
  normalizeUpdate,
  normalizeCreate,
  buildProductionSummary,
  listControlLines,
  createControlLine,
  updateControlLine
} = require('../src/services/controlLineas.service');
const { CONTROL_LINES_PERMISSION } = require('../src/Router/controlLineas.routes');

test('consulta lineas por empresa y conserva lineas sin configuracion', () => {
  assert.match(CONTROL_LINES_SQL, /WHERE l\.EmpCod=@EmpCod/);
  assert.match(CONTROL_LINES_SQL, /LEFT JOIN LINCONFIG c/);
  assert.match(CONTROL_LINES_SQL, /c\.ConfID=1/);
  assert.doesNotMatch(CONTROL_LINES_SQL, /l\.EmpCod\s*=\s*1/);
});

test('cuenta cajas CAP001 de la orden activa en la temporada activa', () => {
  assert.match(CONTROL_LINES_SQL, /FROM TEMP01/);
  assert.match(CONTROL_LINES_SQL, /TempActiva=1/);
  assert.match(CONTROL_LINES_SQL, /o\.OrdpEstado=1/);
  assert.match(CONTROL_LINES_SQL, /LEFT JOIN CAP001 c/);
  assert.match(CONTROL_LINES_SQL, /c\.CAPNproc=o\.Ordpnum/);
  assert.doesNotMatch(CONTROL_LINES_SQL, /c\.CAPEst\s*=/);
});

test('normaliza el indicador de cajas de la orden de proceso activa', () => {
  const lastProcessedAt = new Date('2026-09-01T10:00:00Z');
  assert.deepEqual(buildProductionSummary([{ TempCod: '2026-2027 ', Ordpnum: 169, ProcessedBoxes: 791, LastProcessedAt: lastProcessedAt }]), {
    season: '2026-2027',
    activeProcess: 169,
    activeProcesses: [169],
    activeProcessCount: 1,
    processedBoxes: 791,
    lastProcessedAt: lastProcessedAt.toISOString()
  });
});

test('normaliza campos CHAR y mantiene separados los estados GX', () => {
  const line = normalizeLine({
    LinMaquina: 2,
    LinID: 7,
    LinDesc: 'Linea norte        ',
    LinPC: 'PACK-07             ',
    LinEstado: 0,
    LinEstConf: 1,
    ConfID: 1,
    ConfEstado: 1,
    Especod: 1,
    EspeNom: 'CEREZAS             ',
    Calibre: '28-30     ',
    EnvCod: 5,
    EnvNom: 'CAJA 5 KG           ',
    Catcod: 1,
    CatNom: 'EXPORTACION         ',
    LConfCodPer: 0,
    LConfLogin: 'OPERADOR  ',
    LConfFecLog: null
  });

  assert.equal(line.description, 'Linea norte');
  assert.equal(line.pc, 'PACK-07');
  assert.equal(line.active, false);
  assert.equal(line.lineConfigured, true);
  assert.equal(line.configurationActive, true);
  assert.equal(line.speciesName, 'CEREZAS');
  assert.equal(line.assignedPersonCode, 0);
});

test('arma resumen y filtros rapidos sin mezclar empresas', async () => {
  let boundEmpCod;
  const request = {
    input(name, _type, value) {
      if (name === 'EmpCod') boundEmpCod = value;
      return this;
    },
    async query() {
      return {
        recordset: [
          { LinMaquina: 2, LinID: 1, LinEstado: 1, LinEstConf: 1, ConfID: 1, ConfEstado: 1 },
          { LinMaquina: 1, LinID: 2, LinEstado: 0, LinEstConf: 0, ConfID: null, ConfEstado: 0 },
          { LinMaquina: 2, LinID: 3, LinEstado: 1, LinEstConf: 0, ConfID: 1, ConfEstado: 0 }
        ]
      };
    }
  };
  const result = await listControlLines(7, { poolProvider: async () => ({ request: () => request }) });

  assert.equal(boundEmpCod, 7);
  assert.deepEqual(result.machines, [1, 2]);
  assert.deepEqual(result.summary, { total: 3, active: 2, inactive: 1, configured: 1 });
  assert.deepEqual(result.production, {
    season: null,
    activeProcess: null,
    activeProcesses: [],
    activeProcessCount: 0,
    processedBoxes: 0,
    lastProcessedAt: null
  });
});

test('la ruta usa el programa historico de configuracion de lineas', () => {
  assert.deepEqual(CONTROL_LINES_PERMISSION, { sistema: 100, modulo: 6, programa: 11 });
});

test('los catalogos de edicion se filtran por empresa y conservan dependencias', () => {
  assert.match(CONTROL_LINES_CATALOGS_SQL, /ESPECIES WHERE EmpCod=@EmpCod/);
  assert.match(CONTROL_LINES_CATALOGS_SQL, /CALIBRES WHERE EmpCod=@EmpCod/);
  assert.match(CONTROL_LINES_CATALOGS_SQL, /ENVCAT1 WHERE EmpCod=@EmpCod/);
  assert.deepEqual(normalizeUpdate({ speciesCode: 1, caliber: ' 28-30 ', containerCode: 3, categoryCode: 4, active: true }), {
    speciesCode: 1,
    caliber: '28-30',
    containerCode: 3,
    categoryCode: 4,
    active: true
  });
  assert.throws(() => normalizeUpdate({ speciesCode: '', caliber: '28-30', containerCode: 3, categoryCode: 4, active: true }), /especie/i);
});

test('normaliza el alta de linea sin aceptar empresa ni identificador desde la pantalla', () => {
  assert.deepEqual(normalizeCreate({
    EmpCod: 99,
    line: 88,
    machine: 21,
    description: ' LINEA 21 ',
    location: ' ENVASADO ',
    pc: ' PC-LINEA21 ',
    personCode: '',
    speciesCode: 1,
    caliber: '28-30',
    containerCode: 3,
    categoryCode: 4,
    active: true
  }), {
    machine: 21,
    description: 'LINEA 21',
    location: 'ENVASADO',
    pc: 'PC-LINEA21',
    personCode: null,
    speciesCode: 1,
    caliber: '28-30',
    containerCode: 3,
    categoryCode: 4,
    active: true
  });
  assert.throws(() => normalizeCreate({ machine: 21, description: '', location: 'A', pc: 'PC', active: true }), /descripcion/i);
});

test('crea LINEAS y LINCONFIG con LinID correlativo en una transaccion', async () => {
  const transactions = { began: false, committed: false, rolledBack: false };
  const executed = [];
  const bound = [];
  const transaction = {
    async begin() { transactions.began = true; },
    async commit() { transactions.committed = true; },
    async rollback() { transactions.rolledBack = true; }
  };
  const transactionRequests = [
    { recordset: [{ SpeciesExists: 1, CaliberExists: 1, ContainerExists: 1, CategoryExists: 1 }] },
    { recordset: [{ LinID: 21 }] }
  ];
  const requestFactory = () => ({
    input(name, _type, value) { bound.push([name, value]); return this; },
    async query(statement) { executed.push(statement); return transactionRequests.shift(); }
  });
  const listRequest = {
    input() { return this; },
    async query() {
      return {
        recordset: [{ LinMaquina: 21, LinID: 21, LinDesc: 'LINEA 21', LinEstado: 1, LinEstConf: 1, ConfID: 1, ConfEstado: 1 }]
      };
    }
  };
  const result = await createControlLine(7, 'OPERADOR', {
    machine: 21,
    description: 'LINEA 21',
    location: 'ENVASADO',
    pc: 'PC-LINEA21',
    personCode: null,
    speciesCode: 1,
    caliber: '28-30',
    containerCode: 3,
    categoryCode: 4,
    active: true
  }, {
    poolProvider: async () => ({ request: () => listRequest }),
    transactionFactory: () => transaction,
    requestFactory
  });

  assert.equal(transactions.began, true);
  assert.equal(transactions.committed, true);
  assert.equal(transactions.rolledBack, false);
  assert.match(executed[1], /FROM LINEAS WITH \(UPDLOCK, HOLDLOCK\)/);
  assert.match(executed[1], /INSERT INTO LINEAS/);
  assert.match(executed[1], /INSERT INTO LINCONFIG/);
  assert.ok(bound.some(([name, value]) => name === 'EmpCod' && value === 7));
  assert.equal(result.machine, 21);
  assert.equal(result.line, 21);
});

test('revierte el alta completa si la configuracion no pertenece a la empresa', async () => {
  const transactions = { committed: false, rolledBack: false };
  const transaction = {
    async begin() {},
    async commit() { transactions.committed = true; },
    async rollback() { transactions.rolledBack = true; }
  };
  const requestFactory = () => ({
    input() { return this; },
    async query() {
      return { recordset: [{ SpeciesExists: 1, CaliberExists: 0, ContainerExists: 1, CategoryExists: 1 }] };
    }
  });

  await assert.rejects(() => createControlLine(7, 'OPERADOR', {
    machine: 21,
    description: 'LINEA 21',
    location: 'ENVASADO',
    pc: 'PC-LINEA21',
    speciesCode: 1,
    caliber: 'INVALIDO',
    containerCode: 3,
    categoryCode: 4,
    active: false
  }, {
    poolProvider: async () => ({}),
    transactionFactory: () => transaction,
    requestFactory
  }), /configuracion/i);

  assert.equal(transactions.committed, false);
  assert.equal(transactions.rolledBack, true);
});

test('actualiza estado y configuracion dentro de una transaccion', async () => {
  const transactions = { began: false, committed: false, rolledBack: false };
  const executed = [];
  const bound = [];
  const transaction = {
    async begin() { transactions.began = true; },
    async commit() { transactions.committed = true; },
    async rollback() { transactions.rolledBack = true; }
  };
  const transactionRequests = [
    { recordset: [{ LineExists: 1, SpeciesExists: 1, CaliberExists: 1, ContainerExists: 1, CategoryExists: 1 }] },
    { recordset: [] }
  ];
  const requestFactory = () => ({
    input(name, _type, value) { bound.push([name, value]); return this; },
    async query(statement) { executed.push(statement); return transactionRequests.shift(); }
  });
  const listRequest = {
    input() { return this; },
    async query() { return { recordset: [{ LinMaquina: 2, LinID: 7, LinEstado: 1, LinEstConf: 1, ConfID: 1, ConfEstado: 1, Especod: 1, Calibre: '28-30', EnvCod: 3, Catcod: 4 }] }; }
  };
  const pool = { request: () => listRequest };

  const result = await updateControlLine(9, 'OPERADOR', 2, 7, {
    speciesCode: 1, caliber: '28-30', containerCode: 3, categoryCode: 4, active: true
  }, { poolProvider: async () => pool, transactionFactory: () => transaction, requestFactory });

  assert.equal(transactions.began, true);
  assert.equal(transactions.committed, true);
  assert.equal(transactions.rolledBack, false);
  assert.match(executed[1], /UPDATE LINEAS SET LinEstado=@LinEstado, LinEstConf=1/);
  assert.match(executed[1], /UPDATE LINCONFIG SET Especod=@Especod, Calibre=@Calibre/);
  assert.ok(bound.some(([name, value]) => name === 'EmpCod' && value === 9));
  assert.ok(bound.some(([name, value]) => name === 'Login' && value === 'OPERADOR'));
  assert.equal(result.active, true);
});

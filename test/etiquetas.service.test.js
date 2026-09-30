const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ETIQUETAS_PERMISSION,
  createEtiquetaService,
  normalizeCompany,
  normalizeConfigCode,
  revisionBuffer
} = require('../src/modules/etiquetas/etiquetas.service');
const { requireConfigEtiquetaPermission } = require('../src/modules/etiquetas/etiquetas.routes');

test('el diseñador reutiliza exactamente el permiso de CONFIGETI', () => {
  assert.deepEqual(ETIQUETAS_PERMISSION, { sistema: 110, modulo: 1, programa: 1 });
});

test('ADMINFULL conserva el mismo acceso excepcional del CRUD CONFIGETI', () => {
  let continued = false;
  requireConfigEtiquetaPermission(
    { auth: { user: { roles: ['adminfull'] }, permissions: {} } },
    {},
    () => { continued = true; }
  );
  assert.equal(continued, true);
});

test('la empresa se obtiene como codigo numerico valido de sesion', () => {
  assert.equal(normalizeCompany('1'), 1);
  assert.throws(() => normalizeCompany(undefined), /empresa de la sesion/i);
  assert.throws(() => normalizeCompany(0), /empresa de la sesion/i);
});

test('normaliza ConfCod sin permitir inyeccion ni superar char(10)', () => {
  assert.equal(normalizeConfigCode(' lavina16 '), 'LAVINA16');
  assert.throws(() => normalizeConfigCode("A' OR 1=1"), /CONFIGETI/);
  assert.throws(() => normalizeConfigCode('12345678901'), /CONFIGETI/);
});

test('la revision rowversion debe ser exactamente de ocho bytes', () => {
  const encoded = Buffer.from('12345678').toString('base64');
  assert.deepEqual(revisionBuffer(encoded), Buffer.from('12345678'));
  assert.throws(() => revisionBuffer('AA=='), /revision/i);
});

test('lista configuraciones historicas y distingue si ya tienen diseño', async () => {
  const revision = Buffer.from('12345678');
  const request = {
    input() { return this; },
    async query() {
      return { recordset: [
        { ConfCod: 'LAVINA16', ConfigurationLines: 12, LabelType: 'VINASA', ExampleText: 'CHERRY', EtiRowVersion: null },
        { ConfCod: 'POLCURA16', ConfigurationLines: 12, LabelType: 'VINASA', ExampleText: 'CHERRY', EtiNombre: 'Polcura', EtiDpi: 203, EtiRowVersion: revision }
      ] };
    }
  };
  const service = createEtiquetaService({ poolProvider: async () => ({ request: () => request }), fetchImpl: null });
  const result = await service.list(1);

  assert.deepEqual(result.rows.map((row) => [row.code, row.configurationLines, row.hasDesign]), [
    ['LAVINA16', 12, false],
    ['POLCURA16', 12, true]
  ]);
  assert.equal(result.rows[1].revision, revision.toString('base64'));
});

test('elimina solo la plantilla visual usando rowversion', async () => {
  const bound = [];
  const request = {
    input(name, _type, value) { bound.push([name, value]); return this; },
    async query(statement) {
      assert.match(statement, /DELETE dbo\.ETIQUETAPLANTILLA/);
      assert.doesNotMatch(statement, /DELETE dbo\.CONFIGETI/);
      return { recordset: [{ Existing: true, Deleted: 1 }] };
    }
  };
  const service = createEtiquetaService({ poolProvider: async () => ({ request: () => request }), fetchImpl: null });
  const revision = Buffer.from('12345678').toString('base64');
  const result = await service.remove(1, 'LAVINA16', { revision });

  assert.deepEqual(result, { deleted: true, code: 'LAVINA16' });
  assert.ok(bound.some(([name, value]) => name === 'EmpCod' && value === 1));
  assert.ok(bound.some(([name, value]) => name === 'Revision' && Buffer.from(value).equals(Buffer.from('12345678'))));
});

test('rescata VINASA orientado para edicion como un unico documento ZPL', async () => {
  const rows = [
    { ConfLinea: 1, ConfLin1: 'ST', ConfText1a: 'CHERRY', ConfLin1b: 'ST', ConfText1b: 'CSE:153275' },
    { ConfLinea: 2, ConfLin1: 'TNE', ConfDato1a: 3, ConfLin1b: 'NE', ConfDato1b: 7 },
    { ConfLinea: 3, ConfLin1: 'ST', ConfText1a: 'GROWER', ConfLin1b: 'ST', ConfText1b: 'PACKED' },
    { ConfLinea: 4, ConfLin1: 'N', ConfDato1a: 4, ConfLin1b: 'ST', ConfText1b: 'CSP:112117' },
    { ConfLinea: 5, ConfLin1: 'TN', ConfText1a: 'TOWNSHIP:', ConfDato1a: 5, ConfLin1b: 'ST', ConfText1b: 'TOWNSHIP:CODEGUA' },
    { ConfLinea: 6, ConfLin1: 'TN', ConfText1a: 'PROVINCE:', ConfDato1a: 6, ConfLin1b: 'ST', ConfText1b: 'PROVINCE:CACHAPOAL' },
    { ConfLinea: 7, ConfLin1: 'N', ConfDato1a: 11 },
    { ConfLinea: 8, ConfLin1b: 'ST', ConfText1b: 'DATE:' },
    { ConfLinea: 9, ConfLin1: 'ST', ConfText1a: 'PRODUCT OF CHILE' },
    { ConfLinea: 10, ConfLin1: 'ST', ConfText1a: 'FDA:12563897578' },
    { ConfLinea: 11, ConfLin1: 'ST', ConfText1a: 'GGN:4049928853332' }
  ];
  const request = {
    input() { return this; },
    async query(statement) {
      if (/FROM dbo\.CONFIGETI/i.test(statement)) return { recordset: rows.map((row) => ({ ...row, ConfTipEti: 'VINASA' })) };
      if (/FROM dbo\.ETIQUETAPLANTILLA/i.test(statement)) return { recordset: [] };
      throw new Error(`Consulta no esperada: ${statement}`);
    }
  };
  const service = createEtiquetaService({ poolProvider: async () => ({ request: () => request }), fetchImpl: null });
  const rescued = await service.rescue(1, 'LAVINA16');
  const { zpl, design } = rescued;

  assert.equal((zpl.match(/\^XA/g) || []).length, 1);
  assert.equal((zpl.match(/\^XZ/g) || []).length, 1);
  assert.equal(design.widthDots, 799);
  assert.equal(design.heightDots, 400);
  assert.equal(design.displayRotation, 180);
  assert.ok(design.elements.length >= 20);
  assert.ok(design.variables.some((variable) => variable.name === 'productor'));
  assert.ok(design.variables.some((variable) => variable.name === 'codigo'));
  assert.match(zpl, /\^FDCSE:153275\^FS/);
  assert.match(zpl, /\{\{calibre_sin_ceros\}\}/);
  assert.match(zpl, /\^BY2,3,64/);
  assert.equal(design.elements.find((element) => element.type === 'barcode').moduleWidth, 2);
});

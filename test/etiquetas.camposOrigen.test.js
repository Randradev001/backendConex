const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describeFieldOrigins, VARIABLE_ORIGINS } = require('../src/modules/etiquetas/camposOrigen.service');
const { parseZpl } = require('../src/modules/etiquetas/zpl/zplCore');
const { variableValues } = require('../src/impresion-worker/impresion.service');

test('POLCURA16 distingue CSE fijo, ubicación dinámica de productor y ubicación fija de packing', () => {
  const design = parseZpl(fs.readFileSync(path.join(__dirname, '../docs/gx8/recovered/POLCURA16.worker.zpl'), 'utf8'));
  const original = JSON.stringify(design);
  const { rows } = describeFieldOrigins(design);
  const cse = rows.find((row) => row.content === 'CSE:93154');
  assert.equal(cse.kind, 'fixed');
  assert.deepEqual(cse.tags, []);
  assert.equal(cse.source, 'ETIQUETAVERSION.EtiDesignJson');
  const township = rows.find((row) => row.content === 'TOWNSHIP:-{{comuna}}');
  assert.equal(township.kind, 'mixed');
  assert.equal(township.tags[0].source, 'PRODUCTORES.ProdComuna');
  assert.equal(rows.find((row) => row.content === 'PROVINCE:-{{provincia}}').tags[0].source, 'PRODUCTORES.ProdProvincia');
  assert.equal(rows.find((row) => row.content === 'TOWNSHIP: CODEGUA').kind, 'fixed');
  assert.equal(rows.find((row) => row.content === 'PROVINCE: CACHAPOAL').kind, 'fixed');
  assert.equal(rows.length, design.elements.length);
  assert.equal(JSON.stringify(design), original);
});

test('todos los tags resueltos por el worker tienen un origen documentado', () => {
  assert.deepEqual(Object.keys(VARIABLE_ORIGINS).sort(), Object.keys(variableValues({}, '123')).sort());
});

test('lee tags nuevos del contenido sin depender de la lista de muestras ni atribuirles una tabla', () => {
  const design = parseZpl('^XA^FO10,10^A0N,20,20^FD{{comuna}} / {{personalizado}} / {{comuna}}^FS^XZ');
  design.variables = [];
  design.elements[0].visible = false;
  const row = describeFieldOrigins(design, { versioned: false }).rows[0];
  assert.equal(row.visible, false);
  assert.equal(row.source, 'ETIQUETAPLANTILLA.EtiDesignJson');
  assert.equal(row.tags.length, 2);
  assert.equal(row.tags[0].known, true);
  assert.equal(row.tags[1].known, false);
  assert.equal(row.tags[1].source, 'Sin origen productivo registrado');
});

test('la consulta valida la versión en la empresa de sesión y analiza cambios sin guardar', async (t) => {
  const versions = require('../src/modules/etiquetas/etiquetasVersiones.service');
  const { fieldOrigins } = require('../src/modules/etiquetas/etiquetas.controller');
  const get = t.mock.method(versions, 'getVersion', async () => ({ template: { design: null } }));
  const design = parseZpl('^XA^FO10,10^A0N,20,20^FDCSE:NUEVO^FS^XZ');
  let result;
  await fieldOrigins(
    { context: { empCod: 7 }, params: { etiCod: 'POLCURA16', version: '4' }, body: { design, EmpCod: 99 } },
    { json(value) { result = value; } },
    (error) => { throw error; }
  );
  assert.deepEqual(get.mock.calls[0].arguments, [7, 'POLCURA16', '4']);
  assert.equal(result.rows[0].content, 'CSE:NUEVO');
  assert.equal(result.rows[0].kind, 'fixed');
});

test('no expone el análisis si la versión no existe en la empresa de sesión', async (t) => {
  const versions = require('../src/modules/etiquetas/etiquetasVersiones.service');
  const { fieldOrigins } = require('../src/modules/etiquetas/etiquetas.controller');
  t.mock.method(versions, 'getVersion', async () => {
    throw Object.assign(new Error('La versión de etiqueta no existe.'), { status: 404, code: 'LABEL_VERSION_NOT_FOUND' });
  });
  let status;
  let result;
  await fieldOrigins(
    { context: { empCod: 7 }, params: { etiCod: 'OTRA', version: '1' }, body: {} },
    { status(value) { status = value; return this; }, json(value) { result = value; } },
    (error) => { throw error; }
  );
  assert.equal(status, 404);
  assert.equal(result.code, 'LABEL_VERSION_NOT_FOUND');
});

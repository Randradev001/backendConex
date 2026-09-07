const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeVersion, normalizeTypeCode, blankDesign } = require('../src/modules/etiquetas/etiquetasVersiones.service');
const { validateDocument, generateZpl } = require('../src/modules/etiquetas/zpl/zplCore');

test('la versión de etiqueta debe ser un entero positivo', () => {
  assert.equal(normalizeVersion('3'), 3);
  assert.throws(() => normalizeVersion(0), /entero positivo/);
  assert.throws(() => normalizeVersion('1.5'), /entero positivo/);
});

test('el tipo de etiqueta debe referenciar un código TIPETI operativo', () => {
  assert.equal(normalizeTypeCode('10'), 10);
  assert.throws(() => normalizeTypeCode(0), /seleccionar un tipo/);
  assert.throws(() => normalizeTypeCode('VINASA'), /seleccionar un tipo/);
});

test('una etiqueta nueva comienza con un diseño completo sin CONFIGETI', () => {
  const design = validateDocument(blankDesign('Versión 1'));
  const zpl = generateZpl(design);

  assert.equal(design.widthDots, 799);
  assert.equal(design.heightDots, 400);
  assert.deepEqual(design.elements, []);
  assert.match(zpl, /^\^XA/);
  assert.match(zpl, /\^PW799/);
  assert.match(zpl, /\^XZ$/);
});

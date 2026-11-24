const test = require('node:test');
const assert = require('node:assert/strict');
const { createEtiquetaVersionService, normalizeVersion, normalizeTypeCode, blankDesign } = require('../src/modules/etiquetas/etiquetasVersiones.service');
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

test('restaura una versión con el diseño predeterminado recuperado del XPZ sin persistirlo', async () => {
  const rows = [
    { ConfLinea: 1, ConfLin1: 'ST', ConfText1a: 'CHERRY', ConfLin1b: 'ST', ConfText1b: 'CSE:88510', ConfTipEti: 'VINASA' },
    { ConfLinea: 5, ConfLin1: 'TN', ConfText1a: 'TOWNSHIP:', ConfDato1a: 5, ConfLin1b: 'ST', ConfText1b: 'TOWNSHIP:CODEGUA', ConfTipEti: 'VINASA' },
    { ConfLinea: 6, ConfLin1: 'TN', ConfText1a: 'PROVINCE:', ConfDato1a: 6, ConfLin1b: 'ST', ConfText1b: 'PROVINCE:CACHAPOAL', ConfTipEti: 'VINASA' }
  ];
  const request = {
    input() { return this; },
    async query(statement) {
      if (/FROM dbo\.ETIQUETA e[\s\S]*INNER JOIN dbo\.ETIQUETAVERSION/i.test(statement)) return { recordset: [{
        EtiCod: 'POLCURA16', EtiNombre: 'Polcura', EtiTipo: 'VINASA', EtiConfCodOrigen: 'POLCURA16',
        EtiVersion: 4, EtiVersionNombre: 'Producción', EtiVersionDescripcion: 'Vigente', EtiAnchoMm: 100,
        EtiAltoMm: 50, EtiDpi: 203, EtiVigente: true, EtiDesignJson: JSON.stringify(blankDesign('Actual')),
        EtiZpl: '^XA^XZ', EtiRowVersion: Buffer.from('12345678')
      }] };
      if (/FROM dbo\.CONFIGETI/i.test(statement)) return { recordset: rows };
      throw new Error(`Consulta no esperada: ${statement}`);
    }
  };
  const service = createEtiquetaVersionService({ poolProvider: async () => ({ request: () => request }), fetchImpl: null });
  const result = await service.restoreDefault(1, 'POLCURA16', 4);

  assert.equal(result.source.procedure, 'Eti_CV_VINA2016');
  assert.equal(result.source.persisted, false);
  assert.equal(result.design.displayRotation, 180);
  assert.equal(result.design.name, 'Producción');
  assert.match(result.zpl, /TOWNSHIP:-\{\{comuna\}\}/);
  assert.match(result.zpl, /PROVINCE:-\{\{provincia\}\}/);
});

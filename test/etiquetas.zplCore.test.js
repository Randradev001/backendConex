const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ZplValidationError,
  parseZpl,
  generateZpl,
  escapeFieldData,
  validateDocument
} = require('../src/modules/etiquetas/zpl/zplCore');

const historicalZpl = [
  '^XA',
  '^MMT',
  '^PW799',
  '^LL376',
  '^LS0',
  '^FT30,48^A0N,28,31^FH\\^FDProductor:^FS',
  '^FT190,48^A0N,28,31^FH\\^FD{{productor}}^FS',
  '^FO20,70^GB750,2,2^FS',
  '^BY2,3,60^FT30,160^BCN,60,Y,N^FH\\^FD123456789^FS',
  '^FO600,90^BQN,2,4^FH\\^FDLA,LOTE-10^FS',
  '^PQ1,0,1,Y',
  '^XZ'
].join('\n');

test('importar y generar sin cambios conserva exactamente el ZPL historico', () => {
  const design = parseZpl(historicalZpl, { dpi: 203, name: 'Normal 14' });

  assert.equal(design.widthDots, 799);
  assert.equal(design.heightDots, 376);
  assert.deepEqual(design.elements.map((element) => element.type), ['text', 'text', 'rectangle', 'barcode', 'qr']);
  assert.equal(design.variables[0].name, 'productor');
  assert.equal(generateZpl(design), historicalZpl);
  assert.ok(design.importState.passthroughCommands.some((command) => command.code === '^MM'));
  assert.ok(design.importState.passthroughCommands.some((command) => command.code === '^PQ'));
});

test('editar un campo reemplaza solo su tramo y conserva comandos desconocidos', () => {
  const design = parseZpl(historicalZpl);
  const target = design.elements[1];
  target.content = 'PREDIO ^ NORTE';
  target.dirty = true;

  const generated = generateZpl(design);

  assert.match(generated, /\^MMT/);
  assert.match(generated, /\^PQ1,0,1,Y/);
  assert.match(generated, /\^FDPREDIO \\5E NORTE\^FS/);
  assert.doesNotMatch(generated, /\{\{productor\}\}/);
});

test('renderizar variables escapa los delimitadores de comandos ZPL', () => {
  const design = parseZpl(historicalZpl);
  const generated = generateZpl(design, { variableValues: { productor: 'A^B~C\\D' } });

  assert.match(generated, /A\\5EB\\7EC\\5CD/);
  assert.equal(escapeFieldData('A^B~C\\D'), 'A\\5EB\\7EC\\5CD');
});

test('usa muestras representativas incluso en disenos historicos con muestras genericas', () => {
  const design = parseZpl('^XA\n^PW799\n^LL400\n^FT178,181^A0I,79,79^FD{{calibre}}^FS\n^XZ');

  assert.equal(design.variables[0].sampleValue, '00LL');
  design.variables[0].sampleValue = 'CALIBRE';
  assert.match(generateZpl(design, { useSamples: true }), /\^FD00LL\^FS/);
});

test('muestra el calibre VINASA sin ceros en el preview', () => {
  const design = parseZpl('^XA\n^PW799\n^LL400\n^FT178,181^A0I,79,79^FD{{calibre_sin_ceros}}^FS\n^XZ');

  assert.equal(design.variables[0].sampleValue, 'XLD');
  assert.match(generateZpl(design, { useSamples: true }), /\^FDXLD\^FS/);
});

test('un codigo de barras sin alto explicito hereda el alto configurado en BY', () => {
  const design = parseZpl('^XA\n^PW799\n^LL400\n^BY4,3,64^FT739,60^BCI,,Y,N^FD>;{{codigo}}^FS\n^XZ');
  const barcode = design.elements.find((element) => element.type === 'barcode');
  const generated = generateZpl(design, { variableValues: { codigo: '00000100203400701016000' } });

  assert.equal(barcode.heightDots, 64);
  assert.equal((generated.match(/\^BY/g) || []).length, 1);
  assert.match(generated, /\^BY4,3,64\^FT739,60\^BCI,64,Y,N/);
});

test('rechaza documentos con ids duplicados o medidas invalidas', () => {
  assert.throws(() => validateDocument({
    dpi: 203,
    widthMm: 0,
    heightMm: 50,
    elements: [
      { id: 'x', type: 'text', xDots: 0, yDots: 0 },
      { id: 'x', type: 'unknown', xDots: 'no', yDots: 0 }
    ],
    variables: []
  }), (error) => {
    assert.ok(error instanceof ZplValidationError);
    assert.ok(error.details.some((detail) => detail.includes('ancho')));
    assert.ok(error.details.some((detail) => detail.includes('duplicado')));
    return true;
  });
});

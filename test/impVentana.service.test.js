const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFolios, labelData, buildLabelZpl } = require('../src/modules/ingresoTarjas/impVentana.service');

test('normaliza y elimina folios repetidos para impresión', () => {
  assert.deepEqual(normalizeFolios(['73', '0000000073', '74']), ['0000000073', '0000000074']);
});

test('construye la etiqueta con el último peso del detalle y calibres sin ceros', () => {
  const parameters = new Map([[1, [104, 211]], [2, [132, 76]]]);
  parameters.copies = 2;
  const label = labelData(
    { folio: '0000000073', speciesName: 'CEREZA' },
    [
      { varietyName: 'BING', caliber: '0XLD', boxes: 4, envPesoSag: 1.1, lot: 1 },
      { varietyName: 'BING', caliber: '0XLD', boxes: 5, envPesoSag: 1.3, lot: 2 },
      { varietyName: 'LAPINS', caliber: '0XJL', boxes: 2, envPesoSag: 1.6, lot: 3 }
    ],
    parameters
  );
  assert.equal(label.weight, 1.6);
  assert.deepEqual(label.calibers, ['XLD', 'XJL']);
  assert.equal(label.boxes, 11);
  assert.equal(label.copies, 2);
  assert.match(buildLabelZpl({ ...label, zpl: undefined }), /\^PW799/);
  assert.match(buildLabelZpl({ ...label, zpl: undefined }), /\^LL1558/);
  assert.match(buildLabelZpl({ ...label, zpl: undefined }), /0000000073/);
  assert.match(buildLabelZpl({ ...label, zpl: undefined }), /\^PQ2,0,1,Y/);
});

test('quita solo ceros iniciales del calibre y reduce su fuente cuando el texto es largo', () => {
  const parameters = new Map([[1, [104, 211]]]);
  const label = labelData(
    { folio: '0000000073', speciesName: 'CEREZA' },
    [{ varietyName: 'BING', caliber: '0X0LARGO', boxes: 4, envPesoSag: 1.1, lot: 1 }],
    parameters
  );
  const zpl = buildLabelZpl({ ...label, zpl: undefined });

  assert.deepEqual(label.calibers, ['X0LARGO']);
  assert.match(zpl, /\^FT457,1519\^A0B,45,90\^FH\\\^FDX0LARGO\^FS/);
});

test('elimina todos los ceros consecutivos al inicio de cada calibre', () => {
  const label = labelData(
    { folio: '0000000073', speciesName: 'CEREZA' },
    [
      { varietyName: 'BING', caliber: '00XL', boxes: 4, envPesoSag: 1.1, lot: 1 },
      { varietyName: 'BING', caliber: '000L', boxes: 4, envPesoSag: 1.1, lot: 2 }
    ],
    new Map([[2, [132, 76]]])
  );

  assert.deepEqual(label.calibers, ['XL', 'L']);
});

test('apila hasta tres calibres y divide en dos columnas desde cuatro', () => {
  const parameters = new Map([[2, [132, 76]]]);
  const label = labelData(
    { folio: '0000000073', speciesName: 'CEREZA' },
    [
      { varietyName: 'BING', caliber: 'OOPD', boxes: 4, envPesoSag: 1.1, lot: 1 },
      { varietyName: 'BING', caliber: '0XXJL', boxes: 4, envPesoSag: 1.1, lot: 2 }
    ],
    parameters
  );
  const zpl = buildLabelZpl({ ...label, zpl: undefined });

  assert.deepEqual(label.calibers, ['OOPD', 'XXJL']);
  assert.match(zpl, /\^FT493,1519\^A0B,49,57\^FH\\\^FDOOPD\^FS/);
  assert.match(zpl, /\^FT425,1519\^A0B,49,57\^FH\\\^FDXXJL\^FS/);

  const sixCalibers = buildLabelZpl({
    ...label,
    calibers: ['XLL', 'KD', 'KL', 'JJ', 'XX', 'LL'],
    dimensions: { largo: 39, ancho: 69 },
    zpl: undefined
  });
  assert.match(sixCalibers, /\^FT493,1520\^A0B,54,56\^FH\\\^FDXLL\^FS/);
  assert.match(sixCalibers, /\^FT493,1340\^A0B,54,56\^FH\\\^FDJJ\^FS/);
  assert.doesNotMatch(sixCalibers, /\^FO280,1355\^GB242,0,6\^FS/);
});

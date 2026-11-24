const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DashboardProduccionError,
  buildDashboard,
  getDashboard,
  weightedQuality
} = require('../src/services/dashboardProduccion.service');

test('pondera la calidad por los kilos de cada lote', () => {
  assert.deepEqual(
    weightedQuality([
      { quality: 80, kilos: 200 },
      { quality: 100, kilos: 800 },
      { quality: null, kilos: 500 }
    ]),
    { average: 96, kilos: 1000, lots: 2 }
  );
});

test('calcula producción estimada y pallets redondeados al menor', () => {
  const result = buildDashboard({
    context: { season: '2017-2018 ', today: '2026-11-24' },
    order: { Ordpnum: 520, OrdpFecha: '2026-11-24', OrdpEstado: 1, OrdpTotKilos: 1000, VarNom: 'BING' },
    production: { boxes: 767, kilos: 800 },
    qualityRows: [{ quality: 90, kilos: 1000 }],
    varieties: [{ code: 1, name: 'BING ' }],
    calibers: [{ code: 'XL ', boxes: 400 }],
    parameter: { PAR1Valor1: 384 }
  });

  assert.equal(result.production.approximatePallets, 1);
  assert.equal(result.estimate.exportPercentage, 80);
  assert.equal(result.estimate.commercialPercentage, 20);
  assert.equal(result.quality.weightedAverage, 90);
});

test('mantiene visible la sobreproducción sin limitar porcentajes', () => {
  const result = buildDashboard({
    context: {},
    order: { Ordpnum: 1, OrdpTotKilos: 100 },
    production: { boxes: 10, kilos: 120 },
    qualityRows: [],
    parameter: { PAR1Valor1: 20 }
  });
  assert.equal(result.estimate.exportPercentage, 120);
  assert.equal(result.estimate.commercialPercentage, -20);
  assert.equal(result.estimate.overProduction, true);
});

test('rechaza el parámetro de pallets ausente o no positivo', () => {
  assert.throws(
    () => buildDashboard({ context: {}, production: {}, qualityRows: [], parameter: null }),
    (error) => error instanceof DashboardProduccionError && error.code === 'PALLET_PARAMETER_INVALID'
  );
});

test('consulta exclusivamente con la empresa recibida desde sesión', async () => {
  const inputs = {};
  let statement = '';
  const poolProvider = async () => ({
    request: () => ({
      input(name, _type, value) {
        inputs[name] = value;
        return this;
      },
      async query(sqlText) {
        statement = sqlText;
        return {
          recordsets: [
            [{ season: '2017-2018', today: '2026-11-24' }],
            [{ Ordpnum: 6, OrdpTotKilos: 1000 }],
            [{ boxes: 384, kilos: 800 }],
            [{ quality: 95, kilos: 1000 }],
            [],
            [],
            [{ PAR1Valor1: 384 }]
          ]
        };
      }
    })
  });

  const result = await getDashboard(7, { poolProvider });
  assert.equal(inputs.EmpCod, 7);
  assert.equal(result.production.approximatePallets, 1);
  assert.match(statement, /WHERE EmpCod=@EmpCod AND PARCod=70 AND PAR1Cod=1/);
  assert.match(statement, /CalRecEstado='F'/);
  assert.match(statement, /OrdpEstado IN \(0,1,4\)/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, CalidadError } = require('../src/services/recepcionesCalidad.service');
const { defaultRange } = require('../src/services/recepcionesCalidadDashboard.service');

const payload = {
  tempCod:'2026-2027',origin:1,docType:1,guide:10,producer:'88510',lot:394,
  inspectionDate:'2026-08-11',inspectionTime:'16:00',sampleSize:100,
  damages:[{code:1,fruits:2}],calibers:[{code:'00LL',percentage:100,preCaliber:100}],
  colors:[{caliber:'00LL',lightRed:100,darkRed:100}],pests:[{code:1,selected:true},{code:2,selected:false}]
};

test('normaliza un control de calidad y conserva solo hallazgos seleccionados',()=>{
  const value=normalize(payload);
  assert.equal(value.lot,394); assert.equal(value.pests.length,1); assert.equal(value.pests[0].code,1);
  assert.ok(value.inspectionTime instanceof Date);
  assert.equal(value.inspectionTime.getHours(),16);
  assert.equal(value.qualityPercentage,98);
});

test('rechaza horas fuera del rango SQL time',()=>{
  assert.throws(()=>normalize({...payload,inspectionTime:'25:80'}),CalidadError);
});

test('rechaza controles sin muestra valida',()=>{
  assert.throws(()=>normalize({...payload,sampleSize:0}),CalidadError);
});

test('relaciona las cantidades de color con el calibre',()=>{
  const value=normalize({...payload,colors:[{caliber:'0XXL',lightRed:100,darkRed:100}]});
  assert.deepEqual(value.colors,[{caliber:'0XXL',lightRed:100,darkRed:100}]);
});

test('rechaza danos cuyo total supera el tamano de muestra',()=>{
  assert.throws(()=>normalize({...payload,damages:[{code:1,fruits:60},{code:2,fruits:41}]}),/danos no pueden superar/);
});

test('rechaza distribuciones de calibre o color distintas de 100',()=>{
  assert.throws(()=>normalize({...payload,calibers:[{code:'00LL',percentage:70,preCaliber:50},{code:'0XXL',percentage:29,preCaliber:50}]}),/sumar exactamente 100/);
  assert.throws(()=>normalize({...payload,colors:[{caliber:'00LL',lightRed:80,darkRed:50},{caliber:'0XXL',lightRed:19,darkRed:50}]}),/sumar exactamente 100/);
});

test('rechaza firmeza sobre la muestra y clasificacion sobre 100',()=>{
  assert.throws(()=>normalize({...payload,durofelFruits:101}),/firmeza no pueden superar/);
  assert.throws(()=>normalize({...payload,exportPercentage:101}),/no pueden superar 100/);
  assert.throws(()=>normalize({...payload,commercialPercentage:100.01}),/no pueden superar 100/);
});

test('el dashboard propone un rango mensual valido',()=>{
  const range=defaultRange();
  assert.match(range.from,/^\d{4}-\d{2}-\d{2}$/);
  assert.match(range.to,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(range.from<=range.to);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, CalidadError } = require('../src/services/recepcionesCalidad.service');
const {
  defaultRange,
  buildQualityClassification,
  buildCaliberDistribution,
  buildColorDistribution
} = require('../src/services/recepcionesCalidadDashboard.service');

const payload = {
  tempCod:'2026-2027',origin:1,docType:1,guide:10,producer:'88510',lot:394,
  inspectionDate:'2026-08-11',inspectionTime:'16:00',sampleSize:100,
  damages:[{code:1,fruits:2}],calibers:[{code:'00LL',percentage:80,preCaliber:20}],
  colors:[{caliber:'00LL',lightRed:75,darkRed:25}],pests:[{code:1,selected:true},{code:2,selected:false}]
};

test('normaliza un control de calidad y conserva solo hallazgos seleccionados',()=>{
  const value=normalize(payload);
  assert.equal(value.lot,394); assert.equal(value.pests.length,1); assert.equal(value.pests[0].code,1);
  assert.ok(value.inspectionTime instanceof Date);
  assert.equal(value.inspectionTime.getHours(),16);
  assert.equal(value.qualityPercentage,98);
  assert.equal(value.exportPercentage,98);
  assert.equal(value.commercialPercentage,2);
});

test('rechaza horas fuera del rango SQL time',()=>{
  assert.throws(()=>normalize({...payload,inspectionTime:'25:80'}),CalidadError);
});

test('rechaza controles sin muestra valida',()=>{
  assert.throws(()=>normalize({...payload,sampleSize:0}),CalidadError);
});

test('relaciona las cantidades de color con el calibre',()=>{
  const value=normalize({...payload,colors:[{caliber:'0XXL',lightRed:75,darkRed:25}]});
  assert.deepEqual(value.colors,[{caliber:'0XXL',lightRed:75,darkRed:25}]);
});

test('rechaza danos cuyo total supera el tamano de muestra',()=>{
  assert.throws(()=>normalize({...payload,damages:[{code:1,fruits:60},{code:2,fruits:41}]}),/danos no pueden superar/);
});

test('rechaza cantidades de calibre o color que no completan la muestra',()=>{
  assert.throws(()=>normalize({...payload,calibers:[{code:'00LL',percentage:70,preCaliber:10},{code:'0XXL',percentage:10,preCaliber:5}]}),/tamano de muestra/);
  assert.throws(()=>normalize({...payload,colors:[{caliber:'00LL',lightRed:50,darkRed:20},{caliber:'0XXL',lightRed:10,darkRed:10}]}),/tamano de muestra/);
});

test('rechaza firmeza sobre la muestra y recalcula la clasificacion desde los danos',()=>{
  assert.throws(()=>normalize({...payload,durofelFruits:101}),/firmeza no pueden superar/);
  const value=normalize({...payload,exportPercentage:1,commercialPercentage:99});
  assert.equal(value.exportPercentage,98);
  assert.equal(value.commercialPercentage,2);
});

test('el dashboard propone un rango mensual valido',()=>{
  const range=defaultRange();
  assert.match(range.from,/^\d{4}-\d{2}-\d{2}$/);
  assert.match(range.to,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(range.from<=range.to);
});

test('el dashboard segrega la muestra entre fruta sin dano y con dano',()=>{
  assert.deepEqual(buildQualityClassification(100,21),[
    {label:'Fruta sin daño',value:79,fruits:79},
    {label:'Fruta con daño',value:21,fruits:21}
  ]);
});

test('el dashboard distribuye calibre y pre calibre por numero de frutos',()=>{
  assert.deepEqual(buildCaliberDistribution([
    {label:'XXL',percentage:30,preCaliber:5},
    {label:'XXL',percentage:20,preCaliber:2},
    {label:'XL',percentage:40,preCaliber:3}
  ]),[
    {label:'XXL',caliber:50,preCaliber:7,total:57},
    {label:'XL',caliber:40,preCaliber:3,total:43}
  ]);
});

test('el dashboard agrupa la distribucion de color por calibre',()=>{
  assert.deepEqual(buildColorDistribution([
    {label:'XXL',lightRed:20,darkRed:10},
    {label:'XXL',lightRed:5,darkRed:15},
    {label:'XL',lightRed:30,darkRed:20}
  ]),[
    {label:'XXL',lightRed:25,darkRed:25,total:50},
    {label:'XL',lightRed:30,darkRed:20,total:50}
  ]);
});

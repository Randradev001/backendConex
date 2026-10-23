const router = require("express").Router();

const maestrosRouter = require("./maestros.routes")
const seguridadRouter = require('./seguridad.routes')
const recepcionFrutaRouter = require('./recepcionFruta.routes')
const recepcionesIngresoRouter = require('./recepcionesIngreso.routes')
const recepcionesCalidadRouter = require('./recepcionesCalidad.routes')
const ordenesProcesoRouter = require('./ordenesProceso.routes')
const capturaCajasRouter = require('../modules/capturaCajas/capturaCajas.routes');
const controlLineasRouter = require('./controlLineas.routes')
const etiquetasRouter = require('../modules/etiquetas/etiquetas.routes')
const impresionRouter = require('../impresion-worker/impresion.routes')
const ingresoTarjasRouter = require('../modules/ingresoTarjas/ingresoTarjas.routes')
const inspeccionesRouter = require('../modules/inspecciones/inspecciones.routes')
const despachosSAGRouter = require('../modules/despachosSAG/despachosSAG.routes')
const despachosUSRouter = require('../modules/despachosUS/despachosUS.routes')
const procesosUSDARouter = require('../modules/procesosUSDA/procesosUSDA.routes')
const anulacionesRouter = require('../modules/anulaciones/anulaciones.routes')
const repaletizajeRouter = require('../modules/repaletizaje/repaletizaje.routes')
const frutaComercialRouter = require('../modules/frutaComercial/frutaComercial.routes')
const printAgentRouter = require('../print-agent/printAgent.routes')

router.use('/maestros',maestrosRouter)
router.use('/seguridad', seguridadRouter)
router.use('/recepcion-fruta', recepcionFrutaRouter)
router.use('/recepciones-ingreso', recepcionesIngresoRouter)
router.use('/recepciones-calidad', recepcionesCalidadRouter)
router.use('/ordenes-proceso-operacion', ordenesProcesoRouter)
router.use('/captura-cajas', capturaCajasRouter);
router.use('/control-lineas', controlLineasRouter)
router.use('/etiquetas', etiquetasRouter)
router.use('/impresion', impresionRouter)
router.use('/ingreso-tarjas', ingresoTarjasRouter)
router.use('/inspecciones', inspeccionesRouter)
router.use('/despachos-sag', despachosSAGRouter)
router.use('/despachos-us', despachosUSRouter)
router.use('/procesos-usda', procesosUSDARouter)
router.use('/anulaciones', anulacionesRouter)
router.use('/repaletizajes', repaletizajeRouter)
router.use('/fruta-comercial', frutaComercialRouter)
router.use('/packing-list', require('../modules/packingList/packingList.routes'))
router.use('/lista-precios', require('../modules/listaPrecios/listaPrecios.routes'))
router.use('/guias-electronicas', require('./guiasElectronicas.routes'))
router.use('/print-agent/v1', printAgentRouter)

// test para confirmar que este router está montado
router.get('/test', (req, res) => res.send('Router raíz OK'));



module.exports = router

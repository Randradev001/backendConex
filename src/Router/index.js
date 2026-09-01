const router = require("express").Router();

const maestrosRouter = require("./maestros.routes")
const seguridadRouter = require('./seguridad.routes')
const recepcionFrutaRouter = require('./recepcionFruta.routes')
const recepcionesIngresoRouter = require('./recepcionesIngreso.routes')
const recepcionesCalidadRouter = require('./recepcionesCalidad.routes')
const ordenesProcesoRouter = require('./ordenesProceso.routes')
const controlLineasRouter = require('./controlLineas.routes')

router.use('/maestros',maestrosRouter)
router.use('/seguridad', seguridadRouter)
router.use('/recepcion-fruta', recepcionFrutaRouter)
router.use('/recepciones-ingreso', recepcionesIngresoRouter)
router.use('/recepciones-calidad', recepcionesCalidadRouter)
router.use('/ordenes-proceso-operacion', ordenesProcesoRouter)
router.use('/control-lineas', controlLineasRouter)

// test para confirmar que este router está montado
router.get('/test', (req, res) => res.send('Router raíz OK'));



module.exports = router

const router = require("express").Router();

 // const correoRouter = require("./enviarCorreo")
const correoAprendizaje = require("./enviarCorreoAprendizaje")
const correoAprendizajeStatus = require("./enviarCorreoStatusAprendizaje")
const maestrosRouter = require("./maestros.routes")


// router.use('/enviarCorreo',correoRouter)

router.use('/enviarCorreoAprendizaje',correoAprendizaje)

router.use('/enviarCorreoStatusAprendizaje',correoAprendizajeStatus)

router.use('/maestros',maestrosRouter)

// test para confirmar que este router está montado
router.get('/test', (req, res) => res.send('Router raíz OK'));



module.exports = router

const router = require("express").Router();

 // const correoRouter = require("./enviarCorreo")
const correoAprendizaje = require("./enviarCorreoAprendizaje")
const correoAprendizajeStatus = require("./enviarCorreoStatusAprendizaje")


// router.use('/enviarCorreo',correoRouter)

router.use('/enviarCorreoAprendizaje',correoAprendizaje)

router.use('/enviarCorreoStatusAprendizaje',correoAprendizajeStatus)

module.exports = router
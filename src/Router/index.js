const router = require("express").Router();

const correoRouter = require("./enviarCorreo")
const correoAprendizaje = require("./enviarCorreoAprendizaje")

router.use('/enviarCorreo',correoRouter)

router.use('/enviarCorreoAprendizaje',correoAprendizaje)

module.exports = router
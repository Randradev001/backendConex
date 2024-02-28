const router = require("express").Router();

const correoRouter = require("./enviarCorreo")
const correoAprendizaje = require("./enviarCorreoAprendizaje")
const correoStatusAprendizaje = require("./enviarCorreoStatusAprendizaje")


router.use('/enviarCorreo',correoRouter)

router.use('/enviarCorreoAprendizaje',correoAprendizaje)

router.use('/enviarCorreoStatusAprendizaje',correoStatusAprendizaje)

module.exports = router
const router = require("express").Router();

const correoRouter = require("./enviarCorreo")


router.use('/enviarCorreo',correoRouter)


module.exports = router
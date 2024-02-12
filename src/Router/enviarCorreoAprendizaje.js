const router = require("express").Router();
const CorreoController = require('../controllers/correoAprendizaje')

router.post("/",CorreoController.enviarCorreo)

module.exports = router
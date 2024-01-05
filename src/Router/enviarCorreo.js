const router = require("express").Router();
const CorreoController = require('../controllers/correoController')

router.post("/",CorreoController.enviarCorreo)

module.exports = router
const router = require("express").Router();
 const CorreoController = require('../controllers/correoStatusAprendizaje')

router.post("/",CorreoController.enviarCorreo)


module.exports = router
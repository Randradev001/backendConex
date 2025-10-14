const router = require("express").Router();
const CorreoController = require('../controllers/correoStatusAprendizaje')

router.post("/",CorreoController.enviarCorreo)

// test ultra simple del subrouter
router.get('/ping', (req, res) => res.send('status subrouter OK'));

module.exports = router
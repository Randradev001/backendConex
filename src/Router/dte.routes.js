/* const router = require("express").Router();
const CorreoController = require('../controllers/correoController')

router.post("/",CorreoController.enviarCorreo)

module.exports = router */

const router = require("express").Router();
const DteController = require('../controllers/dteController')

router.post("/createBoleta", DteController.createBoletaDte);
router.post("/traeDoc/:id", DteController.getDteById);
router.post("/traeAllDocs", DteController.getDtes);
router.post("/createCompany", DteController.createCompany);
router.post("/getCompanies", DteController.getCompanies);
router.post('/getComunas', DteController.getComunas);



module.exports = router;
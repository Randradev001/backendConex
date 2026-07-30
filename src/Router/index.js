const router = require("express").Router();

const maestrosRouter = require("./maestros.routes")
const seguridadRouter = require('./seguridad.routes')

router.use('/maestros',maestrosRouter)
router.use('/seguridad', seguridadRouter)

// test para confirmar que este router está montado
router.get('/test', (req, res) => res.send('Router raíz OK'));



module.exports = router

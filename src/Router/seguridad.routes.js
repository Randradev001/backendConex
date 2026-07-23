const router = require('express').Router();
const SeguridadController = require('../controllers/seguridadController');
const authContext = require('../middleware/authContext');

router.post('/login', SeguridadController.login);
router.get('/session', authContext, SeguridadController.session);
router.post('/logout', SeguridadController.logout);
router.put('/password', authContext, SeguridadController.changePassword);

module.exports = router;

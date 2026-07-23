const SeguridadService = require('../services/seguridad.service');

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'conex_session';

const readCookie = (req, name) => {
  const cookies = String(req.headers.cookie || '').split(';');
  const item = cookies.find((value) => value.trim().startsWith(`${name}=`));
  return item ? decodeURIComponent(item.trim().slice(name.length + 1)) : null;
};

const getSessionToken = (req) => readCookie(req, COOKIE_NAME);

const authContext = async (req, res, next) => {
  try {
    const session = await SeguridadService.getSession(getSessionToken(req));
    if (!session) return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Debe iniciar sesion.' });

    req.auth = session;
    req.context = {
      ...(req.context || {}),
      empCod: session.company.empCod,
      login: session.user.login
    };
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = authContext;
module.exports.getSessionToken = getSessionToken;
module.exports.COOKIE_NAME = COOKIE_NAME;

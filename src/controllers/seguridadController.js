const SeguridadService = require('../services/seguridad.service');
const { COOKIE_NAME, getSessionToken } = require('../middleware/authContext');

const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = (expiresAt) => [
  `${COOKIE_NAME}=`,
  'Path=/',
  'HttpOnly',
  'SameSite=Lax',
  isProduction ? 'Secure' : '',
  expiresAt ? `Expires=${new Date(expiresAt).toUTCString()}` : 'Max-Age=0'
].filter(Boolean);

const setSessionCookie = (res, token, expiresAt) => {
  const parts = cookieOptions(expiresAt);
  parts[0] = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
  res.setHeader('Set-Cookie', parts.join('; '));
};

const sendError = (res, error) => {
  if (error instanceof SeguridadService.SecurityError) {
    return res.status(error.status).json({ code: error.code, message: error.message, details: error.details });
  }
  console.error('Error de seguridad:', error);
  return res.status(500).json({ code: 'SECURITY_ERROR', message: 'No fue posible completar la operacion.' });
};

const login = async (req, res) => {
  try {
    const result = await SeguridadService.login(req.body || {});
    if (result.requiresCompany) return res.json(result);
    setSessionCookie(res, result.token, result.expiresAt);
    delete result.token;
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
};

const session = (req, res) => res.json({
  authenticated: true,
  user: req.auth.user,
  company: req.auth.company,
  permissions: req.auth.permissions,
  menu: req.auth.menu,
  expiresAt: req.auth.expiresAt
});

const menu = (req, res) => res.json({ data: req.auth.menu || [] });

const logout = async (req, res) => {
  try {
    await SeguridadService.logout(getSessionToken(req));
    res.setHeader('Set-Cookie', cookieOptions().join('; '));
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error);
  }
};

const changePassword = async (req, res) => {
  try {
    await SeguridadService.changePassword(req.auth.user.login, req.auth.company.empCod, req.body?.currentPassword, req.body?.newPassword);
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = { login, session, menu, logout, changePassword };

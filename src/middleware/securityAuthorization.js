const { SecurityError } = require('../services/seguridad.service');

const numeric = (value) => Number(value);

const hasPermission = (permissions, required) => {
  const programs = Array.isArray(permissions?.programas) ? permissions.programas : [];
  const actions = Array.isArray(permissions?.acciones) ? permissions.acciones : [];
  const system = numeric(required.sistema);
  const module = numeric(required.modulo);
  const program = numeric(required.programa);
  const action = required.accion === undefined || required.accion === null ? null : numeric(required.accion);

  if (!Number.isInteger(system) || !Number.isInteger(module) || !Number.isInteger(program)) return false;
  if (action !== null) {
    return actions.some((item) => numeric(item.SistCod) === system && numeric(item.Modcod) === module
      && numeric(item.ProgCod) === program && numeric(item.ProgOPCod) === action);
  }
  return programs.some((item) => numeric(item.SistCod) === system && numeric(item.Modcod) === module && numeric(item.ProgCod) === program);
};

const requirePermission = (resolveRequired) => (req, res, next) => {
  const required = typeof resolveRequired === 'function' ? resolveRequired(req) : resolveRequired;
  if (!hasPermission(req.auth?.permissions || {}, required || {})) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'No tiene permisos para ejecutar esta accion.' });
  }
  return next();
};

const requireSecurityAdmin = (req, res, next) => {
  const configured = String(process.env.SECURITY_ADMIN_LOGINS || '').split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
  const adminRoles = String(process.env.SECURITY_ADMIN_ROLES || 'ADMINFULL').split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
  const login = String(req.auth?.user?.login || '').toUpperCase();
  const minimumLevel = Number(process.env.SECURITY_ADMIN_MIN_LEVEL || 900);
  const level = Number(req.auth?.user?.nivelSeguridad || 0);
  const roles = Array.isArray(req.auth?.user?.roles) ? req.auth.user.roles.map((item) => String(item).toUpperCase()) : [];
  if (configured.includes(login) || adminRoles.some((role) => roles.includes(role)) || level >= minimumLevel) return next();
  return res.status(403).json({ code: 'SECURITY_ADMIN_REQUIRED', message: 'Se requiere autorizacion para administrar Seguridad.' });
};

const verifyPermission = (req, res, next) => {
  try {
    const allowed = hasPermission(req.auth?.permissions || {}, req.body || {});
    return res.json({ allowed });
  } catch (error) {
    return next(new SecurityError(400, 'VALIDATION_ERROR', 'Los codigos de permiso no son validos.'));
  }
};

module.exports = { hasPermission, requirePermission, requireSecurityAdmin, verifyPermission };

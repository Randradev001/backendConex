const { SecurityError } = require('../services/seguridad.service');
const { isSecurityAdmin } = require('../security/securityAdminPolicy');

const numeric = (value) => Number(value);

const hasPermission = (permissions, required) => {
  const programs = Array.isArray(permissions?.programas) ? permissions.programas : [];
  const system = numeric(required.sistema);
  const module = numeric(required.modulo);
  const program = numeric(required.programa);

  if (!Number.isInteger(system) || !Number.isInteger(module) || !Number.isInteger(program)) return false;
  // En CONEX el programa es la unidad de autorizacion. Las acciones se
  // conservan por compatibilidad con GX8, pero no restringen operaciones.
  return programs.some((item) => numeric(item.SistCod) === system && numeric(item.Modcod) === module && numeric(item.ProgCod) === program);
};

const requirePermission = (resolveRequired) => (req, res, next) => {
  const required = typeof resolveRequired === 'function' ? resolveRequired(req) : resolveRequired;
  if (!hasPermission(req.auth?.permissions || {}, required || {})) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'No tiene permisos para ejecutar esta accion.' });
  }
  return next();
};

const requireAnyPermission = (resolveRequirements) => (req, res, next) => {
  const requirements = typeof resolveRequirements === 'function' ? resolveRequirements(req) : resolveRequirements;
  const allowed = Array.isArray(requirements)
    && requirements.some((required) => hasPermission(req.auth?.permissions || {}, required || {}));

  if (!allowed) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'No tiene permisos para ejecutar esta accion.' });
  }
  return next();
};

const requireSecurityAdmin = (req, res, next) => {
  if (isSecurityAdmin(req.auth?.user)) return next();
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

module.exports = { hasPermission, requirePermission, requireAnyPermission, requireSecurityAdmin, verifyPermission };

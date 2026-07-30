const service = require('../services/seguridadCatalogos.service');
const rolesService = require('../services/seguridadRoles.service');
const assignmentsService = require('../services/seguridadAsignaciones.service');
const { SecurityError } = require('../services/seguridad.service');

const sendError = (res, error) => {
  if (error instanceof SecurityError) return res.status(error.status).json({ code: error.code, message: error.message });
  console.error('Error en catalogos de seguridad:', error);
  return res.status(500).json({ code: 'SECURITY_CATALOG_ERROR', message: 'No fue posible completar la operacion.' });
};

const execute = (operation) => async (req, res) => {
  try {
    const result = await operation(req);
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
};

const list = execute((req) => service.list(req.params.catalog, req.query, req.context));
const insert = execute((req) => service.insert(req.params.catalog, req.body || {}, req.context));
const update = execute((req) => service.update(req.params.catalog, req.body || {}, req.context));
const remove = execute((req) => service.remove(req.params.catalog, req.body || {}, req.context));
const getRolePermissions = execute((req) => rolesService.getRolePermissions(req.params.role));
const saveRolePermissions = execute((req) => rolesService.saveRolePermissions(req.params.role, req.body || {}, req.context));
const reapplyRolePermissions = execute((req) => rolesService.reapplyRolePermissions(req.params.role, req.body || {}, req.context));
const getUserRoles = execute((req) => rolesService.getUserRoles(req.params.login, req.context));
const getUserAssignments = execute((req) => assignmentsService.getUserAssignments(req.params.login, req.context));
const getSystemAssignments = execute((req) => assignmentsService.getSystemAssignments(req.params.login, req.params.system, req.context));
const saveSystemAssignments = execute((req) => assignmentsService.saveSystemAssignments(req.params.login, req.params.system, req.body || {}, req.context));
const metadata = (req, res) => res.json({ data: service.metadata() });

module.exports = {
  list,
  insert,
  update,
  remove,
  metadata,
  getRolePermissions,
  saveRolePermissions,
  reapplyRolePermissions,
  getUserRoles,
  getUserAssignments,
  getSystemAssignments,
  saveSystemAssignments
};

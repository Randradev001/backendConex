const router = require('express').Router();
const MaestrosController = require('../controllers/maestrosController');
const authContext = require('../middleware/authContext');
const { requirePermission, requireAnyPermission } = require('../middleware/securityAuthorization');

router.use(authContext);

const bindReadRoute = (path, handler) => {
  router.get(path, handler);
  router.post(path, handler);
};

const bindCrudRoutes = (path, handlers) => {
  router.post(`${path}/insert`, handlers.insert);
  router.put(`${path}/update`, handlers.update);
  router.patch(`${path}/update`, handlers.update);
  router.post(`${path}/update`, handlers.update);
  router.delete(`${path}/delete`, handlers.remove);
  router.post(`${path}/delete`, handlers.remove);
};

const masterPermission = (programCode) => ({ sistema: 100, modulo: 1, programa: programCode });
const processMasterPermission = (modulo, programCode) => ({ sistema: 110, modulo, programa: programCode });

const bindAuthorizedRead = (path, handler, programCodes) => {
  const codes = Array.isArray(programCodes) ? programCodes : [programCodes];
  const permission = codes.length === 1
    ? requirePermission(masterPermission(codes[0]))
    : requireAnyPermission(codes.map(masterPermission));

  router.get(path, permission, handler);
  router.post(path, permission, handler);
};

const bindAuthorizedCrud = (path, handlers, programCode) => {
  const permission = requirePermission(masterPermission(programCode));

  router.post(`${path}/insert`, permission, handlers.insert);
  router.put(`${path}/update`, permission, handlers.update);
  router.patch(`${path}/update`, permission, handlers.update);
  router.post(`${path}/update`, permission, handlers.update);
  router.delete(`${path}/delete`, permission, handlers.remove);
  router.post(`${path}/delete`, permission, handlers.remove);
};

const bindAuthorizedMaster = (path, handlers, programCode) => {
  bindAuthorizedRead(path, handlers.list, programCode);
  bindAuthorizedCrud(path, handlers, programCode);
};

const bindAuthorizedProcessMaster = (path, handlers, modulo, programCode) => {
  const permission = (req, res, next) => {
    const roles = Array.isArray(req.auth?.user?.roles)
      ? req.auth.user.roles.map((role) => String(role).trim().toUpperCase())
      : [];
    if (roles.includes('ADMINFULL')) return next();
    return requirePermission(processMasterPermission(modulo, programCode))(req, res, next);
  };
  router.get(path, permission, handlers.list);
  router.post(path, permission, handlers.list);
  router.post(`${path}/insert`, permission, handlers.insert);
  router.put(`${path}/update`, permission, handlers.update);
  router.patch(`${path}/update`, permission, handlers.update);
  router.post(`${path}/update`, permission, handlers.update);
  router.delete(`${path}/delete`, permission, handlers.remove);
  router.post(`${path}/delete`, permission, handlers.remove);
};

router.get('/', MaestrosController.getCatalogos);

bindReadRoute('/empresas', MaestrosController.listEmpresas);
bindCrudRoutes('/empresas', {
  insert: MaestrosController.insertEmpresa,
  update: MaestrosController.updateEmpresa,
  remove: MaestrosController.deleteEmpresa
});

bindAuthorizedRead('/temporadas', MaestrosController.listTemporadas, 18);
bindAuthorizedCrud('/temporadas', {
  insert: MaestrosController.insertTemporada,
  update: MaestrosController.updateTemporada,
  remove: MaestrosController.deleteTemporada
}, 18);

bindAuthorizedRead('/especies', MaestrosController.listEspecies, [3, 4]);
bindAuthorizedCrud('/especies', {
  insert: MaestrosController.insertEspecie,
  update: MaestrosController.updateEspecie,
  remove: MaestrosController.deleteEspecie
}, 3);

bindAuthorizedMaster('/variedades', {
  list: MaestrosController.listVariedades,
  insert: MaestrosController.insertVariedad,
  update: MaestrosController.updateVariedad,
  remove: MaestrosController.deleteVariedad
}, 3);

bindAuthorizedMaster('/calibres', {
  list: MaestrosController.listCalibres,
  insert: MaestrosController.insertCalibre,
  update: MaestrosController.updateCalibre,
  remove: MaestrosController.deleteCalibre
}, 4);

bindAuthorizedMaster('/plagas-recepcion', {
  list: MaestrosController.listPlagasRecepcion,
  insert: MaestrosController.insertPlagaRecepcion,
  update: MaestrosController.updatePlagaRecepcion,
  remove: MaestrosController.deletePlagaRecepcion
}, 3);

bindAuthorizedMaster('/colores-recepcion', {
  list: MaestrosController.listColoresRecepcion,
  insert: MaestrosController.insertColorRecepcion,
  update: MaestrosController.updateColorRecepcion,
  remove: MaestrosController.deleteColorRecepcion
}, 3);

bindAuthorizedMaster('/envases', {
  list: MaestrosController.listEnvases,
  insert: MaestrosController.insertEnvase,
  update: MaestrosController.updateEnvase,
  remove: MaestrosController.deleteEnvase
}, 6);

bindAuthorizedMaster('/categorias-envase', {
  list: MaestrosController.listCategoriasEnvase,
  insert: MaestrosController.insertCategoriaEnvase,
  update: MaestrosController.updateCategoriaEnvase,
  remove: MaestrosController.deleteCategoriaEnvase
}, 6);

bindReadRoute('/comunas', MaestrosController.listComunas);
bindAuthorizedMaster('/productores', {
  list: MaestrosController.listProductores,
  insert: MaestrosController.insertProductor,
  update: MaestrosController.updateProductor,
  remove: MaestrosController.deleteProductor
}, 5);

bindAuthorizedMaster('/cuarteles', {
  list: MaestrosController.listCuarteles,
  insert: MaestrosController.insertCuartel,
  update: MaestrosController.updateCuartel,
  remove: MaestrosController.deleteCuartel
}, 5);
bindAuthorizedMaster('/clientes', {
  list: MaestrosController.listClientes,
  insert: MaestrosController.insertCliente,
  update: MaestrosController.updateCliente,
  remove: MaestrosController.deleteCliente
}, 12);
bindAuthorizedRead('/exportadoras', MaestrosController.listExportadoras, [15, 16]);
bindAuthorizedCrud('/exportadoras', {
  insert: MaestrosController.insertExportadora,
  update: MaestrosController.updateExportadora,
  remove: MaestrosController.deleteExportadora
}, 15);
bindAuthorizedMaster('/exportadoras-productores', {
  list: MaestrosController.listExportadoraProductores,
  insert: MaestrosController.insertExportadoraProductor,
  update: MaestrosController.updateExportadoraProductor,
  remove: MaestrosController.deleteExportadoraProductor
}, 16);
bindAuthorizedMaster('/consignatarios', {
  list: MaestrosController.listConsignatarios,
  insert: MaestrosController.insertConsignatario,
  update: MaestrosController.updateConsignatario,
  remove: MaestrosController.deleteConsignatario
}, 14);
bindAuthorizedMaster('/agentes', {
  list: MaestrosController.listAgentes,
  insert: MaestrosController.insertAgente,
  update: MaestrosController.updateAgente,
  remove: MaestrosController.deleteAgente
}, 13);
bindAuthorizedMaster('/condiciones', {
  list: MaestrosController.listCondiciones,
  insert: MaestrosController.insertCondicion,
  update: MaestrosController.updateCondicion,
  remove: MaestrosController.deleteCondicion
}, 7);
bindAuthorizedMaster('/origenes', {
  list: MaestrosController.listOrigenes,
  insert: MaestrosController.insertOrigen,
  update: MaestrosController.updateOrigen,
  remove: MaestrosController.deleteOrigen
}, 8);
bindAuthorizedMaster('/destinos', {
  list: MaestrosController.listDestinos,
  insert: MaestrosController.insertDestino,
  update: MaestrosController.updateDestino,
  remove: MaestrosController.deleteDestino
}, 11);
bindAuthorizedMaster('/tipos-documento', {
  list: MaestrosController.listTiposDocumento,
  insert: MaestrosController.insertTipoDocumento,
  update: MaestrosController.updateTipoDocumento,
  remove: MaestrosController.deleteTipoDocumento
}, 1, 1);
bindAuthorizedProcessMaster('/ordenes-proceso-adm', {
  list: MaestrosController.listOrdenesProcesoAdm,
  insert: MaestrosController.insertOrdenesProcesoAdm,
  update: MaestrosController.updateOrdenesProcesoAdm,
  remove: MaestrosController.deleteOrdenesProcesoAdm
}, 2, 2);
bindAuthorizedMaster('/tipos-movimiento', {
  list: MaestrosController.listTiposMovimiento,
  insert: MaestrosController.insertTipoMovimiento,
  update: MaestrosController.updateTipoMovimiento,
  remove: MaestrosController.deleteTipoMovimiento
}, 2);
bindAuthorizedMaster('/subtipos-movimiento', {
  list: MaestrosController.listSubtiposMovimiento,
  insert: MaestrosController.insertSubtipoMovimiento,
  update: MaestrosController.updateSubtipoMovimiento,
  remove: MaestrosController.deleteSubtipoMovimiento
}, 2);
bindAuthorizedMaster('/parametros-generales', {
  list: MaestrosController.listParametrosGenerales,
  insert: MaestrosController.insertParametroGeneral,
  update: MaestrosController.updateParametroGeneral,
  remove: MaestrosController.deleteParametroGeneral
}, 30);
bindAuthorizedMaster('/parametros-detalle', {
  list: MaestrosController.listParametrosDetalle,
  insert: MaestrosController.insertParametroDetalle,
  update: MaestrosController.updateParametroDetalle,
  remove: MaestrosController.deleteParametroDetalle
}, 30);
bindAuthorizedRead('/monedas', MaestrosController.listMonedas, [31, 32]);
bindAuthorizedCrud('/monedas', {
  insert: MaestrosController.insertMoneda,
  update: MaestrosController.updateMoneda,
  remove: MaestrosController.deleteMoneda
}, 31);
bindAuthorizedMaster('/valores-moneda', {
  list: MaestrosController.listValoresMoneda,
  insert: MaestrosController.insertValorMoneda,
  update: MaestrosController.updateValorMoneda,
  remove: MaestrosController.deleteValorMoneda
}, 32);
bindAuthorizedMaster('/puertos', {
  list: MaestrosController.listPuertos,
  insert: MaestrosController.insertPuerto,
  update: MaestrosController.updatePuerto,
  remove: MaestrosController.deletePuerto
}, 20);
bindAuthorizedMaster('/causales-anulacion', {
  list: MaestrosController.listCausalesAnulacion,
  insert: MaestrosController.insertCausalAnulacion,
  update: MaestrosController.updateCausalAnulacion,
  remove: MaestrosController.deleteCausalAnulacion
}, 21);
bindAuthorizedMaster('/despachadores-autorizados', {
  list: MaestrosController.listDespachadoresAutorizados,
  insert: MaestrosController.insertDespachadorAutorizado,
  update: MaestrosController.updateDespachadorAutorizado,
  remove: MaestrosController.deleteDespachadorAutorizado
}, 19);
bindAuthorizedMaster('/procedencias', {
  list: MaestrosController.listProcedencias,
  insert: MaestrosController.insertProcedencia,
  update: MaestrosController.updateProcedencia,
  remove: MaestrosController.deleteProcedencia
}, 9);
bindAuthorizedMaster('/secciones', {
  list: MaestrosController.listSecciones,
  insert: MaestrosController.insertSeccion,
  update: MaestrosController.updateSeccion,
  remove: MaestrosController.deleteSeccion
}, 10);
bindAuthorizedMaster('/tipos-etiqueta', {
  list: MaestrosController.listTiposEtiqueta,
  insert: MaestrosController.insertTipoEtiqueta,
  update: MaestrosController.updateTipoEtiqueta,
  remove: MaestrosController.deleteTipoEtiqueta
}, 22);

bindAuthorizedProcessMaster('/configuraciones-etiqueta', {
  list: MaestrosController.listConfiguracionesEtiqueta,
  insert: MaestrosController.insertConfiguracionEtiqueta,
  update: MaestrosController.updateConfiguracionEtiqueta,
  remove: MaestrosController.deleteConfiguracionEtiqueta
}, 1);
bindAuthorizedMaster('/tipos-base-pallet', {
  list: MaestrosController.listTiposBasePallet,
  insert: MaestrosController.insertTipoBasePallet,
  update: MaestrosController.updateTipoBasePallet,
  remove: MaestrosController.deleteTipoBasePallet
}, 23);
bindAuthorizedMaster('/tipos-altura', {
  list: MaestrosController.listTiposAltura,
  insert: MaestrosController.insertTipoAltura,
  update: MaestrosController.updateTipoAltura,
  remove: MaestrosController.deleteTipoAltura
}, 24);

module.exports = router;

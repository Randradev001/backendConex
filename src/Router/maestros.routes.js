const router = require('express').Router();
const MaestrosController = require('../controllers/maestrosController');
const authContext = require('../middleware/authContext');
const { requirePermission } = require('../middleware/securityAuthorization');

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

const bindAuthorizedMaster = (path, handlers, programCode) => {
  const permission = requirePermission({ sistema: 100, modulo: 1, programa: programCode });

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

bindReadRoute('/temporadas', MaestrosController.listTemporadas);
bindCrudRoutes('/temporadas', {
  insert: MaestrosController.insertTemporada,
  update: MaestrosController.updateTemporada,
  remove: MaestrosController.deleteTemporada
});

bindReadRoute('/especies', MaestrosController.listEspecies);
bindCrudRoutes('/especies', {
  insert: MaestrosController.insertEspecie,
  update: MaestrosController.updateEspecie,
  remove: MaestrosController.deleteEspecie
});

bindReadRoute('/variedades', MaestrosController.listVariedades);
bindCrudRoutes('/variedades', {
  insert: MaestrosController.insertVariedad,
  update: MaestrosController.updateVariedad,
  remove: MaestrosController.deleteVariedad
});

bindReadRoute('/calibres', MaestrosController.listCalibres);
bindCrudRoutes('/calibres', {
  insert: MaestrosController.insertCalibre,
  update: MaestrosController.updateCalibre,
  remove: MaestrosController.deleteCalibre
});

bindReadRoute('/envases', MaestrosController.listEnvases);
bindCrudRoutes('/envases', {
  insert: MaestrosController.insertEnvase,
  update: MaestrosController.updateEnvase,
  remove: MaestrosController.deleteEnvase
});

bindReadRoute('/categorias-envase', MaestrosController.listCategoriasEnvase);
bindCrudRoutes('/categorias-envase', {
  insert: MaestrosController.insertCategoriaEnvase,
  update: MaestrosController.updateCategoriaEnvase,
  remove: MaestrosController.deleteCategoriaEnvase
});

bindReadRoute('/comunas', MaestrosController.listComunas);
bindReadRoute('/productores', MaestrosController.listProductores);
bindCrudRoutes('/productores', {
  insert: MaestrosController.insertProductor,
  update: MaestrosController.updateProductor,
  remove: MaestrosController.deleteProductor
});

bindReadRoute('/cuarteles', MaestrosController.listCuarteles);
bindCrudRoutes('/cuarteles', {
  insert: MaestrosController.insertCuartel,
  update: MaestrosController.updateCuartel,
  remove: MaestrosController.deleteCuartel
});
bindAuthorizedMaster('/clientes', {
  list: MaestrosController.listClientes,
  insert: MaestrosController.insertCliente,
  update: MaestrosController.updateCliente,
  remove: MaestrosController.deleteCliente
}, 12);
bindReadRoute('/exportadoras', MaestrosController.listExportadoras);
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
bindReadRoute('/origenes', MaestrosController.listOrigenes);
bindReadRoute('/condiciones', MaestrosController.listCondiciones);
bindReadRoute('/destinos', MaestrosController.listDestinos);
bindReadRoute('/tipos-documento', MaestrosController.listTiposDocumento);

module.exports = router;

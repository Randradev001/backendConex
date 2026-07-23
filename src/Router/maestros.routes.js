const router = require('express').Router();
const MaestrosController = require('../controllers/maestrosController');
const authContext = require('../middleware/authContext');

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
bindReadRoute('/clientes', MaestrosController.listClientes);
bindReadRoute('/exportadoras', MaestrosController.listExportadoras);
bindReadRoute('/consignatarios', MaestrosController.listConsignatarios);
bindReadRoute('/agentes', MaestrosController.listAgentes);
bindReadRoute('/origenes', MaestrosController.listOrigenes);
bindReadRoute('/condiciones', MaestrosController.listCondiciones);
bindReadRoute('/destinos', MaestrosController.listDestinos);
bindReadRoute('/tipos-documento', MaestrosController.listTiposDocumento);

module.exports = router;

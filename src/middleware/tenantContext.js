const configuredEmpCod = Number(process.env.DEFAULT_EMP_COD || 1);

const DEFAULT_EMP_COD = Number.isInteger(configuredEmpCod) && configuredEmpCod > 0 ? configuredEmpCod : 1;
const DEFAULT_LOGIN = process.env.DEFAULT_LOGIN || 'MIGRACION';

const tenantContext = (req, res, next) => {
  // El login reemplazara estos valores fijos cuando se implemente autenticacion.
  req.context = {
    ...(req.context || {}),
    empCod: DEFAULT_EMP_COD,
    login: DEFAULT_LOGIN
  };

  next();
};

module.exports = tenantContext;

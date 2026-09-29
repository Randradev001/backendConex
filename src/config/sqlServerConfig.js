require('./loadEnv');

const firstEnv = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
};

// Una variable primaria vacia puede desactivar expresamente un alias legado,
// por ejemplo DB_INSTANCE= para conectar por puerto al SQL Server de Docker.
const firstDefinedEnv = (...names) => {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(process.env, name)) {
      const value = String(process.env[name] || '').trim();
      return value || undefined;
    }
  }
  return undefined;
};

const parseBoolean = (value, defaultValue) => {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'y', 'si', 's'].includes(String(value).trim().toLowerCase());
};

const requireEnv = (...names) => {
  const value = firstEnv(...names);
  if (value !== undefined) return value;
  throw new Error(`Falta configurar variable de entorno: ${names.join(' o ')}`);
};

const buildSqlServerConfig = ({ database } = {}) => {
  const instanceName = firstDefinedEnv('DB_INSTANCE', 'SQLSERVER_INSTANCE');
  const port = firstEnv('DB_PORT', 'SQLSERVER_PORT');
  const config = {
    server: requireEnv('DB_SERVER', 'SQLSERVER_HOST'),
    user: requireEnv('DB_USER', 'SQLSERVER_USER'),
    password: requireEnv('DB_PASSWORD', 'SQLSERVER_PASSWORD'),
    database: database || requireEnv('DB_DATABASE', 'SQLSERVER_DATABASE'),
    options: {
      encrypt: parseBoolean(firstEnv('DB_ENCRYPT', 'SQLSERVER_ENCRYPT'), false),
      trustServerCertificate: parseBoolean(firstEnv('DB_TRUST_SERVER_CERTIFICATE', 'SQLSERVER_TRUST_CERT'), true)
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 30000,
    requestTimeout: 30000
  };

  if (instanceName) config.options.instanceName = instanceName;
  if (port) config.port = Number(port);
  else if (!instanceName) config.port = 1433;

  return config;
};

const getConfiguredDatabase = () => firstEnv('DB_DATABASE', 'SQLSERVER_DATABASE');

module.exports = {
  buildSqlServerConfig,
  getConfiguredDatabase
};

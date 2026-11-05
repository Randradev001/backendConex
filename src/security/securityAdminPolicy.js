const configuredValues = (name, fallback = '') => String(process.env[name] || fallback)
  .split(',')
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);

const isSecurityAdmin = (user = {}) => {
  const login = String(user.login || '').trim().toUpperCase();
  const roles = Array.isArray(user.roles) ? user.roles.map((item) => String(item).trim().toUpperCase()) : [];
  const configuredMinimumLevel = String(process.env.SECURITY_ADMIN_MIN_LEVEL || '').trim();
  const minimumLevel = configuredMinimumLevel ? Number(configuredMinimumLevel) : null;
  const level = Number(user.nivelSeguridad || 0);

  return configuredValues('SECURITY_ADMIN_LOGINS').includes(login)
    || configuredValues('SECURITY_ADMIN_ROLES', 'ADMINFULL').some((role) => roles.includes(role))
    || (Number.isFinite(minimumLevel) && level >= minimumLevel);
};

module.exports = { isSecurityAdmin };

const validContextSources = new Set(['database', 'api']);

const value = (env, name) => {
  const result = String(env[name] ?? '').trim();
  return result || undefined;
};

const positiveInteger = (env, name, defaultValue) => {
  const raw = value(env, name);
  const result = raw === undefined ? defaultValue : Number(raw);
  if (!Number.isInteger(result) || result <= 0) {
    throw new Error(`${name} debe ser un entero positivo.`);
  }
  return result;
};

const requireValue = (env, ...names) => {
  for (const name of names) {
    const result = value(env, name);
    if (result) return result;
  }
  throw new Error(`Falta configurar variable de entorno: ${names.join(' o ')}`);
};

const parseEnabled = (raw) => ['1', 'true', 'yes', 'si'].includes(String(raw || '').trim().toLowerCase());

const buildPrintConfig = (env = process.env) => {
  const queueSource = (value(env, 'PRINT_QUEUE_SOURCE') || 'database').toLowerCase();
  if (queueSource !== 'database') {
    throw new Error('PRINT_QUEUE_SOURCE debe ser database porque el PLC inserta en OrdenImpresion local.');
  }
  // PRINT_JOB_SOURCE se conserva temporalmente como alias del perfil inicial.
  const contextSource = (value(env, 'PRINT_CONTEXT_SOURCE') || value(env, 'PRINT_JOB_SOURCE') || 'database').toLowerCase();
  if (!validContextSources.has(contextSource)) {
    throw new Error('PRINT_CONTEXT_SOURCE debe ser database o api.');
  }

  const config = {
    enabled: parseEnabled(env.PRINT_WORKER_ENABLED),
    queueSource,
    contextSource,
    pollMs: positiveInteger(env, 'PRINT_POLL_MS', 750),
    printerPort: positiveInteger(env, 'PRINT_PORT', 9100),
    printerTimeoutMs: positiveInteger(env, 'PRINT_TIMEOUT_MS', 5000)
  };

  requireValue(env, 'DB_PASSWORD', 'SQLSERVER_PASSWORD');
  config.empCod = positiveInteger(env, 'PRINT_EMP_COD', 1);
  config.database = {
    server: requireValue(env, 'DB_SERVER', 'SQLSERVER_HOST'),
    name: requireValue(env, 'DB_DATABASE', 'SQLSERVER_DATABASE'),
    user: requireValue(env, 'DB_USER', 'SQLSERVER_USER'),
    passwordConfigured: true
  };

  if (contextSource === 'api') {
    const apiUrl = requireValue(env, 'PRINT_API_URL');
    let parsedUrl;
    try {
      parsedUrl = new URL(apiUrl);
    } catch {
      throw new Error('PRINT_API_URL debe ser una URL válida.');
    }
    const localHttp = parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname);
    const insecureHttpAllowed = parseEnabled(env.PRINT_API_ALLOW_INSECURE_HTTP);
    if (parsedUrl.protocol !== 'https:' && !localHttp && !insecureHttpAllowed) {
      throw new Error('PRINT_API_URL debe usar HTTPS; para una transición HTTP explícita configure PRINT_API_ALLOW_INSECURE_HTTP=true.');
    }
    const token = requireValue(env, 'PRINT_AGENT_TOKEN');
    config.api = {
      url: parsedUrl.toString().replace(/\/$/, ''),
      agentId: requireValue(env, 'PRINT_AGENT_ID'),
      installationId: requireValue(env, 'PRINT_INSTALLATION_ID'),
      tokenConfigured: true,
      insecureHttp: parsedUrl.protocol === 'http:' && !localHttp,
      spoolPath: requireValue(env, 'PRINT_LOCAL_SPOOL')
    };
    Object.defineProperty(config.api, 'token', { value: token, enumerable: false });
  }

  return config;
};

module.exports = { buildPrintConfig, parseEnabled, validContextSources };

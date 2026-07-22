const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { nextCorrelative } = require('../services/gxCorrelatives.service');

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const catalogos = {
  empresas: {
    table: 'DEFEMP',
    gxLevel: 1,
    requiresEmpCod: true,
    rutFields: { number: 'EmpRut', verifier: 'EmpDV' },
    primaryKey: ['EmpCod'],
    columns: ['EmpCod', 'EmpNom', 'EmpGiro', 'Empdir', 'EmpRut', 'EmpDV', 'EmpRepre', 'EmpSw', 'EmpPar1', 'EmpPar2', 'empreg', 'empSisProd', 'EmpTempLot', 'EmpCodSAG', 'EmpCodCom', 'EmpRutIMG', 'EmpTReg', 'Empprov', 'Empcom'],
    orderBy: ['EmpCod'],
    searchColumns: ['EmpNom', 'EmpRut'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      EmpNom: { type: 'text', length: 50, required: true },
      EmpGiro: { type: 'text', length: 35 },
      Empdir: { type: 'text', length: 30 },
      EmpRut: { type: 'int' },
      EmpDV: { type: 'text', length: 1 },
      EmpRepre: { type: 'text', length: 20 },
      EmpSw: { type: 'int' },
      EmpPar1: { type: 'int' },
      EmpPar2: { type: 'int' },
      empreg: { type: 'text', length: 4, choices: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'RM'] },
      empSisProd: { type: 'int', choices: [0, 1] },
      EmpTempLot: { type: 'int' },
      EmpCodSAG: { type: 'int' },
      EmpCodCom: { type: 'text', length: 20 },
      EmpRutIMG: { type: 'text', length: 100 },
      EmpTReg: { type: 'int', choices: [0, 1] },
      Empprov: { type: 'text', length: 20 },
      Empcom: { type: 'text', length: 20 }
    }
  },
  temporadas: {
    table: 'TEMP01',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'TempCod'],
    columns: ['EmpCod', 'TempCod', 'TempDes', 'TempFecAbre', 'TempLogA', 'TempFecCierra', 'TempLogC', 'TempActiva'],
    orderBy: ['TempCod'],
    searchColumns: ['TempCod', 'TempDes'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      TempCod: { type: 'text', length: 9, required: true },
      TempDes: { type: 'text', length: 20, required: true },
      TempFecAbre: { type: 'date', serverValueOnInsert: 'serverDate', serverManaged: true },
      TempLogA: { type: 'text', length: 10, serverValueOnInsert: 'contextLogin', serverManaged: true },
      TempFecCierra: { type: 'date' },
      TempLogC: { type: 'text', length: 10 },
      TempActiva: { type: 'int', choices: [0, 1], insertDefault: 1 }
    }
  },
  especies: {
    table: 'ESPECIES',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Especod'],
    columns: ['EmpCod', 'Especod', 'EspeNom', 'EspeDiaV', 'EspeSag', 'EspeNomC', 'EspePLU', 'EspeCMP', 'EspeNomExt', 'EspeNMP', 'EspeSECod'],
    orderBy: ['Especod'],
    searchColumns: ['EspeNom', 'EspeNomC', 'EspeNomExt'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Especod: { type: 'int', required: true, min: 1 },
      EspeNom: { type: 'text', length: 20, required: true },
      EspeDiaV: { type: 'int' },
      EspeSag: { type: 'int' },
      EspeNomC: { type: 'text', length: 4, required: true },
      EspePLU: { type: 'text', length: 15 },
      EspeCMP: { type: 'int' },
      EspeNomExt: { type: 'text', length: 20 },
      EspeNMP: { type: 'text', length: 100 },
      EspeSECod: { type: 'text', length: 10 }
    }
  },
  variedades: {
    table: 'ESPECIES1',
    gxLevel: 2,
    parentTable: 'ESPECIES',
    parentKey: ['EmpCod', 'Especod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Especod', 'VarCod'],
    columns: ['EmpCod', 'Especod', 'VarCod', 'VarNom', 'varnomC', 'VarPLU', 'VarSECod'],
    orderBy: ['Especod', 'VarCod'],
    filters: [{ param: 'Especod', column: 'Especod', type: 'int', required: true }],
    searchColumns: ['VarNom', 'varnomC'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Especod: { type: 'int', required: true, min: 1 },
      VarCod: { type: 'int', required: true, min: 1 },
      VarNom: { type: 'text', length: 20, required: true },
      varnomC: { type: 'text', length: 4, required: true },
      VarPLU: { type: 'text', length: 15 },
      VarSECod: { type: 'text', length: 10 }
    }
  },
  calibres: {
    table: 'CALIBRES',
    gxLevel: 1,
    parentTable: 'ESPECIES',
    parentKey: ['EmpCod', 'Especod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'Especod', 'Calibre'],
    columns: ['EmpCod', 'Especod', 'Calibre', 'CalCod'],
    orderBy: ['Especod', 'CalCod', 'Calibre'],
    filters: [{ param: 'Especod', column: 'Especod', type: 'int', required: true }],
    searchColumns: ['Calibre', 'CalCod'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      Especod: { type: 'int', required: true, min: 1 },
      Calibre: { type: 'text', length: 10, required: true },
      CalCod: { type: 'int', min: 1, serverGenerated: true }
    }
  },
  envases: {
    table: 'ENVCAT',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'EnvCod'],
    columns: ['EmpCod', 'EnvCod', 'EnvNom', 'EnvPeso', 'EnvDestare', 'EnvPesoB', 'EnvUso', 'EnvnomC', 'EnvCMP', 'EnvNomExt', 'EnvNMP', 'EnvSECod'],
    orderBy: ['EnvCod'],
    searchColumns: ['EnvNom', 'EnvnomC', 'EnvNomExt'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      EnvCod: { type: 'int', required: true, min: 1 },
      EnvNom: { type: 'text', length: 20, required: true },
      EnvPeso: { type: 'decimal', precision: 6, scale: 2, required: true, exclusiveMin: 0 },
      EnvDestare: { type: 'decimal', precision: 5, scale: 2 },
      EnvPesoB: { type: 'decimal', precision: 5, scale: 2 },
      EnvUso: { type: 'int', required: true, min: 1, insertDefault: 1 },
      EnvnomC: { type: 'text', length: 10 },
      EnvCMP: { type: 'int' },
      EnvNomExt: { type: 'text', length: 20 },
      EnvNMP: { type: 'text', length: 20 },
      EnvSECod: { type: 'text', length: 10 }
    }
  },
  categoriasEnvase: {
    table: 'ENVCAT1',
    gxLevel: 2,
    parentTable: 'ENVCAT',
    parentKey: ['EmpCod', 'EnvCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'EnvCod', 'Catcod'],
    columns: ['EmpCod', 'EnvCod', 'Catcod', 'CatNom', 'CatNomC', 'CatnomExt', 'CatSECod'],
    orderBy: ['EnvCod', 'Catcod'],
    filters: [{ param: 'EnvCod', column: 'EnvCod', type: 'int', required: true }],
    searchColumns: ['CatNom', 'CatNomC', 'CatnomExt'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      EnvCod: { type: 'int', required: true, min: 1 },
      Catcod: { type: 'int', required: true, min: 1 },
      CatNom: { type: 'text', length: 20, required: true },
      CatNomC: { type: 'text', length: 4, required: true },
      CatnomExt: { type: 'text', length: 20 },
      CatSECod: { type: 'text', length: 10 }
    }
  },
  comunas: {
    table: 'COMUNAS',
    columns: ['ComCod', 'Comdesc'],
    orderBy: ['Comdesc'],
    searchColumns: ['ComCod', 'Comdesc']
  },
  productores: {
    table: 'PRODUCTORES',
    gxLevel: 1,
    parentTable: 'DEFEMP',
    parentKey: ['EmpCod'],
    requiresEmpCod: true,
    rutFields: { number: 'ProdRut', verifier: 'ProdDv' },
    primaryKey: ['EmpCod', 'ProdCod'],
    columns: ['EmpCod', 'ProdCod', 'ProdNom', 'ProdRut', 'ProdDv', 'ProdComuna', 'ProdProvincia', 'ProdPack', 'ProdPackCom', 'ProdPackProv', 'ProdCodExt', 'Prodnom2', 'ProdCodSAG', 'ProdSECod'],
    orderBy: ['ProdCod'],
    searchColumns: ['ProdCod', 'ProdNom', 'ProdRut', 'ProdCodSAG'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ProdCod: { type: 'text', length: 6, required: true },
      ProdNom: { type: 'text', length: 35, required: true },
      ProdRut: { type: 'int' },
      ProdDv: { type: 'text', length: 1 },
      ProdComuna: { type: 'text', length: 20 },
      ProdProvincia: { type: 'text', length: 20 },
      ProdPack: { type: 'text', length: 30 },
      ProdPackCom: { type: 'text', length: 20 },
      ProdPackProv: { type: 'text', length: 20 },
      ProdCodExt: { type: 'text', length: 10 },
      Prodnom2: { type: 'text', length: 20 },
      ProdCodSAG: { type: 'text', length: 10, required: true },
      ProdSECod: { type: 'text', length: 10 }
    }
  },
  cuarteles: {
    table: 'PRODUCTORES1',
    gxLevel: 2,
    parentTable: 'PRODUCTORES',
    parentKey: ['EmpCod', 'ProdCod'],
    requiresEmpCod: true,
    primaryKey: ['EmpCod', 'ProdCod', 'CuarCod'],
    columns: ['EmpCod', 'ProdCod', 'CuarCod', 'CuarNom', 'CuarnomC'],
    orderBy: ['ProdCod', 'CuarCod'],
    filters: [{ param: 'ProdCod', column: 'ProdCod', type: 'text', length: 6, required: true }],
    searchColumns: ['ProdCod', 'CuarNom', 'CuarnomC'],
    fields: {
      EmpCod: { type: 'int', required: true, min: 1 },
      ProdCod: { type: 'text', length: 6, required: true },
      CuarCod: { type: 'int', required: true, min: 1 },
      CuarNom: { type: 'text', length: 35, required: true },
      CuarnomC: { type: 'text', length: 4, required: true }
    }
  },
  clientes: {
    table: 'CLIENTES',
    requiresEmpCod: true,
    columns: ['EmpCod', 'CliCod', 'Clirut', 'CliDv', 'CliNom', 'Clidirec', 'CliGiro', 'Cliciu', 'CliCom', 'CliFono', 'CliRegion'],
    orderBy: ['CliCod'],
    searchColumns: ['CliNom', 'Clirut']
  },
  exportadoras: {
    table: 'EXPORT1',
    requiresEmpCod: true,
    columns: ['EmpCod', 'ExpCod', 'ExpRut', 'ExpDv', 'ExpNom', 'EXPCodMP', 'EXPSECod'],
    orderBy: ['ExpCod'],
    searchColumns: ['ExpNom', 'ExpRut']
  },
  consignatarios: {
    table: 'CONSIG',
    requiresEmpCod: true,
    columns: ['EmpCod', 'ConsCod', 'ConsRut', 'ConsDV', 'ConsNom'],
    orderBy: ['ConsCod'],
    searchColumns: ['ConsNom', 'ConsRut']
  },
  agentes: {
    table: 'AGENTES',
    requiresEmpCod: true,
    columns: ['EmpCod', 'AgeCod', 'Agerut', 'AgeDv', 'AgeNom', 'AgecodMP'],
    orderBy: ['AgeCod'],
    searchColumns: ['AgeNom', 'Agerut']
  },
  origenes: {
    table: 'ORIGEN',
    requiresEmpCod: true,
    columns: ['EmpCod', 'OriCod', 'Orinom', 'OriEst'],
    orderBy: ['OriCod'],
    searchColumns: ['Orinom']
  },
  condiciones: {
    table: 'CONDICION',
    columns: ['ConCod', 'ConNom', 'ConEst', 'ConNomC'],
    orderBy: ['ConCod'],
    searchColumns: ['ConNom', 'ConNomC']
  },
  destinos: {
    table: 'DESTINOS',
    columns: ['DestCod', 'DestNom', 'DestCMP'],
    orderBy: ['DestCod'],
    searchColumns: ['DestNom']
  },
  tiposDocumento: {
    table: 'TIPDOC',
    columns: ['TdCod', 'TdNom', 'TdInter', 'TdBloq'],
    orderBy: ['TdCod'],
    searchColumns: ['TdNom']
  }
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const findParam = (source, name) => {
  if (!source) return { found: false, value: undefined };
  if (hasOwn(source, name)) return { found: true, value: source[name] };

  const lowerName = name.toLowerCase();
  const matchingKey = Object.keys(source).find((key) => key.toLowerCase() === lowerName);
  if (!matchingKey) return { found: false, value: undefined };

  return { found: true, value: source[matchingKey] };
};

const quoteName = (name) => `[${name}]`;

const getParam = (req, name) => {
  const queryParam = findParam(req.query, name);
  if (queryParam.found) return queryParam.value;

  const bodyParam = findParam(req.body, name);
  if (bodyParam.found) return bodyParam.value;

  return undefined;
};

const getContextEmpCod = (req) => {
  const empCod = Number(req.context?.empCod);
  if (!Number.isInteger(empCod) || empCod <= 0) {
    throw httpError(500, 'Contexto de empresa no configurado');
  }

  return empCod;
};

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getIntParam = (req, name, required = true) => {
  const value = getParam(req, name);

  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    throw httpError(400, `Parametro requerido: ${name}`);
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    throw httpError(400, `Parametro invalido: ${name} debe ser entero`);
  }

  return numberValue;
};

const getTextParam = (req, name) => {
  const value = getParam(req, name);
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
};

const getLimit = (req) => {
  const rawLimit = getParam(req, 'limit');
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') return DEFAULT_LIMIT;

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw httpError(400, 'Parametro invalido: limit debe ser entero positivo');
  }

  return Math.min(limit, MAX_LIMIT);
};

const bindFilter = (request, filter, value) => {
  if (filter.type === 'int') {
    const intValue = Number(value);
    if (!Number.isInteger(intValue)) {
      throw httpError(400, `Parametro invalido: ${filter.param} debe ser entero`);
    }
    request.input(filter.param, sql.Int, intValue);
    return;
  }

  request.input(filter.param, sql.VarChar(filter.length || 50), String(value).trim());
};

const buildSearchClause = (request, config, q) => {
  if (!q || !config.searchColumns || config.searchColumns.length === 0) return null;

  request.input('q', sql.NVarChar(120), `%${q}%`);
  return `(${config.searchColumns.map((column) => `CAST(${quoteName(column)} AS NVARCHAR(120)) LIKE @q`).join(' OR ')})`;
};

const listCatalog = (catalogName) => async (req, res) => {
  const config = catalogos[catalogName];

  try {
    const pool = await getPool();
    const request = pool.request();
    const where = [];
    const limit = getLimit(req);

    request.input('limit', sql.Int, limit);

    if (config.requiresEmpCod) {
      request.input('empCod', sql.Int, getContextEmpCod(req));
      where.push('[EmpCod] = @empCod');
    }

    for (const filter of config.filters || []) {
      const value = getParam(req, filter.param);
      const hasValue = value !== undefined && value !== null && value !== '';

      if (!hasValue && filter.required) {
        throw httpError(400, `Parametro requerido: ${filter.param}`);
      }

      if (!hasValue) continue;

      bindFilter(request, filter, value);
      where.push(`${quoteName(filter.column)} = @${filter.param}`);
    }

    const q = getTextParam(req, 'q');
    const searchClause = buildSearchClause(request, config, q);
    if (searchClause) where.push(searchClause);

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const query = `
      SELECT TOP (@limit)
        ${config.columns.map(quoteName).join(',\n        ')}
      FROM ${quoteName(config.table)}
      ${whereSql}
      ORDER BY ${config.orderBy.map(quoteName).join(', ')}
    `;

    const result = await request.query(query);

    return res.json({
      success: true,
      catalog: catalogName,
      count: result.recordset.length,
      data: result.recordset
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      catalog: catalogName,
      message: status === 500 ? 'Error consultando maestro' : error.message,
      error: error.message
    });
  }
};

const hasWriteParam = (req, name) => {
  if (findParam(req.body, name).found) return true;
  if (findParam(req.query, name).found) return true;
  return false;
};

const getWriteParam = (req, name) => {
  const bodyParam = findParam(req.body, name);
  if (bodyParam.found) return bodyParam.value;

  const queryParam = findParam(req.query, name);
  if (queryParam.found) return queryParam.value;

  return undefined;
};

const hasCatalogWriteParam = (req, config, name) => (
  (name === 'EmpCod' && config.requiresEmpCod) || hasWriteParam(req, name)
);

const getCatalogWriteParam = (req, config, name) => {
  if (name === 'EmpCod' && config.requiresEmpCod) return getContextEmpCod(req);
  return getWriteParam(req, name);
};

const getSqlType = (field) => {
  if (field.type === 'int') return sql.Int;
  if (field.type === 'date') return sql.Date;
  if (field.type === 'decimal') return sql.Decimal(field.precision || 18, field.scale ?? 4);
  return sql.VarChar(field.length || 255);
};

const buildDate = (year, month, day) => {
  const dateValue = new Date(Date.UTC(year, month - 1, day));
  if (
    dateValue.getUTCFullYear() !== year ||
    dateValue.getUTCMonth() !== month - 1 ||
    dateValue.getUTCDate() !== day
  ) {
    return null;
  }
  return dateValue;
};

const parseDateValue = (value) => {
  if (value instanceof Date) return value;

  const textValue = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(textValue);
  if (isoMatch) {
    return buildDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const compactMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(textValue);
  if (compactMatch) {
    return buildDate(Number(compactMatch[1]), Number(compactMatch[2]), Number(compactMatch[3]));
  }

  return new Date(textValue);
};

const validateChoice = (fieldName, field, value) => {
  if (!field.choices || value === null) return;

  const isAllowed = field.choices.some((choice) => String(choice) === String(value));
  if (!isAllowed) {
    throw httpError(400, `Campo invalido: ${fieldName} valor no permitido`);
  }
};

const validateRange = (fieldName, field, value) => {
  if (value === null) return;

  if (field.min !== undefined && value < field.min) {
    throw httpError(400, `Campo invalido: ${fieldName} debe ser mayor o igual a ${field.min}`);
  }

  if (field.exclusiveMin !== undefined && value <= field.exclusiveMin) {
    throw httpError(400, `Campo invalido: ${fieldName} debe ser mayor a ${field.exclusiveMin}`);
  }
};

const normalizeValue = (fieldName, field, value, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, `Campo requerido: ${fieldName}`);
    return null;
  }

  if (field.type === 'int') {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue)) {
      throw httpError(400, `Campo invalido: ${fieldName} debe ser entero`);
    }
    validateChoice(fieldName, field, numberValue);
    validateRange(fieldName, field, numberValue);
    return numberValue;
  }

  if (field.type === 'date') {
    const dateValue = parseDateValue(value);
    if (!dateValue || Number.isNaN(dateValue.getTime())) {
      throw httpError(400, `Campo invalido: ${fieldName} debe ser fecha valida`);
    }
    return dateValue;
  }

  if (field.type === 'decimal') {
    const numberValue = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(numberValue)) {
      throw httpError(400, `Campo invalido: ${fieldName} debe ser numerico`);
    }
    validateChoice(fieldName, field, numberValue);
    validateRange(fieldName, field, numberValue);
    return numberValue;
  }

  const textValue = String(value).trim();
  if (textValue === '') {
    if (required) throw httpError(400, `Campo requerido: ${fieldName}`);
    return null;
  }
  if (field.length && textValue.length > field.length) {
    throw httpError(400, `Campo invalido: ${fieldName} maximo ${field.length} caracteres`);
  }
  validateChoice(fieldName, field, textValue);

  return textValue;
};

const bindField = (request, paramName, fieldName, field, value, required = false) => {
  const normalizedValue = normalizeValue(fieldName, field, value, required);
  request.input(paramName, getSqlType(field), normalizedValue);
  return normalizedValue;
};

const getWritableCatalog = (catalogName) => {
  const config = catalogos[catalogName];
  if (!config || !config.fields || !config.primaryKey) {
    throw httpError(500, `Catalogo no configurado para escritura: ${catalogName}`);
  }
  return config;
};

const getKeyPayload = (req, config) => config.primaryKey.reduce((payload, column) => {
  payload[column] = getCatalogWriteParam(req, config, column);
  return payload;
}, {});

const getInsertValue = (req, config, column, field) => {
  if (field.serverValueOnInsert === 'serverDate') return new Date();
  if (field.serverValueOnInsert === 'contextLogin') return req.context?.login || 'MIGRACION';

  const suppliedValue = getCatalogWriteParam(req, config, column);
  if (suppliedValue !== undefined && suppliedValue !== null && suppliedValue !== '') return suppliedValue;

  return field.insertDefault !== undefined ? field.insertDefault : suppliedValue;
};

const calculateRutVerifier = (rut) => {
  let value = Number(rut);
  let factor = 2;
  let sum = 0;

  while (value > 0) {
    sum += (value % 10) * factor;
    value = Math.floor(value / 10);
    factor = factor === 7 ? 2 : factor + 1;
  }

  const result = 11 - (sum % 11);
  if (result === 11) return '0';
  if (result === 10) return 'K';
  return String(result);
};

const validateRut = (config, values) => {
  if (!config.rutFields) return;

  const numberField = config.rutFields.number;
  const verifierField = config.rutFields.verifier;
  const rut = values[numberField];
  const verifier = values[verifierField];
  const touchesRut = rut !== undefined || verifier !== undefined;

  if (!touchesRut || (rut === null && verifier === null)) return;
  if (rut === undefined || rut === null || verifier === undefined || verifier === null) {
    throw httpError(400, 'Debe informar RUT y digito verificador');
  }

  if (calculateRutVerifier(rut) !== String(verifier).trim().toUpperCase()) {
    throw httpError(400, 'RUT incorrecto');
  }
};

const sendWriteError = (res, catalogName, error, defaultMessage) => {
  let status = error.status || 500;
  let message = status === 500 ? defaultMessage : error.message;

  if (error.number === 2601 || error.number === 2627) {
    status = 409;
    message = 'Registro duplicado';
  }

  if (error.number === 547) {
    status = 409;
    message = 'Registro relacionado o llave foranea invalida';
  }

  return res.status(status).json({
    success: false,
    catalog: catalogName,
    message,
    error: error.message
  });
};

const insertCatalog = (catalogName) => async (req, res) => {
  try {
    const config = getWritableCatalog(catalogName);
    const pool = await getPool();
    const request = pool.request();
    const columns = Object.keys(config.fields).filter((column) => !config.fields[column].serverGenerated);
    const normalizedValues = {};

    for (const column of columns) {
      const field = config.fields[column];
      const isRequired = config.primaryKey.includes(column) || field.required === true;
      normalizedValues[column] = bindField(request, column, column, field, getInsertValue(req, config, column, field), isRequired);
    }

    validateRut(config, normalizedValues);

    const query = `
      INSERT INTO ${quoteName(config.table)}
        (${columns.map(quoteName).join(', ')})
      VALUES
        (${columns.map((column) => `@${column}`).join(', ')})
    `;

    await request.query(query);

    return res.status(201).json({
      success: true,
      catalog: catalogName,
      message: 'Registro creado',
      key: getKeyPayload(req, config)
    });
  } catch (error) {
    return sendWriteError(res, catalogName, error, 'Error insertando maestro');
  }
};

const updateCatalog = (catalogName) => async (req, res) => {
  try {
    const config = getWritableCatalog(catalogName);
    const pool = await getPool();
    const request = pool.request();
    const normalizedValues = {};

    for (const column of config.primaryKey) {
      bindField(request, `key_${column}`, column, config.fields[column], getCatalogWriteParam(req, config, column), true);
    }

    const updateColumns = Object.keys(config.fields).filter((column) => (
      !config.primaryKey.includes(column) &&
      !config.fields[column].serverGenerated &&
      !config.fields[column].serverManaged &&
      hasCatalogWriteParam(req, config, column)
    ));

    if (updateColumns.length === 0) {
      throw httpError(400, 'Debe informar al menos un campo para actualizar');
    }

    for (const column of updateColumns) {
      normalizedValues[column] = bindField(
        request,
        column,
        column,
        config.fields[column],
        getCatalogWriteParam(req, config, column),
        false
      );
    }

    validateRut(config, normalizedValues);

    const query = `
      UPDATE ${quoteName(config.table)}
      SET ${updateColumns.map((column) => `${quoteName(column)} = @${column}`).join(', ')}
      WHERE ${config.primaryKey.map((column) => `${quoteName(column)} = @key_${column}`).join(' AND ')}
    `;

    const result = await request.query(query);

    return res.json({
      success: true,
      catalog: catalogName,
      message: 'Registro actualizado',
      rowsAffected: result.rowsAffected[0] || 0,
      key: getKeyPayload(req, config)
    });
  } catch (error) {
    return sendWriteError(res, catalogName, error, 'Error actualizando maestro');
  }
};

const deleteCatalog = (catalogName) => async (req, res) => {
  try {
    const config = getWritableCatalog(catalogName);
    const pool = await getPool();
    const request = pool.request();

    for (const column of config.primaryKey) {
      bindField(request, `key_${column}`, column, config.fields[column], getCatalogWriteParam(req, config, column), true);
    }

    const query = `
      DELETE FROM ${quoteName(config.table)}
      WHERE ${config.primaryKey.map((column) => `${quoteName(column)} = @key_${column}`).join(' AND ')}
    `;

    const result = await request.query(query);

    return res.json({
      success: true,
      catalog: catalogName,
      message: 'Registro eliminado',
      rowsAffected: result.rowsAffected[0] || 0,
      key: getKeyPayload(req, config)
    });
  } catch (error) {
    return sendWriteError(res, catalogName, error, 'Error eliminando maestro');
  }
};

const insertCalibre = async (req, res) => {
  const catalogName = 'calibres';
  let transaction;
  let transactionStarted = false;

  try {
    const config = getWritableCatalog(catalogName);
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    const calCod = await nextCorrelative({
      transaction,
      empCod: getContextEmpCod(req),
      code: 'CAL',
      digits: 5
    });
    if (calCod > 999) {
      throw httpError(409, 'Correlativo CalCod excede el largo Numeric(3) definido en GX8');
    }

    const request = new sql.Request(transaction);
    const columns = Object.keys(config.fields);

    for (const column of columns) {
      const field = config.fields[column];
      const rawValue = column === 'CalCod' ? calCod : getInsertValue(req, config, column, field);
      bindField(request, column, column, field, rawValue, true);
    }

    await request.query(`
      INSERT INTO [${config.table}]
        (${columns.map(quoteName).join(', ')})
      VALUES
        (${columns.map((column) => `@${column}`).join(', ')})
    `);

    await transaction.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      catalog: catalogName,
      message: 'Registro creado',
      key: getKeyPayload(req, config),
      CalCod: calCod
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error revirtiendo insercion de calibre', rollbackError);
      }
    }

    return sendWriteError(res, catalogName, error, 'Error insertando maestro');
  }
};

const getCatalogos = (req, res) => {
  res.json({
    success: true,
    catalogs: Object.keys(catalogos)
  });
};

module.exports = {
  getCatalogos,
  listEmpresas: listCatalog('empresas'),
  insertEmpresa: insertCatalog('empresas'),
  updateEmpresa: updateCatalog('empresas'),
  deleteEmpresa: deleteCatalog('empresas'),
  listTemporadas: listCatalog('temporadas'),
  insertTemporada: insertCatalog('temporadas'),
  updateTemporada: updateCatalog('temporadas'),
  deleteTemporada: deleteCatalog('temporadas'),
  listEspecies: listCatalog('especies'),
  insertEspecie: insertCatalog('especies'),
  updateEspecie: updateCatalog('especies'),
  deleteEspecie: deleteCatalog('especies'),
  listVariedades: listCatalog('variedades'),
  insertVariedad: insertCatalog('variedades'),
  updateVariedad: updateCatalog('variedades'),
  deleteVariedad: deleteCatalog('variedades'),
  listCalibres: listCatalog('calibres'),
  insertCalibre,
  updateCalibre: updateCatalog('calibres'),
  deleteCalibre: deleteCatalog('calibres'),
  listEnvases: listCatalog('envases'),
  insertEnvase: insertCatalog('envases'),
  updateEnvase: updateCatalog('envases'),
  deleteEnvase: deleteCatalog('envases'),
  listCategoriasEnvase: listCatalog('categoriasEnvase'),
  insertCategoriaEnvase: insertCatalog('categoriasEnvase'),
  updateCategoriaEnvase: updateCatalog('categoriasEnvase'),
  deleteCategoriaEnvase: deleteCatalog('categoriasEnvase'),
  listComunas: listCatalog('comunas'),
  listProductores: listCatalog('productores'),
  insertProductor: insertCatalog('productores'),
  updateProductor: updateCatalog('productores'),
  deleteProductor: deleteCatalog('productores'),
  listCuarteles: listCatalog('cuarteles'),
  insertCuartel: insertCatalog('cuarteles'),
  updateCuartel: updateCatalog('cuarteles'),
  deleteCuartel: deleteCatalog('cuarteles'),
  listClientes: listCatalog('clientes'),
  listExportadoras: listCatalog('exportadoras'),
  listConsignatarios: listCatalog('consignatarios'),
  listAgentes: listCatalog('agentes'),
  listOrigenes: listCatalog('origenes'),
  listCondiciones: listCatalog('condiciones'),
  listDestinos: listCatalog('destinos'),
  listTiposDocumento: listCatalog('tiposDocumento')
};

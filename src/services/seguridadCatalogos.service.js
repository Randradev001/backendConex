const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { hashPassword } = require('./password.service');
const { SecurityError, parseRut } = require('./seguridad.service');
const { materializeRolePermissions, removeRoleAssignment } = require('./seguridadRoles.service');

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const text = (length, options = {}) => ({ type: 'text', length, ...options });
const number = (options = {}) => ({ type: 'number', ...options });
const date = (options = {}) => ({ type: 'date', ...options });
const dateTime = (options = {}) => ({ type: 'datetime', ...options });

const catalogs = {
  usuarios: {
    gxObject: 'Usuarios',
    table: 'USUARIOS',
    companyColumn: 'GECODEMP',
    primaryKey: ['GECODEMP', 'UsuLogin'],
    columns: ['GECODEMP', 'UsuLogin', 'UsuRut', 'UsuDV', 'Usunom', 'UsuCargo', 'UsuExpira', 'usucrea', 'UsuNseg', 'UsuCorreo', 'UsuEstado', 'UsuPerfil', 'UsuTipo'],
    searchColumns: ['UsuLogin', 'UsuRut', 'Usunom', 'UsuCorreo', 'UsuCargo'],
    orderBy: ['UsuLogin'],
    fields: {
      GECODEMP: number({ serverValue: 'contextCompany' }),
      UsuLogin: text(10, { required: true, upper: true }),
      UsuClave: text(64, { writeOnly: true, password: true }),
      UsuRut: number({ required: true }),
      UsuDV: text(1, { required: true, upper: true }),
      Usunom: text(35, { required: true }),
      UsuCargo: text(30, { defaultValue: ' ' }),
      UsuExpira: dateTime(),
      usucrea: text(10, { serverValueOnInsert: 'contextLogin' }),
      UsuNseg: number({ defaultValue: 0 }),
      UsuCorreo: text(30, { defaultValue: ' ' }),
      UsuEstado: number({ required: true, defaultValue: 1 }),
      UsuPerfil: text(10, { defaultValue: ' ' }),
      UsuTipo: number({ required: true, defaultValue: 0 })
    }
  },
  roles: {
    gxObject: 'UROLES',
    table: 'UROLES',
    primaryKey: ['ROLCod'],
    columns: ['ROLCod', 'ROLNombre', 'ROLFCrea', 'ROLUCrea'],
    searchColumns: ['ROLCod', 'ROLNombre'],
    orderBy: ['ROLCod'],
    fields: {
      ROLCod: text(10, { required: true, upper: true }),
      ROLNombre: text(30, { required: true }),
      ROLFCrea: dateTime({ serverValueOnInsert: 'serverDate' }),
      ROLUCrea: text(10, { serverValueOnInsert: 'contextLogin' })
    }
  },
  rolesUsuarios: {
    gxObject: 'URolesPorUser',
    table: 'URolesPorUser',
    companyColumn: 'GECODEMP',
    primaryKey: ['GECODEMP', 'UsuLogin', 'ROLCod'],
    columns: ['GECODEMP', 'UsuLogin', 'ROLCod', 'RXUFecCrea'],
    filters: ['UsuLogin', 'ROLCod'],
    searchColumns: ['UsuLogin', 'ROLCod'],
    orderBy: ['UsuLogin', 'ROLCod'],
    fields: {
      GECODEMP: number({ serverValue: 'contextCompany' }),
      UsuLogin: text(10, { required: true, upper: true }),
      ROLCod: text(10, { required: true, upper: true }),
      RXUFecCrea: dateTime({ serverValueOnInsert: 'serverDate' })
    },
    references: [
      { table: 'SEGUSUEMP', pairs: [['GECODEMP', 'GECODEMP'], ['UsuLogin', 'UsuLogin']], message: 'El usuario indicado no existe en la empresa.' },
      { table: 'UROLES', pairs: [['ROLCod', 'ROLCod']], message: 'El rol indicado no existe.' }
    ]
  },
  sistemas: {
    gxObject: 'Sistemas',
    table: 'SISTEMAS',
    primaryKey: ['SistCod'],
    columns: ['SistCod', 'SistNombre', 'SistFecCrea', 'SistFAIcons'],
    searchColumns: ['SistCod', 'SistNombre'],
    orderBy: ['SistCod'],
    fields: {
      SistCod: number({ required: true, min: 1 }),
      SistNombre: text(40, { required: true }),
      SistFecCrea: date({ serverValueOnInsert: 'serverDate' }),
      SistFAIcons: text(30, { defaultValue: ' ' })
    }
  },
  modulos: {
    gxObject: 'Modulos',
    table: 'MODULOS',
    primaryKey: ['SistCod', 'Modcod'],
    columns: ['SistCod', 'Modcod', 'ModTipo', 'Modprg', 'ModDes', 'ModFcrea', 'ModFAIcons'],
    filters: ['SistCod'],
    searchColumns: ['Modcod', 'Modprg', 'ModDes'],
    orderBy: ['SistCod', 'Modcod'],
    fields: {
      SistCod: number({ required: true, min: 1 }),
      Modcod: number({ required: true, min: 1 }),
      ModTipo: number({ required: true, defaultValue: 1 }),
      Modprg: text(15, { defaultValue: ' ' }),
      ModDes: text(30, { required: true }),
      ModFcrea: date({ serverValueOnInsert: 'serverDate' }),
      ModFAIcons: text(30, { defaultValue: ' ' })
    },
    references: [{ table: 'SISTEMAS', pairs: [['SistCod', 'SistCod']], message: 'El sistema indicado no existe.' }]
  },
  programas: {
    gxObject: 'Program',
    table: 'PROGRAM',
    primaryKey: ['SistCod', 'Modcod', 'ProgCod'],
    columns: ['SistCod', 'Modcod', 'ProgCod', 'ProgDes', 'ProgFcrea', 'ProgTipo', 'ProgNomGX', 'ProgIDmenu', 'ProgTarget'],
    filters: ['SistCod', 'Modcod'],
    searchColumns: ['ProgCod', 'ProgDes', 'ProgNomGX'],
    orderBy: ['SistCod', 'Modcod', 'ProgCod'],
    fields: {
      SistCod: number({ required: true, min: 1 }),
      Modcod: number({ required: true, min: 1 }),
      ProgCod: number({ required: true, min: 1 }),
      ProgDes: text(35, { required: true }),
      ProgFcrea: date({ serverValueOnInsert: 'serverDate' }),
      ProgTipo: number({ defaultValue: 0 }),
      ProgNomGX: text(20, { defaultValue: ' ' }),
      ProgIDmenu: text(20, { defaultValue: ' ' }),
      ProgTarget: text(20, { defaultValue: ' ' })
    },
    references: [{ table: 'MODULOS', pairs: [['SistCod', 'SistCod'], ['Modcod', 'Modcod']], message: 'El modulo indicado no existe.' }]
  },
  programaAcciones: {
    gxObject: 'Program',
    gxLevel: 2,
    table: 'PROGRAM1',
    primaryKey: ['SistCod', 'Modcod', 'ProgCod', 'ProgOPCod'],
    columns: ['SistCod', 'Modcod', 'ProgCod', 'ProgOPCod', 'ProgOPDes'],
    filters: ['SistCod', 'Modcod', 'ProgCod'],
    searchColumns: ['ProgOPCod', 'ProgOPDes'],
    orderBy: ['SistCod', 'Modcod', 'ProgCod', 'ProgOPCod'],
    fields: {
      SistCod: number({ required: true, min: 1 }),
      Modcod: number({ required: true, min: 1 }),
      ProgCod: number({ required: true, min: 1 }),
      ProgOPCod: number({ required: true, min: 1 }),
      ProgOPDes: text(35, { required: true })
    },
    references: [{ table: 'PROGRAM', pairs: [['SistCod', 'SistCod'], ['Modcod', 'Modcod'], ['ProgCod', 'ProgCod']], message: 'El programa padre no existe.' }]
  },
  niveles: {
    gxObject: 'NivSeg',
    table: 'NIVSEG',
    primaryKey: ['NSegMod', 'NSegProg'],
    columns: ['NSegMod', 'NSegDMod', 'NSegProg', 'NsegDes', 'NSegIns', 'NsegDel', 'NsegUPD', 'NsegPRC', 'NsegLogA'],
    searchColumns: ['NSegMod', 'NSegDMod', 'NSegProg', 'NsegDes'],
    orderBy: ['NSegMod', 'NSegProg'],
    fields: {
      NSegMod: number({ required: true, min: 1 }),
      NSegDMod: text(30),
      NSegProg: number({ required: true, min: 1 }),
      NsegDes: text(35),
      NSegIns: number(),
      NsegDel: number(),
      NsegUPD: number(),
      NsegPRC: number(),
      NsegLogA: text(10, { serverValueOnInsert: 'contextLogin' })
    }
  },
  asignacionesSistemas: {
    gxObject: 'AsigSist',
    table: 'ASIGSIST',
    companyColumn: 'GECODEMP',
    primaryKey: ['GECODEMP', 'AsgSisLogin', 'SistCod'],
    columns: ['GECODEMP', 'AsgSisLogin', 'SistCod'],
    filters: ['AsgSisLogin'],
    searchColumns: ['AsgSisLogin', 'SistCod'],
    orderBy: ['AsgSisLogin', 'SistCod'],
    fields: {
      GECODEMP: number({ serverValue: 'contextCompany' }),
      AsgSisLogin: text(10, { required: true, upper: true }),
      SistCod: number({ required: true, min: 1 })
    },
    references: [
      { table: 'SEGUSUEMP', pairs: [['GECODEMP', 'GECODEMP'], ['AsgSisLogin', 'UsuLogin']], message: 'El usuario indicado no existe en la empresa.' },
      { table: 'SISTEMAS', pairs: [['SistCod', 'SistCod']], message: 'El sistema indicado no existe.' }
    ]
  },
  asignacionesModulos: {
    gxObject: 'Asig',
    table: 'ASIG',
    companyColumn: 'GECODEMP',
    primaryKey: ['GECODEMP', 'AsigUsu', 'SistCod', 'AsigMod'],
    columns: ['GECODEMP', 'AsigUsu', 'SistCod', 'AsigMod', 'AsigAsig'],
    filters: ['AsigUsu', 'SistCod'],
    searchColumns: ['AsigUsu', 'SistCod', 'AsigMod'],
    orderBy: ['AsigUsu', 'SistCod', 'AsigMod'],
    fields: {
      GECODEMP: number({ serverValue: 'contextCompany' }),
      AsigUsu: text(10, { required: true, upper: true }),
      SistCod: number({ required: true, min: 1 }),
      AsigMod: number({ required: true, min: 1 }),
      AsigAsig: text(10, { serverValueOnInsert: 'contextLogin' })
    }
  },
  asignacionesProgramas: {
    gxObject: 'AsigProg',
    table: 'ASIGPROG',
    companyColumn: 'GECODEMP',
    primaryKey: ['GECODEMP', 'UsuLogin', 'SistCod', 'Modcod', 'ProgCod'],
    columns: ['GECODEMP', 'UsuLogin', 'SistCod', 'Modcod', 'ProgCod', 'ProgUsuC'],
    filters: ['UsuLogin', 'SistCod', 'Modcod'],
    searchColumns: ['UsuLogin', 'SistCod', 'Modcod', 'ProgCod'],
    orderBy: ['UsuLogin', 'SistCod', 'Modcod', 'ProgCod'],
    fields: {
      GECODEMP: number({ serverValue: 'contextCompany' }),
      UsuLogin: text(10, { required: true, upper: true }),
      SistCod: number({ required: true, min: 1 }),
      Modcod: number({ required: true, min: 1 }),
      ProgCod: number({ required: true, min: 1 }),
      ProgUsuC: text(10, { serverValueOnInsert: 'contextLogin' })
    }
  },
  asignacionesAcciones: {
    gxObject: 'AsigProg',
    gxLevel: 2,
    table: 'ASIGPROG1',
    companyColumn: 'GECODEMP',
    primaryKey: ['GECODEMP', 'UsuLogin', 'SistCod', 'Modcod', 'ProgCod', 'ProgOPCod'],
    columns: ['GECODEMP', 'UsuLogin', 'SistCod', 'Modcod', 'ProgCod', 'ProgOPCod'],
    filters: ['UsuLogin', 'SistCod', 'Modcod', 'ProgCod'],
    searchColumns: ['UsuLogin', 'SistCod', 'Modcod', 'ProgCod', 'ProgOPCod'],
    orderBy: ['UsuLogin', 'SistCod', 'Modcod', 'ProgCod', 'ProgOPCod'],
    fields: {
      GECODEMP: number({ serverValue: 'contextCompany' }),
      UsuLogin: text(10, { required: true, upper: true }),
      SistCod: number({ required: true, min: 1 }),
      Modcod: number({ required: true, min: 1 }),
      ProgCod: number({ required: true, min: 1 }),
      ProgOPCod: number({ required: true, min: 1 })
    }
  }
};

const quote = (name) => `[${name}]`;
const isFilled = (value) => value !== undefined && value !== null && value !== '';

const sqlType = (field) => {
  if (field.type === 'number') return sql.Int;
  if (field.type === 'date') return sql.Date;
  if (field.type === 'datetime') return sql.DateTime2;
  return sql.VarChar(field.length);
};

const validateValue = (name, field, rawValue, { insert = false } = {}) => {
  if (!isFilled(rawValue)) {
    if (field.required && !field.serverValue && !(insert && field.serverValueOnInsert)) {
      throw new SecurityError(400, 'VALIDATION_ERROR', `${name} es obligatorio.`);
    }
    return null;
  }

  if (field.type === 'number') {
    const value = Number(rawValue);
    if (!Number.isInteger(value)) throw new SecurityError(400, 'VALIDATION_ERROR', `${name} debe ser entero.`);
    if (field.min !== undefined && value < field.min) throw new SecurityError(400, 'VALIDATION_ERROR', `${name} debe ser mayor o igual a ${field.min}.`);
    return value;
  }

  if (field.type === 'date' || field.type === 'datetime') {
    const value = new Date(rawValue);
    if (Number.isNaN(value.getTime())) throw new SecurityError(400, 'VALIDATION_ERROR', `${name} no contiene una fecha valida.`);
    return value;
  }

  let value = String(rawValue).trim();
  if (field.upper) value = value.toUpperCase();
  if (value.length > field.length) throw new SecurityError(400, 'VALIDATION_ERROR', `${name} admite hasta ${field.length} caracteres.`);
  return value;
};

const resolveValue = (name, field, payload, context, insert) => {
  if (field.serverValue === 'contextCompany') return context.empCod;
  if (insert && field.serverValueOnInsert === 'contextLogin') return context.login;
  if (insert && field.serverValueOnInsert === 'serverDate') return new Date();
  if (insert && !isFilled(payload[name]) && isFilled(field.defaultValue)) return field.defaultValue;
  return validateValue(name, field, payload[name], { insert });
};

const bind = (request, name, field, value) => request.input(name, sqlType(field), value);

const getCatalog = (name) => {
  const config = catalogs[name];
  if (!config) throw new SecurityError(404, 'CATALOG_NOT_FOUND', 'Catalogo de seguridad no encontrado.');
  return config;
};

const assertReferences = async (transaction, config, values) => {
  for (const reference of config.references || []) {
    const request = transaction.request();
    const where = reference.pairs.map(([source, target], index) => {
      bind(request, `ref${index}`, config.fields[source], values[source]);
      return `${quote(target)}=@ref${index}`;
    });
    const result = await request.query(`SELECT TOP (1) 1 AS found FROM ${quote(reference.table)} WHERE ${where.join(' AND ')}`);
    if (!result.recordset.length) throw new SecurityError(400, 'INVALID_REFERENCE', reference.message);
  }
};

const enrichValues = async (transaction, catalogName, values, context) => {
  if (catalogName === 'asignacionesModulos') {
    const result = await transaction.request()
      .input('sistema', sql.Int, values.SistCod)
      .input('modulo', sql.Int, values.AsigMod)
      .query('SELECT TOP (1) ModDes FROM MODULOS WHERE SistCod=@sistema AND Modcod=@modulo');
    if (!result.recordset[0]) throw new SecurityError(400, 'INVALID_REFERENCE', 'El modulo indicado no existe.');
    values.AsigAsig = context.login;

    const parent = await transaction.request()
      .input('empresa', sql.Int, context.empCod).input('usuario', sql.VarChar(10), values.AsigUsu).input('sistema', sql.Int, values.SistCod)
      .query('SELECT TOP (1) 1 AS found FROM ASIGSIST WHERE GECODEMP=@empresa AND AsgSisLogin=@usuario AND SistCod=@sistema');
    if (!parent.recordset.length) throw new SecurityError(400, 'MISSING_PARENT_ASSIGNMENT', 'Primero debe asignar el sistema al usuario.');
  }

  if (catalogName === 'asignacionesProgramas') {
    values.ProgUsuC = context.login;
    const parent = await transaction.request()
      .input('empresa', sql.Int, context.empCod).input('usuario', sql.VarChar(10), values.UsuLogin)
      .input('sistema', sql.Int, values.SistCod).input('modulo', sql.Int, values.Modcod)
      .query('SELECT TOP (1) 1 AS found FROM ASIG WHERE GECODEMP=@empresa AND AsigUsu=@usuario AND SistCod=@sistema AND AsigMod=@modulo');
    if (!parent.recordset.length) throw new SecurityError(400, 'MISSING_PARENT_ASSIGNMENT', 'Primero debe asignar el modulo al usuario.');

    const program = await transaction.request().input('sistema', sql.Int, values.SistCod).input('modulo', sql.Int, values.Modcod)
      .input('programa', sql.Int, values.ProgCod)
      .query('SELECT TOP (1) 1 AS found FROM PROGRAM WHERE SistCod=@sistema AND Modcod=@modulo AND ProgCod=@programa');
    if (!program.recordset.length) throw new SecurityError(400, 'INVALID_REFERENCE', 'El programa indicado no existe.');
  }

  if (catalogName === 'asignacionesAcciones') {
    const parent = await transaction.request().input('empresa', sql.Int, context.empCod).input('usuario', sql.VarChar(10), values.UsuLogin)
      .input('sistema', sql.Int, values.SistCod).input('modulo', sql.Int, values.Modcod).input('programa', sql.Int, values.ProgCod)
      .query('SELECT TOP (1) 1 AS found FROM ASIGPROG WHERE GECODEMP=@empresa AND UsuLogin=@usuario AND SistCod=@sistema AND Modcod=@modulo AND ProgCod=@programa');
    if (!parent.recordset.length) throw new SecurityError(400, 'MISSING_PARENT_ASSIGNMENT', 'Primero debe asignar el programa al usuario.');

    const action = await transaction.request().input('sistema', sql.Int, values.SistCod).input('modulo', sql.Int, values.Modcod)
      .input('programa', sql.Int, values.ProgCod).input('accion', sql.Int, values.ProgOPCod)
      .query('SELECT TOP (1) 1 AS found FROM PROGRAM1 WHERE SistCod=@sistema AND Modcod=@modulo AND ProgCod=@programa AND ProgOPCod=@accion');
    if (!action.recordset.length) throw new SecurityError(400, 'INVALID_REFERENCE', 'La accion indicada no existe en el programa.');
  }
};

const listUsers = async (query, context) => {
  const pool = await getPool();
  const request = pool.request().input('contextCompany', sql.Int, context.empCod);
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  let search = '';

  if (isFilled(query.q)) {
    request.input('search', sql.VarChar(200), `%${String(query.q).trim()}%`);
    search = `AND (
      RTRIM(U.UsuLogin) LIKE @search OR CONVERT(varchar(20), U.UsuRut) LIKE @search
      OR RTRIM(U.Usunom) LIKE @search OR RTRIM(U.UsuCorreo) LIKE @search
      OR RTRIM(U.UsuCargo) LIKE @search
    )`;
  }

  const result = await request.query(`
    SELECT TOP (${limit})
      UE.GECODEMP, U.UsuLogin, U.UsuRut, U.UsuDV, U.Usunom, U.UsuCargo,
      U.UsuExpira, U.usucrea, U.UsuNseg, U.UsuCorreo,
      UE.UsuEstado, UE.UsuPerfil, UE.UsuTipo
    FROM USUARIOS U
    INNER JOIN SEGUSUEMP UE ON UE.UsuLogin=U.UsuLogin
    WHERE UE.GECODEMP=@contextCompany ${search}
    ORDER BY U.UsuLogin
  `);

  return { data: result.recordset, meta: { gxObject: 'Usuarios', gxLevel: 1, table: 'USUARIOS' } };
};

const listRoles = async (query, context) => {
  const pool = await getPool();
  const request = pool.request().input('contextCompany', sql.Int, context.empCod);
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  let search = '';

  if (isFilled(query.q)) {
    request.input('search', sql.VarChar(200), `%${String(query.q).trim()}%`);
    search = 'WHERE RTRIM(R.ROLCod) LIKE @search OR RTRIM(R.ROLNombre) LIKE @search';
  }

  const result = await request.query(`
    SELECT TOP (${limit})
      R.ROLCod, R.ROLNombre, R.ROLFCrea, R.ROLUCrea,
      (SELECT COUNT(*) FROM URolesPorUser RXU
       WHERE RXU.GECODEMP=@contextCompany AND RTRIM(RXU.ROLCod)=RTRIM(R.ROLCod)) AS AssignedUsers,
      (SELECT COUNT(*) FROM ASIGPROG AP
       WHERE AP.GECODEMP=0 AND RTRIM(AP.UsuLogin)=RTRIM(R.ROLCod)) AS AssignedPrograms
    FROM UROLES R
    ${search}
    ORDER BY R.ROLCod
  `);

  return { data: result.recordset, meta: { gxObject: 'UROLES', gxLevel: 1, table: 'UROLES' } };
};

const list = async (catalogName, query, context) => {
  const config = getCatalog(catalogName);
  if (catalogName === 'usuarios') return listUsers(query, context);
  if (catalogName === 'roles') return listRoles(query, context);

  const pool = await getPool();
  const request = pool.request();
  const where = [];
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  if (config.companyColumn) {
    request.input('contextCompany', sql.Int, context.empCod);
    where.push(`${quote(config.companyColumn)}=@contextCompany`);
  }

  for (const name of config.filters || []) {
    if (!isFilled(query[name])) continue;
    const value = validateValue(name, config.fields[name], query[name]);
    bind(request, `filter_${name}`, config.fields[name], value);
    where.push(`${quote(name)}=@filter_${name}`);
  }

  if (isFilled(query.q)) {
    request.input('search', sql.VarChar(200), `%${String(query.q).trim()}%`);
    where.push(`(${config.searchColumns.map((name) => `CONVERT(varchar(200), ${quote(name)}) LIKE @search`).join(' OR ')})`);
  }

  const result = await request.query(`
    SELECT TOP (${limit}) ${config.columns.map(quote).join(', ')}
    FROM ${quote(config.table)}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${config.orderBy.map(quote).join(', ')}
  `);
  return { data: result.recordset, meta: { gxObject: config.gxObject, gxLevel: config.gxLevel || 1, table: config.table } };
};

const storeModernPassword = async (transaction, login, password, migratedFromGx = false) => {
  const modern = await hashPassword(String(password));
  await transaction.request()
    .input('login', sql.VarChar(10), login)
    .input('salt', sql.VarChar(64), modern.salt)
    .input('hash', sql.VarChar(256), modern.hash)
    .input('migrated', sql.Bit, migratedFromGx)
    .query(`
      UPDATE SEGUSUCRED
      SET PasswordSalt=@salt, PasswordHash=@hash, MigradoDesdeGX=@migrated, FechaCambio=SYSUTCDATETIME()
      WHERE UsuLogin=@login;
      IF @@ROWCOUNT=0
        INSERT INTO SEGUSUCRED (UsuLogin,PasswordSalt,PasswordHash,MigradoDesdeGX,FechaCambio)
        VALUES (@login,@salt,@hash,@migrated,SYSUTCDATETIME());
    `);
};

const insertUser = async (payload, context) => {
  const config = catalogs.usuarios;
  const values = {};
  for (const [name, field] of Object.entries(config.fields)) {
    values[name] = resolveValue(name, field, payload, context, true);
  }
  if (!isFilled(values.UsuClave) || String(values.UsuClave).length < 8) {
    throw new SecurityError(400, 'VALIDATION_ERROR', 'UsuClave debe tener al menos 8 caracteres.');
  }
  parseRut(`${values.UsuRut}-${values.UsuDV}`);

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const duplicate = await transaction.request()
      .input('login', sql.VarChar(10), values.UsuLogin)
      .input('rut', sql.Int, values.UsuRut)
      .query('SELECT TOP (1) 1 AS found FROM USUARIOS WHERE RTRIM(UsuLogin)=@login OR UsuRut=@rut');
    if (duplicate.recordset.length) {
      throw new SecurityError(409, 'DUPLICATE_USER', 'Ya existe un usuario con ese login o RUT.');
    }

    const company = await transaction.request().input('empCod', sql.Int, context.empCod)
      .query('SELECT TOP (1) 1 AS found FROM DEFEMP WHERE EmpCod=@empCod');
    if (!company.recordset.length) throw new SecurityError(400, 'INVALID_COMPANY', 'La empresa de la sesion no existe en DEFEMP.');

    await transaction.request()
      .input('login', sql.VarChar(10), values.UsuLogin)
      .input('rut', sql.Int, values.UsuRut)
      .input('dv', sql.VarChar(1), values.UsuDV)
      .input('name', sql.VarChar(35), values.Usunom)
      .input('position', sql.VarChar(30), values.UsuCargo)
      .input('expires', sql.DateTime2, values.UsuExpira)
      .input('creator', sql.VarChar(10), values.usucrea)
      .input('level', sql.Int, values.UsuNseg)
      .input('email', sql.VarChar(30), values.UsuCorreo)
      .query(`
        INSERT INTO USUARIOS
          (UsuLogin,UsuClave,UsuRut,UsuDV,Usunom,UsuCargo,UsuExpira,usucrea,UsuNseg,UsuCorreo)
        VALUES
          (@login,NULL,@rut,@dv,@name,@position,@expires,@creator,@level,@email)
      `);

    await transaction.request()
      .input('empCod', sql.Int, context.empCod)
      .input('login', sql.VarChar(10), values.UsuLogin)
      .input('status', sql.Int, values.UsuEstado)
      .input('profile', sql.VarChar(10), values.UsuPerfil)
      .input('type', sql.Int, values.UsuTipo)
      .input('creator', sql.VarChar(10), context.login)
      .query(`
        INSERT INTO SEGUSUEMP
          (GECODEMP,UsuLogin,UsuEstado,UsuPerfil,UsuTipo,EsPrincipal,UsuCrea)
        VALUES (@empCod,@login,@status,@profile,@type,1,@creator)
      `);

    await storeModernPassword(transaction, values.UsuLogin, values.UsuClave);
    await transaction.commit();
    return { message: 'Usuario creado correctamente.' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const insert = async (catalogName, payload, context) => {
  if (catalogName === 'usuarios') return insertUser(payload, context);

  const config = getCatalog(catalogName);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const values = {};
    for (const [name, field] of Object.entries(config.fields)) values[name] = resolveValue(name, field, payload, context, true);
    await assertReferences(transaction, config, values);
    await enrichValues(transaction, catalogName, values, context);
    const writable = Object.keys(config.fields).filter((name) => !config.fields[name].serverManaged && isFilled(values[name]));
    const request = transaction.request();
    writable.forEach((name) => bind(request, name, config.fields[name], values[name]));
    await request.query(`INSERT INTO ${quote(config.table)} (${writable.map(quote).join(', ')}) VALUES (${writable.map((name) => `@${name}`).join(', ')})`);

    if (catalogName === 'rolesUsuarios') {
      await materializeRolePermissions(transaction, {
        empCod: values.GECODEMP,
        login: values.UsuLogin,
        role: values.ROLCod,
        actor: context.login
      });
    }
    await transaction.commit();
    return { message: `${config.gxObject} creado correctamente.` };
  } catch (error) {
    await transaction.rollback();
    if ([2601, 2627].includes(error.number)) throw new SecurityError(409, 'DUPLICATE_KEY', 'Ya existe un registro con esa clave.');
    throw error;
  }
};

const updateUser = async (payload, context) => {
  const login = validateValue('UsuLogin', catalogs.usuarios.fields.UsuLogin, payload.UsuLogin);
  if (!isFilled(login)) throw new SecurityError(400, 'VALIDATION_ERROR', 'UsuLogin es obligatorio.');

  const editable = ['UsuRut', 'UsuDV', 'Usunom', 'UsuCargo', 'UsuExpira', 'UsuNseg', 'UsuCorreo', 'UsuEstado', 'UsuPerfil', 'UsuTipo'];
  const hasChanges = editable.some((name) => isFilled(payload[name])) || isFilled(payload.UsuClave);
  if (!hasChanges) throw new SecurityError(400, 'NO_CHANGES', 'No hay campos para actualizar.');

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const current = await transaction.request()
      .input('empCod', sql.Int, context.empCod)
      .input('login', sql.VarChar(10), login)
      .query(`
        SELECT U.UsuRut,U.UsuDV,U.Usunom,U.UsuCargo,U.UsuExpira,U.UsuNseg,U.UsuCorreo,
               UE.UsuEstado,UE.UsuPerfil,UE.UsuTipo
        FROM USUARIOS U INNER JOIN SEGUSUEMP UE ON UE.UsuLogin=U.UsuLogin
        WHERE UE.GECODEMP=@empCod AND RTRIM(U.UsuLogin)=@login
      `);
    if (!current.recordset[0]) throw new SecurityError(404, 'NOT_FOUND', 'El usuario no existe en la empresa.');

    const row = current.recordset[0];
    const value = (name) => isFilled(payload[name])
      ? validateValue(name, catalogs.usuarios.fields[name], payload[name])
      : row[name];
    const values = Object.fromEntries(editable.map((name) => [name, value(name)]));
    parseRut(`${values.UsuRut}-${String(values.UsuDV || '').trim()}`);

    await transaction.request()
      .input('login', sql.VarChar(10), login)
      .input('rut', sql.Int, values.UsuRut)
      .input('dv', sql.VarChar(1), String(values.UsuDV || '').trim())
      .input('name', sql.VarChar(35), String(values.Usunom || '').trim())
      .input('position', sql.VarChar(30), String(values.UsuCargo || '').trim())
      .input('expires', sql.DateTime2, values.UsuExpira)
      .input('level', sql.Int, values.UsuNseg)
      .input('email', sql.VarChar(30), String(values.UsuCorreo || '').trim())
      .query(`
        UPDATE USUARIOS SET UsuRut=@rut,UsuDV=@dv,Usunom=@name,UsuCargo=@position,
          UsuExpira=@expires,UsuNseg=@level,UsuCorreo=@email
        WHERE RTRIM(UsuLogin)=@login
      `);

    await transaction.request()
      .input('empCod', sql.Int, context.empCod)
      .input('login', sql.VarChar(10), login)
      .input('status', sql.Int, values.UsuEstado)
      .input('profile', sql.VarChar(10), String(values.UsuPerfil || '').trim())
      .input('type', sql.Int, values.UsuTipo)
      .query(`
        UPDATE SEGUSUEMP SET UsuEstado=@status,UsuPerfil=@profile,UsuTipo=@type
        WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login
      `);

    if (isFilled(payload.UsuClave)) {
      const password = String(payload.UsuClave);
      if (password.length < 8 || password.length > 64) {
        throw new SecurityError(400, 'VALIDATION_ERROR', 'UsuClave debe tener entre 8 y 64 caracteres.');
      }
      await storeModernPassword(transaction, login, password);
    }

    await transaction.commit();
    return { message: 'Usuario actualizado correctamente.' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const update = async (catalogName, payload, context) => {
  if (catalogName === 'usuarios') return updateUser(payload, context);

  const config = getCatalog(catalogName);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const request = transaction.request();
    const where = [];
    for (const name of config.primaryKey) {
      const field = config.fields[name];
      const value = field.serverValue === 'contextCompany' ? context.empCod : validateValue(name, field, payload[name]);
      if (!isFilled(value)) throw new SecurityError(400, 'VALIDATION_ERROR', `${name} es obligatorio.`);
      bind(request, `key_${name}`, field, value);
      where.push(`${quote(name)}=@key_${name}`);
    }

    const sets = [];
    for (const [name, field] of Object.entries(config.fields)) {
      if (config.primaryKey.includes(name) || field.serverManaged || field.serverValue || field.serverValueOnInsert || !isFilled(payload[name])) continue;
      const value = validateValue(name, field, payload[name]);
      bind(request, `value_${name}`, field, value);
      sets.push(`${quote(name)}=@value_${name}`);
    }
    if (!sets.length) throw new SecurityError(400, 'NO_CHANGES', 'No hay campos para actualizar.');
    const result = await request.query(`UPDATE ${quote(config.table)} SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`);
    if (!result.rowsAffected[0]) throw new SecurityError(404, 'NOT_FOUND', 'El registro no existe.');

    await transaction.commit();
    return { message: `${config.gxObject} actualizado correctamente.` };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const dependencyChecks = {
  roles: [{ table: 'URolesPorUser', column: 'ROLCod', source: 'ROLCod' }],
  sistemas: [{ table: 'MODULOS', column: 'SistCod', source: 'SistCod' }, { table: 'ASIGSIST', column: 'SistCod', source: 'SistCod' }],
  modulos: [{ table: 'PROGRAM', pairs: [['SistCod', 'SistCod'], ['Modcod', 'Modcod']] }, { table: 'ASIG', pairs: [['SistCod', 'SistCod'], ['AsigMod', 'Modcod']] }],
  programas: [{ table: 'ASIGPROG', pairs: [['SistCod', 'SistCod'], ['Modcod', 'Modcod'], ['ProgCod', 'ProgCod']] }],
  programaAcciones: [{ table: 'ASIGPROG1', pairs: [['SistCod', 'SistCod'], ['Modcod', 'Modcod'], ['ProgCod', 'ProgCod'], ['ProgOPCod', 'ProgOPCod']] }],
  asignacionesSistemas: [{ table: 'ASIG', pairs: [['GECODEMP', 'GECODEMP'], ['AsigUsu', 'AsgSisLogin'], ['SistCod', 'SistCod']] }],
  asignacionesModulos: [{ table: 'ASIGPROG', pairs: [['GECODEMP', 'GECODEMP'], ['UsuLogin', 'AsigUsu'], ['SistCod', 'SistCod'], ['Modcod', 'AsigMod']] }]
};

const removeUser = async (payload, context) => {
  const login = validateValue('UsuLogin', catalogs.usuarios.fields.UsuLogin, payload.UsuLogin);
  if (!isFilled(login)) throw new SecurityError(400, 'VALIDATION_ERROR', 'UsuLogin es obligatorio.');

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const membership = await transaction.request()
      .input('empCod', sql.Int, context.empCod)
      .input('login', sql.VarChar(10), login)
      .query('SELECT TOP (1) 1 AS found FROM SEGUSUEMP WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login');
    if (!membership.recordset.length) throw new SecurityError(404, 'NOT_FOUND', 'El usuario no existe en la empresa.');

    const assignments = await transaction.request()
      .input('empCod', sql.Int, context.empCod)
      .input('login', sql.VarChar(10), login)
      .query(`
        SELECT TOP (1) 1 AS found FROM (
          SELECT AsgSisLogin AS Login FROM ASIGSIST WHERE GECODEMP=@empCod
          UNION ALL SELECT AsigUsu FROM ASIG WHERE GECODEMP=@empCod
          UNION ALL SELECT UsuLogin FROM ASIGPROG WHERE GECODEMP=@empCod
          UNION ALL SELECT UsuLogin FROM ASIGPROG1 WHERE GECODEMP=@empCod
        ) A
        WHERE RTRIM(REPLACE(A.Login,CHAR(160),' '))=@login
      `);
    if (assignments.recordset.length) {
      throw new SecurityError(409, 'RECORD_IN_USE', 'No se puede eliminar: el usuario conserva asignaciones GX8.');
    }

    await transaction.request()
      .input('empCod', sql.Int, context.empCod)
      .input('login', sql.VarChar(10), login)
      .query(`
        DELETE FROM URolesPorUser WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login;
        DELETE FROM SEGSESION WHERE EmpCod=@empCod AND RTRIM(UsuLogin)=@login;
        DELETE FROM SEGUSUEMP WHERE GECODEMP=@empCod AND RTRIM(UsuLogin)=@login;
      `);

    const remaining = await transaction.request().input('login', sql.VarChar(10), login)
      .query('SELECT COUNT(*) AS total FROM SEGUSUEMP WHERE RTRIM(UsuLogin)=@login');
    if (Number(remaining.recordset[0].total) === 0) {
      await transaction.request().input('login', sql.VarChar(10), login).query(`
        DELETE FROM SEGUSUCRED WHERE RTRIM(UsuLogin)=@login;
        DELETE FROM USUARIOS WHERE RTRIM(UsuLogin)=@login;
      `);
    }

    await transaction.commit();
    return { message: 'Usuario eliminado correctamente.' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const remove = async (catalogName, payload, context) => {
  if (catalogName === 'usuarios') return removeUser(payload, context);

  const config = getCatalog(catalogName);
  const values = {};
  for (const name of config.primaryKey) {
    const field = config.fields[name];
    values[name] = field.serverValue === 'contextCompany' ? context.empCod : validateValue(name, field, payload[name]);
    if (!isFilled(values[name])) throw new SecurityError(400, 'VALIDATION_ERROR', `${name} es obligatorio.`);
  }
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    if (catalogName === 'rolesUsuarios') {
      await removeRoleAssignment(transaction, {
        empCod: values.GECODEMP,
        login: values.UsuLogin,
        role: values.ROLCod,
        actor: context.login
      });
      await transaction.commit();
      return { message: 'URolesPorUser eliminado correctamente.' };
    }

    if (catalogName === 'roles') {
      const templates = await transaction.request().input('role', sql.VarChar(10), values.ROLCod).query(`
        SELECT TOP (1) 1 AS found
        FROM (
          SELECT AsigUsu AS role FROM ASIG WHERE GECODEMP=0
          UNION ALL
          SELECT UsuLogin AS role FROM ASIGPROG WHERE GECODEMP=0
          UNION ALL
          SELECT UsuLogin AS role FROM ASIGPROG1 WHERE GECODEMP=0
        ) AS templates
        WHERE RTRIM(templates.role)=@role
      `);
      if (templates.recordset.length) {
        throw new SecurityError(409, 'ROLE_HAS_PERMISSIONS', 'No se puede eliminar: el rol tiene permisos plantilla asignados.');
      }
    }

    for (const dependency of dependencyChecks[catalogName] || []) {
      const pairs = dependency.pairs || [[dependency.column, dependency.source]];
      const request = transaction.request();
      const where = pairs.map(([target, source], index) => {
        const field = config.fields[source];
        bind(request, `dep${index}`, field, values[source]);
        return `${quote(target)}=@dep${index}`;
      });
      const result = await request.query(`SELECT TOP (1) 1 AS found FROM ${quote(dependency.table)} WHERE ${where.join(' AND ')}`);
      if (result.recordset.length) throw new SecurityError(409, 'RECORD_IN_USE', `No se puede eliminar: existen registros relacionados en ${dependency.table}.`);
    }

    const request = transaction.request();
    const where = config.primaryKey.map((name) => {
      bind(request, `key_${name}`, config.fields[name], values[name]);
      return `${quote(name)}=@key_${name}`;
    });
    if (catalogName === 'programas') {
      await transaction.request().input('s', sql.Int, values.SistCod).input('m', sql.Int, values.Modcod).input('p', sql.Int, values.ProgCod)
        .query('DELETE FROM PROGRAM1 WHERE SistCod=@s AND Modcod=@m AND ProgCod=@p');
    }
    if (catalogName === 'asignacionesProgramas') {
      await transaction.request().input('e', sql.Int, values.GECODEMP).input('u', sql.VarChar(10), values.UsuLogin)
        .input('s', sql.Int, values.SistCod).input('m', sql.Int, values.Modcod).input('p', sql.Int, values.ProgCod)
        .query('DELETE FROM ASIGPROG1 WHERE GECODEMP=@e AND UsuLogin=@u AND SistCod=@s AND Modcod=@m AND ProgCod=@p');
    }
    const result = await request.query(`DELETE FROM ${quote(config.table)} WHERE ${where.join(' AND ')}`);
    if (!result.rowsAffected[0]) throw new SecurityError(404, 'NOT_FOUND', 'El registro no existe.');
    await transaction.commit();
    return { message: `${config.gxObject} eliminado correctamente.` };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const metadata = () => Object.entries(catalogs).map(([name, config]) => ({
  name,
  gxObject: config.gxObject,
  gxLevel: config.gxLevel || 1,
  table: config.table,
  primaryKey: config.primaryKey
}));

module.exports = { catalogs, list, insert, update, remove, metadata };

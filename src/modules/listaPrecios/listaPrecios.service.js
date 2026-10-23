const { getPool, sql } = require('../../conectorMysql/conectorSqlServer');

const permission = Object.freeze({ sistema: 100, modulo: 9, programa: 10 });
const ACTIONS = Object.freeze({ create: 1, update: 2, annul: 3 });
const PRICE_MAX = 999999999.9999;

class ListaPreciosError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const trim = (value) => String(value ?? '').trim();

const localIsoDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const parseDate = (value, label, { optional = false } = {}) => {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const normalized = trim(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00`))) {
    throw new ListaPreciosError(400, 'VALIDATION_ERROR', `${label} debe ser una fecha válida.`);
  }
  return normalized;
};

const parseInteger = (value, label, { optional = true, min = 0, max = 999999999 } = {}) => {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const normalized = trim(value);
  if (!/^\d+$/.test(normalized)) throw new ListaPreciosError(400, 'VALIDATION_ERROR', `${label} no es válido.`);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ListaPreciosError(400, 'VALIDATION_ERROR', `${label} no es válido.`);
  }
  return parsed;
};

const parsePrice = (value) => {
  const normalized = trim(value).replace(',', '.');
  if (!/^\d+(\.\d{1,4})?$/.test(normalized)) {
    throw new ListaPreciosError(400, 'VALIDATION_ERROR', 'Precio unitario debe ser un número con hasta cuatro decimales.');
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > PRICE_MAX) {
    throw new ListaPreciosError(400, 'VALIDATION_ERROR', 'Precio unitario debe ser mayor que cero.');
  }
  return parsed;
};

const parseKey = (payload = {}) => {
  const validFrom = parseDate(payload.validFrom, 'Fecha desde');
  const validTo = parseDate(payload.validTo, 'Fecha hasta');
  if (validFrom > validTo) throw new ListaPreciosError(400, 'VALIDATION_ERROR', 'La fecha desde no puede ser posterior a la fecha hasta.');
  const caliber = trim(payload.caliber).toUpperCase();
  if (!caliber || caliber.length > 10) throw new ListaPreciosError(400, 'VALIDATION_ERROR', 'Calibre es obligatorio y admite hasta 10 caracteres.');
  return {
    clientCode: parseInteger(payload.clientCode, 'Cliente', { optional: false, max: 99999 }),
    speciesCode: parseInteger(payload.speciesCode, 'Especie', { optional: false, max: 999 }),
    caliber,
    packageCode: parseInteger(payload.packageCode, 'Envase', { optional: false, max: 999 }),
    validFrom,
    validTo,
    currencyCode: parseInteger(payload.currencyCode, 'Moneda', { optional: false, max: 99 })
  };
};

const parseRecord = (payload = {}) => {
  return {
    ...parseKey(payload),
    price: parsePrice(payload.price),
    appliesToAll: payload.appliesToAll === true || Number(payload.appliesToAll) === 1 ? 1 : 0
  };
};

const listFilters = (query = {}, now = new Date()) => {
  const defaultTo = localIsoDate(now);
  const defaultFromDate = new Date(now);
  defaultFromDate.setDate(defaultFromDate.getDate() - 30);
  const defaultFrom = localIsoDate(defaultFromDate);
  const from = Object.prototype.hasOwnProperty.call(query, 'from') && trim(query.from) === ''
    ? null
    : parseDate(query.from || defaultFrom, 'Fecha desde');
  const to = Object.prototype.hasOwnProperty.call(query, 'to') && trim(query.to) === ''
    ? null
    : parseDate(query.to || defaultTo, 'Fecha hasta');

  if (from && to && from > to) {
    throw new ListaPreciosError(400, 'VALIDATION_ERROR', 'La fecha desde no puede ser posterior a la fecha hasta.');
  }

  const allowedStatuses = new Set(['', 'total', 'vigente', 'por-vencer', 'vencido', 'anulado']);
  const status = trim(query.status).toLowerCase();
  if (!allowedStatuses.has(status)) throw new ListaPreciosError(400, 'VALIDATION_ERROR', 'El estado solicitado no es válido.');

  return {
    from,
    to,
    client: parseInteger(query.client, 'Cliente', { max: 99999 }),
    species: parseInteger(query.species, 'Especie', { max: 999 }),
    packageCode: parseInteger(query.packageCode, 'Envase', { max: 999 }),
    currency: parseInteger(query.currency, 'Moneda', { max: 99 }),
    search: trim(query.search).slice(0, 100),
    status,
    all: ['1', 'true'].includes(trim(query.all).toLowerCase()),
    page: parseInteger(query.page ?? 1, 'Página', { optional: false, min: 1, max: 100000 }),
    pageSize: parseInteger(query.pageSize ?? 25, 'Tamaño de página', { optional: false, min: 1, max: 100 })
  };
};

const mapRow = (row) => {
  const from = row.validFrom;
  const to = row.validTo;
  return {
    ...row,
    id: [row.clientCode, row.speciesCode, trim(row.caliber), row.packageCode, from, to, row.currencyCode].join('|'),
    clientCode: Number(row.clientCode),
    speciesCode: Number(row.speciesCode),
    packageCode: Number(row.packageCode),
    currencyCode: Number(row.currencyCode),
    price: Number(row.price || 0),
    appliesToAll: Number(row.appliesToAll || 0) === 1,
    annulled: Number(row.annulled || 0) === 1
  };
};

const baseFrom = `
  FROM LISTPRECIOS p
  LEFT JOIN CLIENTES c ON c.EmpCod=p.EmpCod AND c.CliCod=p.CliCod
  LEFT JOIN ESPECIES e ON e.EmpCod=p.EmpCod AND e.Especod=p.Especod
  LEFT JOIN ENVCAT en ON en.EmpCod=p.EmpCod AND en.EnvCod=p.EnvCod
  LEFT JOIN MONEDAS m ON m.MonCod=p.MonCod
`;

const baseWhere = `
  WHERE p.EmpCod=@EmpCod
    AND (@FromDate IS NULL OR p.LSPFecH >= @FromDate)
    AND (@ToDate IS NULL OR p.LSPFecD < DATEADD(day,1,@ToDate))
    AND (@Client IS NULL OR p.CliCod=@Client)
    AND (@Species IS NULL OR p.Especod=@Species)
    AND (@PackageCode IS NULL OR p.EnvCod=@PackageCode)
    AND (@Currency IS NULL OR p.MonCod=@Currency)
    AND (@Search='' OR CONVERT(varchar(20),p.CliCod) LIKE '%'+@Search+'%'
      OR ISNULL(c.CliNom,'') LIKE '%'+@Search+'%'
      OR ISNULL(e.EspeNom,'') LIKE '%'+@Search+'%'
      OR RTRIM(p.Calibre) LIKE '%'+@Search+'%'
      OR ISNULL(en.EnvNom,'') LIKE '%'+@Search+'%'
      OR ISNULL(m.MonDes,'') LIKE '%'+@Search+'%')
`;

const statusWhere = `
  AND (@Status IN ('','total')
    OR (@Status='vigente' AND ISNULL(p.LSPAnulado,0)=0 AND CONVERT(date,GETDATE()) BETWEEN CONVERT(date,p.LSPFecD) AND CONVERT(date,p.LSPFecH))
    OR (@Status='por-vencer' AND ISNULL(p.LSPAnulado,0)=0 AND CONVERT(date,GETDATE()) BETWEEN CONVERT(date,p.LSPFecD) AND CONVERT(date,p.LSPFecH)
      AND CONVERT(date,p.LSPFecH) <= DATEADD(day,30,CONVERT(date,GETDATE())))
    OR (@Status='vencido' AND ISNULL(p.LSPAnulado,0)=0 AND CONVERT(date,p.LSPFecH) < CONVERT(date,GETDATE()))
    OR (@Status='anulado' AND ISNULL(p.LSPAnulado,0)=1))
`;

const listListaPrecios = async (empCod, query = {}) => {
  const filters = listFilters(query);
  const pool = await getPool();
  const request = pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('FromDate', sql.Date, filters.from)
    .input('ToDate', sql.Date, filters.to)
    .input('Client', sql.Int, filters.client)
    .input('Species', sql.SmallInt, filters.species)
    .input('PackageCode', sql.SmallInt, filters.packageCode)
    .input('Currency', sql.SmallInt, filters.currency)
    .input('Search', sql.NVarChar(100), filters.search)
    .input('Status', sql.VarChar(20), filters.status)
    .input('Offset', sql.Int, (filters.page - 1) * filters.pageSize)
    .input('PageSize', sql.Int, filters.pageSize);

  const result = await request.query(`
    SELECT p.CliCod clientCode,LTRIM(RTRIM(COALESCE(c.CliNom,CASE WHEN p.CliCod=0 THEN 'General' END,''))) clientName,
      p.Especod speciesCode,LTRIM(RTRIM(ISNULL(e.EspeNom,''))) speciesName,RTRIM(p.Calibre) caliber,
      p.EnvCod packageCode,LTRIM(RTRIM(ISNULL(en.EnvNom,''))) packageName,
      CONVERT(char(10),p.LSPFecD,23) validFrom,CONVERT(char(10),p.LSPFecH,23) validTo,
      p.MonCod currencyCode,LTRIM(RTRIM(ISNULL(m.MonDes,''))) currencyName,p.LSPPrecioU price,p.LSPIndTodos appliesToAll,
      ISNULL(p.LSPAnulado,0) annulled,RTRIM(ISNULL(p.LSPLoginC,'')) createdBy,CONVERT(char(19),p.LSPFecC,120) createdAt,
      RTRIM(ISNULL(p.LSPLoginM,'')) modifiedBy,CONVERT(char(19),p.LSPFecM,120) modifiedAt,
      RTRIM(ISNULL(p.LSPLoginA,'')) annulledBy,CONVERT(char(19),p.LSPFecA,120) annulledAt
    ${baseFrom} ${baseWhere} ${statusWhere}
    ORDER BY p.LSPFecD DESC,p.LSPFecH DESC,p.CliCod,p.Especod,p.Calibre,p.EnvCod,p.MonCod
    ${filters.all ? ';' : 'OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;'}

    SELECT COUNT_BIG(1) total,
      SUM(CASE WHEN ISNULL(p.LSPAnulado,0)=0 AND CONVERT(date,GETDATE()) BETWEEN CONVERT(date,p.LSPFecD) AND CONVERT(date,p.LSPFecH) THEN 1 ELSE 0 END) currentCount,
      SUM(CASE WHEN ISNULL(p.LSPAnulado,0)=0 AND CONVERT(date,GETDATE()) BETWEEN CONVERT(date,p.LSPFecD) AND CONVERT(date,p.LSPFecH)
        AND CONVERT(date,p.LSPFecH) <= DATEADD(day,30,CONVERT(date,GETDATE())) THEN 1 ELSE 0 END) expiringCount,
      SUM(CASE WHEN ISNULL(p.LSPAnulado,0)=0 AND CONVERT(date,p.LSPFecH) < CONVERT(date,GETDATE()) THEN 1 ELSE 0 END) expiredCount,
      SUM(CASE WHEN ISNULL(p.LSPAnulado,0)=1 THEN 1 ELSE 0 END) annulledCount
    ${baseFrom} ${baseWhere};
  `);

  const summary = result.recordsets[1]?.[0] || {};
  return {
    rows: (result.recordsets[0] || []).map(mapRow),
    total: filters.status ? (result.recordsets[0] || []).length : Number(summary.total || 0),
    metrics: {
      total: Number(summary.total || 0),
      current: Number(summary.currentCount || 0),
      expiring: Number(summary.expiringCount || 0),
      expired: Number(summary.expiredCount || 0),
      annulled: Number(summary.annulledCount || 0)
    },
    page: filters.page,
    pageSize: filters.pageSize
  };
};

const getListaPreciosCatalogs = async (empCod) => {
  const pool = await getPool();
  const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
    SELECT CliCod code,LTRIM(RTRIM(ISNULL(CliNom,''))) name FROM CLIENTES WHERE EmpCod=@EmpCod AND CliCod<>0 ORDER BY CliNom,CliCod;
    SELECT Especod code,LTRIM(RTRIM(ISNULL(EspeNom,''))) name FROM ESPECIES WHERE EmpCod=@EmpCod ORDER BY EspeNom,Especod;
    SELECT EnvCod code,LTRIM(RTRIM(ISNULL(EnvNom,''))) name FROM ENVCAT WHERE EmpCod=@EmpCod ORDER BY EnvNom,EnvCod;
    SELECT MonCod code,LTRIM(RTRIM(ISNULL(MonDes,''))) name FROM MONEDAS ORDER BY MonDes,MonCod;
    SELECT Especod speciesCode,RTRIM(Calibre) code FROM CALIBRES WHERE EmpCod=@EmpCod ORDER BY Especod,CalOrden,Calibre;
  `);
  return {
    clients: [{ code: 0, name: 'General' }, ...(result.recordsets[0] || [])],
    species: result.recordsets[1] || [],
    packages: result.recordsets[2] || [],
    currencies: result.recordsets[3] || [],
    calibers: result.recordsets[4] || []
  };
};

const bindKey = (request, record) => request
  .input('ClientCode', sql.Int, record.clientCode)
  .input('SpeciesCode', sql.SmallInt, record.speciesCode)
  .input('Caliber', sql.Char(10), record.caliber)
  .input('PackageCode', sql.SmallInt, record.packageCode)
  .input('ValidFrom', sql.DateTime, record.validFrom)
  .input('ValidTo', sql.DateTime, record.validTo)
  .input('CurrencyCode', sql.SmallInt, record.currencyCode);

const keyWhere = `EmpCod=@EmpCod AND CliCod=@ClientCode AND Especod=@SpeciesCode AND Calibre=@Caliber
  AND EnvCod=@PackageCode AND LSPFecD=@ValidFrom AND LSPFecH=@ValidTo AND MonCod=@CurrencyCode`;

const validateCatalogs = async (transaction, empCod, record) => {
  const request = bindKey(transaction.request().input('EmpCod', sql.SmallInt, empCod), record);
  const result = await request.query(`
    SELECT
      CASE WHEN @ClientCode=0 OR EXISTS(SELECT 1 FROM CLIENTES WHERE EmpCod=@EmpCod AND CliCod=@ClientCode) THEN 1 ELSE 0 END clientOk,
      CASE WHEN EXISTS(SELECT 1 FROM ESPECIES WHERE EmpCod=@EmpCod AND Especod=@SpeciesCode) THEN 1 ELSE 0 END speciesOk,
      CASE WHEN EXISTS(SELECT 1 FROM CALIBRES WHERE EmpCod=@EmpCod AND Especod=@SpeciesCode AND Calibre=@Caliber) THEN 1 ELSE 0 END caliberOk,
      CASE WHEN EXISTS(SELECT 1 FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@PackageCode) THEN 1 ELSE 0 END packageOk,
      CASE WHEN EXISTS(SELECT 1 FROM MONEDAS WHERE MonCod=@CurrencyCode) THEN 1 ELSE 0 END currencyOk;
  `);
  const validation = result.recordset[0] || {};
  const invalid = [['clientOk', 'Cliente'], ['speciesOk', 'Especie'], ['caliberOk', 'Calibre'], ['packageOk', 'Envase'], ['currencyOk', 'Moneda']]
    .find(([field]) => Number(validation[field]) !== 1);
  if (invalid) throw new ListaPreciosError(400, 'VALIDATION_ERROR', `${invalid[1]} no pertenece al catálogo permitido.`);
};

const createListaPrecio = async (empCod, login, payload) => {
  const record = parseRecord(payload);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await validateCatalogs(transaction, empCod, record);
    const request = bindKey(transaction.request().input('EmpCod', sql.SmallInt, empCod), record)
      .input('Price', sql.Money, record.price)
      .input('AppliesToAll', sql.SmallInt, record.appliesToAll)
      .input('Login', sql.VarChar(10), trim(login).slice(0, 10));
    const existing = await request.query(`SELECT TOP 1 1 found FROM LISTPRECIOS WITH (UPDLOCK,HOLDLOCK) WHERE ${keyWhere}`);
    if (existing.recordset.length) throw new ListaPreciosError(409, 'DUPLICATE_PRICE', 'Ya existe un precio con la misma clave y vigencia.');
    await request.query(`INSERT INTO LISTPRECIOS
      (EmpCod,CliCod,Especod,Calibre,EnvCod,LSPFecD,LSPFecH,MonCod,LSPPrecioU,LSPIndTodos,LSPAnulado,LSPLoginC,LSPFecC)
      VALUES (@EmpCod,@ClientCode,@SpeciesCode,@Caliber,@PackageCode,@ValidFrom,@ValidTo,@CurrencyCode,@Price,@AppliesToAll,0,@Login,GETDATE())`);
    await transaction.commit();
    return { message: 'Precio agregado correctamente.' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateListaPrecio = async (empCod, login, payload) => {
  const record = parseRecord(payload);
  const pool = await getPool();
  const request = bindKey(pool.request().input('EmpCod', sql.SmallInt, empCod), record)
    .input('Price', sql.Money, record.price)
    .input('AppliesToAll', sql.SmallInt, record.appliesToAll)
    .input('Login', sql.VarChar(10), trim(login).slice(0, 10));
  const result = await request.query(`UPDATE LISTPRECIOS SET LSPPrecioU=@Price,LSPIndTodos=@AppliesToAll,LSPLoginM=@Login,LSPFecM=GETDATE()
    WHERE ${keyWhere} AND ISNULL(LSPAnulado,0)=0`);
  if (!result.rowsAffected[0]) throw new ListaPreciosError(409, 'PRICE_NOT_EDITABLE', 'El precio no existe o se encuentra anulado.');
  return { message: 'Precio modificado correctamente.' };
};

const annulListaPrecio = async (empCod, login, payload) => {
  const record = parseKey(payload);
  const pool = await getPool();
  const request = bindKey(pool.request().input('EmpCod', sql.SmallInt, empCod), record)
    .input('Login', sql.VarChar(10), trim(login).slice(0, 10));
  const result = await request.query(`UPDATE LISTPRECIOS SET LSPAnulado=1,LSPLoginA=@Login,LSPFecA=GETDATE()
    WHERE ${keyWhere} AND ISNULL(LSPAnulado,0)=0`);
  if (!result.rowsAffected[0]) throw new ListaPreciosError(409, 'PRICE_NOT_ANNULABLE', 'El precio no existe o ya se encuentra anulado.');
  return { message: 'Precio anulado correctamente.' };
};

module.exports = {
  ListaPreciosError,
  permission,
  ACTIONS,
  listFilters,
  parseKey,
  parseRecord,
  listListaPrecios,
  getListaPreciosCatalogs,
  createListaPrecio,
  updateListaPrecio,
  annulListaPrecio
};

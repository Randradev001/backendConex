const { getPool, sql } = require('../../conectorMysql/conectorSqlServer');
const { nextCorrelative } = require('../../services/gxCorrelatives.service');

const permission = Object.freeze({ sistema: 100, modulo: 2, programa: 6 });
const ACTIONS = Object.freeze({ create: 1, update: 2, annul: 3 });

class FrutaComercialError extends Error {
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

const isoDate = (value, label, { optional = false } = {}) => {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const raw = trim(value).slice(0, 10);
  const display = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = display ? `${display[3]}-${display[2]}-${display[1]}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00`))) {
    throw new FrutaComercialError(400, 'VALIDATION_ERROR', `${label} debe ser una fecha válida.`);
  }
  return normalized;
};

const integer = (value, label, { optional = false, min = 0, max = 9999999999 } = {}) => {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const raw = trim(value);
  if (!/^-?\d+$/.test(raw)) throw new FrutaComercialError(400, 'VALIDATION_ERROR', `${label} debe ser un número entero.`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new FrutaComercialError(400, 'VALIDATION_ERROR', `${label} debe tener entre 0 y ${max.toLocaleString('es-CL')} dígitos.`);
  }
  return parsed;
};

const decimal = (value, label, { min = 0, max = 99999999.99 } = {}) => {
  const raw = trim(value).replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new FrutaComercialError(400, 'VALIDATION_ERROR', `${label} debe ser un número con hasta dos decimales.`);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new FrutaComercialError(400, 'VALIDATION_ERROR', `${label} debe estar entre ${min} y ${max}.`);
  }
  return parsed;
};

const text = (value, label, { required = false, max = 255 } = {}) => {
  const parsed = trim(value);
  if (required && !parsed) throw new FrutaComercialError(400, 'VALIDATION_ERROR', `${label} es obligatorio.`);
  if (parsed.length > max) throw new FrutaComercialError(400, 'VALIDATION_ERROR', `${label} no puede superar ${max} caracteres.`);
  return parsed;
};

const listFilters = (query = {}, now = new Date()) => {
  const toDefault = localIsoDate(now);
  const fromDefault = localIsoDate(new Date(now.getTime() - 30 * 86400000));
  const from = isoDate(query.from || fromDefault, 'Fecha desde');
  const to = isoDate(query.to || toDefault, 'Fecha hasta');
  if (from > to) throw new FrutaComercialError(400, 'VALIDATION_ERROR', 'La fecha desde no puede ser posterior a la fecha hasta.');
  return {
    from,
    to,
    process: integer(query.process || 0, 'Proceso', { max: 9999999999 }),
    species: integer(query.species || 0, 'Especie', { max: 999 }),
    movement: integer(query.movement === undefined || query.movement === '' ? -1 : query.movement, 'Movimiento', { min: -1, max: 99 }),
    page: integer(query.page || 1, 'Página', { min: 1, max: 100000 }),
    pageSize: integer(query.pageSize || 25, 'Tamaño de página', { min: 1, max: 100 })
  };
};

const activeSeason = async (request, empCod) => {
  const result = await request.input('EmpCod', sql.SmallInt, empCod).query(
    'SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC'
  );
  const tempCod = result.recordset[0]?.tempCod;
  if (!tempCod) throw new FrutaComercialError(409, 'ACTIVE_SEASON_NOT_FOUND', 'No existe una temporada activa para la empresa.');
  return tempCod;
};

const mapRow = (row) => ({
  ...row,
  id: `${row.fcoProceso}|${row.fcoNumI}`,
  fcoProceso: Number(row.fcoProceso),
  fcoNumI: Number(row.fcoNumI),
  tmCod: row.tmCod === null ? null : Number(row.tmCod),
  tmsCod: row.tmsCod === null ? null : Number(row.tmsCod),
  speciesCode: row.speciesCode === null ? null : Number(row.speciesCode),
  kilos: row.kilos === null ? null : Number(row.kilos),
  fcoOrigen: row.fcoOrigen === null ? null : Number(row.fcoOrigen),
  canEdit: Number(row.fcoOrigen) === 0
});

const baseSelect = `
    SELECT f.EmpCod empCod,RTRIM(f.TempCod) tempCod,f.FCOProceso fcoProceso,f.FCONumI fcoNumI,
    CONVERT(char(10),f.FCOFecha,23) fcoFecha,RTRIM(f.FCOLoginI) createdLogin,
    CONVERT(char(10),f.FCOFecC,23) createdDate,f.TMcod tmCod,RTRIM(tm.TMNom) tmName,
    f.TMSCod tmsCod,RTRIM(st.TMSNom) tmsName,f.FCONEnv fconEnv,f.FCOKilos kilos,
    f.Especod speciesCode,RTRIM(e.EspeNom) speciesName,f.FCOOBS observation,
    f.FCOOrigen fcoOrigen
  FROM FCOMERCIAL f
    LEFT JOIN ESPECIES e ON e.EmpCod=f.EmpCod AND e.Especod=f.Especod
    LEFT JOIN TIPMOV tm ON tm.EmpCod=f.EmpCod AND tm.TMcod=f.TMcod
    LEFT JOIN TIPMOV1 st ON st.EmpCod=f.EmpCod AND st.TMcod=f.TMcod AND st.TMSCod=f.TMSCod
`;

const getFormData = async (empCod) => {
  const pool = await getPool();
  const request = pool.request();
  const tempCod = await activeSeason(request, empCod);
  const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
    SELECT Especod code,RTRIM(EspeNom) name FROM ESPECIES WHERE EmpCod=@EmpCod ORDER BY EspeNom,Especod;
    SELECT TMcod code,RTRIM(TMNom) name FROM TIPMOV WHERE EmpCod=@EmpCod ORDER BY TMNom,TMcod;
    SELECT TMcod movementCode,TMSCod code,RTRIM(TMSNom) name FROM TIPMOV1 WHERE EmpCod=@EmpCod ORDER BY TMcod,TMSNom,TMSCod;
  `);
  return { tempCod, species: result.recordsets[0] || [], movements: result.recordsets[1] || [], subMovements: result.recordsets[2] || [] };
};

const listFrutaComercial = async (empCod, query = {}) => {
  const filters = listFilters(query);
  const pool = await getPool();
  const request = pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('FromDate', sql.Date, filters.from)
    .input('ToDate', sql.Date, filters.to)
    .input('Process', sql.Decimal(10, 0), filters.process || null)
    .input('Species', sql.SmallInt, filters.species || null)
    .input('Movement', sql.SmallInt, filters.movement === -1 ? null : filters.movement)
    .input('Offset', sql.Int, (filters.page - 1) * filters.pageSize)
    .input('PageSize', sql.Int, filters.pageSize);
  const where = `WHERE f.EmpCod=@EmpCod AND f.TempCod=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC)
    AND f.FCOFecha >= @FromDate AND f.FCOFecha < DATEADD(day,1,@ToDate)
    AND (@Process IS NULL OR f.FCOProceso=@Process) AND (@Species IS NULL OR f.Especod=@Species)
    AND (@Movement IS NULL OR f.TMcod=@Movement)`;
  const result = await request.query(`
    ${baseSelect} ${where}
    ORDER BY f.EmpCod,f.TempCod,f.FCOFecha,f.FCOProceso,f.Especod
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT_BIG(1) total,
      COALESCE(SUM(CASE WHEN f.TMcod=1 THEN f.FCOKilos ELSE 0 END),0) totalEntries,
      COALESCE(SUM(CASE WHEN f.TMcod<>1 OR f.TMcod IS NULL THEN f.FCOKilos ELSE 0 END),0) totalExits
    FROM FCOMERCIAL f ${where};
  `);
  const summary = result.recordsets[1]?.[0] || {};
  const totalEntries = Number(summary.totalEntries || 0);
  const totalExits = Number(summary.totalExits || 0);
  return {
    rows: (result.recordsets[0] || []).map(mapRow),
    total: Number(summary.total || 0),
    tempCod: (await activeSeason(pool.request(), empCod)),
    filters,
    totals: { entries: totalEntries, exits: totalExits, balance: totalEntries - totalExits }
  };
};

const getFrutaComercial = async (empCod, process, entryNumber) => {
  const fcoProceso = integer(process, 'Proceso', { min: 1 });
  const fcoNumI = integer(entryNumber, 'N° ingreso', { min: 1 });
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const request = pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('Process', sql.Decimal(10, 0), fcoProceso)
    .input('EntryNumber', sql.Decimal(10, 0), fcoNumI);
  const result = await request.query(`${baseSelect} WHERE f.EmpCod=@EmpCod AND f.TempCod=@TempCod AND f.FCOProceso=@Process AND f.FCONumI=@EntryNumber;`);
  const row = result.recordset[0];
  if (!row) throw new FrutaComercialError(404, 'NOT_FOUND', 'El registro de fruta comercial no existe.');
  return mapRow(row);
};

const validateReferences = async (request, empCod, species, movement, subMovement) => {
  const result = await request
    .input('EmpCod', sql.SmallInt, empCod)
    .input('Species', sql.SmallInt, species)
    .input('Movement', sql.SmallInt, movement)
    .input('SubMovement', sql.SmallInt, subMovement)
    .query(`
      SELECT TOP 1 Especod FROM ESPECIES WHERE EmpCod=@EmpCod AND Especod=@Species;
      SELECT TOP 1 TMcod FROM TIPMOV WHERE EmpCod=@EmpCod AND TMcod=@Movement;
      SELECT TOP 1 TMSCod FROM TIPMOV1 WHERE EmpCod=@EmpCod AND TMcod=@Movement AND TMSCod=@SubMovement;
    `);
  if (!result.recordsets[0]?.[0]) throw new FrutaComercialError(400, 'SPECIES_NOT_FOUND', 'La especie no existe para la empresa.');
  if (!result.recordsets[1]?.[0]) throw new FrutaComercialError(400, 'MOVEMENT_NOT_FOUND', 'El movimiento no existe para la empresa.');
  if (!result.recordsets[2]?.[0]) throw new FrutaComercialError(400, 'SUB_MOVEMENT_NOT_FOUND', 'El submovimiento no corresponde al movimiento seleccionado.');
};

const normalizePayload = (payload = {}) => ({
  entryNumber: integer(payload.fcoNumI ?? payload.entryNumber, 'N° ingreso', { min: 1, max: 9999999999 }),
  date: isoDate(payload.fcoFecha || payload.date || localIsoDate(), 'Fecha'),
  movement: integer(payload.tmCod ?? payload.movement, 'Movimiento', { min: 0, max: 99 }),
  subMovement: integer(payload.tmsCod ?? payload.subMovement, 'Submovimiento', { min: 0, max: 99 }),
  species: integer(payload.speciesCode ?? payload.especod ?? payload.species, 'Especie', { min: 0, max: 999 }),
  kilos: decimal(payload.kilos ?? payload.fcoKilos, 'Kilos', { min: 0.01 }),
  observation: text(payload.observation ?? payload.fcoObs, 'Observación', { max: 50 })
});

const createFrutaComercial = async (empCod, login, payload) => {
  const values = normalizePayload(payload);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const request = new sql.Request(transaction);
    const tempCod = await activeSeason(request, empCod);
    await validateReferences(new sql.Request(transaction), empCod, values.species, values.movement, values.subMovement);
    const process = await nextCorrelative({ transaction, empCod, code: 'FCOMERCI', digits: 10 });
    await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TempCod', sql.Char(9), tempCod)
      .input('Process', sql.Decimal(10, 0), process)
      .input('EntryNumber', sql.Decimal(10, 0), values.entryNumber)
      .input('Date', sql.Date, values.date)
      .input('Login', sql.Char(10), trim(login).slice(0, 10))
      .input('Movement', sql.SmallInt, values.movement)
      .input('SubMovement', sql.SmallInt, values.subMovement)
      .input('Kilos', sql.Decimal(10, 2), values.kilos)
      .input('Species', sql.SmallInt, values.species)
      .input('Observation', sql.Char(50), values.observation || null)
      .query(`INSERT INTO FCOMERCIAL
        (EmpCod,TempCod,FCOProceso,FCONumI,FCOFecha,FCOLoginI,FCOFecC,TMcod,TMSCod,FCOKilos,Especod,FCOOBS,FCOOrigen)
        VALUES (@EmpCod,@TempCod,@Process,@EntryNumber,@Date,@Login,GETDATE(),@Movement,@SubMovement,@Kilos,@Species,@Observation,0);`);
    await transaction.commit();
    return getFrutaComercial(empCod, process, values.entryNumber);
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const assertEditable = (row) => {
  if (row.fcoOrigen !== 0) throw new FrutaComercialError(409, 'LEGACY_ROW_READ_ONLY', 'Los registros históricos o provenientes de despachos no se pueden modificar ni anular.');
};

const updateFrutaComercial = async (empCod, process, entryNumber, payload) => {
  const current = await getFrutaComercial(empCod, process, entryNumber);
  assertEditable(current);
  const values = normalizePayload({ ...payload, fcoNumI: current.fcoNumI });
  const pool = await getPool();
  await validateReferences(pool.request(), empCod, values.species, values.movement, values.subMovement);
  await pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('Process', sql.Decimal(10, 0), current.fcoProceso)
    .input('EntryNumber', sql.Decimal(10, 0), current.fcoNumI)
    .input('Date', sql.Date, values.date)
    .input('Movement', sql.SmallInt, values.movement)
    .input('SubMovement', sql.SmallInt, values.subMovement)
    .input('Kilos', sql.Decimal(10, 2), values.kilos)
    .input('Species', sql.SmallInt, values.species)
    .input('Observation', sql.Char(50), values.observation || null)
    .query(`UPDATE FCOMERCIAL SET FCOFecha=@Date,TMcod=@Movement,TMSCod=@SubMovement,FCOKilos=@Kilos,Especod=@Species,FCOOBS=@Observation
      WHERE EmpCod=@EmpCod AND FCOProceso=@Process AND FCONumI=@EntryNumber AND FCOOrigen=0;`);
  return getFrutaComercial(empCod, current.fcoProceso, current.fcoNumI);
};

const annulFrutaComercial = async (empCod, process, entryNumber) => {
  const current = await getFrutaComercial(empCod, process, entryNumber);
  assertEditable(current);
  const pool = await getPool();
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('Process', sql.Decimal(10, 0), current.fcoProceso)
    .input('EntryNumber', sql.Decimal(10, 0), current.fcoNumI)
    .query('DELETE FROM FCOMERCIAL WHERE EmpCod=@EmpCod AND FCOProceso=@Process AND FCONumI=@EntryNumber AND FCOOrigen=0; SELECT @@ROWCOUNT affected;');
  if (!Number(result.recordset[0]?.affected || 0)) throw new FrutaComercialError(409, 'NOT_FOUND', 'El registro ya no está disponible para anulación.');
  return { ok: true, fcoProceso: current.fcoProceso, fcoNumI: current.fcoNumI };
};

module.exports = {
  permission,
  ACTIONS,
  FrutaComercialError,
  listFilters,
  getFormData,
  listFrutaComercial,
  getFrutaComercial,
  createFrutaComercial,
  updateFrutaComercial,
  annulFrutaComercial,
  normalizePayload
};

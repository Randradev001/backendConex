const { getPool, sql } = require('../conectorMysql/conectorSqlServer');

const CONTROL_LINES_SQL = `
  SELECT
    l.LinMaquina,
    l.LinID,
    LTRIM(RTRIM(l.LinDesc)) AS LinDesc,
    LTRIM(RTRIM(l.LinPC)) AS LinPC,
    COALESCE(l.LinEstado, 0) AS LinEstado,
    COALESCE(l.LinEstConf, 0) AS LinEstConf,
    c.ConfID,
    c.Especod,
    LTRIM(RTRIM(e.EspeNom)) AS EspeNom,
    LTRIM(RTRIM(c.Calibre)) AS Calibre,
    c.EnvCod,
    LTRIM(RTRIM(env.EnvNom)) AS EnvNom,
    c.Catcod,
    LTRIM(RTRIM(cat.CatNom)) AS CatNom,
    COALESCE(c.ConfEstado, 0) AS ConfEstado,
    LTRIM(RTRIM(c.LConfLogin)) AS LConfLogin,
    c.LConfFecLog,
    c.LConfCodPer
  FROM LINEAS l
  LEFT JOIN LINCONFIG c
    ON c.EmpCod=l.EmpCod AND c.LinMaquina=l.LinMaquina
    AND c.LinID=l.LinID AND c.ConfID=1
  LEFT JOIN ESPECIES e
    ON e.EmpCod=c.EmpCod AND e.Especod=c.Especod
  LEFT JOIN ENVCAT env
    ON env.EmpCod=c.EmpCod AND env.EnvCod=c.EnvCod
  LEFT JOIN ENVCAT1 cat
    ON cat.EmpCod=c.EmpCod AND cat.EnvCod=c.EnvCod AND cat.Catcod=c.Catcod
  WHERE l.EmpCod=@EmpCod
  ORDER BY l.LinMaquina, l.LinID;

  ;WITH ActiveSeason AS
  (
    SELECT TOP (1) EmpCod, TempCod
    FROM TEMP01
    WHERE EmpCod=@EmpCod AND TempActiva=1
    ORDER BY TempFecAbre DESC, TempCod DESC
  )
  SELECT
    LTRIM(RTRIM(s.TempCod)) AS TempCod,
    o.Ordpnum,
    COUNT(c.CAPCOD) AS ProcessedBoxes,
    MAX(c.CAPFecLog) AS LastProcessedAt
  FROM ActiveSeason s
  LEFT JOIN ORDPROC o
    ON o.EmpCod=s.EmpCod AND o.TempCod=s.TempCod AND o.OrdpEstado=1
  LEFT JOIN CAP001 c
    ON c.EmpCod=o.EmpCod AND c.TempCod=o.TempCod AND c.CAPNproc=o.Ordpnum
  GROUP BY s.TempCod, o.Ordpnum
  ORDER BY o.Ordpnum;
`;

const CONTROL_LINES_CATALOGS_SQL = `
  SELECT Especod AS code, LTRIM(RTRIM(EspeNom)) AS name
  FROM ESPECIES WHERE EmpCod=@EmpCod ORDER BY EspeNom;
  SELECT Especod AS speciesCode, LTRIM(RTRIM(Calibre)) AS code
  FROM CALIBRES WHERE EmpCod=@EmpCod ORDER BY Especod, COALESCE(CalCod, 32767), Calibre;
  SELECT EnvCod AS code, LTRIM(RTRIM(EnvNom)) AS name
  FROM ENVCAT WHERE EmpCod=@EmpCod ORDER BY EnvNom;
  SELECT EnvCod AS containerCode, Catcod AS code, LTRIM(RTRIM(CatNom)) AS name
  FROM ENVCAT1 WHERE EmpCod=@EmpCod ORDER BY EnvCod, CatNom;
`;

class ControlLineError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const trimOrNull = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeLine = (row) => ({
  machine: Number(row.LinMaquina),
  line: Number(row.LinID),
  description: trimOrNull(row.LinDesc),
  pc: trimOrNull(row.LinPC),
  active: Number(row.LinEstado) === 1,
  lineStatus: numberOrNull(row.LinEstado) ?? 0,
  lineConfigured: Number(row.LinEstConf) === 1,
  configurationId: numberOrNull(row.ConfID),
  configurationActive: Number(row.ConfEstado) === 1,
  speciesCode: numberOrNull(row.Especod),
  speciesName: trimOrNull(row.EspeNom),
  caliber: trimOrNull(row.Calibre),
  containerCode: numberOrNull(row.EnvCod),
  containerName: trimOrNull(row.EnvNom),
  categoryCode: numberOrNull(row.Catcod),
  categoryName: trimOrNull(row.CatNom),
  assignedPersonCode: numberOrNull(row.LConfCodPer),
  configuredBy: trimOrNull(row.LConfLogin),
  configuredAt: row.LConfFecLog || null
});

const companyCodeFrom = (value) => {
  const companyCode = Number(value);
  if (!Number.isInteger(companyCode) || companyCode < 1) {
    throw new ControlLineError(401, 'COMPANY_CONTEXT_REQUIRED', 'La sesion no tiene una empresa valida.');
  }
  return companyCode;
};

const positiveInteger = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ControlLineError(400, 'VALIDATION_ERROR', `${label} no es valido.`);
  }
  return parsed;
};

const requiredText = (value, label, maxLength) => {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength) {
    throw new ControlLineError(400, 'VALIDATION_ERROR', `${label} es obligatorio y admite hasta ${maxLength} caracteres.`);
  }
  return text;
};

const normalizeUpdate = (raw = {}) => {
  const caliber = String(raw.caliber ?? '').trim();
  if (!caliber || caliber.length > 10) {
    throw new ControlLineError(400, 'VALIDATION_ERROR', 'El calibre es obligatorio y admite hasta 10 caracteres.');
  }
  if (typeof raw.active !== 'boolean') {
    throw new ControlLineError(400, 'VALIDATION_ERROR', 'El estado de la linea no es valido.');
  }
  return {
    speciesCode: positiveInteger(raw.speciesCode, 'La especie'),
    caliber,
    containerCode: positiveInteger(raw.containerCode, 'El envase'),
    categoryCode: positiveInteger(raw.categoryCode, 'La categoria'),
    active: raw.active
  };
};

const normalizeCreate = (raw = {}) => {
  const machine = positiveInteger(raw.machine, 'La maquina');
  if (machine > 32767) throw new ControlLineError(400, 'VALIDATION_ERROR', 'La maquina excede el rango permitido.');
  const personCode = raw.personCode === null || raw.personCode === undefined || raw.personCode === '' ? null : Number(raw.personCode);
  if (personCode !== null && (!Number.isInteger(personCode) || personCode < 0 || personCode > 2147483647)) {
    throw new ControlLineError(400, 'VALIDATION_ERROR', 'El codigo de persona no es valido.');
  }
  return {
    machine,
    description: requiredText(raw.description, 'La descripcion', 20),
    location: requiredText(raw.location, 'La ubicacion', 20),
    pc: requiredText(raw.pc, 'El PC', 20),
    personCode,
    ...normalizeUpdate(raw)
  };
};

const buildProductionSummary = (rows = []) => {
  const activeRows = rows.filter((row) => numberOrNull(row.Ordpnum) !== null);
  const activeProcesses = activeRows.map((row) => Number(row.Ordpnum));
  const lastProcessedDates = activeRows.map((row) => row.LastProcessedAt).filter(Boolean);
  return {
    season: trimOrNull(rows[0]?.TempCod),
    activeProcess: activeProcesses.length === 1 ? activeProcesses[0] : null,
    activeProcesses,
    activeProcessCount: activeProcesses.length,
    processedBoxes: activeRows.reduce((total, row) => total + Number(row.ProcessedBoxes || 0), 0),
    lastProcessedAt: lastProcessedDates.length
      ? new Date(Math.max(...lastProcessedDates.map((value) => new Date(value).getTime()))).toISOString()
      : null
  };
};

const listControlLines = async (empCod, { poolProvider = getPool } = {}) => {
  const companyCode = companyCodeFrom(empCod);

  const pool = await poolProvider();
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, companyCode)
    .query(CONTROL_LINES_SQL);
  const lines = (result.recordsets?.[0] || result.recordset || []).map(normalizeLine);
  const production = buildProductionSummary(result.recordsets?.[1] || []);
  const active = lines.filter((line) => line.active).length;
  const configured = lines.filter((line) => line.lineConfigured && line.configurationActive).length;
  const machines = [...new Set(lines.map((line) => line.machine))].sort((left, right) => left - right);

  return {
    updatedAt: new Date().toISOString(),
    summary: {
      total: lines.length,
      active,
      inactive: lines.length - active,
      configured
    },
    production,
    machines,
    lines
  };
};

const listControlLineCatalogs = async (empCod, { poolProvider = getPool } = {}) => {
  const companyCode = companyCodeFrom(empCod);
  const pool = await poolProvider();
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, companyCode)
    .query(CONTROL_LINES_CATALOGS_SQL);
  const sets = result.recordsets || [];
  return {
    species: sets[0] || [],
    calibers: sets[1] || [],
    containers: sets[2] || [],
    categories: sets[3] || []
  };
};

const createControlLine = async (
  empCod,
  login,
  raw,
  { poolProvider = getPool, transactionFactory, requestFactory = (target) => new sql.Request(target) } = {}
) => {
  const companyCode = companyCodeFrom(empCod);
  const payload = normalizeCreate(raw);
  const pool = await poolProvider();
  const transaction = transactionFactory ? transactionFactory(pool) : new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  let lineCode;

  try {
    const validation = await requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, companyCode)
      .input('Especod', sql.SmallInt, payload.speciesCode)
      .input('Calibre', sql.Char(10), payload.caliber)
      .input('EnvCod', sql.SmallInt, payload.containerCode)
      .input('Catcod', sql.SmallInt, payload.categoryCode)
      .query(`
        SELECT
          CASE WHEN EXISTS (SELECT 1 FROM ESPECIES WHERE EmpCod=@EmpCod AND Especod=@Especod) THEN 1 ELSE 0 END AS SpeciesExists,
          CASE WHEN EXISTS (SELECT 1 FROM CALIBRES WHERE EmpCod=@EmpCod AND Especod=@Especod AND Calibre=@Calibre) THEN 1 ELSE 0 END AS CaliberExists,
          CASE WHEN EXISTS (SELECT 1 FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@EnvCod) THEN 1 ELSE 0 END AS ContainerExists,
          CASE WHEN EXISTS (SELECT 1 FROM ENVCAT1 WHERE EmpCod=@EmpCod AND EnvCod=@EnvCod AND Catcod=@Catcod) THEN 1 ELSE 0 END AS CategoryExists;
      `);
    const found = validation.recordset[0] || {};
    if (!found.SpeciesExists || !found.CaliberExists || !found.ContainerExists || !found.CategoryExists) {
      throw new ControlLineError(400, 'INVALID_CONFIGURATION', 'La configuracion contiene una seleccion inexistente o incompatible.');
    }

    const inserted = await requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, companyCode)
      .input('LinMaquina', sql.SmallInt, payload.machine)
      .input('LinDesc', sql.Char(20), payload.description)
      .input('LinPerCod', sql.Int, payload.personCode)
      .input('LinUbica', sql.Char(20), payload.location)
      .input('LinPC', sql.Char(20), payload.pc)
      .input('LinEstado', sql.SmallInt, payload.active ? 1 : 0)
      .input('Especod', sql.SmallInt, payload.speciesCode)
      .input('Calibre', sql.Char(10), payload.caliber)
      .input('EnvCod', sql.SmallInt, payload.containerCode)
      .input('Catcod', sql.SmallInt, payload.categoryCode)
      .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10))
      .query(`
        DECLARE @LinID smallint;
        SELECT @LinID=CONVERT(smallint, COALESCE(MAX(LinID), 0) + 1)
        FROM LINEAS WITH (UPDLOCK, HOLDLOCK)
        WHERE EmpCod=@EmpCod;

        INSERT INTO LINEAS
          (EmpCod, LinMaquina, LinID, LinDesc, LinPerCod, LinUbica, LinPC, LinEstado, LinEstConf)
        VALUES
          (@EmpCod, @LinMaquina, @LinID, @LinDesc, @LinPerCod, @LinUbica, @LinPC, @LinEstado, 1);

        INSERT INTO LINCONFIG
          (EmpCod, LinMaquina, LinID, ConfID, Especod, Calibre, EnvCod,
           Catcod, ConfEstado, LConfLogin, LConfFecLog, LConfCodPer)
        VALUES
          (@EmpCod, @LinMaquina, @LinID, 1, @Especod, @Calibre, @EnvCod,
           @Catcod, 1, @Login, GETDATE(), NULL);

        SELECT @LinID AS LinID;
      `);
    lineCode = Number(inserted.recordset[0]?.LinID);
    if (!Number.isInteger(lineCode)) throw new Error('No fue posible obtener el identificador de la linea creada.');
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  const result = await listControlLines(companyCode, { poolProvider });
  return result.lines.find((item) => item.machine === payload.machine && item.line === lineCode);
};

const updateControlLine = async (
  empCod,
  login,
  machine,
  line,
  raw,
  { poolProvider = getPool, transactionFactory, requestFactory = (target) => new sql.Request(target) } = {}
) => {
  const companyCode = companyCodeFrom(empCod);
  const machineCode = positiveInteger(machine, 'La maquina');
  const lineCode = positiveInteger(line, 'La linea');
  const payload = normalizeUpdate(raw);
  const pool = await poolProvider();
  const transaction = transactionFactory ? transactionFactory(pool) : new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const validation = await requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, companyCode)
      .input('LinMaquina', sql.SmallInt, machineCode)
      .input('LinID', sql.SmallInt, lineCode)
      .input('Especod', sql.SmallInt, payload.speciesCode)
      .input('Calibre', sql.Char(10), payload.caliber)
      .input('EnvCod', sql.SmallInt, payload.containerCode)
      .input('Catcod', sql.SmallInt, payload.categoryCode)
      .query(`
        SELECT
          CASE WHEN EXISTS (SELECT 1 FROM LINEAS WHERE EmpCod=@EmpCod AND LinMaquina=@LinMaquina AND LinID=@LinID) THEN 1 ELSE 0 END AS LineExists,
          CASE WHEN EXISTS (SELECT 1 FROM ESPECIES WHERE EmpCod=@EmpCod AND Especod=@Especod) THEN 1 ELSE 0 END AS SpeciesExists,
          CASE WHEN EXISTS (SELECT 1 FROM CALIBRES WHERE EmpCod=@EmpCod AND Especod=@Especod AND Calibre=@Calibre) THEN 1 ELSE 0 END AS CaliberExists,
          CASE WHEN EXISTS (SELECT 1 FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@EnvCod) THEN 1 ELSE 0 END AS ContainerExists,
          CASE WHEN EXISTS (SELECT 1 FROM ENVCAT1 WHERE EmpCod=@EmpCod AND EnvCod=@EnvCod AND Catcod=@Catcod) THEN 1 ELSE 0 END AS CategoryExists;
      `);
    const found = validation.recordset[0] || {};
    if (!found.LineExists) throw new ControlLineError(404, 'LINE_NOT_FOUND', 'La linea no existe en la empresa autenticada.');
    if (!found.SpeciesExists || !found.CaliberExists || !found.ContainerExists || !found.CategoryExists) {
      throw new ControlLineError(400, 'INVALID_CONFIGURATION', 'La configuracion contiene una seleccion inexistente o incompatible.');
    }

    await requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, companyCode)
      .input('LinMaquina', sql.SmallInt, machineCode)
      .input('LinID', sql.SmallInt, lineCode)
      .input('Especod', sql.SmallInt, payload.speciesCode)
      .input('Calibre', sql.Char(10), payload.caliber)
      .input('EnvCod', sql.SmallInt, payload.containerCode)
      .input('Catcod', sql.SmallInt, payload.categoryCode)
      .input('LinEstado', sql.SmallInt, payload.active ? 1 : 0)
      .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10))
      .query(`
        UPDATE LINEAS SET LinEstado=@LinEstado, LinEstConf=1
        WHERE EmpCod=@EmpCod AND LinMaquina=@LinMaquina AND LinID=@LinID;

        IF EXISTS (SELECT 1 FROM LINCONFIG WHERE EmpCod=@EmpCod AND LinMaquina=@LinMaquina AND LinID=@LinID AND ConfID=1)
          UPDATE LINCONFIG SET Especod=@Especod, Calibre=@Calibre,
            EnvCod=@EnvCod, Catcod=@Catcod, ConfEstado=1,
            LConfLogin=@Login, LConfFecLog=GETDATE()
          WHERE EmpCod=@EmpCod AND LinMaquina=@LinMaquina AND LinID=@LinID AND ConfID=1;
        ELSE
          INSERT INTO LINCONFIG
            (EmpCod, LinMaquina, LinID, ConfID, Especod, Calibre, EnvCod,
             Catcod, ConfEstado, LConfLogin, LConfFecLog, LConfCodPer)
          VALUES
            (@EmpCod, @LinMaquina, @LinID, 1, @Especod, @Calibre, @EnvCod,
             @Catcod, 1, @Login, GETDATE(), NULL);
      `);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  const result = await listControlLines(companyCode, { poolProvider });
  return result.lines.find((item) => item.machine === machineCode && item.line === lineCode);
};

module.exports = {
  CONTROL_LINES_SQL,
  CONTROL_LINES_CATALOGS_SQL,
  ControlLineError,
  normalizeLine,
  normalizeUpdate,
  normalizeCreate,
  buildProductionSummary,
  listControlLines,
  listControlLineCatalogs,
  createControlLine,
  updateControlLine
};

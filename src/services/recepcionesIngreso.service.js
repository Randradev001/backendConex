const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { nextCorrelative } = require('./gxCorrelatives.service');

class RecepcionesIngresoError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const text = (value) => String(value ?? '').trim();
const integer = (value, field, min = 0) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', `${field} no es valido.`);
  return parsed;
};
const decimal = (value, field, min = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', `${field} no es valido.`);
  return parsed;
};
const dateOnly = (value, field = 'fecha') => {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', `${field} debe usar formato YYYY-MM-DD.`);
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', `${field} no es valida.`);
  }
  return parsed;
};
const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const isoDate = (date) => date.toISOString().slice(0, 10);
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const makeRequest = (source) => source instanceof sql.Transaction ? new sql.Request(source) : source.request();
const calculateReceptionWeights = (containers, grossTotal) => {
  const total = round2(grossTotal);
  const weight = round2(total / containers);
  return { weight, grossKilos: total, netKilos: total };
};

const normalizeKey = (input) => {
  const tempCod = text(input.tempCod);
  const producer = text(input.producer);
  if (!tempCod || tempCod.length > 9) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'La temporada no es valida.');
  if (!producer || producer.length > 6) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'El productor no es valido.');
  return {
    tempCod,
    origin: integer(input.origin, 'origen', 1),
    docType: integer(input.docType, 'tipo de documento', 1),
    guide: integer(input.guide, 'numero de guia', 1),
    producer
  };
};

const normalizePayload = (input = {}) => {
  const key = normalizeKey(input);
  const movementType = integer(input.movementType ?? 1, 'tipo de movimiento', 1);
  const movementSubtype = integer(input.movementSubtype ?? 1, 'subtipo de movimiento', 1);
  if (movementType !== 1 || movementSubtype !== 1) {
    throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'El ingreso de recepcion solo admite el movimiento 1/1 - Ingreso de fruta.');
  }
  const details = Array.isArray(input.details) ? input.details : [];
  if (!details.length) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'Debe ingresar al menos un lote.');
  const normalizedDetails = details.map((item, index) => {
    const containers = integer(item.containers, `envases del detalle ${index + 1}`, 1);
    const grossKilos = round2(decimal(item.grossKilos, `kilos brutos totales del detalle ${index + 1}`, 0.01));
    return {
      lot: item.lot === undefined || item.lot === null || item.lot === '' ? null : integer(item.lot, `lote del detalle ${index + 1}`, 1),
      quarter: integer(item.quarter, `cuartel del detalle ${index + 1}`, 1),
      species: integer(item.species, `especie del detalle ${index + 1}`, 1),
      variety: integer(item.variety, `variedad del detalle ${index + 1}`, 1),
      container: integer(item.container, `envase del detalle ${index + 1}`, 1),
      condition: integer(item.condition, `condicion del detalle ${index + 1}`, 1),
      containers,
      grossKilos
    };
  });
  const suppliedLots = normalizedDetails.filter((item) => item.lot !== null).map((item) => item.lot);
  if (new Set(suppliedLots).size !== suppliedLots.length) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'No puede repetir un lote.');
  return {
    ...key,
    movementType,
    movementSubtype,
    date: dateOnly(input.date),
    observation: text(input.observation).slice(0, 250),
    details: normalizedDetails
  };
};

const bindKey = (request, empCod, key) => request
  .input('EmpCod', sql.SmallInt, empCod)
  .input('TempCod', sql.Char(9), key.tempCod)
  .input('OriCod', sql.SmallInt, key.origin)
  .input('MovTDoc', sql.SmallInt, key.docType)
  .input('MovNGuia', sql.Decimal(10, 0), key.guide)
  .input('MovProd', sql.Char(6), key.producer);

const listCatalogs = async (empCod) => {
  const pool = await getPool();
  const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
    SELECT RTRIM(TempCod) value,RTRIM(TempDes) label,TempActiva active FROM TEMP01 WHERE EmpCod=@EmpCod ORDER BY TempCod DESC;
    SELECT OriCod value,CONCAT(OriCod,'.-',RTRIM(Orinom)) label FROM ORIGEN WHERE EmpCod=@EmpCod AND OriCod>0 AND OriEst=1 ORDER BY OriCod;
    SELECT RTRIM(ProdCod) value,CONCAT(RTRIM(ProdCod),'.-',RTRIM(ProdNom)) label FROM PRODUCTORES WHERE EmpCod=@EmpCod ORDER BY ProdCod;
    SELECT RTRIM(ProdCod) producer,CuarCod value,CONCAT(CuarCod,'.-',RTRIM(CuarNom)) label FROM PRODUCTORES1 WHERE EmpCod=@EmpCod ORDER BY ProdCod,CuarCod;
    SELECT Especod value,CONCAT(Especod,'.-',RTRIM(EspeNom)) label FROM ESPECIES WHERE EmpCod=@EmpCod ORDER BY EspeNom;
    SELECT Especod species,VarCod value,CONCAT(VarCod,'.-',RTRIM(VarNom)) label FROM ESPECIES1 WHERE EmpCod=@EmpCod ORDER BY Especod,VarNom;
    SELECT EnvCod value,CONCAT(EnvCod,'.-',RTRIM(EnvNom)) label,COALESCE(EnvPeso,0) weight,COALESCE(EnvDestare,0) tare FROM ENVCAT WHERE EmpCod=@EmpCod ORDER BY EnvCod;
    SELECT ConCod value,CONCAT(ConCod,'.-',RTRIM(ConNom)) label FROM CONDICION WHERE ConEst=1 ORDER BY ConCod;
    SELECT TdCod value,CONCAT(TdCod,'.-',RTRIM(TdNom)) label FROM TIPDOC WHERE COALESCE(TdBloq,0)=0 ORDER BY TdCod;
    SELECT tm.TMcod movementType,st.TMSCod movementSubtype,
      CONCAT(tm.TMcod,'/',st.TMSCod,'.-',RTRIM(tm.TMNom),' / ',RTRIM(st.TMSNom)) label
    FROM TIPMOV tm JOIN TIPMOV1 st ON st.EmpCod=tm.EmpCod AND st.TMcod=tm.TMcod
    WHERE tm.EmpCod=@EmpCod AND tm.TMcod=1 AND st.TMSCod=1;
  `);
  const active = (result.recordsets[0] || []).filter((item) => Number(item.active) === 1);
  if (active.length !== 1) throw new RecepcionesIngresoError(409, 'ACTIVE_SEASON_INVALID', 'Debe existir exactamente una temporada activa para la empresa.');
  return {
    activeSeason: active[0], seasons: result.recordsets[0] || [], origins: result.recordsets[1] || [], producers: result.recordsets[2] || [],
    quarters: result.recordsets[3] || [], species: result.recordsets[4] || [], varieties: result.recordsets[5] || [],
    containers: result.recordsets[6] || [], conditions: result.recordsets[7] || [],
    documentTypes: result.recordsets[8] || [], movementTypes: result.recordsets[9] || []
  };
};

const list = async (empCod, input = {}) => {
  const page = Math.max(integer(input.page || 1, 'pagina', 1), 1);
  const limit = Math.min(integer(input.limit || 50, 'limite', 1), 200);
  const pool = await getPool();
  const request = pool.request().input('EmpCod', sql.SmallInt, empCod).input('Offset', sql.Int, (page - 1) * limit).input('Limit', sql.Int, limit);
  const tempCod = text(input.tempCod) || null;
  const from = input.from ? dateOnly(input.from, 'fecha desde') : null;
  const to = input.to ? dateOnly(input.to, 'fecha hasta') : null;
  request.input('TempCod', sql.Char(9), tempCod).input('FromDate', sql.Date, from).input('ToDate', sql.Date, to)
    .input('Origin', sql.SmallInt, input.origin ? integer(input.origin, 'origen', 1) : null)
    .input('Producer', sql.Char(6), text(input.producer) || null)
    .input('Guide', sql.Decimal(10, 0), input.guide ? integer(input.guide, 'guia', 1) : null);
  const result = await request.query(`
    SELECT h.TempCod,h.OriCod,h.MovTDoc,h.MovNGuia,RTRIM(h.MovProd) MovProd,h.MovFecha,RTRIM(h.MovObs) MovObs,
      h.MovTotE,h.MovTotKilB,h.MovTotKilN,RTRIM(o.Orinom) OriNom,RTRIM(p.ProdNom) ProdNom,
      CASE WHEN EXISTS(SELECT 1 FROM MOVFRUT1 d JOIN ORDPROC1 op ON op.EmpCod=d.EmpCod AND op.TempCod=d.TempCod AND op.Ordp1Nlote=d.Mov1Nlote
        WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd) THEN 1 ELSE 0 END hasUsage
    INTO #R FROM MOVFRUT h
    LEFT JOIN ORIGEN o ON o.EmpCod=h.EmpCod AND o.OriCod=h.OriCod LEFT JOIN PRODUCTORES p ON p.EmpCod=h.EmpCod AND p.ProdCod=h.MovProd
    WHERE h.EmpCod=@EmpCod AND h.TMcod=1 AND h.TMSCod=1 AND COALESCE(h.Movauto,0)=0
      AND (@TempCod IS NULL OR h.TempCod=@TempCod) AND (@FromDate IS NULL OR h.MovFecha>=@FromDate)
      AND (@ToDate IS NULL OR h.MovFecha<DATEADD(day,1,@ToDate)) AND (@Origin IS NULL OR h.OriCod=@Origin)
      AND (@Producer IS NULL OR h.MovProd=@Producer) AND (@Guide IS NULL OR h.MovNGuia=@Guide);
    SELECT COUNT_BIG(*) total FROM #R;
    SELECT * INTO #Page FROM #R ORDER BY MovFecha DESC,MovNGuia DESC OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
    SELECT * FROM #Page ORDER BY MovFecha DESC,MovNGuia DESC;
    SELECT p.TempCod,p.OriCod,p.MovTDoc,p.MovNGuia,RTRIM(p.MovProd) MovProd,d.Mov1Nlote
    FROM #Page p
    JOIN MOVFRUT1 d ON d.EmpCod=@EmpCod AND d.TempCod=p.TempCod AND d.OriCod=p.OriCod
      AND d.MovTDoc=p.MovTDoc AND d.MovNGuia=p.MovNGuia AND d.MovProd=p.MovProd
    ORDER BY p.MovFecha DESC,p.MovNGuia DESC,d.Mov1Nlote;
  `);
  const lotsByReception = new Map();
  (result.recordsets[2] || []).forEach((lot) => {
    const key = [text(lot.TempCod), lot.OriCod, lot.MovTDoc, lot.MovNGuia, text(lot.MovProd)].join('|');
    if (!lotsByReception.has(key)) lotsByReception.set(key, []);
    lotsByReception.get(key).push(Number(lot.Mov1Nlote));
  });
  const rows = (result.recordsets[1] || []).map((row) => ({
    ...row,
    lots: lotsByReception.get([text(row.TempCod), row.OriCod, row.MovTDoc, row.MovNGuia, text(row.MovProd)].join('|')) || []
  }));
  return { page, limit, total: Number(result.recordsets[0][0].total), rows };
};

const normalizeBoardFilters = (input = {}, now = new Date()) => {
  // "Hoy" corresponde al calendario local de planta, no al dia UTC.
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const to = input.to ? dateOnly(input.to, 'fecha hasta') : dateOnly(localToday, 'fecha hasta');
  const from = input.from ? dateOnly(input.from, 'fecha desde') : addDays(to, -5);
  if (from > to) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'La fecha desde no puede ser posterior a la fecha hasta.');
  const span = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (span > 31) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'El tablero admite un maximo de 31 dias.');
  const tempCod = text(input.tempCod);
  const producer = text(input.producer);
  return {
    from,
    to,
    tempCod: tempCod || null,
    origin: input.origin ? integer(input.origin, 'origen', 1) : null,
    producer: producer || null
  };
};

const listLotBoard = async (empCod, input = {}) => {
  const filters = normalizeBoardFilters(input);
  const pool = await getPool();
  const request = pool.request().input('EmpCod', sql.SmallInt, empCod)
    .input('FromDate', sql.Date, filters.from).input('ToDate', sql.Date, filters.to)
    .input('TempCod', sql.Char(9), filters.tempCod).input('Origin', sql.SmallInt, filters.origin)
    .input('Producer', sql.Char(6), filters.producer);
  const result = await request.query(`
    SELECT
      CONVERT(char(10), h.MovFecha, 23) AS date,
      h.TempCod,
      h.OriCod,
      RTRIM(o.Orinom) AS originName,
      h.MovTDoc,
      h.MovNGuia,
      RTRIM(h.MovProd) AS producerCode,
      RTRIM(p.ProdNom) AS producerName,
      d.Mov1Nlote AS lot,
      d.Mov1Cuar AS quarter,
      RTRIM(q.CuarNom) AS quarterName,
      d.Mov1Espe AS species,
      RTRIM(e.EspeNom) AS speciesName,
      d.Mov1Var AS variety,
      RTRIM(v.VarNom) AS varietyName,
      d.Mov1TEnv AS container,
      RTRIM(env.EnvNom) AS containerName,
      COALESCE(d.Mov1NumE,0) AS containers,
      COALESCE(d.Mov1KilB,0) AS grossKilos,
      COALESCE(d.Mov1KilN,0) AS netKilos,
      CASE WHEN EXISTS(SELECT 1 FROM ORDPROC1 op WHERE op.EmpCod=d.EmpCod AND op.TempCod=d.TempCod AND op.Ordp1Nlote=d.Mov1Nlote) THEN 1 ELSE 0 END AS hasUsage,
      CASE WHEN quality.CalRecId IS NULL THEN 0 ELSE 1 END AS qualityCompleted,
      quality.CalRecId AS qualityControlId,
      quality.CalRecPorCalidad AS qualityPercentage,
      quality.CalRecPorCalidad AS exportPercentage,
      CASE WHEN quality.CalRecPorCalidad IS NULL THEN NULL ELSE 100-quality.CalRecPorCalidad END AS commercialPercentage
    FROM MOVFRUT h
    JOIN MOVFRUT1 d ON d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod
      AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd
    LEFT JOIN ORIGEN o ON o.EmpCod=h.EmpCod AND o.OriCod=h.OriCod
    LEFT JOIN PRODUCTORES p ON p.EmpCod=h.EmpCod AND p.ProdCod=h.MovProd
    LEFT JOIN PRODUCTORES1 q ON q.EmpCod=d.EmpCod AND q.ProdCod=d.MovProd AND q.CuarCod=d.Mov1Cuar
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.Mov1Espe
    LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Mov1Espe AND v.VarCod=d.Mov1Var
    LEFT JOIN ENVCAT env ON env.EmpCod=d.EmpCod AND env.EnvCod=d.Mov1TEnv
    OUTER APPLY (
      SELECT TOP (1) c.CalRecId,c.CalRecPorCalidad
      FROM CALRECEP c
      WHERE c.EmpCod=d.EmpCod AND c.TempCod=d.TempCod AND c.OriCod=d.OriCod
        AND c.MovTDoc=d.MovTDoc AND c.MovNGuia=d.MovNGuia AND c.MovProd=d.MovProd
        AND c.Mov1Nlote=d.Mov1Nlote AND c.CalRecEstado<>'A'
      ORDER BY c.CalRecFecha DESC,c.CalRecHora DESC,c.CalRecId DESC
    ) quality
    WHERE h.EmpCod=@EmpCod AND h.TMcod=1 AND h.TMSCod=1 AND COALESCE(h.Movauto,0)=0
      AND h.MovFecha>=@FromDate AND h.MovFecha<DATEADD(day,1,@ToDate)
      AND (@TempCod IS NULL OR h.TempCod=@TempCod)
      AND (@Origin IS NULL OR h.OriCod=@Origin)
      AND (@Producer IS NULL OR h.MovProd=@Producer)
    ORDER BY h.MovFecha, h.MovProd, h.MovNGuia, d.Mov1Nlote;
  `);
  const rows = result.recordset || [];
  const dates = [];
  for (let date = filters.from; date <= filters.to; date = addDays(date, 1)) {
    const value = isoDate(date);
    const offset = Math.round((date.getTime() - filters.to.getTime()) / 86400000);
    dates.push({
      value,
      label: offset === 0 ? 'Hoy' : `Dia ${offset}`,
      producers: []
    });
  }
  const dateMap = new Map(dates.map((date) => [date.value, date]));
  const totals = { lots: rows.length, producers: 0, containers: 0, grossKilos: 0, netKilos: 0 };
  rows.forEach((row) => {
    const day = dateMap.get(row.date);
    if (!day) return;
    let producer = day.producers.find((item) => item.producerCode === row.producerCode);
    if (!producer) {
      producer = { producerCode: row.producerCode, producerName: row.producerName, lots: [] };
      day.producers.push(producer);
    }
    producer.lots.push(row);
    totals.containers += Number(row.containers || 0);
    totals.grossKilos += Number(row.grossKilos || 0);
    totals.netKilos += Number(row.netKilos || 0);
  });
  totals.producers = new Set(rows.map((row) => `${row.date}|${row.producerCode}`)).size;
  return { filters: { ...filters, from: isoDate(filters.from), to: isoDate(filters.to) }, dates, totals };
};

const getOne = async (empCod, rawKey, transaction = null) => {
  const key = normalizeKey(rawKey);
  const pool = transaction || await getPool();
  const result = await bindKey(makeRequest(pool), empCod, key).query(`
    SELECT h.TempCod,h.OriCod,RTRIM(o.Orinom) OriNom,h.MovTDoc,RTRIM(td.TdNom) TdNom,h.MovNGuia,
      RTRIM(h.MovProd) MovProd,RTRIM(p.ProdNom) ProdNom,h.MovFecha,RTRIM(h.MovObs) MovObs,
      h.TMcod,h.TMSCod,RTRIM(tm.TMNom) TMNom,RTRIM(st.TMSNom) TMSNom,h.MovTotE,h.MovTotKilB,h.MovTotKilN
    FROM MOVFRUT h
    LEFT JOIN ORIGEN o ON o.EmpCod=h.EmpCod AND o.OriCod=h.OriCod
    LEFT JOIN TIPDOC td ON td.TdCod=h.MovTDoc
    LEFT JOIN TIPMOV tm ON tm.EmpCod=h.EmpCod AND tm.TMcod=h.TMcod
    LEFT JOIN TIPMOV1 st ON st.EmpCod=h.EmpCod AND st.TMcod=h.TMcod AND st.TMSCod=h.TMSCod
    LEFT JOIN PRODUCTORES p ON p.EmpCod=h.EmpCod AND p.ProdCod=h.MovProd
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.OriCod=@OriCod AND h.MovTDoc=@MovTDoc AND h.MovNGuia=@MovNGuia AND h.MovProd=@MovProd AND h.TMcod=1 AND h.TMSCod=1 AND COALESCE(h.Movauto,0)=0;
    SELECT d.Mov1Nlote,d.Mov1Cuar,RTRIM(q.CuarNom) CuarNom,d.Mov1Espe,RTRIM(e.EspeNom) EspeNom,
      d.Mov1Var,RTRIM(v.VarNom) VarNom,d.Mov1TEnv,RTRIM(env.EnvNom) EnvNom,d.Mov1Condi,RTRIM(c.ConNom) ConNom,
      d.Mov1NumE,d.Mov1Peso,d.Mov1Destare,d.Mov1KilB,d.Mov1KilN,
      CASE WHEN EXISTS(SELECT 1 FROM ORDPROC1 op WHERE op.EmpCod=d.EmpCod AND op.TempCod=d.TempCod AND op.Ordp1Nlote=d.Mov1Nlote) THEN 1 ELSE 0 END hasUsage
    FROM MOVFRUT1 d
    LEFT JOIN PRODUCTORES1 q ON q.EmpCod=d.EmpCod AND q.ProdCod=d.MovProd AND q.CuarCod=d.Mov1Cuar
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.Mov1Espe
    LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Mov1Espe AND v.VarCod=d.Mov1Var
    LEFT JOIN ENVCAT env ON env.EmpCod=d.EmpCod AND env.EnvCod=d.Mov1TEnv
    LEFT JOIN CONDICION c ON c.ConCod=d.Mov1Condi
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.OriCod=@OriCod AND d.MovTDoc=@MovTDoc AND d.MovNGuia=@MovNGuia AND d.MovProd=@MovProd ORDER BY d.Mov1Nlote;
    SELECT EmpCod,RTRIM(EmpNom) EmpNom,RTRIM(EmpGiro) EmpGiro,RTRIM(Empdir) EmpDir,EmpRut,RTRIM(EmpDV) EmpDV
    FROM DEFEMP WHERE EmpCod=@EmpCod;
  `);
  if (!result.recordsets[0]?.length) throw new RecepcionesIngresoError(404, 'NOT_FOUND', 'La recepcion no existe.');
  return { header: result.recordsets[0][0], details: result.recordsets[1] || [], company: result.recordsets[2]?.[0] || null };
};

const validateAndEnrich = async (transaction, empCod, payload) => {
  const request = makeRequest(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), payload.tempCod)
    .input('OriCod', sql.SmallInt, payload.origin).input('MovProd', sql.Char(6), payload.producer);
  const refs = await request.query(`
    SELECT COUNT(*) count FROM TEMP01 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND TempActiva=1;
    SELECT COUNT(*) count FROM ORIGEN WHERE EmpCod=@EmpCod AND OriCod=@OriCod AND OriEst=1;
    SELECT COUNT(*) count FROM PRODUCTORES WHERE EmpCod=@EmpCod AND ProdCod=@MovProd;
  `);
  if (Number(refs.recordsets[0][0].count) !== 1) throw new RecepcionesIngresoError(409, 'ACTIVE_SEASON_INVALID', 'La temporada debe ser la temporada activa de la empresa.');
  if (!Number(refs.recordsets[1][0].count)) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'El origen no existe o no esta activo.');
  if (!Number(refs.recordsets[2][0].count)) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'El productor no existe.');
  const movement = await makeRequest(transaction).input('EmpCod', sql.SmallInt, empCod)
    .input('TdCod', sql.SmallInt, payload.docType).input('TMcod', sql.SmallInt, payload.movementType)
    .input('TMSCod', sql.SmallInt, payload.movementSubtype).query(`
      SELECT COUNT(*) count FROM TIPDOC WHERE TdCod=@TdCod AND COALESCE(TdBloq,0)=0;
      SELECT COUNT(*) count FROM TIPMOV1 WHERE EmpCod=@EmpCod AND TMcod=@TMcod AND TMSCod=@TMSCod;
    `);
  if (!Number(movement.recordsets[0][0].count)) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'El tipo de documento no existe o esta bloqueado.');
  if (!Number(movement.recordsets[1][0].count)) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'El tipo de movimiento no existe.');

  for (const item of payload.details) {
    const catalog = await makeRequest(transaction).input('EmpCod', sql.SmallInt, empCod).input('ProdCod', sql.Char(6), payload.producer)
      .input('CuarCod', sql.Int, item.quarter).input('Especod', sql.SmallInt, item.species).input('VarCod', sql.Int, item.variety)
      .input('EnvCod', sql.SmallInt, item.container).input('ConCod', sql.SmallInt, item.condition).query(`
        SELECT COALESCE(EnvPeso,0) weight,COALESCE(EnvDestare,0) tare FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@EnvCod;
        SELECT COUNT(*) count FROM PRODUCTORES1 WHERE EmpCod=@EmpCod AND ProdCod=@ProdCod AND CuarCod=@CuarCod;
        SELECT COUNT(*) count FROM ESPECIES1 WHERE EmpCod=@EmpCod AND Especod=@Especod AND VarCod=@VarCod;
        SELECT COUNT(*) count FROM CONDICION WHERE ConCod=@ConCod AND ConEst=1;
      `);
    if (!catalog.recordsets[0]?.length || !Number(catalog.recordsets[1][0].count) || !Number(catalog.recordsets[2][0].count) || !Number(catalog.recordsets[3][0].count)) {
      throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'Un detalle contiene catalogos inexistentes o que no corresponden a la seleccion.');
    }
    const weights = calculateReceptionWeights(item.containers, item.grossKilos);
    item.weight = weights.weight;
    item.tare = Number(catalog.recordsets[0][0].tare || 0);
    item.grossKilos = weights.grossKilos;
    item.netKilos = weights.netKilos;
    if (item.netKilos <= 0) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'Los kilos netos deben ser mayores que cero.');
  }
};

const insertDetail = async (transaction, empCod, payload, item) => {
  if (item.lot === null) item.lot = await nextCorrelative({ transaction, empCod, code: 'LOTE', digits: 10 });
  const year = payload.date.getUTCFullYear();
  const month = payload.date.getUTCMonth() + 1;
  await bindKey(makeRequest(transaction), empCod, payload).input('Lot', sql.Decimal(10, 0), item.lot)
    .input('Quarter', sql.Int, item.quarter).input('Species', sql.SmallInt, item.species).input('Variety', sql.Int, item.variety)
    .input('Container', sql.SmallInt, item.container).input('Condition', sql.SmallInt, item.condition)
    .input('Tare', sql.SmallMoney, item.tare).input('Containers', sql.Int, item.containers).input('Weight', sql.SmallMoney, item.weight)
    .input('Gross', sql.Money, item.grossKilos).input('Net', sql.Money, item.netKilos).input('Date', sql.DateTime, payload.date)
    .input('Year', sql.SmallInt, year).input('Month', sql.SmallInt, month).query(`
      INSERT MOVFRUT1 (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,Mov1Nlote,Mov1Cuar,Mov1Espe,Mov1Var,Mov1TEnv,Mov1Condi,Mov1Destare,Mov1NumE,Mov1Peso,Mov1KilB,Mov1KilN,Mov1TM,Mov1STM,Mov1Fecha,Mov1AA,Mov1MM,Mov1EnvPROC)
      VALUES (@EmpCod,@TempCod,@OriCod,@MovTDoc,@MovNGuia,@MovProd,@Lot,@Quarter,@Species,@Variety,@Container,@Condition,@Tare,@Containers,@Weight,@Gross,@Net,1,1,@Date,@Year,@Month,0);
    `);
};

const recalculateTotals = (transaction, empCod, key) => bindKey(makeRequest(transaction), empCod, key).query(`
  UPDATE h SET MovTotE=COALESCE(x.envases,0),MovTotKilB=COALESCE(x.brutos,0),MovTotKilN=COALESCE(x.netos,0)
  FROM MOVFRUT h OUTER APPLY (SELECT SUM(d.Mov1NumE) envases,SUM(d.Mov1KilB) brutos,SUM(d.Mov1KilN) netos FROM MOVFRUT1 d
    WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd) x
  WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.OriCod=@OriCod AND h.MovTDoc=@MovTDoc AND h.MovNGuia=@MovNGuia AND h.MovProd=@MovProd;
`);

const create = async (empCod, login, input) => {
  const payload = normalizePayload(input);
  if (payload.details.some((item) => item.lot !== null)) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', 'Los lotes nuevos son asignados por el servidor.');
  const pool = await getPool(); const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await validateAndEnrich(transaction, empCod, payload);
    const exists = await bindKey(makeRequest(transaction), empCod, payload).query('SELECT COUNT(*) count FROM MOVFRUT WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OriCod=@OriCod AND MovTDoc=@MovTDoc AND MovNGuia=@MovNGuia AND MovProd=@MovProd;');
    if (Number(exists.recordset[0].count)) throw new RecepcionesIngresoError(409, 'DUPLICATE', 'Ya existe una recepcion con esa clave.');
    await bindKey(makeRequest(transaction), empCod, payload).input('Date', sql.DateTime, payload.date).input('Obs', sql.Char(250), payload.observation)
      .input('Login', sql.Char(10), text(login).slice(0, 10)).query(`
        INSERT MOVFRUT (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,MovFecha,MovObs,TMcod,TMSCod,MovTotE,MovTotKilN,MovTotKilB,MovGrados,MovGBrik,MovLoginC,MovFecC,Movauto)
        VALUES (@EmpCod,@TempCod,@OriCod,@MovTDoc,@MovNGuia,@MovProd,@Date,@Obs,1,1,0,0,0,0,0,@Login,GETDATE(),0);
      `);
    for (const item of payload.details) await insertDetail(transaction, empCod, payload, item);
    await recalculateTotals(transaction, empCod, payload);
    await transaction.commit();
    return getOne(empCod, payload);
  } catch (error) { await transaction.rollback(); throw error; }
};

const update = async (empCod, login, rawKey, input) => {
  const key = normalizeKey(rawKey); const payload = normalizePayload({ ...input, ...key });
  const pool = await getPool(); const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await validateAndEnrich(transaction, empCod, payload);
    const current = await getOne(empCod, key, transaction);
    const currentDate = new Date(current.header.MovFecha).toISOString().slice(0, 10);
    if (current.details.some((detail) => Number(detail.hasUsage) === 1) && payload.date.toISOString().slice(0, 10) !== currentDate) {
      throw new RecepcionesIngresoError(409, 'RECEIPT_ALREADY_USED', 'No se puede cambiar la fecha de una recepcion con lotes ya procesados.');
    }
    const existing = new Map(current.details.map((item) => [Number(item.Mov1Nlote), item]));
    for (const item of current.details.filter((detail) => Number(detail.hasUsage) === 1)) {
      const desired = payload.details.find((detail) => Number(detail.lot) === Number(item.Mov1Nlote));
      const same = desired && Number(item.Mov1Cuar) === desired.quarter && Number(item.Mov1Espe) === desired.species && Number(item.Mov1Var) === desired.variety
        && Number(item.Mov1TEnv) === desired.container && Number(item.Mov1Condi) === desired.condition && Number(item.Mov1NumE) === desired.containers
        && round2(item.Mov1KilB) === desired.grossKilos;
      if (!same) throw new RecepcionesIngresoError(409, 'LOT_ALREADY_USED', `El lote ${item.Mov1Nlote} ya fue usado y no puede modificarse ni quitarse.`);
    }
    for (const item of payload.details.filter((detail) => detail.lot !== null)) {
      if (!existing.has(item.lot)) throw new RecepcionesIngresoError(400, 'VALIDATION_ERROR', `El lote ${item.lot} no pertenece a esta recepcion.`);
    }
    await bindKey(makeRequest(transaction), empCod, key).input('Date', sql.DateTime, payload.date).input('Obs', sql.Char(250), payload.observation)
      .input('Login', sql.Char(10), text(login).slice(0, 10)).query(`
        UPDATE MOVFRUT SET MovFecha=@Date,MovObs=@Obs,MovLoginUPD=@Login,MovFecUPD=GETDATE()
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OriCod=@OriCod AND MovTDoc=@MovTDoc AND MovNGuia=@MovNGuia AND MovProd=@MovProd;
        DELETE d FROM MOVFRUT1 d WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.OriCod=@OriCod AND d.MovTDoc=@MovTDoc AND d.MovNGuia=@MovNGuia AND d.MovProd=@MovProd
          AND NOT EXISTS(SELECT 1 FROM ORDPROC1 op WHERE op.EmpCod=d.EmpCod AND op.TempCod=d.TempCod AND op.Ordp1Nlote=d.Mov1Nlote);
      `);
    for (const item of payload.details.filter((detail) => detail.lot === null || !Number(existing.get(detail.lot)?.hasUsage))) await insertDetail(transaction, empCod, payload, item);
    await recalculateTotals(transaction, empCod, key);
    await transaction.commit(); return getOne(empCod, key);
  } catch (error) { await transaction.rollback(); throw error; }
};

const remove = async (empCod, rawKey) => {
  const key = normalizeKey(rawKey); const pool = await getPool(); const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await getOne(empCod, key, transaction);
    const usage = await bindKey(makeRequest(transaction), empCod, key).query(`SELECT TOP 1 d.Mov1Nlote FROM MOVFRUT1 d JOIN ORDPROC1 op ON op.EmpCod=d.EmpCod AND op.TempCod=d.TempCod AND op.Ordp1Nlote=d.Mov1Nlote WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.OriCod=@OriCod AND d.MovTDoc=@MovTDoc AND d.MovNGuia=@MovNGuia AND d.MovProd=@MovProd;`);
    if (usage.recordset.length) throw new RecepcionesIngresoError(409, 'RECEIPT_ALREADY_USED', 'La recepcion tiene lotes usados en ordenes de proceso y no puede eliminarse.');
    await bindKey(makeRequest(transaction), empCod, key).query(`DELETE FROM MOVFRUT1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OriCod=@OriCod AND MovTDoc=@MovTDoc AND MovNGuia=@MovNGuia AND MovProd=@MovProd; DELETE FROM MOVFRUT WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OriCod=@OriCod AND MovTDoc=@MovTDoc AND MovNGuia=@MovNGuia AND MovProd=@MovProd;`);
    await transaction.commit(); return { deleted: true };
  } catch (error) { await transaction.rollback(); throw error; }
};

const listQualityCatalogs = async (empCod, rawSpecies) => {
  const species = integer(rawSpecies, 'especie', 1);
  const pool = await getPool();
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('Especod', sql.SmallInt, species)
    .query(`
      SELECT MADanCod code,RTRIM(MADanDes) label,MADanOrden displayOrder
      FROM MAdanos
      WHERE EmpCod=@EmpCod AND Especod=@Especod AND MADanActivo=1
      ORDER BY MADanOrden,MADanCod;
      SELECT COALESCE(CalCod,0) id,RTRIM(Calibre) code,COALESCE(CalOrden,CalCod,32767) displayOrder
      FROM CALIBRES
      WHERE EmpCod=@EmpCod AND Especod=@Especod AND calRecepcion=1
      ORDER BY COALESCE(CalOrden,CalCod,32767),COALESCE(CalCod,32767),Calibre;
      SELECT MAPlaCod code,RTRIM(MAPlaTipo) type,RTRIM(MAPlaDes) label,MAPlaOrden displayOrder
      FROM MAPlagas
      WHERE EmpCod=@EmpCod AND Especod=@Especod AND MAPlaActivo=1
      ORDER BY MAPlaOrden,MAPlaCod;
      SELECT RTRIM(MAColCod) code,RTRIM(MAColDes) label,MAColOrden displayOrder,MAColPremium premium
      FROM MAColores
      WHERE EmpCod=@EmpCod AND Especod=@Especod AND MAColActivo=1
      ORDER BY MAColOrden,MAColCod;
    `);
  return { damages: result.recordsets[0] || [], calibers: result.recordsets[1] || [], pests: result.recordsets[2] || [], colors: result.recordsets[3] || [] };
};

module.exports = { RecepcionesIngresoError, normalizeKey, normalizePayload, normalizeBoardFilters, round2, calculateReceptionWeights, listCatalogs, list, listLotBoard, listQualityCatalogs, getOne, create, update, remove };

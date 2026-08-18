const { getPool, sql } = require('../conectorMysql/conectorSqlServer');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

class RecepcionFrutaError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const cleanText = (value) => String(value ?? '').trim();

const parseInteger = (value, field, { min = 0, optional = true } = {}) => {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new RecepcionFrutaError(400, 'VALIDATION_ERROR', `${field} no es valido.`);
  }
  return parsed;
};

const parseDate = (value, field) => {
  const text = cleanText(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new RecepcionFrutaError(400, 'VALIDATION_ERROR', `${field} debe usar formato YYYY-MM-DD.`);
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new RecepcionFrutaError(400, 'VALIDATION_ERROR', `${field} no es una fecha valida.`);
  }
  return date;
};

const normalizeFilters = (input = {}, { paginate = true } = {}) => {
  const from = parseDate(input.from, 'from');
  const to = parseDate(input.to, 'to');
  if (from && to && from > to) {
    throw new RecepcionFrutaError(400, 'VALIDATION_ERROR', 'La fecha desde no puede ser posterior a la fecha hasta.');
  }

  const tempCod = cleanText(input.tempCod);
  if (tempCod.length > 9) {
    throw new RecepcionFrutaError(400, 'VALIDATION_ERROR', 'tempCod supera el largo GeneXus de 9 caracteres.');
  }

  const producer = cleanText(input.producer);
  if (producer.length > 6) {
    throw new RecepcionFrutaError(400, 'VALIDATION_ERROR', 'producer supera el largo GeneXus de 6 caracteres.');
  }

  return {
    tempCod: tempCod || null,
    from,
    to,
    origin: parseInteger(input.origin, 'origin'),
    producer: producer && producer.toUpperCase() !== 'GG' ? producer : null,
    guideFrom: parseInteger(input.guideFrom, 'guideFrom'),
    quarter: parseInteger(input.quarter, 'quarter'),
    species: parseInteger(input.species, 'species'),
    page: paginate ? parseInteger(input.page ?? 1, 'page', { min: 1, optional: false }) : 1,
    limit: paginate
      ? Math.min(parseInteger(input.limit ?? DEFAULT_LIMIT, 'limit', { min: 1, optional: false }), MAX_LIMIT)
      : MAX_LIMIT
  };
};

const bindCommonInputs = (request, empCod, filters) => {
  request.input('EmpCod', sql.SmallInt, empCod);
  request.input('TempCod', sql.Char(9), filters.tempCod);
  request.input('FromDate', sql.Date, filters.from);
  request.input('ToDate', sql.Date, filters.to);
  request.input('Origin', sql.SmallInt, filters.origin);
  request.input('Producer', sql.Char(6), filters.producer);
  request.input('GuideFrom', sql.Decimal(10, 0), filters.guideFrom);
  request.input('Quarter', sql.Int, filters.quarter);
  request.input('Species', sql.SmallInt, filters.species);
  request.input('Offset', sql.Int, (filters.page - 1) * filters.limit);
  request.input('Limit', sql.Int, filters.limit);
  return request;
};

const summarySql = ({ paginated = true } = {}) => `
  SELECT
      h.TempCod,
      h.OriCod,
      LTRIM(RTRIM(o.Orinom)) AS OriNom,
      h.MovTDoc,
      h.MovNGuia,
      LTRIM(RTRIM(h.MovProd)) AS MovProd,
      LTRIM(RTRIM(p.ProdNom)) AS ProdNom,
      h.MovFecha,
      COALESCE(lotTotals.MovItem,0) AS MovItem,
      COALESCE(lotStrings.lotsText,'') AS lotsText,
      COALESCE(lotStrings.lotQualityText,'') AS lotQualityText,
      COALESCE(lotTotals.pendingQualityLots,0) AS pendingQualityLots,
      COALESCE(h.MovTotE, 0) AS MovTotE,
      COALESCE(h.MovTotKilB, 0) AS MovTotKilB,
      COALESCE(h.MovTotKilN, 0) AS MovTotKilN,
      h.TMcod,
      h.TMSCod
    INTO #Result
    FROM MOVFRUT h
    LEFT JOIN ORIGEN o ON o.EmpCod=h.EmpCod AND o.OriCod=h.OriCod
    LEFT JOIN PRODUCTORES p ON p.EmpCod=h.EmpCod AND p.ProdCod=h.MovProd
    OUTER APPLY (
      SELECT COUNT(d.Mov1Nlote) MovItem,
        SUM(CASE WHEN COALESCE(quality.CalRecEstado,'')<>'F' THEN 1 ELSE 0 END) pendingQualityLots
      FROM MOVFRUT1 d
      OUTER APPLY (
        SELECT TOP (1) c.CalRecEstado
        FROM CALRECEP c
        WHERE c.EmpCod=d.EmpCod AND c.TempCod=d.TempCod AND c.OriCod=d.OriCod
          AND c.MovTDoc=d.MovTDoc AND c.MovNGuia=d.MovNGuia AND c.MovProd=d.MovProd
          AND c.Mov1Nlote=d.Mov1Nlote AND c.CalRecEstado<>'A'
        ORDER BY c.CalRecFecha DESC,c.CalRecHora DESC,c.CalRecId DESC
      ) quality
      WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod
        AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd
    ) lotTotals
    OUTER APPLY (
      SELECT
        STUFF((
          SELECT ','+CONVERT(varchar(20),d.Mov1Nlote)
          FROM MOVFRUT1 d
          WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod
            AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd
          ORDER BY d.Mov1Nlote
          FOR XML PATH(''),TYPE
        ).value('.','varchar(max)'),1,1,'') lotsText,
        STUFF((
          SELECT ','+CONCAT(CONVERT(varchar(20),d.Mov1Nlote),':',CASE WHEN quality.CalRecEstado='F' THEN 'F' ELSE 'P' END,':',COALESCE(CONVERT(varchar(30),quality.CalRecId),''),':',COALESCE(CONVERT(varchar(20),quality.CalRecPorCalidad),''))
          FROM MOVFRUT1 d
          OUTER APPLY (
            SELECT TOP (1) c.CalRecId,c.CalRecEstado,c.CalRecPorCalidad
            FROM CALRECEP c
            WHERE c.EmpCod=d.EmpCod AND c.TempCod=d.TempCod AND c.OriCod=d.OriCod
              AND c.MovTDoc=d.MovTDoc AND c.MovNGuia=d.MovNGuia AND c.MovProd=d.MovProd
              AND c.Mov1Nlote=d.Mov1Nlote AND c.CalRecEstado<>'A'
            ORDER BY c.CalRecFecha DESC,c.CalRecHora DESC,c.CalRecId DESC
          ) quality
          WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod
            AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd
          ORDER BY d.Mov1Nlote
          FOR XML PATH(''),TYPE
        ).value('.','varchar(max)'),1,1,'') lotQualityText
    ) lotStrings
    WHERE h.EmpCod=@EmpCod
      AND (@TempCod IS NULL OR h.TempCod=@TempCod)
      AND (@FromDate IS NULL OR h.MovFecha>=@FromDate)
      AND (@ToDate IS NULL OR h.MovFecha<DATEADD(day,1,@ToDate))
      AND (@Origin IS NULL OR h.OriCod=@Origin)
      AND (@Producer IS NULL OR h.MovProd=@Producer)
      AND (@GuideFrom IS NULL OR h.MovNGuia>=@GuideFrom)
    ;
  SELECT COUNT_BIG(*) AS total,
    COALESCE(SUM(MovTotE),0) AS totalEnvases,
    COALESCE(SUM(MovTotKilB),0) AS totalKilosBrutos,
    COALESCE(SUM(MovTotKilN),0) AS totalKilosNetos
  FROM #Result;
  SELECT * FROM #Result
  ORDER BY MovFecha DESC, MovNGuia DESC, OriCod, MovProd
  ${paginated ? 'OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY' : ''};
`;

const detailSql = ({ paginated = true } = {}) => `
  SELECT
      h.TempCod,
      h.OriCod,
      LTRIM(RTRIM(o.Orinom)) AS OriNom,
      h.MovTDoc,
      h.MovNGuia,
      h.MovFecha,
      LTRIM(RTRIM(h.MovProd)) AS MovProd,
      LTRIM(RTRIM(p.ProdNom)) AS ProdNom,
      d.Mov1Nlote,
      d.Mov1Cuar,
      LTRIM(RTRIM(q.CuarNom)) AS CuarNom,
      d.Mov1Espe,
      LTRIM(RTRIM(e.EspeNom)) AS EspeNom,
      d.Mov1Var,
      LTRIM(RTRIM(v.VarNom)) AS VarNom,
      COALESCE(d.Mov1NumE,0) AS Mov1NumE,
      COALESCE(d.Mov1KilB,0) AS Mov1KilB,
      COALESCE(d.Mov1KilN,0) AS Mov1KilN,
      quality.CalRecId AS qualityControlId,
      quality.CalRecFecha AS qualityInspectionDate,
      quality.CalRecEstado AS qualityState,
      quality.CalRecPorCalidad AS qualityPercentage,
      CASE WHEN quality.CalRecId IS NULL THEN 'Sin control'
        WHEN quality.CalRecEstado='F' THEN 'Finalizado' ELSE 'Borrador' END AS qualityStatus
    INTO #Result
    FROM MOVFRUT h
    JOIN MOVFRUT1 d ON d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod
      AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd
    LEFT JOIN ORIGEN o ON o.EmpCod=h.EmpCod AND o.OriCod=h.OriCod
    LEFT JOIN PRODUCTORES p ON p.EmpCod=h.EmpCod AND p.ProdCod=h.MovProd
    LEFT JOIN PRODUCTORES1 q ON q.EmpCod=d.EmpCod AND q.ProdCod=d.MovProd AND q.CuarCod=d.Mov1Cuar
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.Mov1Espe
    LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Mov1Espe AND v.VarCod=d.Mov1Var
    OUTER APPLY (
      SELECT TOP (1) c.CalRecId,c.CalRecFecha,c.CalRecEstado,c.CalRecPorCalidad
      FROM CALRECEP c
      WHERE c.EmpCod=d.EmpCod AND c.TempCod=d.TempCod AND c.OriCod=d.OriCod
        AND c.MovTDoc=d.MovTDoc AND c.MovNGuia=d.MovNGuia AND c.MovProd=d.MovProd
        AND c.Mov1Nlote=d.Mov1Nlote AND c.CalRecEstado<>'A'
      ORDER BY c.CalRecFecha DESC,c.CalRecHora DESC,c.CalRecId DESC
    ) quality
    WHERE h.EmpCod=@EmpCod AND h.TMcod=1 AND h.TMSCod=1
      AND (@TempCod IS NULL OR h.TempCod=@TempCod)
      AND (@FromDate IS NULL OR h.MovFecha>=@FromDate)
      AND (@ToDate IS NULL OR h.MovFecha<DATEADD(day,1,@ToDate))
      AND (@Origin IS NULL OR h.OriCod=@Origin)
      AND (@Producer IS NULL OR h.MovProd=@Producer)
      AND (@Quarter IS NULL OR d.Mov1Cuar=@Quarter)
      AND (@Species IS NULL OR d.Mov1Espe=@Species);
  SELECT COUNT_BIG(*) AS total,
    COALESCE(SUM(Mov1NumE),0) AS totalEnvases,
    COALESCE(SUM(Mov1KilB),0) AS totalKilosBrutos,
    COALESCE(SUM(Mov1KilN),0) AS totalKilosNetos
  FROM #Result;
  SELECT * FROM #Result
  ORDER BY MovFecha DESC, MovNGuia DESC, Mov1Nlote
  ${paginated ? 'OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY' : ''};
`;

const executeQuery = async (view, empCod, input, options = {}) => {
  const filters = normalizeFilters(input, { paginate: options.paginated !== false });
  const pool = await getPool();
  const request = bindCommonInputs(pool.request(), empCod, filters);
  const result = await request.query(view === 'summary' ? summarySql(options) : detailSql(options));
  const totals = result.recordsets[0]?.[0] || {};
  return {
    view,
    page: filters.page,
    limit: filters.limit,
    total: Number(totals.total || 0),
    totals: {
      envases: Number(totals.totalEnvases || 0),
      kilosBrutos: Number(totals.totalKilosBrutos || 0),
      kilosNetos: Number(totals.totalKilosNetos || 0)
    },
    rows: result.recordsets[1] || [],
    filters
  };
};

const listSummary = (empCod, input) => executeQuery('summary', empCod, input, { paginated: true });
const listDetail = (empCod, input) => executeQuery('detail', empCod, input, { paginated: true });
const exportRows = (view, empCod, input) => executeQuery(view, empCod, input, { paginated: false });

const listCatalogs = async (empCod) => {
  const pool = await getPool();
  const request = pool.request().input('EmpCod', sql.SmallInt, empCod);
  const result = await request.query(`
    SELECT RTRIM(TempCod) AS value, RTRIM(TempDes) AS label, TempActiva AS active
    FROM TEMP01 WHERE EmpCod=@EmpCod ORDER BY TempCod DESC;
    SELECT OriCod AS value, CONCAT(OriCod, '.-', RTRIM(Orinom)) AS label
    FROM ORIGEN WHERE EmpCod=@EmpCod AND OriCod>0 AND OriEst=1 ORDER BY OriCod;
    SELECT RTRIM(ProdCod) AS value, CONCAT(RTRIM(ProdCod), '.-', RTRIM(ProdNom)) AS label
    FROM PRODUCTORES WHERE EmpCod=@EmpCod ORDER BY ProdCod;
    SELECT RTRIM(ProdCod) AS producer, CuarCod AS value, CONCAT(CuarCod, '.-', RTRIM(CuarNom)) AS label
    FROM PRODUCTORES1 WHERE EmpCod=@EmpCod ORDER BY ProdCod,CuarCod;
    SELECT Especod AS value, RTRIM(EspeNom) AS label
    FROM ESPECIES WHERE EmpCod=@EmpCod ORDER BY EspeNom,Especod;
  `);
  return {
    seasons: result.recordsets[0] || [],
    origins: result.recordsets[1] || [],
    producers: result.recordsets[2] || [],
    quarters: result.recordsets[3] || [],
    species: result.recordsets[4] || []
  };
};

const getCompany = async (empCod) => {
  const pool = await getPool();
  const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
    SELECT EmpCod, RTRIM(EmpNom) AS EmpNom, RTRIM(EmpGiro) AS EmpGiro, RTRIM(Empdir) AS EmpDir,
      EmpRut, RTRIM(EmpDV) AS EmpDV
    FROM DEFEMP WHERE EmpCod=@EmpCod;
  `);
  return result.recordset[0] || { EmpCod };
};

module.exports = {
  RecepcionFrutaError,
  normalizeFilters,
  summarySql,
  detailSql,
  listSummary,
  listDetail,
  exportRows,
  listCatalogs,
  getCompany
};

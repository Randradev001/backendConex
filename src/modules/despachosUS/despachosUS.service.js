const { getPool, sql } = require("../../conectorMysql/conectorSqlServer");
const { nextCorrelative } = require("../../services/gxCorrelatives.service");
const sagService = require("../despachosSAG/despachosSAG.service");
const { renderDespachoUSPdf } = require("./despachosUS.pdf");
const {
  DespachosSAGError,
  defaultRange,
  listFilters: baseListFilters,
  statusLabel,
} = require("../despachosSAG/despachosSAG.service");

const permission = { sistema: 100, modulo: 20, programa: 11 };
const processTypes = [2, 3];

const trim = (value) => String(value ?? "").trim();

const processTypeLabel = (type) =>
  ({ 2: "Fumigación", 3: "Muestreo" })[Number(type)] || "USDA";

const typeFilter = (query = {}) => {
  const raw = query.type ?? query.dorTipPlani ?? 2;
  const type = Number(raw === "" || raw === null ? 2 : raw);
  if (!Number.isInteger(type) || (type !== 9 && !processTypes.includes(type))) {
    throw new DespachosSAGError(
      400,
      "VALIDATION_ERROR",
      "El tipo de proceso debe ser Fumigación, Muestreo o Todos.",
    );
  }
  return type;
};

const usListFilters = (query = {}) => ({
  ...baseListFilters(query),
  type: typeFilter(query),
  all: String(query.all || "").toLowerCase() === "true" || String(query.all) === "1",
});

const getFormData = async (empCod, { poolProvider = getPool } = {}) => {
  const data = await sagService.getDespachoFormData(empCod, { poolProvider });
  const types = (data.types || []).filter((item) => processTypes.includes(Number(item.code)));
  return {
    ...data,
    types,
    processTypes: [{ code: 9, name: "Todos" }, ...types],
    defaultRange: data.defaultRange || defaultRange(),
  };
};

const listDespachos = async (
  empCod,
  query = {},
  { poolProvider = getPool } = {},
) => {
  const filters = usListFilters(query);
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("From", sql.Date, filters.from)
    .input("To", sql.Date, filters.to)
    .input("Status", sql.SmallInt, filters.status)
    .input("DorTipPlani", sql.SmallInt, filters.type)
    .input("Planilla", sql.Decimal(10, 0), filters.planilla)
    .input("Guide", sql.Decimal(10, 0), filters.guide)
    .input("Search", sql.NVarChar(120), filters.search)
    .input("Offset", sql.Int, (filters.page - 1) * filters.pageSize)
    .input("PageSize", sql.Int, filters.pageSize)
    .query(`
    DECLARE @TempCod char(9)=(
      SELECT TOP 1 TempCod FROM TEMP01
      WHERE EmpCod=@EmpCod AND TempActiva=1
      ORDER BY TempFecAbre DESC,TempCod DESC
    );
    SELECT h.DORNum id,h.DORNum internalNumber,h.DORNumf planillaNumber,h.DorNguia guideNumber,
      h.DorTipPlani processType,CONVERT(char(10),h.DorFecha,23) shipmentDate,
      COALESCE(NULLIF(RTRIM(h.DorNPuertoE),''),RTRIM(pe.PuNombre)) embarkPort,
      COALESCE(NULLIF(RTRIM(h.DorNpuertoD),''),RTRIM(pd.PuNombre)) destinationPort,
      COALESCE(NULLIF(RTRIM(h.DestNom),''),RTRIM(ds.DestNom)) destinationName,
      COALESCE(h.DorTotCajas,0) totalBoxes,COALESCE(h.DorTotKilos,0) totalKilos,
      COALESCE(h.DorTotFol,0) totalFolios,h.DorEstado status,
      COALESCE(NULLIF(RTRIM(h.DANombre),''),RTRIM(da.DANombre)) authorizedDispatcher,
      RTRIM(h.DorNSellos) seals,RTRIM(h.DorTipoTrans) transportType,
      RTRIM(h.DorLogcre) createdBy,CONVERT(char(10),h.DorFecCrea,23) createdDate,
      RTRIM(h.DorLogAnula) annulledBy,CONVERT(char(10),h.DorFecAnula,23) annulledDate
    INTO #filtered
    FROM DESORIGEN h
    LEFT JOIN PUERTOS pe ON pe.PuCod=h.DorPuertoE
    LEFT JOIN PUERTOS pd ON pd.PuCod=h.DorPuertoD
    LEFT JOIN DESTINOS ds ON ds.DestCod=h.DestCod
    LEFT JOIN DESPAAUTO da ON da.EmpCod=h.EmpCod AND da.DACod=h.DACod
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
      AND h.DorTipPlani IN (2,3)
      AND (@DorTipPlani=9 OR h.DorTipPlani=@DorTipPlani)
      AND (@From IS NULL OR h.DorFecha>=@From) AND (@To IS NULL OR h.DorFecha<DATEADD(day,1,@To))
      AND (@Planilla=0 OR h.DORNumf=@Planilla)
      AND (@Guide=0 OR h.DorNguia=@Guide)
      AND (@Status=9 OR h.DorEstado=@Status)
      AND (@Search='' OR CONVERT(varchar(20),h.DORNum) LIKE '%'+@Search+'%' OR CONVERT(varchar(20),h.DORNumf) LIKE '%'+@Search+'%' OR CONVERT(varchar(20),h.DorNguia) LIKE '%'+@Search+'%' OR ISNULL(h.DorNPuertoE,'') LIKE '%'+@Search+'%' OR ISNULL(h.DorNpuertoD,'') LIKE '%'+@Search+'%' OR ISNULL(h.DestNom,'') LIKE '%'+@Search+'%');
    SELECT id,internalNumber,planillaNumber,guideNumber,processType,shipmentDate,embarkPort,destinationPort,
      destinationName,totalBoxes,totalKilos,totalFolios,status,authorizedDispatcher,seals,
      transportType,createdBy,createdDate,annulledBy,annulledDate
    FROM #filtered
    ORDER BY internalNumber DESC
    ${filters.all ? ";" : "OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;"}
    SELECT COUNT(*) total,COALESCE(SUM(CONVERT(bigint,totalBoxes)),0) totalBoxes,
      COALESCE(SUM(CONVERT(decimal(19,2),totalKilos)),0) totalKilos,
      COALESCE(SUM(CONVERT(bigint,totalFolios)),0) totalFolios,
      SUM(CASE WHEN status=0 THEN 1 ELSE 0 END) inProgress,
      SUM(CASE WHEN status=1 THEN 1 ELSE 0 END) finalized,
      SUM(CASE WHEN status=5 THEN 1 ELSE 0 END) annulled
    FROM #filtered;
    SELECT RTRIM(@TempCod) tempCod;
  `);
  const summary = result.recordsets?.[1]?.[0] || {};
  const tempCod = trim(result.recordsets?.[2]?.[0]?.tempCod);
  if (!tempCod) {
    throw new DespachosSAGError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa. Active una temporada antes de consultar despachos US.",
    );
  }
  return {
    rows: (result.recordsets?.[0] || []).map((row) => ({
      ...row,
      processTypeLabel: processTypeLabel(row.processType),
      statusLabel: statusLabel(row.status),
    })),
    total: Number(summary.total || 0),
    totals: {
      boxes: Number(summary.totalBoxes || 0),
      kilos: Number(summary.totalKilos || 0),
      folios: Number(summary.totalFolios || 0),
    },
    statusCounts: { inProgress: Number(summary.inProgress || 0), finalized: Number(summary.finalized || 0), annulled: Number(summary.annulled || 0) },
    tempCod,
    filters,
  };
};

const validId = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9999999999) {
    throw new DespachosSAGError(400, "VALIDATION_ERROR", "El N° interno no es válido.");
  }
  return parsed;
};

const validType = (value) => {
  const type = Number(value);
  if (!Number.isInteger(type) || !processTypes.includes(type)) {
    throw new DespachosSAGError(400, "VALIDATION_ERROR", "El tipo de proceso debe ser Fumigación o Muestreo.");
  }
  return type;
};

const correlativeCode = (type) => (Number(type) === 2 ? "DFUMIOR" : "DMUESOR");

const finalizarDespacho = async (
  empCod,
  dorNumValue,
  dorTipPlaniValue = 2,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
    nextNumber = nextCorrelative,
  } = {},
) => {
  const dorNum = validId(dorNumValue);
  const dorTipPlani = validType(dorTipPlaniValue);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const season = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .query(`
        SELECT TOP 1 RTRIM(TempCod) tempCod
        FROM TEMP01 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempActiva=1
        ORDER BY TempFecAbre DESC,TempCod DESC;
      `);
    const tempCod = trim(season.recordset?.[0]?.tempCod);
    if (!tempCod) {
      throw new DespachosSAGError(409, "ACTIVE_SEASON_NOT_FOUND", "No existe una temporada activa para la empresa.");
    }

    const current = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DorTipPlani", sql.SmallInt, dorTipPlani)
      .input("DORNum", sql.Decimal(10, 0), dorNum)
      .query(`
        SELECT TOP 1 DorEstado
        FROM DESORIGEN WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;
      `);
    const header = current.recordset?.[0];
    if (!header) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
    if (Number(header.DorEstado) === 1) throw new DespachosSAGError(409, "DESPACHO_ALREADY_FINALIZED", "El despacho ya está Finalizado.");
    if (Number(header.DorEstado) === 5) throw new DespachosSAGError(409, "DESPACHO_VOID", "No se puede finalizar un despacho Nulo.");
    if (Number(header.DorEstado) !== 0) throw new DespachosSAGError(409, "DESPACHO_LOCKED", "Solo se puede finalizar un despacho En Proceso.");

    // CamEstDespaUS obtiene un correlativo distinto para Fumigación y Muestreo.
    const planillaNumber = await nextNumber({
      transaction,
      empCod,
      code: correlativeCode(dorTipPlani),
      digits: 10,
    });
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DorTipPlani", sql.SmallInt, dorTipPlani)
      .input("DORNum", sql.Decimal(10, 0), dorNum)
      .input("Planilla", sql.Decimal(10, 0), planillaNumber)
      .query(`
        UPDATE DESORIGEN
        SET DorEstado=1,DORNumf=@Planilla
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani
          AND DORNum=@DORNum AND DorEstado=0;
      `);
    await transaction.commit();
    return {
      dorNum,
      dorTipPlani,
      planillaNumber,
      status: 1,
      statusLabel: statusLabel(1),
    };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError
      ? error
      : new DespachosSAGError(500, "DESPACHO_FINALIZE_ERROR", error.message);
  }
};

const ensureUSType = (value = 2) => validType(value);

const getDespachoDetail = (empCod, dorNum, type = 2, options = {}) =>
  sagService.getDespachoDetail(empCod, dorNum, ensureUSType(type), options);

const createDespacho = (empCod, login, payload = {}, options = {}) =>
  sagService.createDespacho(
    empCod,
    login,
    { ...payload, dorTipPlani: ensureUSType(payload.dorTipPlani ?? payload.type ?? 2) },
    options,
  );

const updateDespacho = (empCod, login, dorNum, payload = {}, options = {}) =>
  sagService.updateDespacho(
    empCod,
    login,
    dorNum,
    { ...payload, dorTipPlani: ensureUSType(payload.dorTipPlani ?? payload.type ?? 2) },
    options,
  );

const anularDespacho = (empCod, login, dorNum, type = 2, options = {}) =>
  sagService.anularDespacho(empCod, login, dorNum, ensureUSType(type), options);

const listAvailableDespachoFolios = (empCod, dorNum, type = 2, query = {}, options = {}) =>
  sagService.listAvailableDespachoFolios(empCod, dorNum, ensureUSType(type), query, options);

const addFolioToDespacho = (empCod, login, dorNum, payload = {}, options = {}) =>
  sagService.addFolioToDespacho(
    empCod,
    login,
    dorNum,
    { ...payload, dorTipPlani: ensureUSType(payload.dorTipPlani ?? payload.type ?? 2) },
    options,
  );

const removeFolioFromDespacho = (empCod, dorNum, folio, payload = {}, options = {}) =>
  sagService.removeFolioFromDespacho(
    empCod,
    dorNum,
    folio,
    { ...payload, dorTipPlani: ensureUSType(payload.dorTipPlani ?? payload.type ?? 2) },
    options,
  );

const getDespachoPdfData = async (empCod, dorNum, type = 2, { poolProvider = getPool } = {}) => {
  const dorTipPlani = ensureUSType(type);
  const detail = await getDespachoDetail(empCod, dorNum, dorTipPlani, { poolProvider });
  const pool = await poolProvider();
  const result = await pool.request().input("EmpCod", sql.SmallInt, empCod).query(`
    SELECT TOP 1 RTRIM(EmpNom) companyName,RTRIM(EmpGiro) companyBusiness,
      RTRIM(Empdir) companyAddress,EmpRut companyRut,RTRIM(EmpDV) companyDv,
      RTRIM(EmpCodCom) companyCommuneCode,EmpCodSAG companySAGCode
    FROM DEFEMP WHERE EmpCod=@EmpCod;
  `);
  return {
    ...detail,
    header: {
      ...detail.header,
      ...result.recordset?.[0],
      processTypeLabel: processTypeLabel(dorTipPlani),
      companyName: trim(result.recordset?.[0]?.companyName),
      companyBusiness: trim(result.recordset?.[0]?.companyBusiness),
      companyAddress: trim(result.recordset?.[0]?.companyAddress),
      companyDv: trim(result.recordset?.[0]?.companyDv),
      companyCommuneCode: trim(result.recordset?.[0]?.companyCommuneCode),
    },
  };
};

const generateDespachoUSPdf = async (
  empCod,
  dorNum,
  type = 2,
  { poolProvider = getPool, pdfRenderer = renderDespachoUSPdf } = {},
) => {
  const data = await getDespachoPdfData(empCod, dorNum, type, { poolProvider });
  const number = trim(data.header.DORNumf || data.header.DORNum) || "despacho";
  return {
    filename: `Planilla_Despacho_US_${number}.pdf`,
    content: await pdfRenderer(data),
  };
};

module.exports = {
  permission,
  processTypes,
  processTypeLabel,
  correlativeCode,
  getFormData,
  getDespachoDetail,
  createDespacho,
  updateDespacho,
  anularDespacho,
  listAvailableDespachoFolios,
  addFolioToDespacho,
  removeFolioFromDespacho,
  getDespachoPdfData,
  generateDespachoUSPdf,
  usListFilters,
  listDespachos,
  finalizarDespacho,
  DespachosSAGError,
};

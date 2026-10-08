const { getPool, sql } = require("../../conectorMysql/conectorSqlServer");
const { nextCorrelative } = require("../../services/gxCorrelatives.service");
const { renderDespachoPdf } = require("./despachosSAG.pdf");

const permission = { sistema: 100, modulo: 20, programa: 3 };

class DespachosSAGError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const trim = (value) => String(value ?? "").trim();

const isoLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultRange = (today = new Date()) => {
  const from = new Date(today.getTime());
  from.setDate(from.getDate() - 30);
  return { from: isoLocal(from), to: isoLocal(today) };
};

const dateValue = (value, label) => {
  const raw = trim(value);
  const display = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = display
    ? `${display[3]}-${display[2]}-${display[1]}`
    : raw.slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
    Number.isNaN(Date.parse(`${normalized}T00:00:00`))
  ) {
    throw new DespachosSAGError(
      400,
      "VALIDATION_ERROR",
      `${label} debe ser una fecha válida en formato DD/MM/YYYY.`,
    );
  }
  return normalized;
};

const integer = (
  value,
  label,
  { min = 0, max = Number.MAX_SAFE_INTEGER, defaultValue = null } = {},
) => {
  if (value === undefined || value === null || trim(value) === "")
    return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new DespachosSAGError(
      400,
      "VALIDATION_ERROR",
      `${label} debe ser un número entero dentro del rango permitido.`,
    );
  }
  return parsed;
};

const listFilters = (query = {}) => {
  const defaults = defaultRange();
  const from = dateValue(query.from || defaults.from, "La fecha desde");
  const to = dateValue(query.to || defaults.to, "La fecha hasta");
  if (from > to) {
    throw new DespachosSAGError(
      400,
      "VALIDATION_ERROR",
      "La fecha desde no puede ser posterior a la fecha hasta.",
    );
  }
  const status = integer(query.status, "El estado", {
    min: 0,
    max: 9,
    defaultValue: 9,
  });
  if (![0, 1, 5, 9].includes(status)) {
    throw new DespachosSAGError(
      400,
      "VALIDATION_ERROR",
      "El estado debe ser En Proceso, Finalizado, Nula o Todos.",
    );
  }
  return {
    from,
    to,
    status,
    planilla: integer(query.planilla, "El número de planilla", {
      min: 0,
      max: 9999999999,
      defaultValue: 0,
    }),
    guide: integer(query.guide, "El número de guía", {
      min: 0,
      max: 9999999999,
      defaultValue: 0,
    }),
    page: integer(query.page, "La página", { min: 1, max: 100000, defaultValue: 1 }),
    pageSize: integer(query.pageSize, "El tamaño de página", {
      min: 1,
      max: 100,
      defaultValue: 25,
    }),
  };
};

const statusLabel = (status) =>
  ({ 0: "En Proceso", 1: "Finalizado", 5: "Nula" })[Number(status)] || "Desconocido";

const getFormData = async (empCod, { poolProvider = getPool } = {}) => {
  const pool = await poolProvider();
  const result = await pool.request().input("EmpCod", sql.SmallInt, empCod).query(`
    SELECT TOP 1 RTRIM(TempCod) tempCod
    FROM TEMP01
    WHERE EmpCod=@EmpCod AND TempActiva=1
    ORDER BY TempFecAbre DESC,TempCod DESC;
    SELECT TOP 1 RTRIM(EmpNom) companyName
    FROM DEFEMP
    WHERE EmpCod=@EmpCod;
  `);
  const active = result.recordsets?.[0]?.[0];
  if (!active) {
    throw new DespachosSAGError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa. Active una temporada antes de consultar despachos SAG.",
    );
  }
  return {
    tempCod: trim(active.tempCod),
    companyName: trim(result.recordsets?.[1]?.[0]?.companyName),
    defaultRange: defaultRange(),
    states: [
      { code: 0, name: "En Proceso" },
      { code: 1, name: "Finalizado" },
      { code: 5, name: "Nula" },
      { code: 9, name: "Todos" },
    ],
  };
};

const listDespachos = async (
  empCod,
  query = {},
  { poolProvider = getPool } = {},
) => {
  const filters = listFilters(query);
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("From", sql.Date, filters.from)
    .input("To", sql.Date, filters.to)
    .input("Status", sql.SmallInt, filters.status)
    .input("Planilla", sql.Decimal(10, 0), filters.planilla)
    .input("Guide", sql.Decimal(10, 0), filters.guide)
    .input("Offset", sql.Int, (filters.page - 1) * filters.pageSize)
    .input("PageSize", sql.Int, filters.pageSize)
    .query(`
    DECLARE @TempCod char(9)=(
      SELECT TOP 1 TempCod FROM TEMP01
      WHERE EmpCod=@EmpCod AND TempActiva=1
      ORDER BY TempFecAbre DESC,TempCod DESC
    );
    SELECT h.DORNum id,h.DORNum internalNumber,h.DORNumf planillaNumber,h.DorNguia guideNumber,
      CONVERT(char(10),h.DorFecha,23) shipmentDate,
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
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DorTipPlani=1
      AND h.DorFecha>=@From AND h.DorFecha<DATEADD(day,1,@To)
      AND (@Planilla=0 OR h.DORNumf=@Planilla)
      AND (@Guide=0 OR h.DorNguia=@Guide)
      AND (@Status=9 OR h.DorEstado=@Status);
    SELECT id,internalNumber,planillaNumber,guideNumber,shipmentDate,embarkPort,destinationPort,
      destinationName,totalBoxes,totalKilos,totalFolios,status,authorizedDispatcher,seals,
      transportType,createdBy,createdDate,annulledBy,annulledDate
    FROM #filtered
    ORDER BY internalNumber DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(*) total,COALESCE(SUM(CONVERT(bigint,totalBoxes)),0) totalBoxes,
      COALESCE(SUM(CONVERT(decimal(19,2),totalKilos)),0) totalKilos,
      COALESCE(SUM(CONVERT(bigint,totalFolios)),0) totalFolios
    FROM #filtered;
    SELECT RTRIM(@TempCod) tempCod;
  `);
  const summary = result.recordsets?.[1]?.[0] || {};
  const tempCod = trim(result.recordsets?.[2]?.[0]?.tempCod);
  if (!tempCod) {
    throw new DespachosSAGError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa. Active una temporada antes de consultar despachos SAG.",
    );
  }
  return {
    rows: (result.recordsets?.[0] || []).map((row) => ({
      ...row,
      statusLabel: statusLabel(row.status),
    })),
    total: Number(summary.total || 0),
    totals: {
      boxes: Number(summary.totalBoxes || 0),
      kilos: Number(summary.totalKilos || 0),
      folios: Number(summary.totalFolios || 0),
    },
    tempCod,
    filters,
  };
};

const validId = (value, label = "N° interno") =>
  integer(value, label, { min: 1, max: 9999999999 });

const getDespachoPdfData = async (
  empCod,
  dorNumValue,
  { poolProvider = getPool } = {},
) => {
  const dorNum = validId(dorNumValue);
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("DORNum", sql.Decimal(10, 0), dorNum)
    .query(`
    DECLARE @TempCod char(9)=(
      SELECT TOP 1 TempCod FROM TEMP01
      WHERE EmpCod=@EmpCod AND TempActiva=1
      ORDER BY TempFecAbre DESC,TempCod DESC
    );
    SELECT h.DORNum internalNumber,h.DORNumf planillaNumber,h.DorNguia guideNumber,
      CONVERT(char(10),h.DorFecha,23) shipmentDate,h.DorPuertoE embarkPortCode,
      COALESCE(NULLIF(RTRIM(h.DorNPuertoE),''),RTRIM(pe.PuNombre)) embarkPort,
      h.DorPuertoD destinationPortCode,
      COALESCE(NULLIF(RTRIM(h.DorNpuertoD),''),RTRIM(pd.PuNombre)) destinationPort,
      h.DestCod destinationCode,COALESCE(NULLIF(RTRIM(h.DestNom),''),RTRIM(ds.DestNom)) destinationName,
      h.ConsCod consigneeCode,COALESCE(NULLIF(RTRIM(h.ConsNom),''),RTRIM(c.ConsNom)) consigneeName,
      h.AgeCod agentCode,COALESCE(NULLIF(RTRIM(h.AgeNom),''),RTRIM(a.AgeNom)) agentName,
      h.Agerut agentRut,h.AgeDv agentDv,h.ExpCod exporterCode,
      COALESCE(NULLIF(RTRIM(h.ExpNom),''),RTRIM(e.ExpNom)) exporterName,h.ExpRut exporterRut,h.ExpDv exporterDv,
      RTRIM(h.DorTipoTrans) transportType,RTRIM(h.DorPatente) patent,RTRIM(h.DorNSellos) seals,
      RTRIM(h.DorUbicacion) location,RTRIM(h.DorNave) vessel,RTRIM(h.DorObs1) observations,
      h.DACod dispatcherCode,COALESCE(NULLIF(RTRIM(h.DANombre),''),RTRIM(da.DANombre)) dispatcherName,
      h.DorTotCajas totalBoxes,h.DorTotKilos totalKilos,h.DorTotFol totalFolios,h.DorEstado status,
      RTRIM(h.DorLogcre) createdBy,CONVERT(char(10),h.DorFecCrea,23) createdDate,
      RTRIM(h.DorLogAnula) annulledBy,CONVERT(char(10),h.DorFecAnula,23) annulledDate,
      h.Dortrata treatment,h.DorTrata2 treatment2,h.Dortrata3 treatment3,h.DorCodTrata treatmentCode,
      h.DorPalBin palletBin,h.DorTipoD shipmentType
    FROM DESORIGEN h
    LEFT JOIN PUERTOS pe ON pe.PuCod=h.DorPuertoE
    LEFT JOIN PUERTOS pd ON pd.PuCod=h.DorPuertoD
    LEFT JOIN DESTINOS ds ON ds.DestCod=h.DestCod
    LEFT JOIN CONSIG c ON c.EmpCod=h.EmpCod AND c.ConsCod=h.ConsCod
    LEFT JOIN AGENTES a ON a.EmpCod=h.EmpCod AND a.AgeCod=h.AgeCod
    LEFT JOIN EXPORT1 e ON e.EmpCod=h.EmpCod AND e.ExpCod=h.ExpCod
    LEFT JOIN DESPAAUTO da ON da.EmpCod=h.EmpCod AND da.DACod=h.DACod
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DorTipPlani=1 AND h.DORNum=@DORNum;
    SELECT RTRIM(d.dor1Folio) folio,d.dor1espe speciesCode,
      COALESCE(NULLIF(RTRIM(d.Dor1Nespe),''),RTRIM(e.EspeNom)) speciesName,
      d.Dor1Cajas boxes,d.Dor1Kilos kilos,d.Dor1Nsol inspectionNumber
    FROM DESORIGEN1 d
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.dor1espe
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=1 AND d.DORNum=@DORNum
    ORDER BY d.dor1Folio;
    SELECT RTRIM(d.dor1Folio) folio,d.Dor2Corr correlation,d.Dor2espe speciesCode,
      COALESCE(NULLIF(RTRIM(d.Dor2Nespe),''),RTRIM(e.EspeNom)) speciesName,d.Dor2var varietyCode,
      COALESCE(NULLIF(RTRIM(d.Dor2Nvar),''),RTRIM(v.VarNom)) varietyName,
      RTRIM(d.Dor2Prod) producerCode,COALESCE(NULLIF(RTRIM(d.Dor2NProd),''),RTRIM(p.ProdNom)) producerName,
      COALESCE(NULLIF(RTRIM(d.Dor2ComP),''),RTRIM(p.ProdComuna)) commune,
      COALESCE(NULLIF(RTRIM(d.Dor2ProvP),''),RTRIM(p.ProdProvincia)) province,
      COALESCE(NULLIF(RTRIM(d.Dor2CSG),''),RTRIM(p.ProdCodSAG)) originCsg,
      d.Dor2fecproc processDate,d.Dor2env containerCode,
      COALESCE(NULLIF(RTRIM(d.Dor2NeNV),''),RTRIM(n.EnvNom)) containerName,
      d.Dor2cat categoryCode,COALESCE(NULLIF(RTRIM(d.Dor2Ncat),''),RTRIM(c.CatNom)) categoryName,
      RTRIM(d.Dor2cal) caliber,d.Dor2Cajas boxes,d.Dor2Kilos kilos
    FROM DESORIGEN2 d
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.Dor2espe
    LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Dor2espe AND v.VarCod=d.Dor2var
    LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND RTRIM(p.ProdCod)=RTRIM(d.Dor2Prod)
    LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Dor2env
    LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.Dor2env AND c.Catcod=d.Dor2cat
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=1 AND d.DORNum=@DORNum
    ORDER BY d.dor1Folio,d.Dor2espe,d.Dor2var,d.Dor2env,d.Dor2Prod,d.Dor2Corr;
    SELECT TOP 1 RTRIM(EmpNom) companyName,RTRIM(EmpGiro) companyBusiness,
      RTRIM(Empdir) companyAddress,EmpRut companyRut,RTRIM(EmpDV) companyDv,
      RTRIM(Empreg) companyRegion,RTRIM(Empcom) companyCommune,
      RTRIM(EmpCodCom) companyCommuneCode,EmpCodSAG companySAGCode
    FROM DEFEMP WHERE EmpCod=@EmpCod;
    SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01
    WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC;
  `);
  const header = result.recordsets?.[0]?.[0];
  if (!header) {
    throw new DespachosSAGError(
      404,
      "DESPACHO_NOT_FOUND",
      "El despacho no existe en la temporada activa de la empresa.",
    );
  }
  return {
    header: {
      ...header,
      tempCod: trim(result.recordsets?.[4]?.[0]?.tempCod),
      statusLabel: statusLabel(header.status),
      companyName: trim(result.recordsets?.[3]?.[0]?.companyName),
      companyBusiness: trim(result.recordsets?.[3]?.[0]?.companyBusiness),
      companyAddress: trim(result.recordsets?.[3]?.[0]?.companyAddress),
      companyRut: result.recordsets?.[3]?.[0]?.companyRut,
      companyDv: trim(result.recordsets?.[3]?.[0]?.companyDv),
      companyRegion: trim(result.recordsets?.[3]?.[0]?.companyRegion),
      companyCommune: trim(result.recordsets?.[3]?.[0]?.companyCommune),
      companyCommuneCode: trim(result.recordsets?.[3]?.[0]?.companyCommuneCode),
      companySAGCode: result.recordsets?.[3]?.[0]?.companySAGCode,
    },
    folios: result.recordsets?.[1] || [],
    details: result.recordsets?.[2] || [],
  };
};

const generateDespachoPdf = async (
  empCod,
  dorNumValue,
  { poolProvider = getPool, pdfRenderer = renderDespachoPdf } = {},
) => {
  const data = await getDespachoPdfData(empCod, dorNumValue, { poolProvider });
  const number = trim(data.header.planillaNumber || data.header.internalNumber) || "despacho";
  return {
    filename: `Planilla_Despacho_${number}.pdf`,
    content: await pdfRenderer(data),
  };
};

const plainInteger = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999999999) {
    throw new DespachosSAGError(
      409,
      "DES_FILE_VALUE_INVALID",
      `${label} no es compatible con el formato de archivo DES.`,
    );
  }
  return String(parsed);
};

const generateArchivoDes = async (
  empCod,
  dorNumValue,
  { poolProvider = getPool } = {},
) => {
  const dorNum = validId(dorNumValue);
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("DORNum", sql.Decimal(10, 0), dorNum)
    .query(`
    DECLARE @TempCod char(9)=(
      SELECT TOP 1 TempCod FROM TEMP01
      WHERE EmpCod=@EmpCod AND TempActiva=1
      ORDER BY TempFecAbre DESC,TempCod DESC
    );
    SELECT TOP 1 h.DORNum,h.DORNumf,h.DestCod,CONVERT(char(8),h.DorFecha,112) fileDate,
      h.DorTotFol,h.DorEstado,
      p.PAR1Valor1 codePl
    FROM DESORIGEN h
    LEFT JOIN PARAMGE1 p ON p.EmpCod=@EmpCod AND p.PARCod=20 AND p.PAR1Cod=30
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DorTipPlani=1 AND h.DORNum=@DORNum;
    SELECT RTRIM(d.dor1Folio) folio,d.Dor1Cajas boxes,
      RTRIM(CONVERT(varchar(20),e.EspeSag)) speciesSag
    FROM DESORIGEN1 d
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.dor1espe
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=1 AND d.DORNum=@DORNum
    ORDER BY d.dor1Folio;
  `);
  const header = result.recordsets?.[0]?.[0];
  if (!header) {
    throw new DespachosSAGError(
      404,
      "DESPACHO_NOT_FOUND",
      "El despacho no existe en la temporada activa de la empresa.",
    );
  }
  if (Number(header.DorEstado) !== 1) {
    throw new DespachosSAGError(
      409,
      "DESPACHO_NOT_FINALIZED",
      "El archivo DES solo puede generarse para despachos finalizados.",
    );
  }
  const codePl = plainInteger(header.codePl, "El código de planta PARAMGE1 20/30");
  const planilla = plainInteger(header.DORNumf, "El número de planilla");
  const destination = Number(header.DestCod) > 700 ? "700" : plainInteger(header.DestCod, "El destino");
  const date = trim(header.fileDate);
  if (!/^\d{8}$/.test(date)) {
    throw new DespachosSAGError(409, "DES_FILE_VALUE_INVALID", "La fecha del despacho no es válida.");
  }
  const folios = result.recordsets?.[1] || [];
  if (!folios.length) {
    throw new DespachosSAGError(
      409,
      "DES_FILE_WITHOUT_FOLIOS",
      "El despacho no tiene folios para generar el archivo DES.",
    );
  }
  const totalFolios = plainInteger(header.DorTotFol ?? folios.length, "El total de folios");
  const lines = [`${codePl}${destination}${date}${totalFolios}`];
  for (const folio of folios) {
    const speciesSag = trim(folio.speciesSag);
    if (!speciesSag) {
      throw new DespachosSAGError(
        409,
        "DES_FILE_VALUE_INVALID",
        `La especie del folio ${trim(folio.folio)} no tiene código SAG configurado.`,
      );
    }
    lines.push(`${trim(folio.folio)}${plainInteger(folio.boxes, `Las cajas del folio ${trim(folio.folio)}`)}${speciesSag}`);
  }
  lines.push("&&");
  return {
    filename: `${codePl}${planilla}.des`,
    content: Buffer.from(`${lines.join("\r\n")}\r\n`, "utf8"),
  };
};

const despachoTypes = [1, 2, 3];
const despachoTypeLabel = (type) =>
  ({ 1: "Origen", 2: "Fumigación", 3: "Muestreo" })[Number(type)] || "Despacho";

const optionalInteger = (value, label, { max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (value === undefined || value === null || trim(value) === "") return null;
  return integer(value, label, { min: 0, max, defaultValue: null });
};

const boundedText = (value, label, max, { required = false } = {}) => {
  const text = trim(value);
  if (required && !text)
    throw new DespachosSAGError(400, "VALIDATION_ERROR", `${label} es obligatorio.`);
  if (text.length > max)
    throw new DespachosSAGError(400, "VALIDATION_ERROR", `${label} admite hasta ${max} caracteres.`);
  return text;
};

const optionalDate = (value, label) => {
  if (value === undefined || value === null || trim(value) === "") return null;
  return dateValue(value, label);
};

const optionalMultipuertoDate = (value, label) => {
  if (value === undefined || value === null || trim(value) === "") return null;
  if (trim(value).length > 10)
    throw new DespachosSAGError(400, "VALIDATION_ERROR", `${label} admite hasta 10 caracteres.`);
  return dateValue(value, label);
};

const optionalMultipuertoLocation = (value, label) => {
  if (value === undefined || value === null || trim(value) === "" || Number(value) === 0) return null;
  return integer(value, label, { min: 1, max: 6, defaultValue: null });
};

const normalizeMultipuertoPayload = (payload = {}) => ({
  traCod: optionalInteger(payload.traCod ?? payload.TRACod, "El código de tratamiento", { max: 9999 }),
  traNom: boundedText(payload.traNom ?? payload.TRANom, "El nombre del tratamiento", 30),
  inacCod: optionalInteger(payload.inacCod ?? payload.INACCod, "El código de ingrediente activo", { max: 9999 }),
  inacNom: boundedText(payload.inacNom ?? payload.INACNom, "El nombre del ingrediente activo", 50),
  fecTra: optionalMultipuertoDate(payload.fecTra ?? payload.dmpFecTra ?? payload.DMPFecTra, "La fecha de tratamiento"),
  conTra: boundedText(payload.conTra ?? payload.dmpConTra ?? payload.DMPConTra, "La concentración de tratamiento", 50),
  duraTra: boundedText(payload.duraTra ?? payload.dmpDuraTra ?? payload.DMPDuraTra, "La duración de tratamiento", 50),
  ttmpCod: optionalInteger(payload.ttmpCod ?? payload.TTMPCod, "El código del tipo de transporte", { max: 9999 }),
  ttmpNom: boundedText(payload.ttmpNom ?? payload.TTMPNom, "El nombre del tipo de transporte", 30),
  sello1: boundedText(payload.sello1 ?? payload.dmpNSello1 ?? payload.DMPNSello1, "El sello 1", 30),
  sello2: boundedText(payload.sello2 ?? payload.dmpNSello2 ?? payload.DMPNSello2, "El sello 2", 30),
  sello3: boundedText(payload.sello3 ?? payload.dmpNSello3 ?? payload.DMPNSello3, "El sello 3", 30),
  sello4: boundedText(payload.sello4 ?? payload.dmpNSello4 ?? payload.DMPNSello4, "El sello 4", 30),
  ubi1: optionalMultipuertoLocation(payload.ubi1 ?? payload.dmpUbi1 ?? payload.DMPUbi1, "La ubicación 1"),
  ubi2: optionalMultipuertoLocation(payload.ubi2 ?? payload.dmpUbi2 ?? payload.DMPUbi2, "La ubicación 2"),
  ubi3: optionalMultipuertoLocation(payload.ubi3 ?? payload.dmpUbi3 ?? payload.DMPUbi3, "La ubicación 3"),
  ubi4: optionalMultipuertoLocation(payload.ubi4 ?? payload.dmpUbi4 ?? payload.DMPUbi4, "La ubicación 4"),
});

const multipuertoRow = (row = {}) => ({
  traCod: row.traCod ?? row.TRACod ?? "",
  traNom: trim(row.traNom ?? row.TRANom),
  inacCod: row.inacCod ?? row.INACCod ?? "",
  inacNom: trim(row.inacNom ?? row.INACNom),
  fecTra: trim(row.fecTra ?? row.DMPFecTra),
  conTra: trim(row.conTra ?? row.DMPConTra),
  duraTra: trim(row.duraTra ?? row.DMPDuraTra),
  ttmpCod: row.ttmpCod ?? row.TTMPCod ?? "",
  ttmpNom: trim(row.ttmpNom ?? row.TTMPNom),
  sello1: trim(row.sello1 ?? row.DMPNSello1),
  sello2: trim(row.sello2 ?? row.DMPNSello2),
  sello3: trim(row.sello3 ?? row.DMPNSello3),
  sello4: trim(row.sello4 ?? row.DMPNSello4),
  ubi1: row.ubi1 ?? row.DMPUbi1 ?? "",
  ubi2: row.ubi2 ?? row.DMPUbi2 ?? "",
  ubi3: row.ubi3 ?? row.DMPUbi3 ?? "",
  ubi4: row.ubi4 ?? row.DMPUbi4 ?? "",
});

const multipuertoSelect = `
  SELECT TOP 1 TRACod traCod,RTRIM(TRANom) traNom,INACCod inacCod,RTRIM(INACNom) inacNom,
    CONVERT(char(10),DMPFecTra,23) fecTra,RTRIM(DMPConTra) conTra,RTRIM(DMPDuraTra) duraTra,
    TTMPCod ttmpCod,RTRIM(TTMPNom) ttmpNom,RTRIM(DMPNSello1) sello1,RTRIM(DMPNSello2) sello2,
    RTRIM(DMPNSello3) sello3,RTRIM(DMPNSello4) sello4,DMPUbi1 ubi1,DMPUbi2 ubi2,DMPUbi3 ubi3,DMPUbi4 ubi4
  FROM DATMP
  WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DMPPlani=@DMPPlani;
`;

const getMultipuertoHeader = async (requestFactory, transaction, empCod, tempCod, dorNum) => {
  const result = await requestFactory(transaction)
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("DorTipPlani", sql.SmallInt, 1)
    .input("DORNum", sql.Decimal(10, 0), dorNum)
    .query(`
      SELECT TOP 1 h.DORNum,h.DORNumf,h.DorPuertoD,h.DorPatente,h.DorNguia,h.DorFecha,h.DorContenedor,h.DorTotFol,
        h.DestCod,h.DACod,COALESCE(NULLIF(RTRIM(h.DANombre),''),RTRIM(da.DANombre)) dispatcherName
      FROM DESORIGEN h
      LEFT JOIN DESPAAUTO da ON da.EmpCod=h.EmpCod AND da.DACod=h.DACod
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DorTipPlani=@DorTipPlani AND h.DORNum=@DORNum;
    `);
  return result.recordset?.[0];
};

const openMultipuerto = async (
  empCod,
  dorNumValue,
  { poolProvider = getPool, transactionFactory = (pool) => new sql.Transaction(pool), requestFactory = (transaction) => new sql.Request(transaction) } = {},
) => {
  const dorNum = validId(dorNumValue);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeTempForRequest(requestFactory(transaction), empCod, { lock: true });
    const header = await getMultipuertoHeader(requestFactory, transaction, empCod, tempCod, dorNum);
    if (!header) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
    const existing = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DMPPlani", sql.Decimal(10, 0), dorNum)
      .query(`${multipuertoSelect.replace("FROM DATMP", "FROM DATMP WITH (UPDLOCK,HOLDLOCK)")}`);
    if (!existing.recordset?.length) {
      await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("DMPPlani", sql.Decimal(10, 0), dorNum)
        .query("INSERT INTO DATMP (EmpCod,TempCod,DMPPlani) VALUES (@EmpCod,@TempCod,@DMPPlani);");
    }
    const values = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DMPPlani", sql.Decimal(10, 0), dorNum)
      .query(multipuertoSelect);
    await transaction.commit();
    return {
      header: { dorNum, planillaNumber: header.DORNumf, dispatcherName: trim(header.dispatcherName) },
      values: multipuertoRow(values.recordset?.[0]),
    };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError ? error : new DespachosSAGError(500, "MULTIPUERTO_OPEN_ERROR", error.message);
  }
};

const updateMultipuerto = async (
  empCod,
  dorNumValue,
  payload = {},
  { poolProvider = getPool, transactionFactory = (pool) => new sql.Transaction(pool), requestFactory = (transaction) => new sql.Request(transaction) } = {},
) => {
  const dorNum = validId(dorNumValue);
  const input = normalizeMultipuertoPayload(payload);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeTempForRequest(requestFactory(transaction), empCod, { lock: true });
    const header = await getMultipuertoHeader(requestFactory, transaction, empCod, tempCod, dorNum);
    if (!header) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
    const existing = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DMPPlani", sql.Decimal(10, 0), dorNum)
      .query("SELECT TOP 1 DMPPlani FROM DATMP WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DMPPlani=@DMPPlani;");
    const request = requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DMPPlani", sql.Decimal(10, 0), dorNum)
      .input("TRACod", sql.Int, input.traCod)
      .input("TRANom", sql.Char(30), input.traNom)
      .input("INACCod", sql.Int, input.inacCod)
      .input("INACNom", sql.Char(50), input.inacNom)
      .input("DMPFecTra", sql.Date, input.fecTra)
      .input("DMPConTra", sql.Char(50), input.conTra)
      .input("DMPDuraTra", sql.Char(50), input.duraTra)
      .input("TTMPCod", sql.Int, input.ttmpCod)
      .input("TTMPNom", sql.Char(30), input.ttmpNom)
      .input("DMPNSello1", sql.Char(30), input.sello1)
      .input("DMPNSello2", sql.Char(30), input.sello2)
      .input("DMPNSello3", sql.Char(30), input.sello3)
      .input("DMPNSello4", sql.Char(30), input.sello4)
      .input("DMPUbi1", sql.Int, input.ubi1)
      .input("DMPUbi2", sql.Int, input.ubi2)
      .input("DMPUbi3", sql.Int, input.ubi3)
      .input("DMPUbi4", sql.Int, input.ubi4);
    if (existing.recordset?.length) {
      await request.query(`
        UPDATE DATMP SET TRACod=@TRACod,TRANom=@TRANom,INACCod=@INACCod,INACNom=@INACNom,DMPFecTra=@DMPFecTra,
          DMPConTra=@DMPConTra,DMPDuraTra=@DMPDuraTra,TTMPCod=@TTMPCod,TTMPNom=@TTMPNom,
          DMPNSello1=@DMPNSello1,DMPNSello2=@DMPNSello2,DMPNSello3=@DMPNSello3,DMPNSello4=@DMPNSello4,
          DMPUbi1=@DMPUbi1,DMPUbi2=@DMPUbi2,DMPUbi3=@DMPUbi3,DMPUbi4=@DMPUbi4
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DMPPlani=@DMPPlani;
      `);
    } else {
      await request.query(`
        INSERT INTO DATMP (EmpCod,TempCod,DMPPlani,TRACod,TRANom,INACCod,INACNom,DMPFecTra,DMPConTra,DMPDuraTra,
          TTMPCod,TTMPNom,DMPNSello1,DMPNSello2,DMPNSello3,DMPNSello4,DMPUbi1,DMPUbi2,DMPUbi3,DMPUbi4)
        VALUES (@EmpCod,@TempCod,@DMPPlani,@TRACod,@TRANom,@INACCod,@INACNom,@DMPFecTra,@DMPConTra,@DMPDuraTra,
          @TTMPCod,@TTMPNom,@DMPNSello1,@DMPNSello2,@DMPNSello3,@DMPNSello4,@DMPUbi1,@DMPUbi2,@DMPUbi3,@DMPUbi4);
      `);
    }
    const values = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DMPPlani", sql.Decimal(10, 0), dorNum)
      .query(multipuertoSelect);
    await transaction.commit();
    return { header: { dorNum, planillaNumber: header.DORNumf }, values: multipuertoRow(values.recordset?.[0]) };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError ? error : new DespachosSAGError(500, "MULTIPUERTO_UPDATE_ERROR", error.message);
  }
};

const legacyInteger = (value) => {
  if (value === undefined || value === null || trim(value) === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.trunc(parsed)) : "";
};

const legacyDecimal = (value) => {
  if (value === undefined || value === null || trim(value) === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "";
};

const legacyDate = (value, separator = "-") => {
  const raw = trim(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return separator === "-" ? `${match[3]}-${match[2]}-${match[1]}` : `${match[1]}${match[2]}${match[3]}`;
};

const multipuertoCommunes = (rows, speciesCode, containerCode) => {
  const seen = new Set();
  const names = [];
  for (const row of rows.filter((item) => String(item.speciesCode) === String(speciesCode) && String(item.containerCode) === String(containerCode))) {
    const producer = trim(row.producerCode);
    if (seen.has(producer)) continue;
    seen.add(producer);
    const name = trim(row.communeName || row.communeValue);
    if (name) names.push(name);
  }
  return { count: names.length, names: names.join("-") };
};

const multipuertoSeals = (data) =>
  [1, 2, 3, 4]
    .map((index) => {
      const seal = trim(data[`sello${index}`]);
      if (!seal) return "";
      return `${seal},${legacyInteger(data[`ubi${index}`])}`;
    })
    .filter(Boolean)
    .join("-");

const buildMultipuertoFile = ({ header = {}, data = {}, groups = [], communes = [] }) => {
  const lines = [];
  for (const group of groups) {
    const communeData = multipuertoCommunes(communes, group.speciesCode, group.containerCode);
    const line = [
      legacyInteger(header.plantCode),
      legacyInteger(header.planillaNumber),
      legacyInteger(header.destinationMpCode),
      legacyInteger(header.exporterMpCode),
      legacyInteger(header.agentMpCode),
      legacyInteger(group.speciesMpCode),
      trim(header.patent),
      legacyInteger(header.guide),
      legacyDate(header.shipmentDate),
      legacyInteger(group.boxes),
      legacyDecimal(group.kilos),
      legacyInteger(group.containerMpCode),
      "4",
      legacyInteger(header.destinationPort),
      trim(header.container),
      legacyInteger(communeData.count),
      communeData.names,
      Number(data.traCod) > 0 ? legacyInteger(data.traCod) : "",
      Number(data.inacCod) > 0 ? legacyInteger(data.inacCod) : "",
      legacyDate(data.fecTra, "yyyymmdd"),
      trim(data.conTra),
      trim(data.duraTra),
      trim(header.dispatcherName),
      legacyInteger(header.totalFolios),
      legacyInteger(data.ttmpCod),
      multipuertoSeals(data),
    ].map((value) => trim(value));
    lines.push(line.join(";"));
  }
  const planilla = legacyInteger(header.planillaNumber);
  const plantCode = legacyInteger(header.plantCode);
  return {
    filename: `MP${plantCode}${planilla}.txt`,
    content: Buffer.from(`${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`, "utf8"),
  };
};

const generateArchivoMultipuerto = async (
  empCod,
  dorNumValue,
  { poolProvider = getPool } = {},
) => {
  const dorNum = validId(dorNumValue);
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("DORNum", sql.Decimal(10, 0), dorNum)
    .query(`
    DECLARE @TempCod char(9)=(
      SELECT TOP 1 TempCod FROM TEMP01
      WHERE EmpCod=@EmpCod AND TempActiva=1
      ORDER BY TempFecAbre DESC,TempCod DESC
    );
    SELECT TOP 1 h.DORNum,h.DORNumf planillaNumber,h.DestCod destinationCode,h.DorPuertoD destinationPort,
      RTRIM(h.DorPatente) patent,h.DorNguia guide,CONVERT(char(10),h.DorFecha,23) shipmentDate,
      RTRIM(h.DorContenedor) container,h.DorTotFol totalFolios,
      COALESCE(NULLIF(RTRIM(h.DANombre),''),RTRIM(da.DANombre)) dispatcherName,
      de.EmpCodSAG plantCode,ds.DestCMP destinationMpCode,e.EXPCodMP exporterMpCode,a.AgecodMP agentMpCode
    FROM DESORIGEN h
    LEFT JOIN DEFEMP de ON de.EmpCod=h.EmpCod
    LEFT JOIN DESTINOS ds ON ds.DestCod=h.DestCod
    LEFT JOIN EXPORT1 e ON e.EmpCod=h.EmpCod AND e.ExpCod=h.ExpCod
    LEFT JOIN AGENTES a ON a.EmpCod=h.EmpCod AND a.AgeCod=h.AgeCod
    LEFT JOIN DESPAAUTO da ON da.EmpCod=h.EmpCod AND da.DACod=h.DACod
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DorTipPlani=1 AND h.DORNum=@DORNum;
    SELECT TOP 1 TRACod traCod,RTRIM(TRANom) traNom,INACCod inacCod,RTRIM(INACNom) inacNom,
      CONVERT(char(10),DMPFecTra,23) fecTra,RTRIM(DMPConTra) conTra,RTRIM(DMPDuraTra) duraTra,
      TTMPCod ttmpCod,RTRIM(TTMPNom) ttmpNom,RTRIM(DMPNSello1) sello1,RTRIM(DMPNSello2) sello2,
      RTRIM(DMPNSello3) sello3,RTRIM(DMPNSello4) sello4,DMPUbi1 ubi1,DMPUbi2 ubi2,DMPUbi3 ubi3,DMPUbi4 ubi4
    FROM DATMP
    WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DMPPlani=@DORNum;
    SELECT d.Dor2espe speciesCode,d.Dor2env containerCode,COALESCE(e.EspeCMP,0) speciesMpCode,
      COALESCE(n.EnvCMP,0) containerMpCode,SUM(CONVERT(decimal(19,2),COALESCE(d.Dor2Cajas,0))) boxes,
      SUM(CONVERT(decimal(19,2),COALESCE(d.Dor2Kilos,0))) kilos
    FROM DESORIGEN2 d
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.Dor2espe
    LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Dor2env
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=1 AND d.DORNum=@DORNum
    GROUP BY d.Dor2espe,d.Dor2env,e.EspeCMP,n.EnvCMP
    ORDER BY d.Dor2espe,d.Dor2env;
    SELECT d.Dor2espe speciesCode,d.Dor2env containerCode,RTRIM(d.Dor2Prod) producerCode,
      COALESCE(NULLIF(RTRIM(d.Dor2ComP),''),NULLIF(RTRIM(p.ProdComuna),'')) communeValue,
      RTRIM(c.Comdesc) communeName
    FROM DESORIGEN2 d
    LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND RTRIM(p.ProdCod)=RTRIM(d.Dor2Prod)
    OUTER APPLY (
      SELECT TOP 1 cm.Comdesc
      FROM COMUNAS cm
      WHERE RTRIM(cm.Comdesc)=COALESCE(NULLIF(RTRIM(d.Dor2ComP),''),NULLIF(RTRIM(p.ProdComuna),''))
        OR CONVERT(varchar(10),cm.ComCod)=COALESCE(NULLIF(RTRIM(d.Dor2ComP),''),NULLIF(RTRIM(p.ProdComuna),''))
      ORDER BY CASE WHEN RTRIM(cm.Comdesc)=COALESCE(NULLIF(RTRIM(d.Dor2ComP),''),NULLIF(RTRIM(p.ProdComuna),'')) THEN 0 ELSE 1 END
    ) c
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=1 AND d.DORNum=@DORNum
    ORDER BY d.Dor2espe,d.Dor2env,d.Dor2Prod,d.Dor2Corr;
  `);
  const header = result.recordsets?.[0]?.[0];
  if (!header) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
  const data = multipuertoRow(result.recordsets?.[1]?.[0]);
  const file = buildMultipuertoFile({
    header,
    data,
    groups: result.recordsets?.[2] || [],
    communes: result.recordsets?.[3] || [],
  });
  return file;
};

const normalizeDespachoPayload = (payload = {}, { typeDefault = 1 } = {}) => {
  const type = integer(payload.dorTipPlani ?? payload.type ?? typeDefault, "El tipo de despacho", {
    min: 1,
    max: 3,
    defaultValue: typeDefault,
  });
  if (!despachoTypes.includes(type))
    throw new DespachosSAGError(400, "VALIDATION_ERROR", "El tipo de despacho debe ser 1, 2 o 3.");
  const rawDate = payload.dorFecha || payload.shipmentDate || isoLocal(new Date());
  return {
    dorTipPlani: type,
    dorFecha: dateValue(rawDate, "La fecha de despacho"),
    dorNumf: optionalInteger(payload.dorNumf ?? payload.planillaNumber, "El número de planilla SAG", { max: 9999999999 }),
    dorPuertoE: optionalInteger(payload.dorPuertoE ?? payload.embarkPortCode, "El puerto de embarque", { max: 9999 }),
    dorNPuertoE: boundedText(payload.dorNPuertoE ?? payload.embarkPort, "El nombre del puerto de embarque", 25),
    dorNguia: optionalInteger(payload.dorNguia ?? payload.guideNumber, "El número de guía", { max: 9999999999 }),
    dorTipoTrans: boundedText(payload.dorTipoTrans ?? payload.transportType, "El tipo de transporte", 30),
    dorPatente: boundedText(payload.dorPatente ?? payload.patent, "La patente", 30),
    dorNSellos: boundedText(payload.dorNSellos ?? payload.seals, "El número de sellos", 30),
    dorUbicacion: boundedText(payload.dorUbicacion ?? payload.location, "La ubicación", 30),
    dorPuertoD: optionalInteger(payload.dorPuertoD ?? payload.destinationPortCode, "El puerto de destino", { max: 9999 }),
    dorNpuertoD: boundedText(payload.dorNpuertoD ?? payload.destinationPort, "El nombre del puerto de destino", 25),
    destCod: optionalInteger(payload.destCod ?? payload.destinationCode, "El destino", { max: 9999 }),
    destNom: boundedText(payload.destNom ?? payload.destinationName, "El nombre del destino", 20),
    consCod: optionalInteger(payload.consCod ?? payload.consigneeCode, "El consignatario", { max: 999999 }),
    consNom: boundedText(payload.consNom ?? payload.consigneeName, "El nombre del consignatario", 30),
    ageCod: optionalInteger(payload.ageCod ?? payload.agentCode, "El agente", { max: 999999 }),
    ageNom: boundedText(payload.ageNom ?? payload.agentName, "El nombre del agente", 30),
    ageRut: optionalInteger(payload.ageRut ?? payload.agentRut, "El RUT del agente", { max: 999999999 }),
    ageDv: boundedText(payload.ageDv ?? payload.agentDv, "El dígito verificador del agente", 1),
    expCod: optionalInteger(payload.expCod ?? payload.exporterCode, "La exportadora", { max: 999999 }),
    expNom: boundedText(payload.expNom ?? payload.exporterName, "El nombre de la exportadora", 40),
    expRut: optionalInteger(payload.expRut ?? payload.exporterRut, "El RUT de la exportadora", { max: 999999999 }),
    expDv: boundedText(payload.expDv ?? payload.exporterDv, "El dígito verificador de la exportadora", 1),
    dorNave: boundedText(payload.dorNave ?? payload.vessel, "La nave", 30),
    dorObs1: boundedText(payload.dorObs1 ?? payload.observations, "Las observaciones", 200, { required: true }),
    daCod: optionalInteger(payload.daCod ?? payload.dispatcherCode, "El despachador autorizado", { max: 999999 }),
    daNombre: boundedText(payload.daNombre ?? payload.dispatcherName, "El nombre del despachador", 30),
    dorTrata: boundedText(payload.dorTrata ?? payload.treatment, "El tratamiento", 50),
    dorTrata2: boundedText(payload.dorTrata2 ?? payload.treatment2, "El tratamiento 2", 50),
    dorTrata3: boundedText(payload.dorTrata3 ?? payload.treatment3, "El tratamiento 3", 50),
    dorCodTrata: boundedText(payload.dorCodTrata ?? payload.treatmentCode, "El código de tratamiento", 20),
    dorContenedor: boundedText(payload.dorContenedor ?? payload.container, "El contenedor", 30),
    dorTipoD: optionalInteger(payload.dorTipoD || payload.shipmentType || 0, "El tipo de despacho", { max: 9999 }),
    dorPalBin: optionalInteger(payload.dorPalBin ?? payload.palletBin ?? 1, "El pallet bin", { max: 9999 }),
  };
};

const activeTempForRequest = async (request, empCod, { lock = false } = {}) => {
  const source = lock ? "TEMP01 WITH (UPDLOCK,HOLDLOCK)" : "TEMP01";
  const result = await request.input("EmpCod", sql.SmallInt, empCod).query(`
    SELECT TOP 1 RTRIM(TempCod) tempCod
    FROM ${source}
    WHERE EmpCod=@EmpCod AND TempActiva=1
    ORDER BY TempFecAbre DESC,TempCod DESC;
  `);
  const tempCod = trim(result.recordset?.[0]?.tempCod);
  if (!tempCod)
    throw new DespachosSAGError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa.",
    );
  return tempCod;
};

const despachoHeaderSelect = `
  SELECT TOP 1 h.EmpCod,h.TempCod,h.DorTipPlani,h.DORNum,h.DORNumf,h.DorFecha,
    h.DorPuertoE,RTRIM(h.DorNPuertoE) dorNPuertoE,h.DorNguia,RTRIM(h.DorTipoTrans) dorTipoTrans,
    RTRIM(h.DorPatente) dorPatente,RTRIM(h.DorNSellos) dorNSellos,RTRIM(h.DorUbicacion) dorUbicacion,
    h.DorPuertoD,RTRIM(h.DorNpuertoD) dorNpuertoD,h.DestCod,
    COALESCE(NULLIF(RTRIM(h.DestNom),''),RTRIM(ds.DestNom)) destNom,
    h.ConsCod,COALESCE(NULLIF(RTRIM(h.ConsNom),''),RTRIM(c.ConsNom)) consNom,
    h.AgeCod,COALESCE(NULLIF(RTRIM(h.AgeNom),''),RTRIM(a.AgeNom)) ageNom,h.Agerut ageRut,h.AgeDv ageDv,
    h.ExpCod,COALESCE(NULLIF(RTRIM(h.ExpNom),''),RTRIM(e.ExpNom)) expNom,h.ExpRut expRut,h.ExpDv expDv,
    RTRIM(h.DorNave) dorNave,RTRIM(h.DorObs1) dorObs1,h.DACod,
    COALESCE(NULLIF(RTRIM(h.DANombre),''),RTRIM(da.DANombre)) daNombre,
    COALESCE(h.DorTotCajas,0) dorTotCajas,COALESCE(h.DorTotKilos,0) dorTotKilos,
    COALESCE(h.DorTotFol,0) dorTotFol,h.DorEstado,
    RTRIM(h.DorLogcre) dorLogcre,h.DorFecCrea dorFecCrea,RTRIM(h.DorLogAnula) dorLogAnula,h.DorFecAnula dorFecAnula,
    RTRIM(h.Dortrata) dorTrata,RTRIM(h.DorTrata2) dorTrata2,RTRIM(h.Dortrata3) dorTrata3,
    RTRIM(h.DorCodTrata) dorCodTrata,RTRIM(h.DorContenedor) dorContenedor,h.DorTipoD dorTipoD,h.DorPalBin dorPalBin
  FROM DESORIGEN h
  LEFT JOIN DESTINOS ds ON ds.DestCod=h.DestCod
  LEFT JOIN CONSIG c ON c.EmpCod=h.EmpCod AND c.ConsCod=h.ConsCod
  LEFT JOIN AGENTES a ON a.EmpCod=h.EmpCod AND a.AgeCod=h.AgeCod
  LEFT JOIN EXPORT1 e ON e.EmpCod=h.EmpCod AND e.ExpCod=h.ExpCod
  LEFT JOIN DESPAAUTO da ON da.EmpCod=h.EmpCod AND da.DACod=h.DACod
  WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DorTipPlani=@DorTipPlani AND h.DORNum=@DORNum;
`;

const getDespachoFormData = async (empCod, { poolProvider = getPool } = {}) => {
  const pool = await poolProvider();
  const result = await pool.request().input("EmpCod", sql.SmallInt, empCod).query(`
    SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC;
    SELECT TOP 1 RTRIM(EmpNom) companyName FROM DEFEMP WHERE EmpCod=@EmpCod;
    SELECT PuCod code,RTRIM(PuNombre) name,COALESCE(PuNac,0) isNational FROM PUERTOS ORDER BY PuNombre,PuCod;
    SELECT DestCod code,RTRIM(DestNom) name FROM DESTINOS ORDER BY DestNom,DestCod;
    SELECT AgeCod code,RTRIM(AgeNom) name,Agerut rut,RTRIM(AgeDv) dv FROM AGENTES WHERE EmpCod=@EmpCod ORDER BY AgeNom,AgeCod;
    SELECT ConsCod code,RTRIM(ConsNom) name,ConsRut rut,RTRIM(ConsDV) dv FROM CONSIG WHERE EmpCod=@EmpCod ORDER BY ConsNom,ConsCod;
    SELECT ExpCod code,RTRIM(ExpNom) name,ExpRut rut,RTRIM(ExpDv) dv FROM EXPORT1 WHERE EmpCod=@EmpCod ORDER BY ExpNom,ExpCod;
    SELECT DACod code,RTRIM(DANombre) name FROM DESPAAUTO WHERE EmpCod=@EmpCod AND (DAVig=1 OR DAVig IS NULL) ORDER BY DANombre,DACod;
    SELECT Especod code,RTRIM(EspeNom) name FROM ESPECIES WHERE EmpCod=@EmpCod ORDER BY EspeNom,Especod;
  `);
  const tempCod = trim(result.recordsets?.[0]?.[0]?.tempCod);
  if (!tempCod)
    throw new DespachosSAGError(409, "ACTIVE_SEASON_NOT_FOUND", "No existe una temporada activa para la empresa.");
  return {
    tempCod,
    companyName: trim(result.recordsets?.[1]?.[0]?.companyName),
    defaultRange: defaultRange(),
    states: [
      { code: 0, name: "En Proceso" },
      { code: 1, name: "Finalizado" },
      { code: 5, name: "Nula" },
      { code: 9, name: "Todos" },
    ],
    types: despachoTypes.map((code) => ({ code, name: despachoTypeLabel(code) })),
    ports: result.recordsets?.[2] || [],
    destinations: result.recordsets?.[3] || [],
    agents: result.recordsets?.[4] || [],
    consignees: result.recordsets?.[5] || [],
    exporters: result.recordsets?.[6] || [],
    dispatchers: result.recordsets?.[7] || [],
    species: result.recordsets?.[8] || [],
  };
};

const getDespachoDetail = async (
  empCod,
  dorNumValue,
  dorTipPlaniValue = 1,
  { poolProvider = getPool } = {},
) => {
  const dorNum = validId(dorNumValue);
  const dorTipPlani = integer(dorTipPlaniValue, "El tipo de despacho", { min: 1, max: 3, defaultValue: 1 });
  const pool = await poolProvider();
  const tempCod = await activeTempForRequest(pool.request(), empCod);
  const result = await pool.request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("DORNum", sql.Decimal(10, 0), dorNum)
    .input("DorTipPlani", sql.SmallInt, dorTipPlani)
    .query(`
      ${despachoHeaderSelect}
      SELECT RTRIM(d.dor1Folio) folio,d.dor1espe speciesCode,COALESCE(NULLIF(RTRIM(d.Dor1Nespe),''),RTRIM(e.EspeNom)) speciesName,
        d.Dor1Cajas boxes,d.Dor1Kilos kilos,d.Dor1Nsol requestNumber,COALESCE(RTRIM(i.SolDestinos),'') approvedDestinations
      FROM DESORIGEN1 d
      LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.dor1espe
      LEFT JOIN SOLICITUDES1 i ON i.EmpCod=d.EmpCod AND i.TempCod=d.TempCod AND i.SolNum=d.Dor1Nsol
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=@DorTipPlani AND d.DORNum=@DORNum ORDER BY d.dor1Folio;
      SELECT RTRIM(d.dor1Folio) folio,d.Dor2Corr correlation,d.Dor2espe speciesCode,
        COALESCE(NULLIF(RTRIM(d.Dor2Nespe),''),RTRIM(e.EspeNom)) speciesName,d.Dor2var varietyCode,
        COALESCE(NULLIF(RTRIM(d.Dor2Nvar),''),RTRIM(v.VarNom)) varietyName,RTRIM(d.Dor2Prod) producerCode,
        COALESCE(NULLIF(RTRIM(d.Dor2NProd),''),RTRIM(p.ProdNom)) producerName,
        COALESCE(NULLIF(RTRIM(d.Dor2ComP),''),RTRIM(p.ProdComuna)) commune,
        COALESCE(NULLIF(RTRIM(d.Dor2ProvP),''),RTRIM(p.ProdProvincia)) province,
        d.Dor2fecproc processDate,d.Dor2env containerCode,COALESCE(NULLIF(RTRIM(d.Dor2NeNV),''),RTRIM(n.EnvNom)) containerName,
        d.Dor2cat categoryCode,COALESCE(NULLIF(RTRIM(d.Dor2Ncat),''),RTRIM(c.CatNom)) categoryName,
        RTRIM(d.Dor2cal) caliber,d.Dor2Cajas boxes,d.Dor2Kilos kilos
      FROM DESORIGEN2 d
      LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.Dor2espe
      LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Dor2espe AND v.VarCod=d.Dor2var
      LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND RTRIM(p.ProdCod)=RTRIM(d.Dor2Prod)
      LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Dor2env
      LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.Dor2env AND c.Catcod=d.Dor2cat
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=@DorTipPlani AND d.DORNum=@DORNum
      ORDER BY d.dor1Folio,d.Dor2Corr;
      SELECT DISTINCT COALESCE(NULLIF(RTRIM(d.Dor2ComP),''),RTRIM(p.ProdComuna)) commune,
        COALESCE(NULLIF(RTRIM(d.Dor2ProvP),''),RTRIM(p.ProdProvincia)) province
      FROM DESORIGEN2 d LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND RTRIM(p.ProdCod)=RTRIM(d.Dor2Prod)
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DorTipPlani=@DorTipPlani AND d.DORNum=@DORNum
      ORDER BY province,commune;
    `);
  const header = result.recordsets?.[0]?.[0];
  if (!header) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
  return {
    header: { ...header, tempCod, typeLabel: despachoTypeLabel(header.DorTipPlani), statusLabel: statusLabel(header.DorEstado) },
    folios: result.recordsets?.[1] || [],
    details: result.recordsets?.[2] || [],
    communes: result.recordsets?.[3] || [],
  };
};

const resolveDespachoCatalogs = async (requestFactory, transaction, empCod, input) => {
  const result = await requestFactory(transaction)
    .input("EmpCod", sql.SmallInt, empCod)
    .input("Embark", sql.SmallInt, input.dorPuertoE)
    .input("DestinationPort", sql.SmallInt, input.dorPuertoD)
    .input("Destination", sql.SmallInt, input.destCod)
    .input("Consignee", sql.SmallInt, input.consCod)
    .input("Agent", sql.SmallInt, input.ageCod)
    .input("Exporter", sql.Int, input.expCod)
    .input("Dispatcher", sql.SmallInt, input.daCod)
    .query(`
      SELECT TOP 1 PuCod,RTRIM(PuNombre) name,COALESCE(PuNac,0) isNational FROM PUERTOS WHERE PuCod=@Embark;
      SELECT TOP 1 PuCod,RTRIM(PuNombre) name FROM PUERTOS WHERE PuCod=@DestinationPort;
      SELECT TOP 1 DestCod,RTRIM(DestNom) name FROM DESTINOS WHERE DestCod=@Destination;
      SELECT TOP 1 ConsCod,RTRIM(ConsNom) name FROM CONSIG WHERE EmpCod=@EmpCod AND ConsCod=@Consignee;
      SELECT TOP 1 AgeCod,RTRIM(AgeNom) name,Agerut rut,RTRIM(AgeDv) dv FROM AGENTES WHERE EmpCod=@EmpCod AND AgeCod=@Agent;
      SELECT TOP 1 ExpCod,RTRIM(ExpNom) name,ExpRut rut,RTRIM(ExpDv) dv FROM EXPORT1 WHERE EmpCod=@EmpCod AND ExpCod=@Exporter;
      SELECT TOP 1 DACod,RTRIM(DANombre) name FROM DESPAAUTO WHERE EmpCod=@EmpCod AND DACod=@Dispatcher;
    `);
  const embark = result.recordsets?.[0]?.[0];
  if (!embark || Number(embark.isNational) !== 1)
    throw new DespachosSAGError(409, "EMBARK_PORT_NOT_NATIONAL", "Puerto de EMBARQUE debe ser NACIONAL.");
  const merge = (value, row, key) => (value || trim(row?.[key]));
  return {
    dorNPuertoE: merge(input.dorNPuertoE, embark, "name"),
    dorNpuertoD: merge(input.dorNpuertoD, result.recordsets?.[1]?.[0], "name"),
    destNom: merge(input.destNom, result.recordsets?.[2]?.[0], "name"),
    consNom: merge(input.consNom, result.recordsets?.[3]?.[0], "name"),
    ageNom: merge(input.ageNom, result.recordsets?.[4]?.[0], "name"),
    ageRut: input.ageRut ?? result.recordsets?.[4]?.[0]?.rut ?? null,
    ageDv: merge(input.ageDv, result.recordsets?.[4]?.[0], "dv"),
    expNom: merge(input.expNom, result.recordsets?.[5]?.[0], "name"),
    expRut: input.expRut ?? result.recordsets?.[5]?.[0]?.rut ?? null,
    expDv: merge(input.expDv, result.recordsets?.[5]?.[0], "dv"),
    daNombre: merge(input.daNombre, result.recordsets?.[6]?.[0], "name"),
  };
};

const updateDespachoTotals = async (request, empCod, tempCod, dorTipPlani, dorNum) => {
  await request
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("DorTipPlani", sql.SmallInt, dorTipPlani)
    .input("DORNum", sql.Decimal(10, 0), dorNum)
    .query(`
      UPDATE h SET DorTotFol=COALESCE(x.totalFolios,0),DorTotCajas=COALESCE(x.totalBoxes,0),DorTotKilos=COALESCE(x.totalKilos,0)
      FROM DESORIGEN h
      OUTER APPLY (SELECT COUNT(*) totalFolios,SUM(CONVERT(bigint,Dor1Cajas)) totalBoxes,SUM(CONVERT(money,Dor1Kilos)) totalKilos
                   FROM DESORIGEN1 d WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.DorTipPlani=h.DorTipPlani AND d.DORNum=h.DORNum) x
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DorTipPlani=@DorTipPlani AND h.DORNum=@DORNum;
    `);
};

const writeDespachoHeader = (request, input, catalogs, { empCod, tempCod, dorNum, login }) => {
  request
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("DorTipPlani", sql.SmallInt, input.dorTipPlani)
    .input("DORNum", sql.Decimal(10, 0), dorNum)
    .input("DORNumf", sql.Decimal(10, 0), input.dorNumf)
    .input("DorFecha", sql.DateTime, input.dorFecha)
    .input("DorPuertoE", sql.SmallInt, input.dorPuertoE)
    .input("DorNPuertoE", sql.Char(25), catalogs.dorNPuertoE)
    .input("DorNguia", sql.Decimal(10, 0), input.dorNguia)
    .input("DorTipoTrans", sql.Char(30), input.dorTipoTrans)
    .input("DorPatente", sql.Char(30), input.dorPatente)
    .input("DorNSellos", sql.Char(30), input.dorNSellos)
    .input("DorUbicacion", sql.Char(30), input.dorUbicacion)
    .input("DorPuertoD", sql.SmallInt, input.dorPuertoD)
    .input("DorNpuertoD", sql.Char(25), catalogs.dorNpuertoD)
    .input("DestCod", sql.SmallInt, input.destCod)
    .input("DestNom", sql.Char(20), catalogs.destNom)
    .input("ConsCod", sql.SmallInt, input.consCod)
    .input("ConsNom", sql.Char(30), catalogs.consNom)
    .input("AgeCod", sql.SmallInt, input.ageCod)
    .input("AgeNom", sql.Char(30), catalogs.ageNom)
    .input("Agerut", sql.Decimal(9, 0), catalogs.ageRut)
    .input("AgeDv", sql.Char(1), catalogs.ageDv)
    .input("ExpCod", sql.SmallInt, input.expCod)
    .input("ExpNom", sql.Char(40), catalogs.expNom)
    .input("ExpRut", sql.Decimal(9, 0), catalogs.expRut)
    .input("ExpDv", sql.Char(1), catalogs.expDv)
    .input("DorNave", sql.Char(30), input.dorNave)
    .input("DorObs1", sql.Char(200), input.dorObs1)
    .input("DACod", sql.SmallInt, input.daCod)
    .input("DANombre", sql.Char(30), catalogs.daNombre)
    .input("Dortrata", sql.Char(50), input.dorTrata)
    .input("DorTrata2", sql.Char(50), input.dorTrata2)
    .input("Dortrata3", sql.Char(50), input.dorTrata3)
    .input("DorCodTrata", sql.Char(20), input.dorCodTrata)
    .input("DorContenedor", sql.Char(30), input.dorContenedor)
    .input("DorTipoD", sql.SmallInt, input.dorTipoD)
    .input("DorPalBin", sql.SmallInt, input.dorPalBin ?? 1)
    .input("Login", sql.Char(10), boundedText(login, "El usuario", 10, { required: true }));
};

const createDespacho = async (
  empCod,
  login,
  payload,
  { poolProvider = getPool, transactionFactory = (pool) => new sql.Transaction(pool), requestFactory = (transaction) => new sql.Request(transaction), nextNumber = nextCorrelative } = {},
) => {
  const input = normalizeDespachoPayload(payload);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeTempForRequest(requestFactory(transaction), empCod, { lock: true });
    const catalogs = await resolveDespachoCatalogs(requestFactory, transaction, empCod, input);
    const dorNum = await nextNumber({ transaction, empCod, code: "DESORINT", digits: 10 });
    const insert = requestFactory(transaction);
    writeDespachoHeader(insert, input, catalogs, { empCod, tempCod, dorNum, login });
    await insert.query(`
      INSERT INTO DESORIGEN (EmpCod,TempCod,DorTipPlani,DORNum,DORNumf,DorFecha,DorPuertoE,DorNPuertoE,DorNguia,DorTipoTrans,DorPatente,DorNSellos,DorUbicacion,DorPuertoD,DorNpuertoD,DestCod,DestNom,ConsCod,ConsNom,AgeCod,AgeNom,Agerut,AgeDv,ExpCod,ExpNom,ExpRut,ExpDv,DorNave,DorObs1,DACod,DANombre,DorTotCajas,DorTotKilos,DorTotFol,DorEstado,DorLogcre,DorFecCrea,Dortrata,DorTrata2,Dortrata3,DorCodTrata,DorContenedor,DorTipoD,DorPalBin)
      VALUES (@EmpCod,@TempCod,@DorTipPlani,@DORNum,@DORNumf,@DorFecha,@DorPuertoE,@DorNPuertoE,@DorNguia,@DorTipoTrans,@DorPatente,@DorNSellos,@DorUbicacion,@DorPuertoD,@DorNpuertoD,@DestCod,@DestNom,@ConsCod,@ConsNom,@AgeCod,@AgeNom,@Agerut,@AgeDv,@ExpCod,@ExpNom,@ExpRut,@ExpDv,@DorNave,@DorObs1,@DACod,@DANombre,0,0,0,0,@Login,GETDATE(),@Dortrata,@DorTrata2,@Dortrata3,@DorCodTrata,@DorContenedor,@DorTipoD,@DorPalBin);
    `);
    await transaction.commit();
    return getDespachoDetail(empCod, dorNum, input.dorTipPlani, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError ? error : new DespachosSAGError(500, "DESPACHO_CREATE_ERROR", error.message);
  }
};

const updateDespacho = async (
  empCod,
  login,
  dorNumValue,
  payload,
  { poolProvider = getPool, transactionFactory = (pool) => new sql.Transaction(pool), requestFactory = (transaction) => new sql.Request(transaction) } = {},
) => {
  const dorNum = validId(dorNumValue);
  const input = normalizeDespachoPayload(payload);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeTempForRequest(requestFactory(transaction), empCod, { lock: true });
    const current = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod)
      .input("DorTipPlani", sql.SmallInt, input.dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum)
      .query("SELECT TOP 1 DorEstado FROM DESORIGEN WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;");
    if (!current.recordset?.length) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
    if (Number(current.recordset[0].DorEstado) === 5) throw new DespachosSAGError(409, "DESPACHO_VOID", "No se puede modificar un despacho Nulo.");
    if (Number(current.recordset[0].DorEstado) !== 0) throw new DespachosSAGError(409, "DESPACHO_LOCKED", "No se puede modificar un despacho Finalizado.");
    const catalogs = await resolveDespachoCatalogs(requestFactory, transaction, empCod, input);
    const update = requestFactory(transaction);
    writeDespachoHeader(update, input, catalogs, { empCod, tempCod, dorNum, login });
    await update.query(`
      UPDATE DESORIGEN SET DORNumf=@DORNumf,DorFecha=@DorFecha,DorPuertoE=@DorPuertoE,DorNPuertoE=@DorNPuertoE,DorNguia=@DorNguia,DorTipoTrans=@DorTipoTrans,
        DorPatente=@DorPatente,DorNSellos=@DorNSellos,DorUbicacion=@DorUbicacion,DorPuertoD=@DorPuertoD,DorNpuertoD=@DorNpuertoD,
        DestCod=@DestCod,DestNom=@DestNom,ConsCod=@ConsCod,ConsNom=@ConsNom,AgeCod=@AgeCod,AgeNom=@AgeNom,Agerut=@Agerut,AgeDv=@AgeDv,
        ExpCod=@ExpCod,ExpNom=@ExpNom,ExpRut=@ExpRut,ExpDv=@ExpDv,DorNave=@DorNave,DorObs1=@DorObs1,DACod=@DACod,DANombre=@DANombre,
        Dortrata=@Dortrata,DorTrata2=@DorTrata2,Dortrata3=@Dortrata3,DorCodTrata=@DorCodTrata,DorContenedor=@DorContenedor,DorTipoD=@DorTipoD,DorPalBin=@DorPalBin
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;
    `);
    await transaction.commit();
    return getDespachoDetail(empCod, dorNum, input.dorTipPlani, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError ? error : new DespachosSAGError(500, "DESPACHO_UPDATE_ERROR", error.message);
  }
};

const listAvailableDespachoFolios = async (empCod, dorNumValue, dorTipPlaniValue = 1, query = {}, { poolProvider = getPool } = {}) => {
  // El número 0 permite consultar candidatos durante el alta, antes de crear la cabecera.
  const dorNum = integer(dorNumValue, "N° interno", { min: 0, max: 9999999999, defaultValue: 0 });
  const dorTipPlani = integer(dorTipPlaniValue, "El tipo de despacho", { min: 1, max: 3, defaultValue: 1 });
  const search = boundedText(query.search, "El folio", 10);
  const speciesCode = optionalInteger(query.speciesCode, "La especie", { max: 999 });
  const destinationCode = integer(query.destinationCode, "El destino", { min: 0, max: 999, defaultValue: 0 });
  const approvedDestinations = boundedText(query.approvedDestinations, "Los destinos aprobados", 100);
  const pool = await poolProvider();
  const tempCod = await activeTempForRequest(pool.request(), empCod);
  const request = pool.request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("DorNum", sql.Decimal(10, 0), dorNum)
    .input("DorTipPlani", sql.SmallInt, dorTipPlani)
    .input("Search", sql.Char(10), search)
    .input("Species", sql.SmallInt, speciesCode)
    .input("DestinationCode", sql.SmallInt, destinationCode)
    .input("ApprovedDestinations", sql.Char(100), approvedDestinations);
  if (dorTipPlani === 1) {
    const result = await request.query(`
      SELECT s.SolNum requestNumber,RTRIM(s.Sol2Folio) folio,s.Sol2Espe speciesCode,RTRIM(e.EspeNom) speciesName,
        COALESCE(s.Sol2CajasDes,0) boxes,COALESCE(s.Sol2KilosDes,0) kilos,i.SolDest destinationCode,RTRIM(d.DestNom) destinationName,
        RTRIM(i.SolDestinos) approvedDestinations
      FROM SOLICITUDES2 s
      INNER JOIN SOLICITUDES1 i ON i.EmpCod=s.EmpCod AND i.TempCod=s.TempCod AND i.SolNum=s.SolNum
      LEFT JOIN ESPECIES e ON e.EmpCod=s.EmpCod AND e.Especod=s.Sol2Espe
      LEFT JOIN DESTINOS d ON d.DestCod=i.SolDest
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod
        AND s.Sol2CajasDes > 0
        AND s.Sol2Dispo=0
        AND i.SolEstado=1
        AND (@Species IS NULL OR s.Sol2Espe=@Species)
        AND (@DestinationCode=0 OR i.SolDest=@DestinationCode)
        AND (@ApprovedDestinations='' OR i.solDestinos LIKE '%' + RTRIM(@ApprovedDestinations) + '%')
        AND (@Search='' OR RTRIM(s.Sol2Folio) LIKE '%' + RTRIM(@Search) + '%')
      ORDER BY s.Sol2Folio;
    `);
    return { rows: result.recordset || [], tempCod, type: dorTipPlani };
  }
  const result = await request.query(`
    SELECT p.PUSNum requestNumber,RTRIM(p.PUS1Folio) folio,p.PUS1Espe speciesCode,RTRIM(e.EspeNom) speciesName,
      COALESCE(p.PUS1CajDes,0) boxes,COALESCE(p.PUS1KilDes,0) kilos
    FROM PROCUSDA1 p
    INNER JOIN PROCUSDA h ON h.EmpCod=p.EmpCod AND h.TempCod=p.TempCod AND h.PUSTipo=@DorTipPlani AND h.PUSNum=p.PUSNum
    LEFT JOIN ESPECIES e ON e.EmpCod=p.EmpCod AND e.Especod=p.PUS1Espe
    WHERE p.EmpCod=@EmpCod AND p.TempCod=@TempCod AND p.PUSTipo=@DorTipPlani
      AND p.PUS1CajDes > 0
      AND p.PUS1Dispo=1
      AND h.PUSEstado=1
      AND (@Species IS NULL OR p.PUS1Espe=@Species)
      AND (@Search='' OR RTRIM(p.PUS1Folio) LIKE '%' + RTRIM(@Search) + '%')
    ORDER BY p.PUS1Folio;
  `);
  return { rows: result.recordset || [], tempCod, type: dorTipPlani };
};

const assertDespachoEditable = (header) => {
  if (Number(header.DorEstado) !== 0)
    throw new DespachosSAGError(409, "DESPACHO_LOCKED", "Los folios solo se pueden modificar con el despacho en proceso.");
};

const addFolioToDespacho = async (
  empCod,
  login,
  dorNumValue,
  payload,
  { poolProvider = getPool, transactionFactory = (pool) => new sql.Transaction(pool), requestFactory = (transaction) => new sql.Request(transaction) } = {},
) => {
  const dorNum = validId(dorNumValue);
  const dorTipPlani = integer(payload?.dorTipPlani ?? payload?.type ?? 1, "El tipo de despacho", { min: 1, max: 3, defaultValue: 1 });
  const folio = boundedText(payload?.folio, "El folio", 10, { required: true });
  const requestNumber = optionalInteger(payload?.requestNumber, "El número de solicitud", { max: 9999999999 });
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeTempForRequest(requestFactory(transaction), empCod, { lock: true });
    const headerResult = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).query("SELECT TOP 1 DorEstado FROM DESORIGEN WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;");
    const header = headerResult.recordset?.[0];
    if (!header) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
    assertDespachoEditable(header);
    const req = requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Folio", sql.Char(10), folio).input("RequestNumber", sql.Decimal(10, 0), requestNumber);
    if (dorTipPlani === 1) {
      const source = await req.query(`
        SELECT TOP 1 s.SolNum,s.Sol2Folio,s.Sol2Espe,s.Sol2CajasDes,s.Sol2KilosDes,RTRIM(e.EspeNom) speciesName
        FROM SOLICITUDES2 s WITH (UPDLOCK,HOLDLOCK)
        INNER JOIN SOLICITUDES1 i ON i.EmpCod=s.EmpCod AND i.TempCod=s.TempCod AND i.SolNum=s.SolNum
        LEFT JOIN ESPECIES e ON e.EmpCod=s.EmpCod AND e.Especod=s.Sol2Espe
        WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND s.Sol2Folio=@Folio AND (@RequestNumber IS NULL OR s.SolNum=@RequestNumber)
          AND s.Sol2CajasDes > 0 AND s.Sol2Dispo=0 AND i.SolEstado=1;
      `);
      const row = source.recordset?.[0];
      if (!row) throw new DespachosSAGError(409, "FOLIO_NOT_AVAILABLE", "El folio no está disponible para este despacho.");
      const duplicate = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Folio", sql.Char(10), folio).query("SELECT TOP 1 dor1Folio FROM DESORIGEN1 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum AND dor1Folio=@Folio;");
      if (duplicate.recordset?.length) throw new DespachosSAGError(409, "FOLIO_ALREADY_ATTACHED", "El folio ya está asociado al despacho.");
      const species = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("Species", sql.SmallInt, row.Sol2Espe).query("SELECT TOP 1 RTRIM(EspeNom) name FROM ESPECIES WHERE EmpCod=@EmpCod AND Especod=@Species;");
      await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Folio", sql.Char(10), folio).input("Species", sql.SmallInt, row.Sol2Espe).input("SpeciesName", sql.Char(20), species.recordset?.[0]?.name || row.speciesName || "").input("Boxes", sql.SmallInt, row.Sol2CajasDes).input("Kilos", sql.Money, row.Sol2KilosDes).input("RequestNumber", sql.Decimal(10, 0), row.SolNum).query("INSERT DESORIGEN1 (EmpCod,TempCod,DorTipPlani,DORNum,dor1Folio,dor1espe,Dor1Nespe,Dor1Cajas,Dor1Kilos,Dor1Nsol) VALUES (@EmpCod,@TempCod,@DorTipPlani,@DORNum,@Folio,@Species,@SpeciesName,@Boxes,@Kilos,@RequestNumber);");
      const details = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("SolNum", sql.Decimal(10, 0), row.SolNum).input("Folio", sql.Char(10), folio).query(`
        SELECT d.Sol3Corr,d.sol3fecha,d.Sol3espe,d.Sol3Var,d.Sol3prod,d.Sol3Env,d.Sol3CaT,d.Sol3Cal,d.Sol3CajasDes,d.Sol3KilosDes,
          RTRIM(e.EspeNom) speciesName,RTRIM(v.VarNom) varietyName,RTRIM(p.ProdNom) producerName,RTRIM(p.ProdComuna) commune,RTRIM(p.ProdProvincia) province,RTRIM(p.ProdCodSAG) originCsg,
          RTRIM(n.EnvNom) containerName,RTRIM(c.CatNom) categoryName
        FROM SOLICITUDES3 d
        LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.Sol3espe
        LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Sol3espe AND v.VarCod=d.Sol3Var
        LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND RTRIM(p.ProdCod)=RTRIM(d.Sol3prod)
        LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Sol3Env
        LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.Sol3Env AND c.Catcod=d.Sol3CaT
        WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.SolNum=@SolNum AND d.Sol2Folio=@Folio AND COALESCE(d.Sol3CajasDes,0)>0 ORDER BY d.Sol3Corr;
      `);
      for (const detail of details.recordset || []) {
        await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Folio", sql.Char(10), folio).input("Corr", sql.SmallInt, detail.Sol3Corr).input("Species", sql.SmallInt, detail.Sol3espe).input("SpeciesName", sql.Char(20), detail.speciesName || "").input("Variety", sql.Int, detail.Sol3Var).input("VarietyName", sql.Char(20), detail.varietyName || "").input("ProcessDate", sql.DateTime, detail.sol3fecha).input("Producer", sql.Char(6), detail.Sol3prod).input("ProducerName", sql.Char(35), detail.producerName || "").input("Commune", sql.Char(20), detail.commune || "").input("Province", sql.Char(20), detail.province || "").input("OriginCsg", sql.Char(10), detail.originCsg || "").input("Container", sql.SmallInt, detail.Sol3Env).input("ContainerName", sql.Char(20), detail.containerName || "").input("Category", sql.SmallInt, detail.Sol3CaT).input("CategoryName", sql.Char(20), detail.categoryName || "").input("Calibre", sql.Char(10), detail.Sol3Cal).input("Boxes", sql.SmallInt, detail.Sol3CajasDes).input("Kilos", sql.Money, detail.Sol3KilosDes).query("INSERT DESORIGEN2 (EmpCod,TempCod,DorTipPlani,DORNum,dor1Folio,Dor2Corr,Dor2espe,Dor2Nespe,Dor2var,Dor2Nvar,Dor2fecproc,Dor2Prod,Dor2NProd,Dor2ComP,Dor2ProvP,Dor2CSG,Dor2env,Dor2NeNV,Dor2cat,Dor2Ncat,Dor2cal,Dor2Cajas,Dor2Kilos) VALUES (@EmpCod,@TempCod,@DorTipPlani,@DORNum,@Folio,@Corr,@Species,@SpeciesName,@Variety,@VarietyName,@ProcessDate,@Producer,@ProducerName,@Commune,@Province,@OriginCsg,@Container,@ContainerName,@Category,@CategoryName,@Calibre,@Boxes,@Kilos);");
      }
      await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("SolNum", sql.Decimal(10, 0), row.SolNum).input("Folio", sql.Char(10), folio).input("DorNum", sql.Decimal(10, 0), dorNum).query("UPDATE SOLICITUDES2 SET Sol2Dispo=1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND Sol2Folio=@Folio; UPDATE FOLIOSPROC SET FPDesOri=@DorNum WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;");
    } else {
      const source = await req.query("SELECT TOP 1 p.* FROM PROCUSDA1 p INNER JOIN PROCUSDA h ON h.EmpCod=p.EmpCod AND h.TempCod=p.TempCod AND h.PUSTipo=p.PUSTipo AND h.PUSNum=p.PUSNum WHERE p.EmpCod=@EmpCod AND p.TempCod=@TempCod AND p.PUSTipo=@DorTipPlani AND p.PUSNum=@RequestNumber AND p.PUS1Folio=@Folio AND p.PUS1CajDes > 0 AND p.PUS1Dispo=1 AND h.PUSEstado=1;");
      const row = source.recordset?.[0];
      if (!row) throw new DespachosSAGError(409, "FOLIO_NOT_AVAILABLE", "El folio USDA no está disponible para este despacho.");
      const species = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("Species", sql.SmallInt, row.PUS1Espe).query("SELECT TOP 1 RTRIM(EspeNom) name FROM ESPECIES WHERE EmpCod=@EmpCod AND Especod=@Species;");
      await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Folio", sql.Char(10), folio).input("Species", sql.SmallInt, row.PUS1Espe).input("SpeciesName", sql.Char(20), species.recordset?.[0]?.name || "").input("Boxes", sql.SmallInt, row.PUS1CajDes).input("Kilos", sql.Money, row.PUS1KilDes).input("RequestNumber", sql.Decimal(10, 0), row.PUSNum).query("INSERT DESORIGEN1 (EmpCod,TempCod,DorTipPlani,DORNum,dor1Folio,dor1espe,Dor1Nespe,Dor1Cajas,Dor1Kilos,Dor1Nsol) VALUES (@EmpCod,@TempCod,@DorTipPlani,@DORNum,@Folio,@Species,@SpeciesName,@Boxes,@Kilos,@RequestNumber);");
      const details = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("Type", sql.SmallInt, dorTipPlani).input("Number", sql.Decimal(10, 0), row.PUSNum).input("Folio", sql.Char(10), folio).query("SELECT d.* FROM PROCUSDA2 d WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.PUSTipo=@Type AND d.PUSNum=@Number AND d.PUS1Folio=@Folio AND COALESCE(d.PUS2CajDES,0)>0 ORDER BY d.PUS2Cor;");
      for (const detail of details.recordset || []) {
        await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Folio", sql.Char(10), folio).input("Corr", sql.SmallInt, detail.PUS2Cor).input("Species", sql.SmallInt, detail.Especod).input("Variety", sql.Int, detail.VarCod).input("ProcessDate", sql.DateTime, detail.PUS2Fecha).input("Producer", sql.Char(6), detail.ProdCod).input("Container", sql.SmallInt, detail.EnvCod).input("Category", sql.SmallInt, detail.Catcod).input("Calibre", sql.Char(10), detail.Calibre).input("Boxes", sql.SmallInt, detail.PUS2CajDES).input("Kilos", sql.Money, detail.PUS2KilDES).query("INSERT DESORIGEN2 (EmpCod,TempCod,DorTipPlani,DORNum,dor1Folio,Dor2Corr,Dor2espe,Dor2var,Dor2fecproc,Dor2Prod,Dor2env,Dor2cat,Dor2cal,Dor2Cajas,Dor2Kilos) VALUES (@EmpCod,@TempCod,@DorTipPlani,@DORNum,@Folio,@Corr,@Species,@Variety,@ProcessDate,@Producer,@Container,@Category,@Calibre,@Boxes,@Kilos);");
      }
      await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("Type", sql.SmallInt, dorTipPlani).input("Number", sql.Decimal(10, 0), row.PUSNum).input("Folio", sql.Char(10), folio).query("UPDATE PROCUSDA1 SET PUS1Dispo=0 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type AND PUSNum=@Number AND PUS1Folio=@Folio;");
    }
    await updateDespachoTotals(requestFactory(transaction), empCod, tempCod, dorTipPlani, dorNum);
    await transaction.commit();
    return getDespachoDetail(empCod, dorNum, dorTipPlani, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError ? error : new DespachosSAGError(500, "DESPACHO_FOLIO_ADD_ERROR", error.message);
  }
};

const removeFolioFromDespacho = async (
  empCod,
  dorNumValue,
  folioValue,
  payload = {},
  { poolProvider = getPool, transactionFactory = (pool) => new sql.Transaction(pool), requestFactory = (transaction) => new sql.Request(transaction) } = {},
) => {
  const dorNum = validId(dorNumValue);
  const folio = boundedText(folioValue, "El folio", 10, { required: true });
  const dorTipPlani = integer(payload?.dorTipPlani ?? payload?.type ?? 1, "El tipo de despacho", { min: 1, max: 3, defaultValue: 1 });
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeTempForRequest(requestFactory(transaction), empCod, { lock: true });
    const header = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).query("SELECT TOP 1 DorEstado FROM DESORIGEN WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;");
    if (!header.recordset?.length) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
    assertDespachoEditable(header.recordset[0]);
    const child = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Folio", sql.Char(10), folio).query("SELECT TOP 1 dor1Nsol FROM DESORIGEN1 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum AND dor1Folio=@Folio;");
    const row = child.recordset?.[0];
    if (!row) throw new DespachosSAGError(404, "FOLIO_NOT_FOUND", "El folio no está asociado al despacho.");
    await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Folio", sql.Char(10), folio).query("DELETE FROM DESORIGEN2 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum AND dor1Folio=@Folio; DELETE FROM DESORIGEN1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum AND dor1Folio=@Folio;");
    if (dorTipPlani === 1) {
      await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("Folio", sql.Char(10), folio).input("RequestNumber", sql.Decimal(10, 0), row.dor1Nsol).query("UPDATE SOLICITUDES2 SET Sol2Dispo=0 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@RequestNumber AND Sol2Folio=@Folio; UPDATE FOLIOSPROC SET FPDesOri=0 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;");
    } else {
      await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("Type", sql.SmallInt, dorTipPlani).input("Number", sql.Decimal(10, 0), row.dor1Nsol).input("Folio", sql.Char(10), folio).query("UPDATE PROCUSDA1 SET PUS1Dispo=1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type AND PUSNum=@Number AND PUS1Folio=@Folio;");
    }
    await updateDespachoTotals(requestFactory(transaction), empCod, tempCod, dorTipPlani, dorNum);
    await transaction.commit();
    return getDespachoDetail(empCod, dorNum, dorTipPlani, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError ? error : new DespachosSAGError(500, "DESPACHO_FOLIO_REMOVE_ERROR", error.message);
  }
};

const finalizarDespacho = async (
  empCod,
  dorNumValue,
  dorTipPlaniValue = 1,
  { poolProvider = getPool, transactionFactory = (pool) => new sql.Transaction(pool), requestFactory = (transaction) => new sql.Request(transaction) } = {},
) => {
  const dorNum = validId(dorNumValue);
  const dorTipPlani = integer(dorTipPlaniValue, "El tipo de despacho", { min: 1, max: 3, defaultValue: 1 });
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeTempForRequest(requestFactory(transaction), empCod, { lock: true });
    const result = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DorTipPlani", sql.SmallInt, dorTipPlani)
      .input("DORNum", sql.Decimal(10, 0), dorNum)
      .query(`
        SELECT TOP 1 DorEstado,DorFecha,DorPuertoE,DorPuertoD,DestCod,RTRIM(DorObs1) DorObs1
        FROM DESORIGEN WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;
        SELECT COUNT_BIG(1) folioCount
        FROM DESORIGEN1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;
      `);
    const recordsets = result.recordsets || [result.recordset || []];
    const header = recordsets[0]?.[0];
    if (!header) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
    if (Number(header.DorEstado) === 1) throw new DespachosSAGError(409, "DESPACHO_ALREADY_FINALIZED", "El despacho ya está Finalizado.");
    if (Number(header.DorEstado) === 5) throw new DespachosSAGError(409, "DESPACHO_VOID", "No se puede finalizar un despacho Nulo.");
    if (!header.DorFecha) throw new DespachosSAGError(409, "DESPACHO_INCOMPLETE", "La fecha de despacho es obligatoria antes de finalizar.");
    if (!(Number(header.DorPuertoE) > 0)) throw new DespachosSAGError(409, "DESPACHO_INCOMPLETE", "El puerto de embarque es obligatorio antes de finalizar.");
    if (!(Number(header.DorPuertoD) > 0)) throw new DespachosSAGError(409, "DESPACHO_INCOMPLETE", "El puerto de destino es obligatorio antes de finalizar.");
    if (!(Number(header.DestCod) > 0)) throw new DespachosSAGError(409, "DESPACHO_INCOMPLETE", "El destino es obligatorio antes de finalizar.");
    if (!trim(header.DorObs1)) throw new DespachosSAGError(409, "DESPACHO_INCOMPLETE", "Las observaciones son obligatorias antes de finalizar.");
    if (!(Number(recordsets[1]?.[0]?.folioCount) > 0)) throw new DespachosSAGError(409, "DESPACHO_WITHOUT_FOLIOS", "El despacho debe tener al menos un folio antes de finalizar.");

    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("DorTipPlani", sql.SmallInt, dorTipPlani)
      .input("DORNum", sql.Decimal(10, 0), dorNum)
      .query(`
        UPDATE DESORIGEN SET DorEstado=1
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum AND DorEstado=0;
      `);
    await transaction.commit();
    return { dorNum, status: 1, statusLabel: statusLabel(1) };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError ? error : new DespachosSAGError(500, "DESPACHO_FINALIZE_ERROR", error.message);
  }
};

const anularDespacho = async (
  empCod,
  login,
  dorNumValue,
  dorTipPlaniValue = 1,
  { poolProvider = getPool, transactionFactory = (pool) => new sql.Transaction(pool), requestFactory = (transaction) => new sql.Request(transaction) } = {},
) => {
  const dorNum = validId(dorNumValue);
  const dorTipPlani = integer(dorTipPlaniValue, "El tipo de despacho", { min: 1, max: 3, defaultValue: 1 });
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeTempForRequest(requestFactory(transaction), empCod, { lock: true });
    const header = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).query("SELECT TOP 1 DorEstado FROM DESORIGEN WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;");
    if (!header.recordset?.length) throw new DespachosSAGError(404, "DESPACHO_NOT_FOUND", "El despacho no existe en la temporada activa.");
    if (Number(header.recordset[0].DorEstado) === 5) throw new DespachosSAGError(409, "DESPACHO_ALREADY_VOID", "El despacho ya está Nulo.");
    const folios = await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).query("SELECT RTRIM(dor1Folio) folio,dor1Nsol requestNumber FROM DESORIGEN1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;");
    for (const row of folios.recordset || []) {
      if (dorTipPlani === 1) {
        await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("Folio", sql.Char(10), row.folio).input("RequestNumber", sql.Decimal(10, 0), row.requestNumber).query("UPDATE SOLICITUDES2 SET Sol2Dispo=0 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@RequestNumber AND Sol2Folio=@Folio; UPDATE FOLIOSPROC SET FPDesOri=0 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;");
      } else {
        await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("Type", sql.SmallInt, dorTipPlani).input("Number", sql.Decimal(10, 0), row.requestNumber).input("Folio", sql.Char(10), row.folio).query("UPDATE PROCUSDA1 SET PUS1Dispo=1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type AND PUSNum=@Number AND PUS1Folio=@Folio;");
      }
    }
    await requestFactory(transaction).input("EmpCod", sql.SmallInt, empCod).input("TempCod", sql.Char(9), tempCod).input("DorTipPlani", sql.SmallInt, dorTipPlani).input("DORNum", sql.Decimal(10, 0), dorNum).input("Login", sql.Char(10), boundedText(login, "El usuario", 10, { required: true })).query("UPDATE DESORIGEN SET DorEstado=5,DorFecAnula=GETDATE(),DorLogAnula=@Login WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorTipPlani=@DorTipPlani AND DORNum=@DORNum;");
    await transaction.commit();
    return getDespachoDetail(empCod, dorNum, dorTipPlani, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof DespachosSAGError ? error : new DespachosSAGError(500, "DESPACHO_VOID_ERROR", error.message);
  }
};

module.exports = {
  permission,
  DespachosSAGError,
  defaultRange,
  dateValue,
  listFilters,
  statusLabel,
  getFormData,
  listDespachos,
  getDespachoPdfData,
  generateDespachoPdf,
  generateArchivoDes,
  normalizeMultipuertoPayload,
  openMultipuerto,
  updateMultipuerto,
  buildMultipuertoFile,
  generateArchivoMultipuerto,
  despachoTypeLabel,
  normalizeDespachoPayload,
  getDespachoFormData,
  getDespachoDetail,
  createDespacho,
  updateDespacho,
  listAvailableDespachoFolios,
  addFolioToDespacho,
  removeFolioFromDespacho,
  finalizarDespacho,
  anularDespacho,
};

const { getPool, sql } = require("../../conectorMysql/conectorSqlServer");
const { renderProcesoUSDAPdf } = require("./procesosUSDA.pdf");

const permission = { sistema: 100, modulo: 20, programa: 10 };
const processTypes = [2, 3];
const statusValues = [0, 1, 2, 3];
const maxProcessNumber = 9999999999;

class ProcesosUSDAError extends Error {
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
  from.setDate(from.getDate() - 60);
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
    throw new ProcesosUSDAError(
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
  if (value === undefined || value === null || trim(value) === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ProcesosUSDAError(
      400,
      "VALIDATION_ERROR",
      `${label} debe ser un número entero dentro del rango permitido.`,
    );
  }
  return parsed;
};

const listFilters = (query = {}) => {
  const defaults = defaultRange();
  const from = Object.prototype.hasOwnProperty.call(query, "from") && trim(query.from) === "" ? null : dateValue(query.from || defaults.from, "La fecha desde");
  const to = Object.prototype.hasOwnProperty.call(query, "to") && trim(query.to) === "" ? null : dateValue(query.to || defaults.to, "La fecha hasta");
  if (from && to && from > to) {
    throw new ProcesosUSDAError(
      400,
      "VALIDATION_ERROR",
      "La fecha desde no puede ser posterior a la fecha hasta.",
    );
  }

  const type = integer(query.type ?? query.PUSTipo, "El tipo de proceso", {
    min: 2,
    max: 9,
    defaultValue: 9,
  });
  if (![...processTypes, 9].includes(type)) {
    throw new ProcesosUSDAError(
      400,
      "VALIDATION_ERROR",
      "El tipo de proceso debe ser Fumigación, Muestreo o Todos.",
    );
  }

  const status = integer(query.status ?? query.PUSEstado, "El estado", {
    min: 0,
    max: 9,
    defaultValue: 9,
  });
  if (![...statusValues, 9].includes(status)) {
    throw new ProcesosUSDAError(
      400,
      "VALIDATION_ERROR",
      "El estado debe ser En Proceso, Aprobado, Rechazado, Anulado o Todos.",
    );
  }

  return {
    from,
    to,
    type,
    status,
    species: integer(query.species ?? query.Espe, "La especie", {
      min: 0,
      max: 32767,
      defaultValue: 0,
    }),
    processNumber: integer(
      query.processNumber ?? query.PUSNum,
      "El número de proceso",
      { min: 0, max: maxProcessNumber, defaultValue: 0 },
    ),
    search: trim(query.search).slice(0, 100),
    all: String(query.all || "").toLowerCase() === "true" || String(query.all) === "1",
    page: integer(query.page, "La página", {
      min: 1,
      max: 100000,
      defaultValue: 1,
    }),
    pageSize: integer(query.pageSize, "El tamaño de página", {
      min: 1,
      max: 100,
      defaultValue: 25,
    }),
  };
};

const processTypeLabel = (type) =>
  ({ 2: "Fumigación", 3: "Muestreo" })[Number(type)] || "Desconocido";

const statusLabel = (status) =>
  ({ 0: "En Proceso", 1: "Aprobado", 2: "Rechazado", 3: "Anulado" })[Number(status)] ||
  "Desconocido";

const getActiveSeason = async (request, empCod, { lock = false } = {}) => {
  const hint = lock ? " WITH (UPDLOCK,HOLDLOCK)" : "";
  const result = await request.input("EmpCod", sql.SmallInt, empCod).query(`
    SELECT TOP 1 RTRIM(TempCod) tempCod
    FROM TEMP01${hint}
    WHERE EmpCod=@EmpCod AND TempActiva=1
    ORDER BY TempFecAbre DESC,TempCod DESC;
  `);
  const tempCod = trim(result.recordset?.[0]?.tempCod);
  if (!tempCod) {
    throw new ProcesosUSDAError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa. Active una temporada antes de consultar Procesos USDA.",
    );
  }
  return tempCod;
};

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
    SELECT Especod code,RTRIM(EspeNom) name
    FROM ESPECIES
    WHERE EmpCod=@EmpCod
    ORDER BY Especod;
  `);
  const tempCod = trim(result.recordsets?.[0]?.[0]?.tempCod);
  if (!tempCod) {
    throw new ProcesosUSDAError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa. Active una temporada antes de consultar Procesos USDA.",
    );
  }
  return {
    tempCod,
    companyName: trim(result.recordsets?.[1]?.[0]?.companyName),
    species: result.recordsets?.[2] || [],
    defaultRange: defaultRange(),
    processTypes: [
      { code: 2, name: "Fumigación" },
      { code: 3, name: "Muestreo" },
      { code: 9, name: "Todos" },
    ],
    states: [
      { code: 0, name: "En Proceso" },
      { code: 1, name: "Aprobado" },
      { code: 2, name: "Rechazado" },
      { code: 3, name: "Anulado" },
      { code: 9, name: "Todos" },
    ],
  };
};

const listProcesos = async (
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
    .input("Type", sql.SmallInt, filters.type)
    .input("Status", sql.SmallInt, filters.status)
    .input("Species", sql.SmallInt, filters.species)
    .input("ProcessNumber", sql.Decimal(10, 0), filters.processNumber)
    .input("Search", sql.NVarChar(100), filters.search)
    .input("Offset", sql.Int, (filters.page - 1) * filters.pageSize)
    .input("PageSize", sql.Int, filters.pageSize)
    .query(`
    DECLARE @TempCod char(9)=(
      SELECT TOP 1 TempCod FROM TEMP01
      WHERE EmpCod=@EmpCod AND TempActiva=1
      ORDER BY TempFecAbre DESC,TempCod DESC
    );
    SELECT h.PUSTipo processType,h.PUSNum processNumber,
      CONVERT(char(10),h.PUSFecha,23) processDate,
      COALESCE(h.PUSTotCaj,0) totalBoxes,COALESCE(h.PUSTotKil,0) totalKilos,
      COALESCE(h.PUSTotPal,0) totalPallets,h.PUSEstado status,
      h.PUSEspe speciesCode,RTRIM(e.EspeNom) speciesName,
      RTRIM(h.PUSLoginC) createdBy,CONVERT(char(10),h.PUSFecC,23) createdDate,
      RTRIM(@TempCod) tempCod
    INTO #filtered
    FROM PROCUSDA h
    LEFT JOIN ESPECIES e ON e.EmpCod=h.EmpCod AND e.Especod=h.PUSEspe
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
      AND (@Type=9 OR h.PUSTipo=@Type)
      AND (@Status=9 OR h.PUSEstado=@Status)
      AND (@Species=0 OR h.PUSEspe=@Species)
      AND h.PUSNum>=@ProcessNumber
      AND (@From IS NULL OR h.PUSFecha>=@From) AND (@To IS NULL OR h.PUSFecha<DATEADD(day,1,@To))
      AND (@Search='' OR CONVERT(varchar(20),h.PUSNum) LIKE '%'+@Search+'%' OR ISNULL(e.EspeNom,'') LIKE '%'+@Search+'%' OR ISNULL(h.PUSLoginC,'') LIKE '%'+@Search+'%');
    SELECT processType,processNumber,processDate,totalBoxes,totalKilos,totalPallets,status,
      speciesCode,speciesName,createdBy,createdDate,tempCod
    FROM #filtered
    ORDER BY processNumber DESC
    ${filters.all ? ";" : "OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;"}
    SELECT COUNT(*) total,COALESCE(SUM(CONVERT(bigint,totalBoxes)),0) totalBoxes,
      COALESCE(SUM(CONVERT(decimal(19,2),totalKilos)),0) totalKilos,
      COALESCE(SUM(CONVERT(bigint,totalPallets)),0) totalPallets,
      SUM(CASE WHEN status=0 THEN 1 ELSE 0 END) inProgress,
      SUM(CASE WHEN status=1 THEN 1 ELSE 0 END) approved,
      SUM(CASE WHEN status IN (2,3) THEN 1 ELSE 0 END) rejected
    FROM #filtered;
    SELECT RTRIM(@TempCod) tempCod;
  `);

  const summary = result.recordsets?.[1]?.[0] || {};
  const tempCod = trim(result.recordsets?.[2]?.[0]?.tempCod);
  if (!tempCod) {
    throw new ProcesosUSDAError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa. Active una temporada antes de consultar Procesos USDA.",
    );
  }
  const rows = (result.recordsets?.[0] || []).map((row) => ({
    ...row,
    id: `${Number(row.processType)}-${row.processNumber}`,
    processTypeLabel: processTypeLabel(row.processType),
    statusLabel: statusLabel(row.status),
  }));
  return {
    rows,
    total: Number(summary.total || 0),
    totals: {
      boxes: Number(summary.totalBoxes || 0),
      kilos: Number(summary.totalKilos || 0),
      pallets: Number(summary.totalPallets || 0),
    },
    statusCounts: { inProgress: Number(summary.inProgress || 0), approved: Number(summary.approved || 0), rejected: Number(summary.rejected || 0) },
    tempCod,
    filters,
  };
};

const validProcessNumber = (value) =>
  integer(value, "El número de proceso", {
    min: 1,
    max: maxProcessNumber,
  });

const processFolioValue = (value) => {
  const folio = trim(value);
  if (!folio || folio.length > 10) {
    throw new ProcesosUSDAError(
      400,
      "VALIDATION_ERROR",
      "El folio es obligatorio y no puede superar los 10 caracteres.",
    );
  }
  return folio;
};

const processPayload = (payload = {}, { processType, processNumber } = {}) => ({
  processType: validProcessType(
    payload.processType ?? payload.PUSTipo ?? processType,
  ),
  processNumber: validProcessNumber(
    payload.processNumber ?? payload.PUSNum ?? processNumber,
  ),
  processDate: dateValue(
    payload.processDate ?? payload.PUSFecha,
    "La fecha del proceso",
  ),
});

const mapProcessHeader = (row) => ({
  processType: Number(row.processType),
  processNumber: Number(row.processNumber),
  processDate: trim(row.processDate),
  status: Number(row.status ?? 0),
  speciesCode: Number(row.speciesCode || 0),
  speciesName: trim(row.speciesName),
  createdBy: trim(row.createdBy),
  createdDate: trim(row.createdDate),
  totalBoxes: Number(row.totalBoxes || 0),
  totalKilos: Number(row.totalKilos || 0),
  totalFolios: Number(row.totalFolios || 0),
  tempCod: trim(row.tempCod),
  processTypeLabel: processTypeLabel(row.processType),
  statusLabel: statusLabel(row.status),
});

const assertProcessNotAnnulled = (header) => {
  if (Number(header.status) === 3) {
    throw new ProcesosUSDAError(
      409,
      "PROCESS_LOCKED",
      "El proceso USDA está anulado y no admite modificaciones.",
    );
  }
};

const updateProcessTotals = async (
  request,
  empCod,
  tempCod,
  processType,
  processNumber,
) => {
  await request
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("Type", sql.SmallInt, processType)
    .input("ProcessNumber", sql.Decimal(10, 0), processNumber).query(`
      UPDATE h
      SET PUSTotCaj=COALESCE(t.totalBoxes,0),
          PUSTotKil=COALESCE(t.totalKilos,0),
          PUSTotPal=COALESCE(t.totalFolios,0)
      FROM PROCUSDA h
      OUTER APPLY (
        SELECT COUNT_BIG(1) totalFolios,
          SUM(CONVERT(bigint,d.PUS1Cajas)) totalBoxes,
          SUM(CONVERT(decimal(19,2),d.PUS1Kilos)) totalKilos
        FROM PROCUSDA1 d
        WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod
          AND d.PUSTipo=h.PUSTipo AND d.PUSNum=h.PUSNum
      ) t
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
        AND h.PUSTipo=@Type AND h.PUSNum=@ProcessNumber;
    `);
};

const getProcesoDetail = async (
  empCod,
  processTypeValue,
  processNumberValue,
  { poolProvider = getPool } = {},
) => {
  const processType = validProcessType(processTypeValue);
  const processNumber = validProcessNumber(processNumberValue);
  const pool = await poolProvider();
  const tempCod = await getActiveSeason(pool.request(), empCod);
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("Type", sql.SmallInt, processType)
    .input("ProcessNumber", sql.Decimal(10, 0), processNumber).query(`
      SELECT TOP 1 h.PUSTipo processType,h.PUSNum processNumber,
        CONVERT(char(10),h.PUSFecha,23) processDate,h.PUSEstado status,
        h.PUSEspe speciesCode,RTRIM(e.EspeNom) speciesName,
        RTRIM(h.PUSLoginC) createdBy,CONVERT(char(10),h.PUSFecC,23) createdDate,
        COALESCE(h.PUSTotCaj,0) totalBoxes,COALESCE(h.PUSTotKil,0) totalKilos,
        COALESCE(h.PUSTotPal,0) totalFolios,RTRIM(h.TempCod) tempCod
      FROM PROCUSDA h
      LEFT JOIN ESPECIES e ON e.EmpCod=h.EmpCod AND e.Especod=h.PUSEspe
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
        AND h.PUSTipo=@Type AND h.PUSNum=@ProcessNumber;
      SELECT RTRIM(d.PUS1Folio) folio,d.PUS1Espe speciesCode,
        RTRIM(e.EspeNom) speciesName,COALESCE(d.PUS1Cajas,0) boxes,
        COALESCE(d.PUS1Kilos,0) kilos,COALESCE(d.PUS1Dispo,0) available,
        COALESCE(d.PUS1CajRep,0) repBoxes,COALESCE(d.PUS1KilRep,0) repKilos,
        COALESCE(d.PUS1CajDes,0) dispatchedBoxes,COALESCE(d.PUS1KilDes,0) dispatchedKilos
      FROM PROCUSDA1 d
      LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.PUS1Espe
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod
        AND d.PUSTipo=@Type AND d.PUSNum=@ProcessNumber
      ORDER BY d.PUS1Folio;
      SELECT RTRIM(d.PUS1Folio) folio,d.PUS2Cor correlation,
        CONVERT(char(10),d.PUS2Fecha,23) processDate,d.VarCod varietyCode,
        d.ProdCod producerCode,d.EnvCod containerCode,d.Catcod categoryCode,
        RTRIM(d.Calibre) caliber,d.Especod speciesCode,
        COALESCE(d.PUS2Cajas,0) boxes,COALESCE(d.PUS2Kilos,0) kilos,
        COALESCE(d.PUS2CajDES,0) dispatchedBoxes,COALESCE(d.PUS2KilDES,0) dispatchedKilos
      FROM PROCUSDA2 d
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod
        AND d.PUSTipo=@Type AND d.PUSNum=@ProcessNumber
      ORDER BY d.PUS1Folio,d.PUS2Cor;
    `);
  if (!result.recordsets?.[0]?.[0]) {
    throw new ProcesosUSDAError(
      404,
      "PROCESS_NOT_FOUND",
      "El proceso USDA no existe en la temporada activa.",
    );
  }
  return {
    header: mapProcessHeader(result.recordsets[0][0]),
    folios: result.recordsets[1] || [],
    details: result.recordsets[2] || [],
    tempCod,
  };
};

const checkProcesoDisponible = async (
  empCod,
  processTypeValue,
  processNumberValue,
  { poolProvider = getPool } = {},
) => {
  const processType = validProcessType(processTypeValue);
  const processNumber = validProcessNumber(processNumberValue);
  const pool = await poolProvider();
  const tempCod = await getActiveSeason(pool.request(), empCod);
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("Type", sql.SmallInt, processType)
    .input("ProcessNumber", sql.Decimal(10, 0), processNumber).query(`
      SELECT TOP 1 PUSNum
      FROM PROCUSDA
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod
        AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
    `);
  return {
    available: !result.recordset?.length,
    processType,
    processNumber,
    tempCod,
  };
};

const getProcesoPdfData = async (
  empCod,
  processTypeValue,
  processNumberValue,
  { poolProvider = getPool } = {},
) => {
  const processType = validProcessType(processTypeValue);
  const processNumber = validProcessNumber(processNumberValue);
  const detail = await getProcesoDetail(empCod, processType, processNumber, {
    poolProvider,
  });
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), detail.tempCod)
    .input("Type", sql.SmallInt, processType)
    .input("ProcessNumber", sql.Decimal(10, 0), processNumber).query(`
      SELECT TOP 1 RTRIM(EmpNom) companyName,RTRIM(EmpGiro) companyBusiness,
        RTRIM(Empdir) companyAddress,EmpRut companyRut,RTRIM(EmpDV) companyDv
      FROM DEFEMP WHERE EmpCod=@EmpCod;
      SELECT RTRIM(d.PUS1Folio) folio,
        RTRIM(d.ProdCod) producerCode,RTRIM(p.ProdNom) producerName,
        CONVERT(varchar(30),p.ProdComuna) producerCommune,
        CONVERT(varchar(30),p.ProdProvincia) producerProvince,
        RTRIM(p.ProdPack) packingName,
        CONVERT(varchar(30),p.ProdPackCom) packingCommune,
        CONVERT(varchar(30),p.ProdPackProv) packingProvince,
        RTRIM(e.EspeNom) speciesName,
        RTRIM(v.VarNom) varietyName,
        COALESCE(d.PUS2Cajas,0) detailBoxes,
        COALESCE(f.PUS1Cajas,0) folioBoxes,
        CONVERT(char(10),d.PUS2Fecha,23) detailDate,
        RTRIM(p.ProdCodSAG) producerSagCode,
        d.PUS2Cor correlation
      FROM PROCUSDA2 d
      INNER JOIN PROCUSDA1 f
        ON f.EmpCod=d.EmpCod AND f.TempCod=d.TempCod
        AND f.PUSTipo=d.PUSTipo AND f.PUSNum=d.PUSNum
        AND f.PUS1Folio=d.PUS1Folio
      LEFT JOIN PRODUCTORES p
        ON p.EmpCod=d.EmpCod AND RTRIM(p.ProdCod)=RTRIM(d.ProdCod)
      LEFT JOIN ESPECIES e
        ON e.EmpCod=d.EmpCod AND e.Especod=COALESCE(d.Especod,f.PUS1Espe)
      LEFT JOIN ESPECIES1 v
        ON v.EmpCod=d.EmpCod AND v.Especod=COALESCE(d.Especod,f.PUS1Espe)
        AND v.VarCod=d.VarCod
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod
        AND d.PUSTipo=@Type AND d.PUSNum=@ProcessNumber
      ORDER BY d.PUS1Folio,d.PUS2Cor;
    `);
  const company = result.recordsets?.[0]?.[0] || {};
  if (!result.recordsets?.[0]?.[0]) {
    throw new ProcesosUSDAError(
      404,
      "COMPANY_NOT_FOUND",
      "No existe la empresa asociada al usuario para generar el PDF.",
    );
  }
  const enrichedDetails = result.recordsets?.[1] || [];
  const fallbackDetails = detail.details.map((row) => {
    const folio = detail.folios.find((item) => trim(item.folio) === trim(row.folio));
    return {
      ...row,
      folioBoxes: Number(folio?.boxes || 0),
      speciesName: trim(folio?.speciesName || row.speciesName),
      detailBoxes: Number(row.boxes || 0),
      detailDate: row.processDate,
    };
  });
  return {
    ...detail,
    header: { ...detail.header, ...company },
    details: enrichedDetails.length ? enrichedDetails : fallbackDetails,
  };
};

const generateProcesoUSDAPdf = async (
  empCod,
  processTypeValue,
  processNumberValue,
  { poolProvider = getPool, pdfRenderer = renderProcesoUSDAPdf } = {},
) => {
  const data = await getProcesoPdfData(
    empCod,
    processTypeValue,
    processNumberValue,
    { poolProvider },
  );
  return {
    filename: `DetalleUSDA_${data.header.processNumber}.pdf`,
    content: await pdfRenderer(data),
  };
};

const listAvailableProcessFolios = async (
  empCod,
  processTypeValue,
  processNumberValue = 0,
  query = {},
  { poolProvider = getPool } = {},
) => {
  const processType = validProcessType(processTypeValue);
  const processNumber = integer(processNumberValue, "El número de proceso", {
    min: 0,
    max: maxProcessNumber,
    defaultValue: 0,
  });
  const folio = trim(query.folio ?? query.search);
  if (folio.length > 10) {
    throw new ProcesosUSDAError(
      400,
      "VALIDATION_ERROR",
      "El folio no puede superar los 10 caracteres.",
    );
  }
  const species = integer(query.species ?? query.speciesCode ?? query.Espe, "La especie", {
    min: 0,
    max: 32767,
    defaultValue: 0,
  });
  const pool = await poolProvider();
  const tempCod = await getActiveSeason(pool.request(), empCod);
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("TempCod", sql.Char(9), tempCod)
    .input("Folio", sql.Char(10), folio)
    .input("Species", sql.SmallInt, species).query(`
      SELECT RTRIM(h.FPFolio) folio,h.FPEspe speciesCode,
        RTRIM(e.EspeNom) speciesName,RTRIM(x.ExpNom) exporterName,
        COALESCE(t.totalBoxes,0) boxes,
        COALESCE(t.totalKilos,0) kilos,h.FPEstado status,h.FPDisponible available
      FROM FOLIOSPROC h
      LEFT JOIN ESPECIES e ON e.EmpCod=h.EmpCod AND e.Especod=h.FPEspe
      LEFT JOIN EXPORT1 x ON x.EmpCod=h.EmpCod AND x.ExpCod=h.ExpCod
      OUTER APPLY (
        SELECT SUM(CONVERT(bigint,d.FP2Cajas)) totalBoxes,
          SUM(CONVERT(decimal(19,2),d.FP2Kilos)) totalKilos
        FROM FOLIOSPROC1 d
        WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio
      ) t
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
        AND h.FPEstado=10 AND h.FPDisponible=1
        AND (@Folio='' OR RTRIM(h.FPFolio)=RTRIM(@Folio))
        AND (@Species=0 OR h.FPEspe=@Species)
      ORDER BY h.FPFolio;
    `);
  return {
    rows: (result.recordset || []).map((row) => ({
      ...row,
      id: trim(row.folio),
    })),
    tempCod,
    type: processType,
  };
};

const createProceso = async (
  empCod,
  login,
  payload,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const input = processPayload(payload);
  const userLogin = trim(login);
  if (!userLogin || userLogin.length > 10) {
    throw new ProcesosUSDAError(400, "VALIDATION_ERROR", "El usuario no es válido.");
  }
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await getActiveSeason(requestFactory(transaction), empCod, { lock: true });
    const duplicate = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, input.processType)
      .input("ProcessNumber", sql.Decimal(10, 0), input.processNumber)
      .query(`
        SELECT TOP 1 PUSNum
        FROM PROCUSDA WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod
          AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
      `);
    if (duplicate.recordset?.length) {
      throw new ProcesosUSDAError(
        409,
        "PROCESS_ALREADY_EXISTS",
        "Ya existe un proceso USDA con ese tipo y número en la temporada activa.",
      );
    }
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, input.processType)
      .input("ProcessNumber", sql.Decimal(10, 0), input.processNumber)
      .input("ProcessDate", sql.Date, input.processDate)
      .input("Status", sql.SmallInt, 0)
      .input("Login", sql.Char(10), userLogin)
      .query(`
        INSERT PROCUSDA
          (EmpCod,TempCod,PUSTipo,PUSNum,PUSFecha,PUSEstado,PUSEspe,
           PUSLoginC,PUSFecC,PUSTotCaj,PUSTotKil,PUSTotPal)
        VALUES
          (@EmpCod,@TempCod,@Type,@ProcessNumber,@ProcessDate,@Status,0,
           @Login,GETDATE(),0,0,0);
      `);
    await transaction.commit();
    return getProcesoDetail(empCod, input.processType, input.processNumber, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof ProcesosUSDAError
      ? error
      : new ProcesosUSDAError(500, "PROCESS_CREATE_ERROR", error.message);
  }
};

const updateProceso = async (
  empCod,
  login,
  processTypeValue,
  processNumberValue,
  payload,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const processType = validProcessType(processTypeValue);
  const processNumber = validProcessNumber(processNumberValue);
  const input = processPayload(payload, { processType, processNumber });
  const userLogin = trim(login);
  if (!userLogin || userLogin.length > 10) {
    throw new ProcesosUSDAError(400, "VALIDATION_ERROR", "El usuario no es válido.");
  }
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await getActiveSeason(requestFactory(transaction), empCod, { lock: true });
    const current = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .query(`
        SELECT TOP 1 PUSEstado status
        FROM PROCUSDA WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod
          AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
      `);
    const header = current.recordset?.[0];
    if (!header) {
      throw new ProcesosUSDAError(
        404,
        "PROCESS_NOT_FOUND",
        "El proceso USDA no existe en la temporada activa.",
      );
    }
    assertProcessNotAnnulled(header);
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .input("ProcessDate", sql.Date, input.processDate)
      .query(`
        UPDATE PROCUSDA
        SET PUSFecha=@ProcessDate
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod
          AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
      `);
    await transaction.commit();
    return getProcesoDetail(empCod, processType, processNumber, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof ProcesosUSDAError
      ? error
      : new ProcesosUSDAError(500, "PROCESS_UPDATE_ERROR", error.message);
  }
};

const addProcesoFolio = async (
  empCod,
  login,
  processTypeValue,
  processNumberValue,
  payload,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const processType = validProcessType(processTypeValue);
  const processNumber = validProcessNumber(processNumberValue);
  const folio = processFolioValue(payload?.folio ?? payload?.FPFolio);
  const userLogin = trim(login);
  if (!userLogin || userLogin.length > 10) {
    throw new ProcesosUSDAError(400, "VALIDATION_ERROR", "El usuario no es válido.");
  }
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await getActiveSeason(requestFactory(transaction), empCod, { lock: true });
    const current = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .query(`
        SELECT TOP 1 PUSEstado status
        FROM PROCUSDA WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod
          AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
      `);
    const header = current.recordset?.[0];
    if (!header) {
      throw new ProcesosUSDAError(404, "PROCESS_NOT_FOUND", "El proceso USDA no existe en la temporada activa.");
    }
    assertProcessNotAnnulled(header);
    const duplicate = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .input("Folio", sql.Char(10), folio)
      .query(`
        SELECT TOP 1 PUS1Folio
        FROM PROCUSDA1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type
          AND PUSNum=@ProcessNumber AND PUS1Folio=@Folio;
      `);
    if (duplicate.recordset?.length) {
      throw new ProcesosUSDAError(409, "FOLIO_ALREADY_ATTACHED", "El folio ya está asociado al proceso.");
    }
    const sourceResult = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Folio", sql.Char(10), folio)
      .query(`
        SELECT TOP 1 h.FPFolio,h.FPEspe,
          COALESCE(t.totalBoxes,0) totalBoxes,COALESCE(t.totalKilos,0) totalKilos
        FROM FOLIOSPROC h WITH (UPDLOCK,HOLDLOCK)
        OUTER APPLY (
          SELECT SUM(CONVERT(bigint,d.FP2Cajas)) totalBoxes,
            SUM(CONVERT(decimal(19,2),d.FP2Kilos)) totalKilos
          FROM FOLIOSPROC1 d
          WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio
        ) t
        WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPFolio=@Folio
          AND h.FPEstado=10 AND h.FPDisponible=1
          AND NOT EXISTS (
            SELECT 1 FROM PROCUSDA1 attached
            WHERE attached.EmpCod=h.EmpCod AND attached.TempCod=h.TempCod
              AND attached.PUS1Folio=h.FPFolio
          );
      `);
    const source = sourceResult.recordset?.[0];
    if (!source) {
      throw new ProcesosUSDAError(409, "FOLIO_NOT_AVAILABLE", "El folio no está disponible para este proceso USDA.");
    }
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .input("Folio", sql.Char(10), folio)
      .input("Boxes", sql.SmallInt, Number(source.totalBoxes || 0))
      .input("Species", sql.SmallInt, Number(source.FPEspe || 0))
      .input("Kilos", sql.Money, Number(source.totalKilos || 0))
      .query(`
        INSERT PROCUSDA1
          (EmpCod,TempCod,PUSTipo,PUSNum,PUS1Folio,PUS1Espe,PUS1Cajas,
           PUS1Kilos,PUS1Dispo,PUS1CajRep,PUS1KilRep,PUS1CajDes,PUS1KilDes)
        VALUES
          (@EmpCod,@TempCod,@Type,@ProcessNumber,@Folio,@Species,@Boxes,
           @Kilos,1,0,0,@Boxes,@Kilos);
      `);
    const sourceDetails = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Folio", sql.Char(10), folio)
      .query(`
        SELECT FP2Cor,FP2Fecha,fp2varcod VarCod,ProdCod,EnvCod,Catcod,
          Calibre,fp2especod Especod,FP2Cajas,FP2Kilos
        FROM FOLIOSPROC1
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio
        ORDER BY FP2NProc,FP2Cor;
      `);
    for (const detail of sourceDetails.recordset || []) {
      await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("Type", sql.SmallInt, processType)
        .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
        .input("Folio", sql.Char(10), folio)
        .input("Correlation", sql.SmallInt, detail.FP2Cor)
        .input("ProcessDate", sql.DateTime, detail.FP2Fecha)
        .input("Variety", sql.Int, detail.VarCod)
        .input("Producer", sql.Char(6), detail.ProdCod)
        .input("Container", sql.SmallInt, detail.EnvCod)
        .input("Category", sql.SmallInt, detail.Catcod)
        .input("Caliber", sql.Char(10), detail.Calibre)
        .input("Species", sql.SmallInt, detail.Especod)
        .input("Boxes", sql.SmallInt, detail.FP2Cajas)
        .input("Kilos", sql.Money, detail.FP2Kilos)
        .query(`
          INSERT PROCUSDA2
            (EmpCod,TempCod,PUSTipo,PUSNum,PUS1Folio,PUS2Cor,PUS2Fecha,
             VarCod,ProdCod,EnvCod,Catcod,Calibre,Especod,PUS2Cajas,
             PUS2Kilos,PUS2CajREp,PUS2KilRep,PUS2CajDES,PUS2KilDES)
          VALUES
            (@EmpCod,@TempCod,@Type,@ProcessNumber,@Folio,@Correlation,
             @ProcessDate,@Variety,@Producer,@Container,@Category,@Caliber,
             @Species,@Boxes,@Kilos,0,0,@Boxes,@Kilos);
        `);
    }
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Folio", sql.Char(10), folio)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .query(`
        UPDATE FOLIOSPROC
        SET FPDisponible=0,FPDesUsda=@ProcessNumber
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
        UPDATE FOLIOSPROC1
        SET Fp2Ins=@ProcessNumber
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
      `);
    await updateProcessTotals(requestFactory(transaction), empCod, tempCod, processType, processNumber);
    await transaction.commit();
    return getProcesoDetail(empCod, processType, processNumber, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof ProcesosUSDAError
      ? error
      : new ProcesosUSDAError(500, "PROCESS_FOLIO_ADD_ERROR", error.message);
  }
};

const removeProcesoFolio = async (
  empCod,
  processTypeValue,
  processNumberValue,
  folioValue,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const processType = validProcessType(processTypeValue);
  const processNumber = validProcessNumber(processNumberValue);
  const folio = processFolioValue(folioValue);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await getActiveSeason(requestFactory(transaction), empCod, { lock: true });
    const headerResult = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .query(`
        SELECT TOP 1 PUSEstado status
        FROM PROCUSDA WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod
          AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
      `);
    const header = headerResult.recordset?.[0];
    if (!header) throw new ProcesosUSDAError(404, "PROCESS_NOT_FOUND", "El proceso USDA no existe en la temporada activa.");
    assertProcessNotAnnulled(header);
    const childResult = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .input("Folio", sql.Char(10), folio)
      .query(`
        SELECT TOP 1 PUS1Dispo available,PUS1CajRep repBoxes
        FROM PROCUSDA1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type
          AND PUSNum=@ProcessNumber AND PUS1Folio=@Folio;
      `);
    const child = childResult.recordset?.[0];
    if (!child) throw new ProcesosUSDAError(404, "FOLIO_NOT_FOUND", "El folio no está asociado al proceso.");
    if (Number(child.available) === 0) {
      throw new ProcesosUSDAError(409, "FOLIO_DISPATCHED", "El folio ya fue despachado y no puede ser eliminado.");
    }
    if (Number(child.repBoxes) > 0) {
      throw new ProcesosUSDAError(409, "FOLIO_REPALETIZED", "El folio contiene repaletizaje y no puede ser eliminado.");
    }
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .input("Folio", sql.Char(10), folio)
      .query(`
        DELETE FROM PROCUSDA2
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type
          AND PUSNum=@ProcessNumber AND PUS1Folio=@Folio;
        DELETE FROM PROCUSDA1
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type
          AND PUSNum=@ProcessNumber AND PUS1Folio=@Folio;
        UPDATE FOLIOSPROC
        SET FPDisponible=1,FPDesUsda=0
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
      `);
    await updateProcessTotals(requestFactory(transaction), empCod, tempCod, processType, processNumber);
    await transaction.commit();
    return getProcesoDetail(empCod, processType, processNumber, { poolProvider });
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof ProcesosUSDAError
      ? error
      : new ProcesosUSDAError(500, "PROCESS_FOLIO_REMOVE_ERROR", error.message);
  }
};

const validProcessType = (value) => {
  const type = integer(value, "El tipo de proceso", { min: 0, max: 9 });
  if (!processTypes.includes(type)) {
    throw new ProcesosUSDAError(
      400,
      "VALIDATION_ERROR",
      "El tipo de proceso debe ser Fumigación o Muestreo.",
    );
  }
  return type;
};

const changeStatus = async (
  empCod,
  login,
  processTypeValue,
  processNumberValue,
  statusValue,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
    allowAnnulled = false,
  } = {},
) => {
  const processType = validProcessType(processTypeValue);
  const processNumber = integer(processNumberValue, "El número de proceso", {
    min: 1,
    max: maxProcessNumber,
  });
  const status = integer(statusValue, "El estado", { min: 0, max: allowAnnulled ? 3 : 2 });
  const userLogin = trim(login);
  if (!userLogin || userLogin.length > 10) {
    throw new ProcesosUSDAError(400, "VALIDATION_ERROR", "El usuario no es válido.");
  }

  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await getActiveSeason(requestFactory(transaction), empCod, { lock: true });
    const current = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .query(`
        SELECT TOP 1 PUSEstado
        FROM PROCUSDA WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
      `);
    if (!current.recordset?.[0]) {
      throw new ProcesosUSDAError(
        404,
        "PROCESS_NOT_FOUND",
        "El proceso USDA no existe en la temporada activa.",
      );
    }
    if (Number(current.recordset[0].PUSEstado) === 3) {
      throw new ProcesosUSDAError(
        409,
        "PROCESS_LOCKED",
        "El proceso USDA está anulado y no admite cambios de estado.",
      );
    }

    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Type", sql.SmallInt, processType)
      .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
      .input("Status", sql.SmallInt, status)
      .query(`
        UPDATE PROCUSDA
        SET PUSEstado=@Status
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
      `);

    if ([2, 3].includes(status)) {
      // EstadoUS y Anular liberan los folios y eliminan el detalle USDA.
      await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("Type", sql.SmallInt, processType)
        .input("ProcessNumber", sql.Decimal(10, 0), processNumber)
        .query(`
          UPDATE f
          SET f.FPDisponible=1,f.FPIns=0
          FROM FOLIOSPROC f
          INNER JOIN PROCUSDA1 d
            ON d.EmpCod=f.EmpCod AND d.TempCod=f.TempCod AND d.PUS1Folio=f.FPFolio
          WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod
            AND d.PUSTipo=@Type AND d.PUSNum=@ProcessNumber;
          UPDATE f
          SET f.Fp2Ins=0
          FROM FOLIOSPROC1 f
          INNER JOIN PROCUSDA1 d
            ON d.EmpCod=f.EmpCod AND d.TempCod=f.TempCod AND d.PUS1Folio=f.FPFolio
          WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod
            AND d.PUSTipo=@Type AND d.PUSNum=@ProcessNumber;
          DELETE FROM PROCUSDA2
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
          DELETE FROM PROCUSDA1
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PUSTipo=@Type AND PUSNum=@ProcessNumber;
        `);
    }

    await transaction.commit();
    return {
      processType,
      processNumber,
      status,
      statusLabel: statusLabel(status),
      releasedFolios: [2, 3].includes(status),
    };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error instanceof ProcesosUSDAError
      ? error
      : new ProcesosUSDAError(500, "PROCESS_STATUS_ERROR", error.message);
  }
};

const anularProceso = async (empCod, login, processType, processNumber, dependencies = {}) =>
  changeStatus(empCod, login, processType, processNumber, 3, {
    ...dependencies,
    allowAnnulled: true,
  });

module.exports = {
  permission,
  processTypes,
  statusValues,
  defaultRange,
  listFilters,
  processTypeLabel,
  statusLabel,
  getFormData,
  listProcesos,
  getProcesoDetail,
  checkProcesoDisponible,
  getProcesoPdfData,
  generateProcesoUSDAPdf,
  listAvailableProcessFolios,
  createProceso,
  updateProceso,
  addProcesoFolio,
  removeProcesoFolio,
  changeStatus,
  anularProceso,
  ProcesosUSDAError,
};

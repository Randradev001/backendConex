const { getPool, sql } = require("../../conectorMysql/conectorSqlServer");
const { nextCorrelative } = require("../../services/gxCorrelatives.service");
const {
  renderSolicitudPdf,
} = require("./inspecciones.pdf");

const permission = { sistema: 100, modulo: 20, programa: 1 };

class InspeccionesError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const trim = (value) => String(value ?? "").trim();
const isoDate = (value, label) => {
  const raw = trim(value);
  // SQL Server recibe una fecha tipada; se normaliza el formato visible antes de persistir.
  const displayMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const text = displayMatch
    ? `${displayMatch[3]}-${displayMatch[2]}-${displayMatch[1]}`
    : raw.slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    Number.isNaN(Date.parse(`${text}T00:00:00`))
  ) {
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      `${label} debe ser una fecha válida en formato DD/MM/YYYY (también se acepta AAAA-MM-DD).`,
    );
  }
  return text;
};
const integer = (
  value,
  label,
  { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {},
) => {
  if (optional && (value === "" || value === null || value === undefined))
    return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      `${label} debe ser un número entero dentro del rango permitido.`,
    );
  }
  return parsed;
};
const localIsoDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const defaultRange = (now = new Date()) => {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - 60);
  return { from: localIsoDate(from), to: localIsoDate(to) };
};

const listFilters = (query = {}, now = new Date()) => {
  const defaults = defaultRange(now);
  const from = isoDate(query.from || defaults.from, "Fecha desde");
  const to = isoDate(query.to || defaults.to, "Fecha hasta");
  if (from > to)
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      "La fecha desde no puede ser posterior a la fecha hasta.",
    );
  const statusValue = trim(query.status);
  const status =
    !statusValue || statusValue === "9"
      ? null
      : integer(statusValue, "Estado", { min: 0, max: 5 });
  if (status !== null && ![0, 1, 2, 5].includes(status)) {
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      "El estado seleccionado no es válido para una solicitud de inspección.",
    );
  }
  return {
    from,
    to,
    requestNumber: integer(query.requestNumber, "N° de solicitud", {
      optional: true,
      min: 1,
      max: 999999999,
    }),
    species: integer(query.species, "Especie", {
      optional: true,
      min: 1,
      max: 9999,
    }),
    destination: integer(query.destination, "Destino", {
      optional: true,
      min: 1,
      max: 9999,
    }),
    status,
    page: integer(query.page ?? 1, "Página", { min: 1, max: 100000 }),
    pageSize: integer(query.pageSize ?? 25, "Registros por página", {
      min: 1,
      max: 100,
    }),
  };
};

const statusLabel = (status) =>
  ({ 0: "En curso", 1: "Aprobada", 2: "Rechazada", 5: "Anulada" })[
    Number(status)
  ] || "Sin estado";
const normalizeFolio = (value) => {
  const text = trim(value);
  if (!/^\d{1,10}$/.test(text) || Number(text) === 0) {
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      "Cada folio debe contener entre 1 y 10 dígitos y ser distinto de cero.",
    );
  }
  return text.padStart(10, "0");
};
const textValue = (value, label, { required = false, max = 100 } = {}) => {
  const text = trim(value);
  if (required && !text)
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      `${label} es obligatorio.`,
    );
  if (text.length > max)
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      `${label} admite hasta ${max} caracteres.`,
    );
  return text;
};

const folioDetailDuplicateError = (folio, correlation) => {
  const detailReference = correlation
    ? ` el correlativo de detalle ${correlation}`
    : " un correlativo de detalle";
  return new InspeccionesError(
    409,
    "FOLIO_DETAIL_DUPLICATE",
    `No se pudo asociar el folio ${folio || "el seleccionado"}: ya existe${detailReference} repetido en sus datos de inspección. Revise el detalle del folio y corrija la duplicidad antes de volver a intentarlo.`,
  );
};

const translateSolicitudDetailDuplicate = (error) => {
  const rawMessage = String(error?.message || "");
  if (
    !/Violation of (?:PRIMARY KEY|UNIQUE KEY) constraint/i.test(rawMessage) ||
    !/SOLICITUDES3/i.test(rawMessage)
  ) {
    return null;
  }
  const keyValues = rawMessage
    .match(/duplicate key value is \(([^)]+)\)/i)?.[1]
    ?.split(/\s*,\s*/)
    .map((value) => trim(value).replace(/^['"]|['"]$/g, ""));
  const folio = keyValues?.[3] || "el seleccionado";
  const correlation = keyValues?.[4];
  return folioDetailDuplicateError(folio, correlation);
};

// FOLIOSPROC1 puede contener correlativos históricos repetidos. SOLICITUDES3
// exige un correlativo único por folio, por lo que se conservan todas las
// líneas y se enumeran solo cuando el origen viene duplicado.
const withUniqueSolicitudDetailCorrelations = (details) => {
  const correlations = details.map((detail) => Number(detail.FP2Cor));
  const hasDuplicates = correlations.some(
    (correlation, index) => correlations.indexOf(correlation) !== index,
  );
  if (!hasDuplicates) return details;
  return details.map((detail, index) => ({ ...detail, sol3Corr: index + 1 }));
};

const requestPayload = (payload = {}) => {
  const folios = [
    ...new Set(
      (Array.isArray(payload.folios) ? payload.folios : []).map(normalizeFolio),
    ),
  ];
  if (folios.length > 500)
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      "Una solicitud puede contener hasta 500 folios.",
    );
  return {
    requestDate: isoDate(payload.requestDate, "Fecha"),
    species: integer(payload.species, "Especie", { min: 1, max: 9999 }),
    destination: integer(payload.destination, "Destino", { min: 1, max: 9999 }),
    applicant: textValue(payload.applicant, "Solicitante", {
      required: true,
      max: 30,
    }),
    approvedDestinations: textValue(
      payload.approvedDestinations,
      "Destinos aprobados",
      { max: 100 },
    ),
    folios,
  };
};

const getFormData = async (empCod, { poolProvider = getPool } = {}) => {
  const pool = await poolProvider();
  const result = await pool.request().input("EmpCod", sql.SmallInt, empCod)
    .query(`
    SELECT TOP 1 RTRIM(TempCod) tempCod
    FROM TEMP01
    WHERE EmpCod=@EmpCod AND TempActiva=1
    ORDER BY TempFecAbre DESC,TempCod DESC;
    SELECT Especod code,RTRIM(EspeNom) name FROM ESPECIES WHERE EmpCod=@EmpCod ORDER BY EspeNom,Especod;
    SELECT DestCod code,RTRIM(DestNom) name FROM DESTINOS ORDER BY DestNom,DestCod;
    SELECT TOP 1 RTRIM(EmpNom) companyName FROM DEFEMP WHERE EmpCod=@EmpCod;
  `);
  const active = result.recordsets[0]?.[0];
  if (!active)
    throw new InspeccionesError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa. Active una temporada antes de consultar inspecciones.",
    );
  return {
    tempCod: active.tempCod,
    companyName: result.recordsets[3]?.[0]?.companyName || null,
    species: result.recordsets[1] || [],
    destinations: result.recordsets[2] || [],
    defaultRange: defaultRange(),
  };
};

const listInspecciones = async (
  empCod,
  query,
  { poolProvider = getPool } = {},
) => {
  const filters = listFilters(query);
  const pool = await poolProvider();
  const request = pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("From", sql.Date, filters.from)
    .input("To", sql.Date, filters.to)
    .input("RequestNumber", sql.Int, filters.requestNumber)
    .input("Species", sql.SmallInt, filters.species)
    .input("Destination", sql.SmallInt, filters.destination)
    .input("Status", sql.SmallInt, filters.status)
    .input("Offset", sql.Int, (filters.page - 1) * filters.pageSize)
    .input("PageSize", sql.Int, filters.pageSize);
  const result = await request.query(`
    DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
    SELECT s.SolNum id,s.SolnumI requestNumber,CONVERT(char(10),s.Solfecha,23) requestDate,
        s.solespe speciesCode,RTRIM(e.EspeNom) speciesName,
        s.SolDest destinationCode,RTRIM(d.DestNom) destinationName,
        COALESCE(s.soltotcajas,0) totalBoxes,COALESCE(s.soltotpal,0) totalPallets,s.SolEstado status,
        RTRIM(s.SolSolicita) applicant,RTRIM(s.sollogin) createdBy,RTRIM(s.solDestinos) approvedDestinations
      INTO #filtered
    FROM SOLICITUDES1 s
    LEFT JOIN ESPECIES e ON e.EmpCod=s.EmpCod AND e.Especod=s.solespe
    LEFT JOIN DESTINOS d ON d.DestCod=s.SolDest
    WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND s.SolTipo='INS'
      AND s.Solfecha>=@From AND s.Solfecha<DATEADD(day,1,@To)
      AND (@RequestNumber IS NULL OR s.SolnumI=@RequestNumber)
      AND (@Species IS NULL OR s.solespe=@Species)
      AND (@Destination IS NULL OR s.SolDest=@Destination)
      AND (@Status IS NULL OR s.SolEstado=@Status);
    SELECT id,requestNumber,requestDate,speciesCode,speciesName,destinationCode,destinationName,totalBoxes,totalPallets,status,applicant,createdBy,approvedDestinations
    FROM #filtered ORDER BY requestDate DESC,requestNumber DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(*) total,COALESCE(SUM(CONVERT(bigint,totalBoxes)),0) totalBoxes,COALESCE(SUM(CONVERT(bigint,totalPallets)),0) totalPallets,
      COALESCE(SUM(CASE WHEN status=0 THEN 1 ELSE 0 END),0) inProgress,
      COALESCE(SUM(CASE WHEN status=1 THEN 1 ELSE 0 END),0) approved,
      COALESCE(SUM(CASE WHEN status=2 THEN 1 ELSE 0 END),0) rejected,
      COALESCE(SUM(CASE WHEN status=5 THEN 1 ELSE 0 END),0) annulled
    FROM #filtered;
    SELECT RTRIM(@TempCod) tempCod;
  `);
  const summary = result.recordsets[1]?.[0] || {};
  return {
    rows: (result.recordsets[0] || []).map((row) => ({
      ...row,
      statusLabel: statusLabel(row.status),
    })),
    total: Number(summary.total || 0),
    totals: {
      boxes: Number(summary.totalBoxes || 0),
      pallets: Number(summary.totalPallets || 0),
    },
    statusCounts: {
      inProgress: Number(summary.inProgress || 0),
      approved: Number(summary.approved || 0),
      rejected: Number(summary.rejected || 0),
      annulled: Number(summary.annulled || 0),
    },
    tempCod: result.recordsets[2]?.[0]?.tempCod || null,
    filters,
  };
};

const listAvailableFolios = async (
  empCod,
  query = {},
  { poolProvider = getPool } = {},
) => {
  const species = integer(query.species, "Especie", { min: 1, max: 9999 });
  const folio = trim(query.folio);
  if (folio && !/^\d{1,10}$/.test(folio))
    throw new InspeccionesError(
      400,
      "VALIDATION_ERROR",
      "El filtro Folio debe contener solo dígitos, hasta 10 posiciones.",
    );
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("Species", sql.SmallInt, species)
    .input("Folio", sql.VarChar(10), folio).query(`
    DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
    SELECT TOP 500 RTRIM(h.FPFolio) folio,COALESCE(tot.totalBoxes,0) totalBoxes,COALESCE(tot.totalKilos,0) totalKilos,
      COALESCE(prod.producerName,'') producerName,COALESCE(det.details,0) details
    FROM FOLIOSPROC h
    OUTER APPLY (
      SELECT SUM(CONVERT(bigint,d.FP2Cajas)) totalBoxes,SUM(CONVERT(decimal(19,4),d.FP2Kilos)) totalKilos
      FROM FOLIOSPROC1 d WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio
    ) tot
    OUTER APPLY (
      SELECT MIN(RTRIM(p.ProdNom)) producerName
      FROM FOLIOSPROC1 d LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=d.ProdCod
      WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio
    ) prod
    OUTER APPLY (SELECT COUNT(*) details FROM FOLIOSPROC1 d WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio) det
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPEspe=@Species AND h.FPEstado=10 AND h.FPDisponible=1
      AND NOT EXISTS (
        SELECT 1
        FROM SOLICITUDES2 associated
        WHERE associated.EmpCod=h.EmpCod
          AND associated.TempCod=h.TempCod
          AND associated.Sol2Folio=h.FPFolio
      )
      AND (@Folio='' OR RTRIM(h.FPFolio) LIKE '%' + @Folio + '%')
    ORDER BY h.FPFolio;
  `);
  return { rows: result.recordset || [] };
};

const getAvailableFolioDetails = async (
  empCod,
  query = {},
  { poolProvider = getPool } = {},
) => {
  const species = integer(query.species, "Especie", { min: 1, max: 9999 });
  const folio = normalizeFolio(query.folio);
  const availabilityFilter = `
      AND h.FPDisponible=1
      AND NOT EXISTS (
        SELECT 1
        FROM SOLICITUDES2 associated
        WHERE associated.EmpCod=h.EmpCod
          AND associated.TempCod=h.TempCod
          AND associated.Sol2Folio=h.FPFolio
      )`;
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("Species", sql.SmallInt, species)
    .input("Folio", sql.Char(10), folio).query(`
    DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
    SELECT RTRIM(d.FPFolio) folio,d.FP2Cor,CONVERT(char(10),d.FP2Fecha,23) movementDate,RTRIM(p.ProdNom) producerName,RTRIM(v.VarNom) varietyName,
      RTRIM(n.EnvNom) containerName,RTRIM(c.CatNom) categoryName,RTRIM(d.Calibre) caliber,d.Fp2Tipo type,d.FP2Cajas boxes,d.FP2Kilos kilos,d.CuarCod orchard
    FROM FOLIOSPROC h
    JOIN FOLIOSPROC1 d ON d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio
    LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=d.ProdCod
    LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.fp2especod AND v.VarCod=d.fp2varcod
    LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.EnvCod
    LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.EnvCod AND c.Catcod=d.Catcod
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPFolio=@Folio AND h.FPEspe=@Species AND h.FPEstado=10${availabilityFilter}
    ORDER BY d.FP2Cor;
  `);
  if (!result.recordset?.length)
    throw new InspeccionesError(
      409,
      "FOLIO_NOT_AVAILABLE",
      `El folio ${folio} no cumple las condiciones originales para la solicitud: especie, estado completo y disponibilidad.`,
    );
  return { folio, rows: result.recordset };
};

const getSolicitudDetalle = async (
  empCod,
  solNumValue,
  { poolProvider = getPool } = {},
) => {
  const solNum = integer(solNumValue, "N° de solicitud", {
    min: 1,
    max: 999999999,
  });
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("SolNum", sql.Decimal(10, 0), solNum).query(`
    DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
    SELECT h.SolNum,h.SolnumI,CONVERT(char(10),h.Solfecha,23) requestDate,h.solespe speciesCode,RTRIM(e.EspeNom) speciesName,
      h.SolDest destinationCode,RTRIM(d.DestNom) destinationName,RTRIM(h.SolSolicita) applicant,RTRIM(h.solDestinos) approvedDestinations,
      RTRIM(h.SollogAP) approvalLogin,CONVERT(char(10),h.SolFecAP,23) approvalDate,
      RTRIM(h.SollogRE) rejectionLogin,CONVERT(char(10),h.SolFecRE,23) rejectionDate,
      h.SolEstado status,h.soltotcajas totalBoxes,h.soltotkilos totalKilos,h.soltotpal totalPallets,h.solcajasRA boxesA,h.SolcajasRB boxesB,h.SolcajasRC boxesC
    FROM SOLICITUDES1 h LEFT JOIN ESPECIES e ON e.EmpCod=h.EmpCod AND e.Especod=h.solespe LEFT JOIN DESTINOS d ON d.DestCod=h.SolDest
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.SolNum=@SolNum AND h.SolTipo='INS';
    SELECT RTRIM(s.Sol2Folio) folio,RTRIM(e.EspeNom) speciesName,s.Sol2Cajas totalBoxes,s.Sol2Kilos totalKilos,s.Sol2Dispo dispatched,s.Sol2CajasREP repackedBoxes
    FROM SOLICITUDES2 s LEFT JOIN ESPECIES e ON e.EmpCod=s.EmpCod AND e.Especod=s.Sol2Espe
    WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND s.SolNum=@SolNum ORDER BY s.Sol2Folio;
    SELECT RTRIM(d.Sol2Folio) folio,d.Sol3Corr,CONVERT(char(10),d.sol3fecha,23) movementDate,
      RTRIM(p.ProdCodSAG) producerSagCode,RTRIM(p.ProdCod) producerCode,RTRIM(p.ProdNom) producerName,
      CONVERT(varchar(30),p.ProdProvincia) producerProvince,CONVERT(varchar(20),p.ProdComuna) producerCommune,
      RTRIM(v.VarNom) varietyName,RTRIM(e2.EspeNom) speciesName,
      RTRIM(n.EnvNom) containerName,RTRIM(c.CatNom) categoryName,RTRIM(d.Sol3Cal) caliber,d.sol3Tipo type,
      d.Sol3Cajas boxes,d.Sol3Kilos kilos,d.Sol3Cuar orchard,RTRIM(cu.CuarNom) orchardName
    FROM SOLICITUDES3 d
    LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=d.Sol3prod
    LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Sol3espe AND v.VarCod=d.Sol3Var
    LEFT JOIN ESPECIES e2 ON e2.EmpCod=d.EmpCod AND e2.Especod=d.Sol3espe
    LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Sol3Env
    LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.Sol3Env AND c.Catcod=d.Sol3CaT
    LEFT JOIN PRODUCTORES1 cu ON cu.EmpCod=d.EmpCod AND cu.ProdCod=d.Sol3prod AND cu.CuarCod=d.Sol3Cuar
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.SolNum=@SolNum ORDER BY d.Sol2Folio,d.Sol3Corr;
  `);
  const header = result.recordsets[0]?.[0];
  if (!header)
    throw new InspeccionesError(
      404,
      "SOLICITUD_NOT_FOUND",
      "La solicitud no existe en la temporada activa.",
    );
  return {
    header: { ...header, statusLabel: statusLabel(header.status) },
    folios: result.recordsets[1] || [],
    details: result.recordsets[2] || [],
  };
};

const getSolicitudPdfData = async (
  empCod,
  solNumValue,
  { poolProvider = getPool } = {},
) => {
  const detail = await getSolicitudDetalle(empCod, solNumValue, { poolProvider });
  const pool = await poolProvider();
  const config = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .query(`
    SELECT TOP 1 RTRIM(EmpNom) companyName,RTRIM(Empreg) companyRegion,RTRIM(EmpGiro) companyBusiness,
      RTRIM(Empdir) companyAddress,EmpRut companyRut,RTRIM(EmpDV) companyDv
    FROM DEFEMP WHERE EmpCod=@EmpCod;
    SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01
    WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC;
  `);
  const header = {
    ...detail.header,
    ...(config.recordsets?.[0]?.[0] || {}),
    tempCod: config.recordsets?.[1]?.[0]?.tempCod || null,
  };
  return {
    ...detail,
    header,
  };
};

const generateSolicitudPdf = async (
  empCod,
  solNumValue,
  { poolProvider = getPool, pdfRenderer = renderSolicitudPdf } = {},
) => {
  const data = await getSolicitudPdfData(empCod, solNumValue, { poolProvider });
  const requestNumber = trim(data.header?.SolnumI || data.header?.requestNumber || data.header?.SolNum);
  const printableNumber = /^\d+$/.test(requestNumber) ? requestNumber.padStart(10, "0") : requestNumber || "solicitud";
  return {
    filename: `Solicitud_${printableNumber}.pdf`,
    content: await pdfRenderer(data),
  };
};

const padded = (value, digits, label) => {
  if (value === null || value === undefined || trim(value) === "") {
    throw new InspeccionesError(
      409,
      "INS_FILE_VALUE_INVALID",
      `${label} no está configurado para generar el archivo INS.`,
    );
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number >= 10 ** digits) {
    throw new InspeccionesError(
      409,
      "INS_FILE_VALUE_INVALID",
      `${label} no es compatible con el formato de archivo INS.`,
    );
  }
  return String(number).padStart(digits, "0");
};

const generateArchivoIns = async (
  empCod,
  solNumValue,
  { poolProvider = getPool } = {},
) => {
  const solNum = integer(solNumValue, "N° de solicitud", {
    min: 1,
    max: 999999999,
  });
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("SolNum", sql.Decimal(10, 0), solNum).query(`
    DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
    SELECT h.SolnumI requestNumber,h.SolEstado status,h.SolDest destination,CONVERT(char(8),h.Solfecha,112) requestDate,
      h.soltotpal totalPallets,e.EspeSag speciesSag,
      (SELECT TOP 1 PAR1Valor1 FROM PARAMGE1 WHERE EmpCod=@EmpCod AND PARCod=20 AND PAR1Cod=30) codePl
    FROM SOLICITUDES1 h
    LEFT JOIN ESPECIES e ON e.EmpCod=h.EmpCod AND e.Especod=h.solespe
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.SolNum=@SolNum AND h.SolTipo='INS';
    SELECT RTRIM(Sol2Folio) folio,Sol2Cajas boxes
    FROM SOLICITUDES2
    WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND Sol2Cajas>0
    ORDER BY Sol2Folio;
  `);
  const header = result.recordsets?.[0]?.[0];
  if (!header)
    throw new InspeccionesError(
      404,
      "SOLICITUD_NOT_FOUND",
      "La solicitud no existe en la temporada activa.",
    );
  if (Number(header.status) !== 1) {
    throw new InspeccionesError(
      409,
      "SOLICITUD_NOT_APPROVED",
      "El archivo INS solo puede generarse para solicitudes aprobadas.",
    );
  }
  const folios = result.recordsets?.[1] || [];
  if (!folios.length)
    throw new InspeccionesError(
      409,
      "INS_FILE_WITHOUT_FOLIOS",
      "La solicitud aprobada no tiene folios con cajas para generar el archivo INS.",
    );
  const codePl = padded(
    header.codePl,
    4,
    "La configuración PL (parámetro 20/30)",
  );
  const requestNumber = padded(
    header.requestNumber,
    5,
    "El número impreso de la solicitud",
  );
  const speciesSag = padded(
    header.speciesSag,
    8,
    "El código SAG de la especie",
  );
  const destination = padded(
    Number(header.destination) >= 700 ? 700 : header.destination,
    3,
    "El destino",
  );
  const totalPallets = padded(header.totalPallets, 4, "El total de pallets");
  if (!/^\d{8}$/.test(trim(header.requestDate))) {
    throw new InspeccionesError(
      409,
      "INS_FILE_VALUE_INVALID",
      "La fecha de la solicitud no es válida para el archivo INS.",
    );
  }
  const lines = [
    `${requestNumber}${codePl}${speciesSag}${destination}000${trim(header.requestDate)}${totalPallets}`,
  ];
  folios.forEach((row) => {
    const folio = trim(row.folio);
    if (!/^\d{1,10}$/.test(folio))
      throw new InspeccionesError(
        409,
        "INS_FILE_VALUE_INVALID",
        `El folio ${folio || "(vacío)"} no es válido para el archivo INS.`,
      );
    lines.push(
      `${folio.padStart(10, "0")}${padded(row.boxes, 4, `Las cajas del folio ${folio}`)}`,
    );
  });
  lines.push("&&");
  return {
    filename: `${codePl}${requestNumber}.INS`,
    content: Buffer.from(lines.join("\r\n"), "ascii"),
  };
};

const createSolicitud = async (
  empCod,
  login,
  payload,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
    nextNumber = nextCorrelative,
  } = {},
) => {
  const input = requestPayload(payload);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const active = await requestFactory(transaction).input(
      "EmpCod",
      sql.SmallInt,
      empCod,
    ).query(`
      SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01 WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC;
    `);
    const tempCod = active.recordset?.[0]?.tempCod;
    if (!tempCod)
      throw new InspeccionesError(
        409,
        "ACTIVE_SEASON_NOT_FOUND",
        "No existe una temporada activa para crear la solicitud.",
      );

    const catalog = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("Species", sql.SmallInt, input.species)
      .input("Destination", sql.SmallInt, input.destination).query(`
        SELECT Especod FROM ESPECIES WHERE EmpCod=@EmpCod AND Especod=@Species;
        SELECT DestCod FROM DESTINOS WHERE DestCod=@Destination;
      `);
    if (!catalog.recordsets?.[0]?.length)
      throw new InspeccionesError(
        409,
        "SPECIES_NOT_FOUND",
        "La especie seleccionada no existe para la empresa.",
      );
    if (!catalog.recordsets?.[1]?.length)
      throw new InspeccionesError(
        409,
        "DESTINATION_NOT_FOUND",
        "El destino seleccionado no existe.",
      );

    const sources = [];
    for (const folio of input.folios) {
      const source = await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("Folio", sql.Char(10), folio)
        .input("Species", sql.SmallInt, input.species).query(`
          SELECT h.FPFolio,h.FPEspe,h.TAlCod,h.TBPCod,h.TEtCod,
            COALESCE(tot.totalBoxes,0) totalBoxes,COALESCE(tot.totalKilos,0) totalKilos,
            COALESCE(ranges.boxesA,0) boxesA,COALESCE(ranges.boxesB,0) boxesB,COALESCE(ranges.boxesC,0) boxesC
          FROM FOLIOSPROC h WITH (UPDLOCK,HOLDLOCK)
          OUTER APPLY (
            SELECT SUM(CONVERT(bigint,d.FP2Cajas)) totalBoxes,SUM(CONVERT(decimal(19,4),d.FP2Kilos)) totalKilos
            FROM FOLIOSPROC1 d WITH (UPDLOCK,HOLDLOCK) WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio
          ) tot
          OUTER APPLY (
            SELECT SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0) BETWEEN 0.1 AND 5 THEN d.FP2Cajas ELSE 0 END) boxesA,
              SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0) BETWEEN 5.1 AND 10 THEN d.FP2Cajas ELSE 0 END) boxesB,
              SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0)>=10.1 THEN d.FP2Cajas ELSE 0 END) boxesC
            FROM FOLIOSPROC1 d WITH (UPDLOCK,HOLDLOCK) JOIN ENVCAT e ON e.EmpCod=d.EmpCod AND e.EnvCod=d.EnvCod
            WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio
          ) ranges
          WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPFolio=@Folio AND h.FPEspe=@Species
            AND h.FPEstado=10 AND h.FPDisponible=1;

          SELECT FP2Cor,FP2Fecha,ProdCod,fp2especod,fp2varcod,EnvCod,Catcod,Calibre,Fp2Tipo,FP2Cajas,FP2Kilos,CuarCod
          FROM FOLIOSPROC1 WITH (UPDLOCK,HOLDLOCK)
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio ORDER BY FP2Cor;
        `);
      if (!source.recordsets?.[0]?.length || !source.recordsets?.[1]?.length) {
        throw new InspeccionesError(
          409,
          "FOLIO_NOT_AVAILABLE",
          `El folio ${folio} no cumple las condiciones originales para inspección o no tiene detalle.`,
        );
      }
      sources.push({
        header: source.recordsets[0][0],
        details: withUniqueSolicitudDetailCorrelations(source.recordsets[1]),
      });
    }

    const solNum = await nextNumber({
      transaction,
      empCod,
      code: "SOLINTER",
      digits: 10,
    });
    const solNumI = await nextNumber({
      transaction,
      empCod,
      code: "SOLINS",
      digits: 10,
    });
    const totals = sources.reduce(
      (acc, source) => ({
        boxes: acc.boxes + Number(source.header.totalBoxes || 0),
        kilos: acc.kilos + Number(source.header.totalKilos || 0),
        boxesA: acc.boxesA + Number(source.header.boxesA || 0),
        boxesB: acc.boxesB + Number(source.header.boxesB || 0),
        boxesC: acc.boxesC + Number(source.header.boxesC || 0),
      }),
      { boxes: 0, kilos: 0, boxesA: 0, boxesB: 0, boxesC: 0 },
    );
    const write = requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum)
      .input("SolNumI", sql.Decimal(10, 0), solNumI)
      .input("RequestDate", sql.Date, input.requestDate)
      .input("Applicant", sql.Char(30), input.applicant)
      .input("Destination", sql.SmallInt, input.destination)
      .input("Species", sql.SmallInt, input.species)
      .input("ApprovedDestinations", sql.Char(100), input.approvedDestinations)
      .input(
        "Login",
        sql.Char(10),
        textValue(login, "Usuario", { required: true, max: 10 }),
      )
      .input("Boxes", sql.Int, totals.boxes)
      .input("Kilos", sql.Money, totals.kilos)
      .input("Pallets", sql.Int, sources.length)
      .input("BoxesA", sql.Int, totals.boxesA)
      .input("BoxesB", sql.Int, totals.boxesB)
      .input("BoxesC", sql.Int, totals.boxesC);
    await write.query(`INSERT INTO SOLICITUDES1 (EmpCod,TempCod,SolNum,SollogAP,SolFecAP,SollogRE,SolFecRE,Solfecha,SolSolicita,SolDest,solespe,solDestinos,SolEstado,sollogin,soltotcajas,soltotkilos,soltotpal,solcajasRA,SolcajasRB,SolcajasRC,SolTipo,SolnumI)
      VALUES (@EmpCod,@TempCod,@SolNum,'',NULL,'',NULL,@RequestDate,@Applicant,@Destination,@Species,@ApprovedDestinations,0,@Login,@Boxes,@Kilos,@Pallets,@BoxesA,@BoxesB,@BoxesC,'INS',@SolNumI);`);
    for (const source of sources) {
      const h = source.header;
      await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("SolNum", sql.Decimal(10, 0), solNum)
        .input("Folio", sql.Char(10), h.FPFolio)
        .input("Species", sql.SmallInt, h.FPEspe)
        .input("Boxes", sql.SmallInt, h.totalBoxes)
        .input("Kilos", sql.Money, h.totalKilos)
        .input("Height", sql.SmallInt, h.TAlCod || 0)
        .input("PalletBase", sql.SmallInt, h.TBPCod || 0)
        .input("Label", sql.SmallInt, h.TEtCod || 0).query(`
          INSERT INTO SOLICITUDES2 (EmpCod,TempCod,SolNum,Sol2Folio,Sol2Espe,Sol2Dispo,Sol2Cajas,Sol2Kilos,Sol2CajasREP,Sol2KilosRep,Sol2CajasDes,Sol2KilosDes,Sol2NumAnu,Sol2CAlt,Sol2CBase,Sol2Ceti)
          VALUES (@EmpCod,@TempCod,@SolNum,@Folio,@Species,0,@Boxes,@Kilos,0,0,@Boxes,@Kilos,0,@Height,@PalletBase,@Label);
        `);
      for (const d of source.details) {
        await requestFactory(transaction)
          .input("EmpCod", sql.SmallInt, empCod)
          .input("TempCod", sql.Char(9), tempCod)
          .input("SolNum", sql.Decimal(10, 0), solNum)
          .input("Folio", sql.Char(10), h.FPFolio)
          .input("Corr", sql.SmallInt, d.sol3Corr ?? d.FP2Cor)
          .input("MovementDate", sql.DateTime, d.FP2Fecha)
          .input("Species", sql.SmallInt, d.fp2especod)
          .input("Variety", sql.Int, d.fp2varcod)
          .input("Producer", sql.Char(6), d.ProdCod)
          .input("Container", sql.SmallInt, d.EnvCod)
          .input("Category", sql.SmallInt, d.Catcod)
          .input("Caliber", sql.Char(10), d.Calibre)
          .input("Type", sql.SmallInt, d.Fp2Tipo || 0)
          .input("Boxes", sql.SmallInt, d.FP2Cajas)
          .input("Kilos", sql.Money, d.FP2Kilos)
          .input("Orchard", sql.Int, d.CuarCod || 0).query(`
            INSERT INTO SOLICITUDES3 (EmpCod,TempCod,SolNum,Sol2Folio,Sol3Corr,sol3fecha,Sol3espe,Sol3Var,Sol3prod,Sol3Env,Sol3CaT,Sol3Cal,sol3Tipo,Sol3Cajas,Sol3Kilos,Sol3CajasRep,Sol3KilosRep,Sol3CajasDes,Sol3KilosDes,Sol3Cuar)
            VALUES (@EmpCod,@TempCod,@SolNum,@Folio,@Corr,@MovementDate,@Species,@Variety,@Producer,@Container,@Category,@Caliber,@Type,@Boxes,@Kilos,0,0,@Boxes,@Kilos,@Orchard);
          `);
      }
      await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("Folio", sql.Char(10), h.FPFolio).query(`
        UPDATE FOLIOSPROC SET FPDisponible=0,FPIns=1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
        UPDATE FOLIOSPROC1 SET Fp2Ins=1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
      `);
    }
    await transaction.commit();
    return {
      solNum,
      solNumI,
      tempCod,
      folios: sources.length,
      totals: {
        boxes: totals.boxes,
        kilos: totals.kilos,
        pallets: sources.length,
      },
    };
  } catch (error) {
    const translatedError = translateSolicitudDetailDuplicate(error) || error;
    if (!transaction._aborted)
      await transaction.rollback().catch(() => undefined);
    throw translatedError;
  }
};

const updateSolicitud = async (
  empCod,
  solNumValue,
  payload,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const solNum = integer(solNumValue, "N° de solicitud", {
    min: 1,
    max: 999999999,
  });
  const input = requestPayload(payload);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const active = await requestFactory(transaction).input(
      "EmpCod",
      sql.SmallInt,
      empCod,
    ).query(`
      SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01 WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC;
    `);
    const tempCod = active.recordset?.[0]?.tempCod;
    if (!tempCod)
      throw new InspeccionesError(
        409,
        "ACTIVE_SEASON_NOT_FOUND",
        "No existe una temporada activa para modificar la solicitud.",
      );

    const catalog = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("Species", sql.SmallInt, input.species)
      .input("Destination", sql.SmallInt, input.destination).query(`
        SELECT Especod FROM ESPECIES WHERE EmpCod=@EmpCod AND Especod=@Species;
        SELECT DestCod FROM DESTINOS WHERE DestCod=@Destination;
      `);
    if (!catalog.recordsets?.[0]?.length)
      throw new InspeccionesError(
        409,
        "SPECIES_NOT_FOUND",
        "La especie seleccionada no existe para la empresa.",
      );
    if (!catalog.recordsets?.[1]?.length)
      throw new InspeccionesError(
        409,
        "DESTINATION_NOT_FOUND",
        "El mercado seleccionado no existe.",
      );

    const headerResult = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum).query(`
        SELECT TOP 1 SolNum,SolEstado,solespe
        FROM SOLICITUDES1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
        SELECT COUNT(*) folioCount
        FROM SOLICITUDES2 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum;
      `);
    const header = headerResult.recordsets?.[0]?.[0];
    const folioCount = Number(headerResult.recordsets?.[1]?.[0]?.folioCount || 0);
    if (!header)
      throw new InspeccionesError(
        404,
        "SOLICITUD_NOT_FOUND",
        "La solicitud no existe en la temporada activa.",
      );
    if (Number(header.SolEstado) !== 0)
      throw new InspeccionesError(
        409,
        "SOLICITUD_LOCKED",
        "Solo se pueden modificar solicitudes en curso.",
      );
    if (folioCount > 0 && Number(header.solespe) !== input.species)
      throw new InspeccionesError(
        409,
        "SPECIES_LOCKED",
        "No se puede cambiar la especie porque la solicitud ya tiene folios asociados.",
      );

    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum)
      .input("RequestDate", sql.Date, input.requestDate)
      .input("Applicant", sql.Char(30), input.applicant)
      .input("Destination", sql.SmallInt, input.destination)
      .input("Species", sql.SmallInt, input.species)
      .input("ApprovedDestinations", sql.Char(100), input.approvedDestinations)
      .query(`
        UPDATE SOLICITUDES1
        SET Solfecha=@RequestDate,
            SolSolicita=@Applicant,
            SolDest=@Destination,
            solespe=@Species,
            solDestinos=@ApprovedDestinations
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
      `);
    await transaction.commit();
    return {
      solNum,
      tempCod,
      requestDate: input.requestDate,
      species: input.species,
      destination: input.destination,
      applicant: input.applicant,
      approvedDestinations: input.approvedDestinations,
    };
  } catch (error) {
    if (!transaction._aborted)
      await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const addFolioToSolicitud = async (
  empCod,
  solNumValue,
  folioValue,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const solNum = integer(solNumValue, "N° de solicitud", {
    min: 1,
    max: 999999999,
  });
  const folio = normalizeFolio(folioValue);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const active = await requestFactory(transaction).input(
      "EmpCod",
      sql.SmallInt,
      empCod,
    ).query(`
      SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01 WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC;
    `);
    const tempCod = active.recordset?.[0]?.tempCod;
    if (!tempCod)
      throw new InspeccionesError(
        409,
        "ACTIVE_SEASON_NOT_FOUND",
        "No existe una temporada activa para agregar el folio.",
      );

    const headerResult = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum)
      .input("Folio", sql.Char(10), folio).query(`
        SELECT TOP 1 SolNum,solespe,SolEstado FROM SOLICITUDES1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
        SELECT COUNT(*) existingCount FROM SOLICITUDES2 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND Sol2Folio=@Folio;
      `);
    const header = headerResult.recordsets?.[0]?.[0];
    if (!header)
      throw new InspeccionesError(
        404,
        "SOLICITUD_NOT_FOUND",
        "La solicitud no existe en la temporada activa.",
      );
    if (Number(header.SolEstado) !== 0)
      throw new InspeccionesError(
        409,
        "SOLICITUD_LOCKED",
        "Solo se pueden agregar folios a solicitudes en curso.",
      );
    if (Number(headerResult.recordsets?.[1]?.[0]?.existingCount || 0) > 0) {
      throw new InspeccionesError(
        409,
        "FOLIO_ALREADY_ADDED",
        `El folio ${folio} ya pertenece a esta solicitud.`,
      );
    }

    const source = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Folio", sql.Char(10), folio)
      .input("Species", sql.SmallInt, header.solespe).query(`
        SELECT h.FPFolio,h.FPEspe,h.TAlCod,h.TBPCod,h.TEtCod,
          COALESCE(tot.totalBoxes,0) totalBoxes,COALESCE(tot.totalKilos,0) totalKilos
        FROM FOLIOSPROC h WITH (UPDLOCK,HOLDLOCK)
        OUTER APPLY (
          SELECT SUM(CONVERT(bigint,d.FP2Cajas)) totalBoxes,SUM(CONVERT(decimal(19,4),d.FP2Kilos)) totalKilos
          FROM FOLIOSPROC1 d WITH (UPDLOCK,HOLDLOCK)
          WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio
        ) tot
        WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPFolio=@Folio AND h.FPEspe=@Species
          AND h.FPEstado=10 AND h.FPDisponible=1;
        SELECT FP2Cor,FP2Fecha,ProdCod,fp2especod,fp2varcod,EnvCod,Catcod,Calibre,Fp2Tipo,FP2Cajas,FP2Kilos,CuarCod
        FROM FOLIOSPROC1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio ORDER BY FP2Cor;
      `);
    const sourceHeader = source.recordsets?.[0]?.[0];
    const sourceDetails = withUniqueSolicitudDetailCorrelations(
      source.recordsets?.[1] || [],
    );
    if (!sourceHeader || !sourceDetails.length) {
      throw new InspeccionesError(
        409,
        "FOLIO_NOT_AVAILABLE",
        `El folio ${folio} no está completo, disponible, no corresponde a la especie de la solicitud o ya está asociado a otra inspección.`,
      );
    }

    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum)
      .input("Folio", sql.Char(10), sourceHeader.FPFolio)
      .input("Species", sql.SmallInt, sourceHeader.FPEspe)
      .input("Boxes", sql.BigInt, sourceHeader.totalBoxes)
      .input("Kilos", sql.Money, sourceHeader.totalKilos)
      .input("Height", sql.SmallInt, sourceHeader.TAlCod || 0)
      .input("PalletBase", sql.SmallInt, sourceHeader.TBPCod || 0)
      .input("Label", sql.SmallInt, sourceHeader.TEtCod || 0).query(`
        INSERT INTO SOLICITUDES2 (EmpCod,TempCod,SolNum,Sol2Folio,Sol2Espe,Sol2Dispo,Sol2Cajas,Sol2Kilos,Sol2CajasREP,Sol2KilosRep,Sol2CajasDes,Sol2KilosDes,Sol2NumAnu,Sol2CAlt,Sol2CBase,Sol2Ceti)
        VALUES (@EmpCod,@TempCod,@SolNum,@Folio,@Species,0,@Boxes,@Kilos,0,0,@Boxes,@Kilos,0,@Height,@PalletBase,@Label);
      `);
    for (const detail of sourceDetails) {
      await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("SolNum", sql.Decimal(10, 0), solNum)
        .input("Folio", sql.Char(10), sourceHeader.FPFolio)
        .input("Corr", sql.SmallInt, detail.sol3Corr ?? detail.FP2Cor)
        .input("MovementDate", sql.DateTime, detail.FP2Fecha)
        .input("Species", sql.SmallInt, detail.fp2especod)
        .input("Variety", sql.Int, detail.fp2varcod)
        .input("Producer", sql.Char(6), detail.ProdCod)
        .input("Container", sql.SmallInt, detail.EnvCod)
        .input("Category", sql.SmallInt, detail.Catcod)
        .input("Caliber", sql.Char(10), detail.Calibre)
        .input("Type", sql.SmallInt, detail.Fp2Tipo || 0)
        .input("Boxes", sql.SmallInt, detail.FP2Cajas)
        .input("Kilos", sql.Money, detail.FP2Kilos)
        .input("Orchard", sql.Int, detail.CuarCod || 0).query(`
          INSERT INTO SOLICITUDES3 (EmpCod,TempCod,SolNum,Sol2Folio,Sol3Corr,sol3fecha,Sol3espe,Sol3Var,Sol3prod,Sol3Env,Sol3CaT,Sol3Cal,sol3Tipo,Sol3Cajas,Sol3Kilos,Sol3CajasRep,Sol3KilosRep,Sol3CajasDes,Sol3KilosDes,Sol3Cuar)
          VALUES (@EmpCod,@TempCod,@SolNum,@Folio,@Corr,@MovementDate,@Species,@Variety,@Producer,@Container,@Category,@Caliber,@Type,@Boxes,@Kilos,0,0,@Boxes,@Kilos,@Orchard);
        `);
    }
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Folio", sql.Char(10), sourceHeader.FPFolio).query(`
      UPDATE FOLIOSPROC SET FPDisponible=0,FPIns=1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
      UPDATE FOLIOSPROC1 SET Fp2Ins=1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
    `);
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum).query(`
      UPDATE h SET
        soltotcajas=COALESCE((SELECT SUM(CONVERT(bigint,s.Sol2Cajas)) FROM SOLICITUDES2 s WHERE s.EmpCod=h.EmpCod AND s.TempCod=h.TempCod AND s.SolNum=h.SolNum),0),
        soltotkilos=COALESCE((SELECT SUM(CONVERT(money,s.Sol2Kilos)) FROM SOLICITUDES2 s WHERE s.EmpCod=h.EmpCod AND s.TempCod=h.TempCod AND s.SolNum=h.SolNum),0),
        soltotpal=COALESCE((SELECT COUNT(*) FROM SOLICITUDES2 s WHERE s.EmpCod=h.EmpCod AND s.TempCod=h.TempCod AND s.SolNum=h.SolNum),0),
        solcajasRA=COALESCE((SELECT SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0) BETWEEN 0.1 AND 5 THEN d.Sol3Cajas ELSE 0 END) FROM SOLICITUDES3 d JOIN ENVCAT e ON e.EmpCod=d.EmpCod AND e.EnvCod=d.Sol3Env WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.SolNum=h.SolNum),0),
        SolcajasRB=COALESCE((SELECT SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0) BETWEEN 5.1 AND 10 THEN d.Sol3Cajas ELSE 0 END) FROM SOLICITUDES3 d JOIN ENVCAT e ON e.EmpCod=d.EmpCod AND e.EnvCod=d.Sol3Env WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.SolNum=h.SolNum),0),
        SolcajasRC=COALESCE((SELECT SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0)>=10.1 THEN d.Sol3Cajas ELSE 0 END) FROM SOLICITUDES3 d JOIN ENVCAT e ON e.EmpCod=d.EmpCod AND e.EnvCod=d.Sol3Env WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.SolNum=h.SolNum),0)
      FROM SOLICITUDES1 h WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.SolNum=@SolNum;
    `);
    await transaction.commit();
    return { solNum, folio };
  } catch (error) {
    const translatedError = translateSolicitudDetailDuplicate(error) || error;
    if (!transaction._aborted)
      await transaction.rollback().catch(() => undefined);
    throw translatedError;
  }
};

const removeFolioFromSolicitud = async (
  empCod,
  solNumValue,
  folioValue,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const solNum = integer(solNumValue, "N° de solicitud", {
    min: 1,
    max: 999999999,
  });
  const folio = normalizeFolio(folioValue);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const active = await requestFactory(transaction).input(
      "EmpCod",
      sql.SmallInt,
      empCod,
    ).query(`
      SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01 WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC;
    `);
    const tempCod = active.recordset?.[0]?.tempCod;
    if (!tempCod)
      throw new InspeccionesError(
        409,
        "ACTIVE_SEASON_NOT_FOUND",
        "No existe una temporada activa para quitar el folio.",
      );

    const headerResult = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum)
      .input("Folio", sql.Char(10), folio).query(`
        SELECT TOP 1 SolNum,SolEstado FROM SOLICITUDES1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
        SELECT TOP 1 Sol2Folio,Sol2Dispo,Sol2CajasREP,Sol2KilosREP,Sol2CajasDes,Sol2KilosDes,Sol2NumAnu
        FROM SOLICITUDES2 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND Sol2Folio=@Folio;
      `);
    const header = headerResult.recordsets?.[0]?.[0];
    const association = headerResult.recordsets?.[1]?.[0];
    if (!header)
      throw new InspeccionesError(
        404,
        "SOLICITUD_NOT_FOUND",
        "La solicitud no existe en la temporada activa.",
      );
    if (Number(header.SolEstado) !== 0)
      throw new InspeccionesError(
        409,
        "SOLICITUD_LOCKED",
        "Solo se pueden quitar folios de solicitudes en curso.",
      );
    if (!association)
      throw new InspeccionesError(
        404,
        "FOLIO_NOT_ASSOCIATED",
        `El folio ${folio} no pertenece a esta solicitud.`,
      );
    // Las cantidades a despacho se copian al asociar el folio; no prueban un
    // despacho realizado y, por tanto, no impiden liberar la inspección.
    if (
      Number(association.Sol2Dispo || 0) !== 0 ||
      Number(association.Sol2CajasREP || 0) !== 0 ||
      Number(association.Sol2KilosREP || 0) !== 0 ||
      Number(association.Sol2NumAnu || 0) !== 0
    ) {
      throw new InspeccionesError(
        409,
        "FOLIO_USED",
        "El folio ya tiene movimientos asociados y no se puede quitar.",
      );
    }

    const source = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Folio", sql.Char(10), folio).query(`
        SELECT TOP 1 FPFolio,FPIns,FPDisponible,FPDesOri,FPDesOT,FPDesUsda
        FROM FOLIOSPROC WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
      `);
    const sourceHeader = source.recordset?.[0];
    if (!sourceHeader)
      throw new InspeccionesError(
        409,
        "FOLIO_SOURCE_NOT_FOUND",
        `No se encontró el folio ${folio} para liberar su asociación.`,
      );
    if (
      Number(sourceHeader.FPIns) !== 1 ||
      Number(sourceHeader.FPDisponible) !== 0 ||
      Number(sourceHeader.FPDesOri || 0) !== 0 ||
      Number(sourceHeader.FPDesOT || 0) !== 0 ||
      Number(sourceHeader.FPDesUsda || 0) !== 0
    ) {
      throw new InspeccionesError(
        409,
        "FOLIO_LOCKED",
        "El folio está siendo utilizado por otra operación y no se puede liberar.",
      );
    }

    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum)
      .input("Folio", sql.Char(10), folio).query(`
        DELETE FROM SOLICITUDES3
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND Sol2Folio=@Folio;
        DELETE FROM SOLICITUDES2
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND Sol2Folio=@Folio;
        UPDATE FOLIOSPROC
        SET FPDisponible=1,FPIns=0
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
        UPDATE FOLIOSPROC1
        SET Fp2Ins=0
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
      `);
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("SolNum", sql.Decimal(10, 0), solNum).query(`
      UPDATE h SET
        soltotcajas=COALESCE((SELECT SUM(CONVERT(bigint,s.Sol2Cajas)) FROM SOLICITUDES2 s WHERE s.EmpCod=h.EmpCod AND s.TempCod=h.TempCod AND s.SolNum=h.SolNum),0),
        soltotkilos=COALESCE((SELECT SUM(CONVERT(money,s.Sol2Kilos)) FROM SOLICITUDES2 s WHERE s.EmpCod=h.EmpCod AND s.TempCod=h.TempCod AND s.SolNum=h.SolNum),0),
        soltotpal=COALESCE((SELECT COUNT(*) FROM SOLICITUDES2 s WHERE s.EmpCod=h.EmpCod AND s.TempCod=h.TempCod AND s.SolNum=h.SolNum),0),
        solcajasRA=COALESCE((SELECT SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0) BETWEEN 0.1 AND 5 THEN d.Sol3Cajas ELSE 0 END) FROM SOLICITUDES3 d JOIN ENVCAT e ON e.EmpCod=d.EmpCod AND e.EnvCod=d.Sol3Env WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.SolNum=h.SolNum),0),
        SolcajasRB=COALESCE((SELECT SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0) BETWEEN 5.1 AND 10 THEN d.Sol3Cajas ELSE 0 END) FROM SOLICITUDES3 d JOIN ENVCAT e ON e.EmpCod=d.EmpCod AND e.EnvCod=d.Sol3Env WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.SolNum=h.SolNum),0),
        SolcajasRC=COALESCE((SELECT SUM(CASE WHEN COALESCE(e.EnvPesoSag,e.EnvPeso,0)>=10.1 THEN d.Sol3Cajas ELSE 0 END) FROM SOLICITUDES3 d JOIN ENVCAT e ON e.EmpCod=d.EmpCod AND e.EnvCod=d.Sol3Env WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.SolNum=h.SolNum),0)
      FROM SOLICITUDES1 h WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.SolNum=@SolNum;
    `);
    await transaction.commit();
    return { solNum, folio };
  } catch (error) {
    if (!transaction._aborted)
      await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

// GeneXus "Eliminar" no borra la cabecera: anula solicitudes en curso y libera
// sus folios asociados dentro de la misma transacción.
const anularSolicitud = async (
  empCod,
  solNumValue,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const solNum = integer(solNumValue, "N° de solicitud", {
    min: 1,
    max: 999999999,
  });
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const result = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("SolNum", sql.Decimal(10, 0), solNum).query(`
      DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
      SELECT TOP 1 SolNum,SolEstado
      FROM SOLICITUDES1 WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
      SELECT Sol2Folio,Sol2Dispo,Sol2CajasREP,Sol2KilosREP,Sol2CajasDes,Sol2KilosDes,Sol2NumAnu
      FROM SOLICITUDES2 WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum;
      SELECT f.FPFolio, f.FPIns, f.FPDisponible, f.FPDesOri, f.FPDesOT, f.FPDesUsda
      FROM FOLIOSPROC f WITH (UPDLOCK,HOLDLOCK)
      INNER JOIN SOLICITUDES2 s
        ON s.EmpCod=f.EmpCod AND s.TempCod=f.TempCod AND s.Sol2Folio=f.FPFolio
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND s.SolNum=@SolNum;
    `);
    const recordsets = result.recordsets || [result.recordset || []];
    const header = recordsets[0]?.[0];
    if (!header)
      throw new InspeccionesError(
        404,
        "SOLICITUD_NOT_FOUND",
        "La solicitud no existe en la temporada activa.",
      );
    if (Number(header.SolEstado) !== 0)
      throw new InspeccionesError(
        409,
        "SOLICITUD_LOCKED",
        `La solicitud está en estado ${statusLabel(header.SolEstado)} y no puede eliminarse.`,
      );
    const associations = recordsets[1] || [];
    const sources = new Map(
      (recordsets[2] || []).map((source) => [trim(source.FPFolio), source]),
    );
    for (const association of associations) {
      const folio = trim(association.Sol2Folio);
      // Sol2CajasDes/Sol2KilosDes son cantidades iniciales del folio para un
      // despacho futuro; solo una marca de uso posterior bloquea la anulación.
      if (
        Number(association.Sol2Dispo || 0) !== 0 ||
        Number(association.Sol2CajasREP || 0) !== 0 ||
        Number(association.Sol2KilosREP || 0) !== 0 ||
        Number(association.Sol2NumAnu || 0) !== 0
      ) {
        throw new InspeccionesError(
          409,
          "FOLIO_USED",
          `El folio ${folio} ya tiene movimientos asociados y no se puede liberar al anular la solicitud.`,
        );
      }
      const source = sources.get(folio);
      if (!source)
        throw new InspeccionesError(
          409,
          "FOLIO_SOURCE_NOT_FOUND",
          `No se encontró el folio ${folio} para liberar su asociación.`,
        );
      if (
        Number(source.FPIns) !== 1 ||
        Number(source.FPDisponible) !== 0 ||
        Number(source.FPDesOri || 0) !== 0 ||
        Number(source.FPDesOT || 0) !== 0 ||
        Number(source.FPDesUsda || 0) !== 0
      ) {
        throw new InspeccionesError(
          409,
          "FOLIO_LOCKED",
          `El folio ${folio} está siendo utilizado por otra operación y no se puede liberar.`,
        );
      }
    }

    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("SolNum", sql.Decimal(10, 0), solNum).query(`
      DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01
        WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
      DECLARE @Folios TABLE (Folio char(10) PRIMARY KEY);
      INSERT INTO @Folios (Folio)
      SELECT Sol2Folio
      FROM SOLICITUDES2
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum;
      UPDATE f SET FPDisponible=1,FPIns=0
      FROM FOLIOSPROC f
      INNER JOIN @Folios x ON x.Folio=f.FPFolio
      WHERE f.EmpCod=@EmpCod AND f.TempCod=@TempCod;
      UPDATE f SET Fp2Ins=0
      FROM FOLIOSPROC1 f
      INNER JOIN @Folios x ON x.Folio=f.FPFolio
      WHERE f.EmpCod=@EmpCod AND f.TempCod=@TempCod;
      DELETE FROM SOLICITUDES3
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum;
      DELETE FROM SOLICITUDES2
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum;
      UPDATE SOLICITUDES1 SET SolEstado=5,soltotcajas=0,soltotkilos=0,soltotpal=0,solcajasRA=0,SolcajasRB=0,SolcajasRC=0
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
    `);
    await transaction.commit();
    return { solNum, status: 5, statusLabel: statusLabel(5) };
  } catch (error) {
    if (!transaction._aborted)
      await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const cambiarEstadoSolicitud = async (
  empCod,
  login,
  solNumValue,
  statusValue,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
  } = {},
) => {
  const solNum = integer(solNumValue, "N° de solicitud", {
    min: 1,
    max: 999999999,
  });
  const status = integer(statusValue, "Estado", { min: 1, max: 2 });
  const userLogin = textValue(login, "Usuario", { required: true, max: 10 });
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const headerResult = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("SolNum", sql.Decimal(10, 0), solNum).query(`
      DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
      SELECT TOP 1 SolNum,SolEstado
      FROM SOLICITUDES1 WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
    `);
    const header = headerResult.recordset?.[0];
    if (!header)
      throw new InspeccionesError(
        404,
        "SOLICITUD_NOT_FOUND",
        "La solicitud no existe en la temporada activa.",
      );
    if (Number(header.SolEstado) !== 0)
      throw new InspeccionesError(
        409,
        "SOLICITUD_LOCKED",
        `La solicitud está en estado ${statusLabel(header.SolEstado)} y no puede cambiarse.`,
      );

    const update = requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("SolNum", sql.Decimal(10, 0), solNum)
      .input("Login", sql.Char(10), userLogin);
    if (status === 1) {
      await update.query(`
        DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01
          WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
        UPDATE SOLICITUDES1
        SET SolEstado=1,SollogAP=@Login,SolFecAP=GETDATE(),SollogRE='',SolFecRE=NULL
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
      `);
    } else {
      await update.query(`
        DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01
          WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
        UPDATE SOLICITUDES1
        SET SolEstado=2,SollogRE=@Login,SolFecRE=GETDATE(),SollogAP='',SolFecAP=NULL
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@SolNum AND SolTipo='INS';
      `);
    }
    await transaction.commit();
    return { solNum, status, statusLabel: statusLabel(status) };
  } catch (error) {
    if (!transaction._aborted)
      await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

module.exports = {
  permission,
  InspeccionesError,
  defaultRange,
  listFilters,
  statusLabel,
  getFormData,
  listInspecciones,
  listAvailableFolios,
  getAvailableFolioDetails,
  requestPayload,
  createSolicitud,
  updateSolicitud,
  addFolioToSolicitud,
  removeFolioFromSolicitud,
  anularSolicitud,
  cambiarEstadoSolicitud,
  getSolicitudDetalle,
  getSolicitudPdfData,
  generateSolicitudPdf,
  generateArchivoIns,
};

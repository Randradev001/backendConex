const { getPool, sql } = require("../../conectorMysql/conectorSqlServer");

const permission = { sistema: 100, modulo: 20, programa: 5 };

class IngresoTarjasError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const trim = (value) => String(value ?? "").trim();
const integer = (
  value,
  label,
  { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {},
) => {
  if (optional && (value === "" || value === null || value === undefined))
    return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new IngresoTarjasError(
      400,
      "VALIDATION_ERROR",
      `${label} debe ser un número entero dentro del rango permitido.`,
    );
  }
  return parsed;
};
const dateValue = (value, label) => {
  const text = trim(value).slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    Number.isNaN(Date.parse(`${text}T00:00:00`))
  ) {
    throw new IngresoTarjasError(
      400,
      "VALIDATION_ERROR",
      `${label} debe ser una fecha válida en formato AAAA-MM-DD.`,
    );
  }
  return text;
};
const normalizeFolio = (value) => {
  const raw = trim(value);
  if (!/^\d{1,10}$/.test(raw) || Number(raw) === 0) {
    throw new IngresoTarjasError(
      400,
      "INVALID_FOLIO",
      "El folio debe contener entre 1 y 10 dígitos y ser distinto de cero.",
    );
  }
  return raw.padStart(10, "0");
};
const normalizeFolioFilter = (value) => {
  const raw = trim(value);
  if (!/^\d{1,10}$/.test(raw) || Number(raw) === 0) {
    throw new IngresoTarjasError(
      400,
      "INVALID_FOLIO",
      "Ingrese un folio valido de hasta 10 digitos.",
    );
  }
  return raw;
};

const importCode = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText))
      return value.richText.map((item) => item.text || "").join("");
    if (value.text !== undefined) return String(value.text);
    if (value.result !== undefined) return String(value.result);
  }
  return String(value);
};

const importCellText = (value) => importCode(value).trim();
const importCellCode = (value) => importCellText(value).replace(/\.0+$/, "");
const importHeader = (value) =>
  importCellText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const importDate = (value, label = "Fecha Proceso") => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const text = importCellText(value);
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const normalized = match
    ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
    : text.slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
    Number.isNaN(Date.parse(`${normalized}T00:00:00`))
  ) {
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      `${label} debe ser una fecha válida en formato DD/MM/YYYY.`,
    );
  }
  return normalized;
};

const importInteger = (
  value,
  label,
  { min = 1, max = Number.MAX_SAFE_INTEGER } = {},
) => {
  const text = importCellText(value);
  const parsed = Number(text);
  if (!text || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      `${label} debe ser un número entero mayor que cero y no superar el máximo permitido.`,
    );
  }
  return parsed;
};

const importMap = (rows, field) =>
  new Map(
    (rows || [])
      .filter((row) => importCellText(row.externalCode))
      .map((row) => [
        importCellText(row.externalCode).toUpperCase(),
        row[field],
      ]),
  );

const getImportCatalogs = async (empCod, { poolProvider = getPool } = {}) => {
  const pool = await poolProvider();
  const result = await pool.request().input("EmpCod", sql.SmallInt, empCod)
    .query(`
    SELECT ExpCod internalCode,CONVERT(varchar(10),ExpCod) externalCode FROM EXPORT1 WHERE EmpCod=@EmpCod;
    SELECT RTRIM(ProdCod) internalCode,RTRIM(ProdCod) externalCode FROM PRODUCTORES WHERE EmpCod=@EmpCod;
    SELECT Especod internalCode,CONVERT(varchar(10),Especod) externalCode FROM ESPECIES WHERE EmpCod=@EmpCod;
    SELECT Especod speciesCode,VarCod internalCode,CONVERT(varchar(10),VarCod) externalCode FROM ESPECIES1 WHERE EmpCod=@EmpCod;
    SELECT EnvCod internalCode,CONVERT(varchar(10),EnvCod) externalCode FROM ENVCAT WHERE EmpCod=@EmpCod AND COALESCE(EnvUso,0)<>2;
    SELECT EnvCod containerCode,Catcod internalCode,CONVERT(varchar(10),Catcod) externalCode FROM ENVCAT1 WHERE EmpCod=@EmpCod;
    SELECT Especod speciesCode,RTRIM(Calibre) caliber FROM CALIBRES WHERE EmpCod=@EmpCod;
  `);
  return {
    exporters: importMap(result.recordsets[0], "internalCode"),
    producers: importMap(result.recordsets[1], "internalCode"),
    species: importMap(result.recordsets[2], "internalCode"),
    varieties: new Map(
      (result.recordsets[3] || [])
        .filter((row) => importCellText(row.externalCode))
        .map((row) => [
          `${row.speciesCode}|${importCellText(row.externalCode).toUpperCase()}`,
          row.internalCode,
        ]),
    ),
    containers: importMap(result.recordsets[4], "internalCode"),
    categories: new Map(
      (result.recordsets[5] || [])
        .filter((row) => importCellText(row.externalCode))
        .map((row) => [
          `${row.containerCode}|${importCellText(row.externalCode).toUpperCase()}`,
          row.internalCode,
        ]),
    ),
    calibers: new Map(
      (result.recordsets[6] || []).map((row) => [
        `${row.speciesCode}|${importCellText(row.caliber).toUpperCase()}`,
        importCellText(row.caliber),
      ]),
    ),
  };
};

const resolveImportRow = (row, catalogs) => {
  const folio = normalizeFolio(row.folio);
  const exporter = catalogs.exporters.get(
    importCellCode(row.exporterCode).toUpperCase(),
  );
  if (!exporter)
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      "La exportadora indicada no existe para la empresa seleccionada.",
    );
  const species = catalogs.species.get(
    importCellCode(row.speciesCode).toUpperCase(),
  );
  if (!species)
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      "La especie indicada no existe para la empresa seleccionada.",
    );
  const producer = catalogs.producers.get(
    importCellCode(row.producerCode).toUpperCase(),
  );
  if (!producer)
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      "El productor indicado no existe para la empresa seleccionada.",
    );
  const variety = catalogs.varieties.get(
    `${species}|${importCellCode(row.varietyCode).toUpperCase()}`,
  );
  if (variety === undefined)
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      "La variedad no corresponde a la especie indicada.",
    );
  const container = catalogs.containers.get(
    importCellCode(row.containerCode).toUpperCase(),
  );
  if (container === undefined)
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      "El envase indicado no existe o no está disponible para ingreso.",
    );
  const category = catalogs.categories.get(
    `${container}|${importCellCode(row.categoryCode).toUpperCase()}`,
  );
  if (category === undefined)
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      "La categoría no está configurada para el envase indicado.",
    );
  const caliber = importCellText(row.caliber);
  if (
    !caliber ||
    !catalogs.calibers.has(`${species}|${caliber.toUpperCase()}`)
  ) {
    throw new IngresoTarjasError(
      400,
      "IMPORT_ROW_INVALID",
      "El calibre no existe para la especie indicada.",
    );
  }
  return {
    folio,
    status: 10,
    orderNumber: null,
    exporterCode: Number(exporter),
    speciesCode: Number(species),
    labelCode: null,
    heightCode: null,
    palletBaseCode: null,
    details: [
      {
        lot: 0,
        movementDate: importDate(row.processDate),
        producerCode: String(producer).trim(),
        speciesCode: Number(species),
        varietyCode: Number(variety),
        containerCode: Number(container),
        categoryCode: Number(category),
        caliber: catalogs.calibers.get(`${species}|${caliber.toUpperCase()}`),
        boxes: importInteger(row.boxes, "Cajas", { min: 1, max: 32767 }),
      },
    ],
  };
};

const readImportRows = async (filePath, { ExcelJS } = {}) => {
  const excel = ExcelJS || require("exceljs");
  // ExcelJS 4.x no puede leer de forma estable algunos XLSX cuyo ZIP declara
  // las hojas antes de workbook.xml. El archivo ya está limitado y almacenado
  // en disco por multer; el lector documental mantiene compatibilidad con
  // esos archivos y evita depender del orden interno del ZIP.
  const workbook = new excel.Workbook();
  await workbook.xlsx.readFile(filePath);
  const rows = new Map();
  const errors = [];
  const warnings = [];
  let rowCount = 0;
  let sheetSeen = false;
  let headerChecked = false;
  for (const worksheet of workbook.worksheets) {
    if (sheetSeen) break;
    sheetSeen = true;
    worksheet.eachRow((row) => {
      const values = row.values || [];
      if (!headerChecked) {
        headerChecked = true;
        const headers = values.slice(1, 11).map(importHeader);
        if (
          !["ndefolio", "nfolio", "folio"].includes(headers[0]) ||
          headers[1] !== "codigoexportadora" ||
          headers[2] !== "fechaproceso"
        ) {
          throw new IngresoTarjasError(
            400,
            "IMPORT_FORMAT_INVALID",
            "El archivo no corresponde al formato oficial de carga de folios (.xlsx). Descargue la plantilla vigente y vuelva a intentarlo.",
          );
        }
        return;
      }
      const cells = values.slice(1, 11);
      if (!cells.some((value) => importCellText(value))) return;
      rowCount += 1;
      const line = row.number;
      const rawFolio = importCellText(cells[0]);
      let folio;
      try {
        folio = normalizeFolio(rawFolio);
      } catch (error) {
        errors.push({
          line,
          folio: rawFolio || "—",
          message:
            "El folio debe contener entre 1 y 10 dígitos y ser distinto de cero.",
        });
        return;
      }
      if (rows.has(folio)) {
        warnings.push({
          line,
          folio,
          message:
            "Folio repetido; se conserva la primera fila y esta fila fue descartada.",
        });
        return;
      }
      rows.set(folio, {
        line,
        folio: rawFolio,
        exporterCode: cells[1],
        processDate: cells[2],
        producerCode: cells[3],
        speciesCode: cells[4],
        varietyCode: cells[5],
        containerCode: cells[6],
        categoryCode: cells[7],
        caliber: cells[8],
        boxes: cells[9],
      });
    });
  }
  if (!headerChecked)
    throw new IngresoTarjasError(
      400,
      "IMPORT_FORMAT_INVALID",
      "El archivo no contiene una fila de encabezados reconocible. Descargue el formato oficial e inténtelo nuevamente.",
    );
  return { rows: [...rows.values()], errors, warnings, rowCount };
};

const importFoliosExcel = async (empCod, filePath, dependencies = {}) => {
  const rowsResult = await readImportRows(filePath, dependencies);
  const catalogs = await getImportCatalogs(empCod, dependencies);
  const errors = [...rowsResult.errors];
  const warnings = [...rowsResult.warnings];
  let loaded = 0;
  for (const row of rowsResult.rows) {
    try {
      const payload = resolveImportRow(row, catalogs);
      await saveTarja(empCod, payload, {
        ...dependencies,
        allowZeroLot: true,
        origin: 5,
      });
      loaded += 1;
    } catch (error) {
      errors.push({
        line: row.line,
        folio: row.folio,
        message:
          error.message ||
          "No fue posible procesar este folio. Revise sus datos y vuelva a intentarlo.",
      });
    }
  }
  return {
    loaded,
    rejected: errors.length,
    duplicatesDiscarded: warnings.length,
    totalRows: rowsResult.rowCount,
    errors,
    warnings,
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

    SELECT o.Ordpnum orderNumber,CONVERT(char(10),o.OrdpFecha,23) orderDate,
      o.ExpCod exporterCode,RTRIM(x.ExpNom) exporterName,o.Especod speciesCode,RTRIM(e.EspeNom) speciesName,
      o.VarCod varietyCode,RTRIM(v.VarNom) varietyName,RTRIM(o.ProdCod) producerCode,RTRIM(p.ProdNom) producerName,
      o.OrdpEstado orderState
    FROM ORDPROC o
    LEFT JOIN EXPORT1 x ON x.EmpCod=o.EmpCod AND x.ExpCod=o.ExpCod
    LEFT JOIN ESPECIES e ON e.EmpCod=o.EmpCod AND e.Especod=o.Especod
    LEFT JOIN ESPECIES1 v ON v.EmpCod=o.EmpCod AND v.Especod=o.Especod AND v.VarCod=o.VarCod
    LEFT JOIN PRODUCTORES p ON p.EmpCod=o.EmpCod AND p.ProdCod=o.ProdCod
    WHERE o.EmpCod=@EmpCod
      AND o.TempCod=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC)
    ORDER BY o.Ordpnum DESC;

    SELECT d.Ordpnum orderNumber,d.Ordp1Nlote lot,COALESCE(d.Ordp1Env,0) assignedBoxes,
      COALESCE(used.usedBoxes,0) usedBoxes,COALESCE(d.Ordp1Env,0)-COALESCE(used.usedBoxes,0) availableBoxes,
      CONVERT(char(10),source.MovFecha,23) movementDate,
      COALESCE(o.ExpCod,0) exporterCode,COALESCE(NULLIF(o.Especod,0),source.Mov1Espe,0) speciesCode,
      COALESCE(NULLIF(o.VarCod,0),source.Mov1Var,0) varietyCode,
      RTRIM(COALESCE(NULLIF(o.ProdCod,''),source.MovProd,'')) producerCode,
      RTRIM(p.ProdNom) producerName,RTRIM(e.EspeNom) speciesName,RTRIM(v.VarNom) varietyName
    FROM ORDPROC1 d
    JOIN ORDPROC o ON o.EmpCod=d.EmpCod AND o.TempCod=d.TempCod AND o.Ordpnum=d.Ordpnum
    OUTER APPLY (
      SELECT TOP 1 h.MovFecha,m.Mov1Espe,m.Mov1Var,h.MovProd
      FROM MOVFRUT1 m
      JOIN MOVFRUT h ON h.EmpCod=m.EmpCod AND h.TempCod=m.TempCod AND h.OriCod=m.OriCod
        AND h.MovTDoc=m.MovTDoc AND h.MovNGuia=m.MovNGuia AND h.MovProd=m.MovProd
      WHERE m.EmpCod=d.EmpCod AND m.TempCod=d.TempCod AND m.Mov1Nlote=d.Ordp1Nlote
      ORDER BY CASE WHEN h.TMcod=1 THEN 0 ELSE 1 END,h.MovFecha DESC
    ) source
    OUTER APPLY (
      SELECT SUM(fd.FP2Cajas) usedBoxes
      FROM FOLIOSPROC1 fd
      JOIN FOLIOSPROC fh ON fh.EmpCod=fd.EmpCod AND fh.TempCod=fd.TempCod AND fh.FPFolio=fd.FPFolio
      WHERE fd.EmpCod=d.EmpCod AND fd.TempCod=d.TempCod AND fh.FPOrdProc=d.Ordpnum AND fd.FP2NProc=d.Ordp1Nlote
    ) used
    LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=COALESCE(NULLIF(o.ProdCod,''),source.MovProd)
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=COALESCE(NULLIF(o.Especod,0),source.Mov1Espe)
    LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=COALESCE(NULLIF(o.Especod,0),source.Mov1Espe)
      AND v.VarCod=COALESCE(NULLIF(o.VarCod,0),source.Mov1Var)
    WHERE d.EmpCod=@EmpCod
      AND d.TempCod=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC)
    ORDER BY d.Ordpnum DESC,d.Ordp1Nlote;

    SELECT ExpCod code,RTRIM(ExpNom) name FROM EXPORT1 WHERE EmpCod=@EmpCod ORDER BY ExpNom;
    SELECT Especod code,RTRIM(EspeNom) name FROM ESPECIES WHERE EmpCod=@EmpCod ORDER BY EspeNom;
    SELECT Especod speciesCode,VarCod code,RTRIM(VarNom) name FROM ESPECIES1 WHERE EmpCod=@EmpCod ORDER BY Especod,VarNom;
    SELECT RTRIM(ProdCod) code,RTRIM(ProdNom) name FROM PRODUCTORES WHERE EmpCod=@EmpCod ORDER BY ProdNom;
    SELECT TEtCod code,RTRIM(TEtDesc) name FROM TIPETI WHERE EmpCod=@EmpCod ORDER BY TEtCod;
    SELECT TAlCod code,RTRIM(TAlDesc) name FROM TIPALT WHERE EmpCod=@EmpCod ORDER BY TAlCod;
    SELECT TBPCod code,RTRIM(TBPDesc) name FROM TIPBPA WHERE EmpCod=@EmpCod ORDER BY TBPCod;
    SELECT EnvCod code,RTRIM(EnvNom) name,EnvPeso weight,EnvDestare tare
      FROM ENVCAT WHERE EmpCod=@EmpCod AND COALESCE(EnvUso,0)<>2 ORDER BY EnvNom;
    SELECT EnvCod containerCode,Catcod code,RTRIM(CatNom) name FROM ENVCAT1 WHERE EmpCod=@EmpCod ORDER BY EnvCod,Catcod;
    SELECT Especod speciesCode,CalCod code,RTRIM(Calibre) name FROM CALIBRES WHERE EmpCod=@EmpCod ORDER BY Especod,CalOrden,Calibre;
    SELECT DestCod code,RTRIM(DestNom) name FROM DESTINOS ORDER BY DestNom,DestCod;
    SELECT TOP 1 RTRIM(EmpNom) companyName FROM DEFEMP WHERE EmpCod=@EmpCod;
  `);
  const active = result.recordsets[0]?.[0];
  if (!active)
    throw new IngresoTarjasError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "No existe una temporada activa para la empresa. Active una temporada antes de consultar tarjas.",
    );
  return {
    tempCod: trim(active.tempCod),
    companyName: trim(result.recordsets[14]?.[0]?.companyName || ""),
    states: [
      { code: 1, name: "En tránsito" },
      { code: 10, name: "Tarja completa" },
    ],
    orders: result.recordsets[1] || [],
    lots: result.recordsets[2] || [],
    catalogs: {
      exporters: result.recordsets[3] || [],
      species: result.recordsets[4] || [],
      varieties: result.recordsets[5] || [],
      producers: result.recordsets[6] || [],
      labels: result.recordsets[7] || [],
      heights: result.recordsets[8] || [],
      palletBases: result.recordsets[9] || [],
      containers: result.recordsets[10] || [],
      categories: result.recordsets[11] || [],
      calibers: result.recordsets[12] || [],
      destinations: result.recordsets[13] || [],
    },
  };
};

const saveTarja = async (
  empCod,
  body = {},
  dependencies = {},
  editingFolio = null,
) => {
  const poolProvider = dependencies.poolProvider || getPool;
  const transactionFactory =
    dependencies.transactionFactory || ((pool) => new sql.Transaction(pool));
  const requestFactory =
    dependencies.requestFactory ||
    ((transaction) => new sql.Request(transaction));
  const origin = Number.isInteger(dependencies.origin)
    ? dependencies.origin
    : 0;
  const folio = normalizeFolio(editingFolio ?? body.folio);
  if (editingFolio && body.folio && normalizeFolio(body.folio) !== folio) {
    throw new IngresoTarjasError(
      400,
      "FOLIO_IMMUTABLE",
      "El folio es la identificación de la tarja y no puede modificarse. Cree una nueva tarja si necesita usar otro folio.",
    );
  }
  const status = integer(body.status, "El estado", { min: 1, max: 10 });
  if (![1, 10].includes(status))
    throw new IngresoTarjasError(
      400,
      "INVALID_STATE",
      "El estado seleccionado no es válido. Use “En tránsito” o “Tarja completa.”",
    );
  const entryDate = body.entryDate
    ? dateValue(body.entryDate, "La fecha de ingreso")
    : null;
  const orderInput =
    body.orderNumber === "" ||
    body.orderNumber === null ||
    body.orderNumber === undefined ||
    Number(body.orderNumber) === 0
      ? null
      : body.orderNumber;
  const orderNumber =
    orderInput === null
      ? null
      : integer(orderInput, "La orden", { min: 1, max: 9999999999 });
  const requestedExporter = integer(body.exporterCode, "La exportadora", {
    min: 1,
    max: 32767,
  });
  const requestedSpecies = integer(body.speciesCode, "La especie", {
    min: 1,
    max: 32767,
  });
  const labelCode = integer(body.labelCode, "El tipo de etiqueta", {
    min: 1,
    max: 999,
    optional: true,
  });
  const heightCode = integer(body.heightCode, "El tipo de altura", {
    min: 1,
    max: 999,
    optional: true,
  });
  const palletBaseCode = integer(
    body.palletBaseCode,
    "El tipo de base de pallet",
    { min: 1, max: 999, optional: true },
  );
  const destinationCode = integer(body.destinationCode, "El destino", {
    min: 1,
    max: 32767,
    optional: true,
  });
  const boxNumber = integer(body.boxNumber, "El numero de caja", {
    min: 1,
    max: 9999999999,
    optional: true,
  });
  const service = trim(body.service);
  if (service.length > 30)
    throw new IngresoTarjasError(
      400,
      "VALIDATION_ERROR",
      "El servicio admite hasta 30 caracteres.",
    );
  if (!Array.isArray(body.details) || !body.details.length) {
    throw new IngresoTarjasError(
      400,
      "DETAIL_REQUIRED",
      "Debe agregar al menos un lote antes de guardar la tarja.",
    );
  }
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const baseRequest = requestFactory(transaction).input(
      "EmpCod",
      sql.SmallInt,
      empCod,
    );
    const seasonResult = await baseRequest.query(
      `SELECT TOP 1 RTRIM(TempCod) TempCod FROM TEMP01 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC;`,
    );
    if (!seasonResult.recordset.length)
      throw new IngresoTarjasError(
        409,
        "ACTIVE_SEASON_NOT_FOUND",
        "No existe una temporada activa para la empresa. Active una temporada antes de ingresar tarjas.",
      );
    const tempCod = trim(seasonResult.recordset[0].TempCod);
    const exists = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Folio", sql.Char(10), folio)
      .query(`SELECT TOP 1 FPFolio,FPOrigen,FPIns,FPDesOri,FPDesOT,FPDesUsda,FPDisponible
        FROM FOLIOSPROC WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;`);
    if (!editingFolio && exists.recordset.length)
      throw new IngresoTarjasError(
        409,
        "FOLIO_EXISTS",
        "El Folio Ya Existe: ingrese otro número para la temporada activa.",
      );
    if (editingFolio && !exists.recordset.length)
      throw new IngresoTarjasError(
        404,
        "FOLIO_NOT_FOUND",
        "El folio indicado no existe en la temporada activa o ya fue eliminado.",
      );
    if (editingFolio) {
      const current = exists.recordset[0];
      if (![0, 5].includes(Number(current.FPOrigen))) {
        throw new IngresoTarjasError(
          409,
          "FOLIO_AUTOMATIC",
          "Esta tarja fue generada automáticamente y no se puede modificar desde este formulario.",
        );
      }
      if (
        [
          current.FPIns,
          current.FPDesOri,
          current.FPDesOT,
          current.FPDesUsda,
        ].some((value) => Number(value) !== 0)
      ) {
        throw new IngresoTarjasError(
          409,
          "FOLIO_IN_USE",
          "La tarja ya tiene inspección o despacho asociado y no se puede modificar.",
        );
      }
      if (Number(current.FPDisponible) === 0) {
        throw new IngresoTarjasError(
          409,
          "FOLIO_UNAVAILABLE",
          "La tarja no está disponible para modificación porque ya fue utilizada en otro proceso.",
        );
      }
      await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("Folio", sql.Char(10), folio)
        .query(
          "DELETE FROM FOLIOSPROC1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;",
        );
    }

    let order = null;
    if (orderNumber) {
      const orderResult = await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("OrderNumber", sql.Decimal(10, 0), orderNumber)
        .query(
          "SELECT TOP 1 ExpCod,Especod,VarCod,RTRIM(ProdCod) ProdCod FROM ORDPROC WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@OrderNumber;",
        );
      if (!orderResult.recordset.length)
        throw new IngresoTarjasError(
          409,
          "ORDER_NOT_FOUND",
          "La orden asociada al lote no pertenece a la temporada activa. Verifique el lote ingresado.",
        );
      order = orderResult.recordset[0];
    }
    const exporterCode = Number(order?.ExpCod) || requestedExporter;
    const headerSpecies = Number(order?.Especod) || requestedSpecies;
    if (Number(order?.ExpCod) && Number(order.ExpCod) !== requestedExporter)
      throw new IngresoTarjasError(
        409,
        "EXPORTER_MISMATCH",
        "La exportadora seleccionada no coincide con la exportadora de la orden asociada.",
      );
    if (Number(order?.Especod) && Number(order.Especod) !== requestedSpecies)
      throw new IngresoTarjasError(
        409,
        "SPECIES_MISMATCH",
        "La especie seleccionada no coincide con la especie de la orden asociada.",
      );
    if (destinationCode) {
      const destination = await requestFactory(transaction)
        .input("Destination", sql.SmallInt, destinationCode)
        .query(
          "SELECT TOP 1 DestCod FROM DESTINOS WHERE DestCod=@Destination;",
        );
      if (!destination.recordset.length)
        throw new IngresoTarjasError(
          409,
          "INVALID_DESTINATION",
          "El destino seleccionado no existe para la empresa. Seleccione un destino válido.",
        );
    }

    const normalized = [];
    const requestedByLot = new Map();
    const correlations = new Map();
    const duplicateKeys = new Set();
    for (const raw of body.details) {
      const lot = integer(raw.lot, "El lote", { min: 0, max: 9999999999 });
      const boxes = integer(raw.boxes, "Las cajas", { min: 1, max: 32767 });
      const lotRequest = requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("Lot", sql.Decimal(10, 0), lot);
      const lotResult =
        lot === 0
          ? { recordset: [] }
          : orderNumber
            ? await lotRequest.input(
                "OrderNumber",
                sql.Decimal(10, 0),
                orderNumber,
              ).query(`
            SELECT TOP 1 d.Ordp1Env assignedBoxes,o.ExpCod,o.Especod,o.VarCod,RTRIM(o.ProdCod) orderProducer,
              source.MovFecha,source.Mov1Espe,source.Mov1Var,RTRIM(source.MovProd) movementProducer
            FROM ORDPROC1 d WITH (UPDLOCK,HOLDLOCK)
            JOIN ORDPROC o ON o.EmpCod=d.EmpCod AND o.TempCod=d.TempCod AND o.Ordpnum=d.Ordpnum
            OUTER APPLY (
              SELECT TOP 1 h.MovFecha,m.Mov1Espe,m.Mov1Var,h.MovProd
              FROM MOVFRUT1 m
              JOIN MOVFRUT h ON h.EmpCod=m.EmpCod AND h.TempCod=m.TempCod AND h.OriCod=m.OriCod
                AND h.MovTDoc=m.MovTDoc AND h.MovNGuia=m.MovNGuia AND h.MovProd=m.MovProd
              WHERE m.EmpCod=d.EmpCod AND m.TempCod=d.TempCod AND m.Mov1Nlote=d.Ordp1Nlote
              ORDER BY CASE WHEN h.TMcod=1 THEN 0 ELSE 1 END,h.MovFecha DESC
            ) source
            WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.Ordpnum=@OrderNumber AND d.Ordp1Nlote=@Lot;
          `)
            : await lotRequest.query(`
            SELECT TOP 1 COALESCE(m.Mov1NumE,0) assignedBoxes,CAST(NULL AS smallint) ExpCod,
              m.Mov1Espe Especod,m.Mov1Var VarCod,RTRIM(h.MovProd) movementProducer,
              h.MovFecha,m.Mov1Espe,m.Mov1Var
            FROM MOVFRUT1 m
            JOIN MOVFRUT h ON h.EmpCod=m.EmpCod AND h.TempCod=m.TempCod AND h.OriCod=m.OriCod
              AND h.MovTDoc=m.MovTDoc AND h.MovNGuia=m.MovNGuia AND h.MovProd=m.MovProd
            WHERE m.EmpCod=@EmpCod AND m.TempCod=@TempCod AND m.Mov1Nlote=@Lot
            ORDER BY CASE WHEN h.TMcod=1 THEN 0 ELSE 1 END,h.MovFecha DESC;
          `);
      if (lot > 0 && orderNumber && !lotResult.recordset.length) {
        throw new IngresoTarjasError(
          409,
          "LOT_NOT_FOUND",
          `El lote ${lot} no pertenece a la orden seleccionada. Ingrese un lote disponible de esa orden.`,
        );
      }
      const source = lotResult.recordset[0] || {};
      const hasBalance =
        lot > 0 && Boolean(orderNumber || lotResult.recordset.length);
      const producerCode = trim(
        source.orderProducer || source.movementProducer || raw.producerCode,
      );
      if (producerCode.length > 6)
        throw new IngresoTarjasError(
          400,
          "VALIDATION_ERROR",
          "El productor admite hasta 6 caracteres.",
        );
      const speciesCode =
        Number(source.Especod || source.Mov1Espe) ||
        integer(raw.speciesCode, "La especie del detalle", {
          min: 1,
          max: 32767,
        });
      const varietyCode =
        Number(source.VarCod || source.Mov1Var) ||
        integer(raw.varietyCode, "La variedad", { min: 1, max: 2147483647 });
      const movementDate = source.MovFecha
        ? new Date(source.MovFecha).toISOString().slice(0, 10)
        : dateValue(raw.movementDate, "La fecha");
      if (!producerCode)
        throw new IngresoTarjasError(
          400,
          "VALIDATION_ERROR",
          `El productor es obligatorio para el lote ${lot}.`,
        );
      if (speciesCode !== headerSpecies)
        throw new IngresoTarjasError(
          409,
          "SPECIES_MISMATCH",
          `La especie del lote ${lot} no coincide con la especie seleccionada en la cabecera.`,
        );
      if (Number(source.ExpCod) && Number(source.ExpCod) !== exporterCode)
        throw new IngresoTarjasError(
          409,
          "EXPORTER_MISMATCH",
          `La exportadora del lote ${lot} no coincide con la exportadora seleccionada en la cabecera.`,
        );

      const containerCode = integer(raw.containerCode, "El envase", {
        min: 1,
        max: 32767,
      });
      const categoryCode = integer(raw.categoryCode, "La categoria", {
        min: 1,
        max: 32767,
      });
      const caliber = trim(raw.caliber);
      if (!caliber)
        throw new IngresoTarjasError(
          400,
          "VALIDATION_ERROR",
          "El calibre es obligatorio.",
        );
      if (caliber.length > 10)
        throw new IngresoTarjasError(
          400,
          "VALIDATION_ERROR",
          "El calibre admite hasta 10 caracteres.",
        );
      const catalog = await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("EnvCod", sql.SmallInt, containerCode)
        .input("CatCod", sql.SmallInt, categoryCode)
        .input("Species", sql.SmallInt, speciesCode)
        .input("Caliber", sql.Char(10), caliber)
        .input("Producer", sql.Char(6), producerCode).query(`
          SELECT TOP 1 EnvPeso,EnvDestare,EnvUso FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@EnvCod;
          SELECT TOP 1 Catcod FROM ENVCAT1 WHERE EmpCod=@EmpCod AND EnvCod=@EnvCod AND Catcod=@CatCod;
          SELECT TOP 1 Calibre FROM CALIBRES WHERE EmpCod=@EmpCod AND Especod=@Species AND RTRIM(Calibre)=RTRIM(@Caliber);
          SELECT TOP 1 ProdCod FROM PRODUCTORES WHERE EmpCod=@EmpCod AND ProdCod=@Producer;
        `);
      const container = catalog.recordsets[0]?.[0];
      if (!container || Number(container.EnvUso) === 2)
        throw new IngresoTarjasError(
          409,
          "INVALID_CONTAINER",
          "El envase seleccionado no está disponible para ingreso o no corresponde a la empresa.",
        );
      if (!catalog.recordsets[1]?.length)
        throw new IngresoTarjasError(
          409,
          "INVALID_CATEGORY",
          "La categoría seleccionada no está configurada para el envase indicado.",
        );
      if (!catalog.recordsets[2]?.length)
        throw new IngresoTarjasError(
          409,
          "INVALID_CALIBER",
          "El calibre seleccionado no está configurado para la especie indicada.",
        );
      if (!catalog.recordsets[3]?.length)
        throw new IngresoTarjasError(
          409,
          "INVALID_PRODUCER",
          "El productor seleccionado no existe para la empresa.",
        );

      const usedRequest = requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("Lot", sql.Decimal(10, 0), lot);
      const usedResult = hasBalance
        ? orderNumber
          ? await usedRequest.input(
              "OrderNumber",
              sql.Decimal(10, 0),
              orderNumber,
            ).query(`
              SELECT COALESCE(SUM(d.FP2Cajas),0) usedBoxes
              FROM FOLIOSPROC1 d WITH (UPDLOCK,HOLDLOCK)
              JOIN FOLIOSPROC h WITH (UPDLOCK,HOLDLOCK) ON h.EmpCod=d.EmpCod AND h.TempCod=d.TempCod AND h.FPFolio=d.FPFolio
              WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND h.FPOrdProc=@OrderNumber AND d.FP2NProc=@Lot;
            `)
          : await usedRequest.query(`
              SELECT COALESCE(SUM(d.FP2Cajas),0) usedBoxes
              FROM FOLIOSPROC1 d WITH (UPDLOCK,HOLDLOCK)
              JOIN FOLIOSPROC h WITH (UPDLOCK,HOLDLOCK) ON h.EmpCod=d.EmpCod AND h.TempCod=d.TempCod AND h.FPFolio=d.FPFolio
              WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.FP2NProc=@Lot;
            `)
        : { recordset: [{ usedBoxes: 0 }] };
      const alreadyRequested = requestedByLot.get(lot) || 0;
      const available =
        Number(source.assignedBoxes || 0) -
        Number(usedResult.recordset[0]?.usedBoxes || 0) -
        alreadyRequested;
      if (hasBalance && boxes > available)
        throw new IngresoTarjasError(
          409,
          "LOT_BALANCE_EXCEEDED",
          `La cantidad ingresada para el lote ${lot} supera el saldo disponible de ${Math.max(0, available)} cajas.`,
        );
      if (hasBalance) requestedByLot.set(lot, alreadyRequested + boxes);

      const duplicateKey = [
        movementDate,
        speciesCode,
        varietyCode,
        producerCode,
        containerCode,
        categoryCode,
        caliber.toUpperCase(),
      ].join("|");
      if (duplicateKeys.has(duplicateKey))
        throw new IngresoTarjasError(
          409,
          "DETAIL_DUPLICATE",
          `El detalle del lote ${lot} repite la misma fecha, productor, envase, categoría y calibre. Cambie uno de esos datos.`,
        );
      duplicateKeys.add(duplicateKey);
      const correlation = (correlations.get(lot) || 0) + 1;
      correlations.set(lot, correlation);
      const netWeight =
        Number(container.EnvPeso || 0) - Number(container.EnvDestare || 0);
      if (netWeight < 0)
        throw new IngresoTarjasError(
          409,
          "INVALID_CONTAINER_WEIGHT",
          "El peso neto del envase no puede ser negativo. Revise el peso y la tara configurados.",
        );
      normalized.push({
        lot,
        correlation,
        movementDate,
        producerCode,
        speciesCode,
        varietyCode,
        containerCode,
        categoryCode,
        caliber,
        boxes,
        kilos: boxes * netWeight,
      });
    }

    const headerRequest = requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), tempCod)
      .input("Folio", sql.Char(10), folio)
      .input("OrderNumber", sql.Decimal(10, 0), orderNumber)
      .input("Exporter", sql.SmallInt, exporterCode)
      .input("Species", sql.SmallInt, headerSpecies)
      .input("Status", sql.SmallInt, status)
      .input("Label", sql.SmallInt, labelCode)
      .input("Origin", sql.SmallInt, origin)
      .input("EntryDate", sql.Date, entryDate)
      .input("Height", sql.SmallInt, heightCode)
      .input("PalletBase", sql.SmallInt, palletBaseCode)
      .input("Destination", sql.SmallInt, destinationCode)
      .input("BoxNumber", sql.Decimal(10, 0), boxNumber)
      .input("Service", sql.VarChar(30), service || null);
    if (editingFolio) {
      await headerRequest.query(`UPDATE FOLIOSPROC SET FPOrdProc=@OrderNumber,ExpCod=@Exporter,FPEspe=@Species,
        FPEstado=@Status,FPFechaIng=COALESCE(@EntryDate,FPFechaIng),FPDisponible=1,TEtCod=@Label,TAlCod=@Height,TBPCod=@PalletBase,
        DestCod=@Destination,FPNCaja=@BoxNumber,FPServicio=@Service
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;`);
    } else {
      await headerRequest.query(`INSERT FOLIOSPROC (EmpCod,TempCod,FPFolio,FPOrdProc,ExpCod,FPEspe,FPEstado,FPFechaIng,FPIns,FPDesOri,FPDesOT,FPDesUsda,FPDisponible,TEtCod,TAlCod,TBPCod,FPOrigen,DestCod,FPNCaja,FPServicio)
        VALUES (@EmpCod,@TempCod,@Folio,@OrderNumber,@Exporter,@Species,@Status,COALESCE(@EntryDate,CAST(GETDATE() AS date)),0,0,0,0,1,@Label,@Height,@PalletBase,@Origin,@Destination,@BoxNumber,@Service);`);
    }
    for (const detail of normalized) {
      await requestFactory(transaction)
        .input("EmpCod", sql.SmallInt, empCod)
        .input("TempCod", sql.Char(9), tempCod)
        .input("Folio", sql.Char(10), folio)
        .input("Lot", sql.Decimal(10, 0), detail.lot)
        .input("Correlation", sql.SmallInt, detail.correlation)
        .input("Date", sql.DateTime, detail.movementDate)
        .input("Producer", sql.Char(6), detail.producerCode)
        .input("Species", sql.SmallInt, detail.speciesCode)
        .input("Variety", sql.Int, detail.varietyCode)
        .input("Container", sql.SmallInt, detail.containerCode)
        .input("Category", sql.SmallInt, detail.categoryCode)
        .input("Caliber", sql.Char(10), detail.caliber)
        .input("Boxes", sql.SmallInt, detail.boxes)
        .input("Kilos", sql.Money, detail.kilos)
        .input("Exporter", sql.SmallInt, exporterCode)
        .input("Status", sql.SmallInt, status)
        .query(`INSERT FOLIOSPROC1 (EmpCod,TempCod,FPFolio,FP2NProc,FP2Cor,FP2Fecha,ProdCod,fp2especod,fp2varcod,EnvCod,Catcod,Calibre,FP2Cajas,FP2Kilos,fp2expcod,Fp2MovRep,Fp2Estado,Fp2Tipo,Fp2Ins,Fp2CajasO,FP2CajasRep)
          VALUES (@EmpCod,@TempCod,@Folio,@Lot,@Correlation,@Date,@Producer,@Species,@Variety,@Container,@Category,@Caliber,@Boxes,@Kilos,@Exporter,0,@Status,0,0,@Boxes,0);`);
    }
    await transaction.commit();
    return {
      folio,
      tempCod,
      orderNumber,
      status,
      updated: Boolean(editingFolio),
      totalBoxes: normalized.reduce((sum, item) => sum + item.boxes, 0),
      totalKilos: normalized.reduce((sum, item) => sum + item.kilos, 0),
      details: normalized.length,
    };
  } catch (error) {
    await transaction.rollback();
    if (error instanceof IngresoTarjasError) throw error;
    if ([2601, 2627].includes(Number(error.number)))
      throw new IngresoTarjasError(
        409,
        "FOLIO_EXISTS",
        "El Folio Ya Existe: ingrese otro número para la temporada activa.",
      );
    throw error;
  }
};

const createTarja = (empCod, body = {}, dependencies = {}) =>
  saveTarja(empCod, body, dependencies);
const updateTarja = (empCod, folio, body = {}, dependencies = {}) =>
  saveTarja(empCod, body, dependencies, normalizeFolio(folio));

const listFilters = (query = {}) => {
  const today = new Date();
  const before = new Date(today);
  before.setDate(before.getDate() - 30);
  const iso = (date) => date.toISOString().slice(0, 10);
  const from = query.from
    ? dateValue(query.from, "La fecha desde")
    : iso(before);
  const to = query.to ? dateValue(query.to, "La fecha hasta") : iso(today);
  if (from > to)
    throw new IngresoTarjasError(
      400,
      "INVALID_DATE_RANGE",
      "La fecha inicial no puede ser posterior a la fecha final. Ajuste el rango de búsqueda.",
    );
  const species = query.species
    ? integer(query.species, "La especie", { min: 0 })
    : 0;
  const status = query.status
    ? integer(query.status, "El estado", { min: 0, max: 10 })
    : 0;
  if (![0, 1, 10].includes(status))
    throw new IngresoTarjasError(
      400,
      "INVALID_STATE",
      "El estado de búsqueda no es válido. Seleccione Todos, En tránsito o Tarja completa.",
    );
  const rawFolio = trim(query.folio);
  const folio = rawFolio ? normalizeFolioFilter(rawFolio) : "";
  const page = query.page ? integer(query.page, "La pagina", { min: 1 }) : 1;
  const pageSize = query.pageSize
    ? integer(query.pageSize, "El tamaño de pagina", { min: 1, max: 200 })
    : 25;
  return { from, to, species, status, folio, page, pageSize };
};

const listTarjas = async (
  empCod,
  query = {},
  { poolProvider = getPool } = {},
) => {
  const filters = listFilters(query);
  const pool = await poolProvider();
  const request = pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("From", sql.Date, filters.from)
    .input("To", sql.Date, filters.to)
    .input("Species", sql.SmallInt, filters.species)
    .input("Status", sql.SmallInt, filters.status)
    .input("Folio", sql.VarChar(10), filters.folio)
    .input("Offset", sql.Int, (filters.page - 1) * filters.pageSize)
    .input("PageSize", sql.Int, filters.pageSize);
  const result = await request.query(`
    DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
    SELECT RTRIM(h.FPFolio) folio,h.FPOrdProc orderNumber,h.FPEspe speciesCode,RTRIM(e.EspeNom) speciesName,
      COALESCE(tot.totalBoxes,0) totalBoxes,COALESCE(tot.totalKilos,0) totalKilos,h.ExpCod exporterCode,RTRIM(x.ExpNom) exporterName,
      CONVERT(char(10),h.FPFechaIng,23) entryDate,h.FPEstado status,h.FPIns inspection,h.FPDisponible available,
      h.FPOrigen origin,h.FPDesOri dispatchOrigin,h.FPDesOT dispatchOt,h.FPDesUsda dispatchUsda
    FROM FOLIOSPROC h
    LEFT JOIN ESPECIES e ON e.EmpCod=h.EmpCod AND e.Especod=h.FPEspe
    LEFT JOIN EXPORT1 x ON x.EmpCod=h.EmpCod AND x.ExpCod=h.ExpCod
    OUTER APPLY (SELECT SUM(CONVERT(bigint,d.FP2Cajas)) totalBoxes,SUM(CONVERT(decimal(19,2),d.FP2Kilos)) totalKilos
      FROM FOLIOSPROC1 d WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio) tot
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPFechaIng>=@From AND h.FPFechaIng<DATEADD(day,1,@To)
      AND (@Species=0 OR h.FPEspe=@Species) AND (@Status=0 OR h.FPEstado=@Status)
      AND (@Folio='' OR RTRIM(h.FPFolio) LIKE '%' + @Folio + '%')
    ORDER BY h.FPFechaIng DESC,h.FPFolio DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT_BIG(*) total,COALESCE(SUM(CONVERT(bigint,tot.totalBoxes)),0) totalBoxes,
      COALESCE(SUM(CONVERT(decimal(19,2),tot.totalKilos)),0) totalKilos
    FROM FOLIOSPROC h
    OUTER APPLY (SELECT SUM(CONVERT(bigint,d.FP2Cajas)) totalBoxes,SUM(CONVERT(decimal(19,2),d.FP2Kilos)) totalKilos
      FROM FOLIOSPROC1 d WHERE d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.FPFolio=h.FPFolio) tot
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPFechaIng>=@From AND h.FPFechaIng<DATEADD(day,1,@To)
      AND (@Species=0 OR h.FPEspe=@Species) AND (@Status=0 OR h.FPEstado=@Status)
      AND (@Folio='' OR RTRIM(h.FPFolio) LIKE '%' + @Folio + '%');
    SELECT RTRIM(@TempCod) tempCod;
  `);
  const totals = result.recordsets[1]?.[0] || {};
  return {
    rows: result.recordsets[0] || [],
    total: Number(totals.total || 0),
    totals: {
      boxes: Number(totals.totalBoxes || 0),
      kilos: Number(totals.totalKilos || 0),
    },
    tempCod: trim(result.recordsets[2]?.[0]?.tempCod),
    filters,
  };
};

const getTarja = async (
  empCod,
  folioValue,
  { poolProvider = getPool } = {},
) => {
  const folio = normalizeFolio(folioValue);
  const pool = await poolProvider();
  const result = await pool
    .request()
    .input("EmpCod", sql.SmallInt, empCod)
    .input("Folio", sql.Char(10), folio).query(`
    DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
    SELECT RTRIM(h.FPFolio) folio,RTRIM(h.TempCod) tempCod,h.FPOrdProc orderNumber,h.ExpCod exporterCode,h.FPEspe speciesCode,
      h.FPEstado status,CONVERT(char(10),h.FPFechaIng,23) entryDate,h.FPDisponible available,h.TEtCod labelCode,
      h.TAlCod heightCode,h.TBPCod palletBaseCode,h.DestCod destinationCode,h.FPNCaja boxNumber,RTRIM(h.FPServicio) service,
      h.FPOrigen origin,h.FPIns inspection,h.FPDesOri dispatchOrigin,
      h.FPDesOT dispatchOt,h.FPDesUsda dispatchUsda
    FROM FOLIOSPROC h WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPFolio=@Folio;
    SELECT d.FP2NProc lot,d.FP2Cor correlation,CONVERT(char(10),d.FP2Fecha,23) movementDate,RTRIM(d.ProdCod) producerCode,
      d.fp2especod speciesCode,d.fp2varcod varietyCode,d.EnvCod containerCode,d.Catcod categoryCode,RTRIM(d.Calibre) caliber,
      d.FP2Cajas boxes,d.FP2Kilos kilos
    FROM FOLIOSPROC1 d WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.FPFolio=@Folio
    ORDER BY d.FP2NProc,d.FP2Cor;
  `);
  if (!result.recordsets[0]?.length)
    throw new IngresoTarjasError(
      404,
      "FOLIO_NOT_FOUND",
      "El folio indicado no existe en la temporada activa o ya fue eliminado.",
    );
  return { ...result.recordsets[0][0], details: result.recordsets[1] || [] };
};

const deleteTarja = async (empCod, folioValue, dependencies = {}) => {
  const poolProvider = dependencies.poolProvider || getPool;
  const transactionFactory =
    dependencies.transactionFactory || ((pool) => new sql.Transaction(pool));
  const requestFactory =
    dependencies.requestFactory ||
    ((transaction) => new sql.Request(transaction));
  const folio = normalizeFolio(folioValue);
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("Folio", sql.Char(10), folio).query(`
      SELECT TOP 1 h.TempCod,h.FPOrigen,h.FPIns,h.FPDesOri,h.FPDesOT,h.FPDesUsda,h.FPDisponible
      FROM FOLIOSPROC h WITH (UPDLOCK,HOLDLOCK)
      JOIN TEMP01 t ON t.EmpCod=h.EmpCod AND t.TempCod=h.TempCod AND t.TempActiva=1
      WHERE h.EmpCod=@EmpCod AND h.FPFolio=@Folio;
    `);
    if (!result.recordset.length)
      throw new IngresoTarjasError(
        404,
        "FOLIO_NOT_FOUND",
        "El folio indicado no existe en la temporada activa o ya fue eliminado.",
      );
    const current = result.recordset[0];
    if (![0, 5].includes(Number(current.FPOrigen)))
      throw new IngresoTarjasError(
        409,
        "FOLIO_AUTOMATIC",
        "Esta tarja fue generada automáticamente y no se puede eliminar desde este listado.",
      );
    if (
      [
        current.FPIns,
        current.FPDesOri,
        current.FPDesOT,
        current.FPDesUsda,
      ].some((value) => Number(value) !== 0)
    ) {
      throw new IngresoTarjasError(
        409,
        "FOLIO_IN_USE",
        "La tarja ya tiene inspección o despacho asociado y no se puede eliminar.",
      );
    }
    if (Number(current.FPDisponible) === 0)
      throw new IngresoTarjasError(
        409,
        "FOLIO_UNAVAILABLE",
        "La tarja no está disponible para eliminación porque ya fue utilizada en otro proceso.",
      );
    await requestFactory(transaction)
      .input("EmpCod", sql.SmallInt, empCod)
      .input("TempCod", sql.Char(9), current.TempCod)
      .input("Folio", sql.Char(10), folio).query(`
        DELETE FROM FOLIOSPROC1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
        DELETE FROM FOLIOSPROC WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FPFolio=@Folio;
      `);
    await transaction.commit();
    return { folio };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  permission,
  IngresoTarjasError,
  normalizeFolio,
  getFormData,
  createTarja,
  updateTarja,
  listFilters,
  listTarjas,
  getTarja,
  deleteTarja,
  importFoliosExcel,
  readImportRows,
  resolveImportRow,
};

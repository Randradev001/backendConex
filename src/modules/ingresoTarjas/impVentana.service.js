const { getPool, sql } = require('../../conectorMysql/conectorSqlServer');
const { listTarjas, normalizeFolio } = require('./ingresoTarjas.service');
const { sendZpl } = require('../../impresion-worker/printerClient');

const permission = Object.freeze({ sistema: 100, modulo: 20, programa: 5 });
const PRINT_STATUS = Object.freeze({ PENDING: 0, PRINTED: 1, FAILED: 3, UNCERTAIN: 4, PROCESSING: 9 });
const DEFAULT_DIMENSIONS = Object.freeze({
  1: [104, 211],
  2: [132, 76],
  3: [65, 79],
  4: [65, 79],
  5: [39, 69],
  6: [39, 69]
});

class ImpVentanaError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const trim = (value) => String(value ?? '').trim();
const safeZpl = (value) => trim(value).replace(/[\u0000-\u001f^~]/g, ' ');
const numberValue = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const formatWeight = (value) => numberValue(value).toFixed(2);
const formatCopies = (value) => Math.max(1, Math.trunc(numberValue(value, 1)));

const positiveInteger = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ImpVentanaError(400, 'INVALID_PRINT_DATA', `${label} debe ser un entero positivo.`);
  return parsed;
};

const normalizeFolios = (value) => {
  if (!Array.isArray(value) || !value.length) throw new ImpVentanaError(400, 'PRINT_FOLIOS_REQUIRED', 'Seleccione al menos un folio para imprimir.');
  if (value.length > 100) throw new ImpVentanaError(400, 'PRINT_FOLIOS_LIMIT', 'Puede imprimir hasta 100 folios por solicitud.');
  const unique = [];
  const seen = new Set();
  for (const raw of value) {
    const folio = normalizeFolio(raw);
    if (!seen.has(folio)) {
      seen.add(folio);
      unique.push(folio);
    }
  }
  return unique;
};

const distinctValues = (values) => {
  const result = [];
  for (const value of values) {
    const normalized = trim(value);
    if (!result.some((current) => current === normalized)) result.push(normalized);
  }
  return result;
};

const strippedCaliber = (value) => trim(value).replace(/^0+/, '');

const labelData = (header, details, parameters) => {
  const varieties = distinctValues(details.map((row) => row.varietyName)).filter(Boolean);
  const calibers = distinctValues(details.map((row) => strippedCaliber(row.caliber))).filter(Boolean);
  const lastDetail = details[details.length - 1] || {};
  const caliberCount = Math.min(Math.max(calibers.length, 1), 6);
  const dimension = parameters.get(caliberCount) || DEFAULT_DIMENSIONS[caliberCount];
  const copies = formatCopies(parameters.copies || 1);
  return {
    folio: trim(header.folio),
    species: trim(header.speciesName),
    varieties,
    calibers,
    boxes: details.reduce((sum, row) => sum + numberValue(row.boxes), 0),
    weight: numberValue(lastDetail.envPesoSag ?? lastDetail.envPeso),
    copies,
    dimensions: { largo: dimension[0], ancho: dimension[1] },
    details: details.map((row) => ({
      lot: numberValue(row.lot),
      correlation: numberValue(row.correlation),
      variety: trim(row.varietyName),
      caliber: trim(row.caliber),
      envase: trim(row.containerName),
      envPesoSag: numberValue(row.envPesoSag ?? row.envPeso),
      boxes: numberValue(row.boxes),
      cuartel: row.cuartelCode == null ? null : numberValue(row.cuartelCode)
    }))
  };
};

const varietyLines = (varieties) => {
  const values = varieties.slice(0, 6).map(safeZpl);
  if (values.length === 1) return [`^FT231,758^A0B,138,100^FH\\^FD${values[0]}^FS`];
  if (values.length === 2) return [`^FT231,766^A0B,127,74^FH\\^FD${values[0]}-${values[1]}^FS`];
  if (values.length === 3) return [
    `^FT236,710^A0B,54,60^FH\\^FD${values[0]}-${values[1]}^FS`,
    `^FT158,712^A0B,54,60^FH\\^FD${values[2]}^FS`
  ];
  if (values.length === 4) return [
    `^FT236,710^A0B,54,60^FH\\^FD${values[0]}-${values[1]}^FS`,
    `^FT158,712^A0B,54,60^FH\\^FD${values[2]}-${values[3]}^FS`
  ];
  if (values.length === 5) return [
    `^FT237,764^A0B,54,48^FH\\^FD${values[0]}-${values[1]}-${values[2]}^FS`,
    `^FT156,763^A0B,54,48^FH\\^FD${values[3]}-${values[4]}^FS`
  ];
  if (values.length >= 6) return [
    `^FT237,764^A0B,54,48^FH\\^FD${values[0]}-${values[1]}-${values[2]}^FS`,
    `^FT156,763^A0B,54,48^FH\\^FD${values[3]}-${values[4]}-${values[5]}^FS`
  ];
  return [];
};

const fittedCaliberSize = (size, value) => {
  const length = Math.max(trim(value).length, 1);
  // El diseño GeneXus reserva tres caracteres por calibre y un guion entre ellos.
  // Al conservar esa proporción, el texto ocupa como máximo el bloque asignado.
  const caliberCount = trim(value).split('-').length;
  const reservedCharacters = (caliberCount * 3) + (caliberCount - 1);
  const scale = Math.min(1, reservedCharacters / length);
  return [Math.max(1, Math.round(size[0] * scale)), Math.max(1, Math.round(size[1] * scale))];
};

const caliberField = (position, size, value) => {
  const [height, width] = fittedCaliberSize(size, value);
  return `^FT${position}^A0B,${height},${width}^FH\\^FD${value}^FS`;
};

const caliberLines = (calibers, parameters, dimensions) => {
  const values = calibers.slice(0, 6).map(safeZpl);
  const count = Math.min(Math.max(values.length, 1), 6);
  const configuredSize = dimensions || parameters.get(count) || DEFAULT_DIMENSIONS[count];
  // Se deja margen respecto del rótulo CALIBRE/SIZE, especialmente en la tercera fila.
  const rowPositions = [493, 425, 367];

  if (count === 1) return [caliberField('457,1519', configuredSize, values[0] || '')];

  // Dos o tres calibres se apilan en una misma columna, sin concatenarlos.
  if (count <= 3) {
    const maxHeight = count === 3 ? 54 : 65;
    const size = [Math.min(configuredSize[0], maxHeight), Math.min(configuredSize[1], 79)];
    return values.map((value, index) => caliberField(`${rowPositions[index]},1519`, size, value));
  }

  // Desde cuatro calibres se usan dos columnas de hasta tres filas cada una.
  // La fuente conserva el ancho necesario para un código de cuatro caracteres.
  const size = [54, 56];
  const firstColumnCount = Math.ceil(count / 2);
  const lines = values.slice(0, firstColumnCount)
    .map((value, index) => caliberField(`${rowPositions[index]},1520`, size, value));
  lines.push(...values.slice(firstColumnCount)
    .map((value, index) => caliberField(`${rowPositions[index]},1340`, size, value)));
  return lines;
};

const buildLabelZpl = (label) => {
  const lines = [
    '\u0010CT~~CD,~CC^~CT~',
    '^XA~TA000~JSN^LT0^MNW^MTD^PON^PMN^LH0,0^JMA^PR2,2~SD15^JUS^LRN^CI0^XZ',
    '^XA', '^MMT', '^PW799', '^LL1558', '^LS0',
    '^FO46,30^GB741,1509,8^FS', '^FO274,33^GB0,1503,12^FS', '^FO521,28^GB0,1502,13^FS',
    '^FO280,1168^GB242,0,10^FS', '^FO287,387^GB242,0,10^FS', '^FO51,774^GB479,0,7^FS',
    '^FT80,1261^A0B,28,28^FH\\^FDESPECIE/SPECIES^FS',
    '^FT79,514^A0B,28,28^FH\\^FDVARIEDAD/VARIETY^FS',
    '^FT322,1442^A0B,28,28^FH\\^FDCALIBRE/SIZE^FS',
    '^FT322,1055^A0B,28,28^FH\\^FDCAJAS/BOXES^FS',
    '^FT319,671^A0B,28,28^FH\\^FDPACKING/TYPE^FS',
    '^FT317,274^A0B,28,28^FH\\^FDNET/WEIGHT^FS',
    ...varietyLines(label.varieties),
    `^FT232,1509^A0B,138,158^FH\\^FD${safeZpl(label.species)}^FS`,
    `^FT439,366^A0B,87,98^FH\\^FD${formatWeight(label.weight)}KG^FS`,
    `^FT468,1106^A0B,138,158^FH\\^FD${Math.trunc(label.boxes)}^FS`,
    ...caliberLines(label.calibers, new Map(), [label.dimensions.largo, label.dimensions.ancho]),
    '^FT454,767^A0B,93,105^FH\\^FDLA VI\\A5A^FS',
    '^FT567,988^A0B,28,28^FH\\^FDCODIGO PALLET / PALLET NUMBER^FS',
    '^BY7,3,130^FT718,1500^BCB,,N,N',
    `^FD>;${safeZpl(label.folio)}^FS`,
    '^FT562,292^BQN,2,7', '^FH\\^FDMA,www.lavinasa.cl^FS',
    `^FT700,800^A0B,93,105^FH\\^FD${safeZpl(label.folio)}^FS`,
    `^PQ${formatCopies(label.copies)},0,1,Y^XZ`
  ];
  return lines.join('\n');
};

const buildLabel = (header, details, parameters) => {
  const label = labelData(header, details, parameters);
  label.zpl = buildLabelZpl(label);
  return label;
};

const getActiveSeason = async (empCod, pool) => {
  const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
    SELECT TOP 1 RTRIM(TempCod) AS TempCod
    FROM dbo.TEMP01
    WHERE EmpCod=@EmpCod AND TempActiva=1
    ORDER BY TempFecAbre DESC,TempCod DESC;
  `);
  if (!result.recordset.length) throw new ImpVentanaError(409, 'ACTIVE_SEASON_NOT_FOUND', 'No existe una temporada activa para la empresa.');
  return trim(result.recordset[0].TempCod);
};

const loadParameters = async (empCod, pool) => {
  const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
    SELECT PAR1Cod,PAR1Valor1,PAR1Valor2
    FROM dbo.PARAMGE1
    WHERE EmpCod=@EmpCod AND PARCod=10 AND PAR1Cod IN (1,2);
  `);
  const parameters = new Map();
  let copies = 1;
  let dimensions = DEFAULT_DIMENSIONS[1];
  for (const row of result.recordset || []) {
    const code = Number(row.PAR1Cod);
    const values = [numberValue(row.PAR1Valor1), numberValue(row.PAR1Valor2)];
    if (code === 2) dimensions = values;
    if (code === 1) copies = formatCopies(row.PAR1Valor1);
  }
  for (let count = 1; count <= 6; count += 1) parameters.set(count, dimensions);
  parameters.copies = copies;
  return parameters;
};

const getPrinters = async (empCod, pool, printerId = null) => {
  const request = pool.request().input('EmpCod', sql.SmallInt, empCod);
  let filter = '';
  if (printerId != null) {
    request.input('PrinterId', sql.SmallInt, positiveInteger(printerId, 'Impresora'));
    filter = ' AND i.CIMPID=@PrinterId';
  }
  const result = await request.query(`
    SELECT i.CIMPID AS id,LTRIM(RTRIM(i.CIMPNombre)) AS name,LTRIM(RTRIM(i.CIMPIP)) AS ip
    FROM dbo.ConfImpresoras i
    WHERE i.EmpCod=@EmpCod${filter}
    ORDER BY i.CIMPID;
  `);
  return (result.recordset || []).map((row) => ({ id: Number(row.id), name: trim(row.name), ip: trim(row.ip) }));
};

const getPrintWindowConfig = async (empCod, { poolProvider = getPool, workerEnabled = process.env.PRINT_WORKER_ENABLED === 'true' } = {}) => {
  const pool = await poolProvider();
  const tempCod = await getActiveSeason(empCod, pool);
  const printers = await getPrinters(empCod, pool);
  const parameter = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
    SELECT TOP 1 PAR1Valor1
    FROM dbo.PARAMGE1
    WHERE EmpCod=@EmpCod AND PARCod=20 AND PAR1Cod=10;
  `);
  return {
    tempCod,
    workerEnabled: Boolean(workerEnabled),
    printers,
    defaultPrinterId: printers.find((printer) => printer.ip)?.id || printers[0]?.id || null,
    swCuartel: Number(parameter.recordset[0]?.PAR1Valor1 || 0) === 1
  };
};

const loadPrintLabels = async (empCod, folios, { poolProvider = getPool } = {}) => {
  const normalizedFolios = normalizeFolios(folios);
  const pool = await poolProvider();
  const tempCod = await getActiveSeason(empCod, pool);
  const request = pool.request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod);
  const names = normalizedFolios.map((folio, index) => {
    const name = `Folio${index}`;
    request.input(name, sql.Char(10), folio);
    return `@${name}`;
  });
  const result = await request.query(`
    SELECT h.FPFolio AS folio,h.FPEspe AS speciesCode,RTRIM(e.EspeNom) AS speciesName,
      h.ExpCod AS exporterCode,RTRIM(x.ExpNom) AS exporterName,h.FPFechaIng AS entryDate
    FROM dbo.FOLIOSPROC h
    LEFT JOIN dbo.ESPECIES e ON e.EmpCod=h.EmpCod AND e.Especod=h.FPEspe
    LEFT JOIN dbo.EXPORT1 x ON x.EmpCod=h.EmpCod AND x.ExpCod=h.ExpCod
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.FPFolio IN (${names.join(',')});

    SELECT d.FPFolio AS folio,d.FP2NProc AS lot,d.FP2Cor AS correlation,d.fp2varcod AS varietyCode,
      RTRIM(v.VarNom) AS varietyName,d.Calibre AS caliber,d.EnvCod AS containerCode,
      RTRIM(env.EnvNom) AS containerName,COALESCE(env.EnvPesoSag,env.EnvPeso) AS envPesoSag,
      env.EnvPeso AS envPeso,d.FP2Cajas AS boxes,d.CuarCod AS cuartelCode
    FROM dbo.FOLIOSPROC1 d
    LEFT JOIN dbo.ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.fp2especod AND v.VarCod=d.fp2varcod
    LEFT JOIN dbo.ENVCAT env ON env.EmpCod=d.EmpCod AND env.EnvCod=d.EnvCod
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.FPFolio IN (${names.join(',')})
    ORDER BY d.FPFolio,d.fp2varcod,d.FP2NProc,d.FP2Cor;
  `);
  const headers = new Map((result.recordsets[0] || []).map((row) => [trim(row.folio), row]));
  const details = new Map();
  for (const row of result.recordsets[1] || []) {
    const key = trim(row.folio);
    if (!details.has(key)) details.set(key, []);
    details.get(key).push(row);
  }
  const missing = normalizedFolios.filter((folio) => !headers.has(folio));
  if (missing.length) throw new ImpVentanaError(404, 'PRINT_FOLIO_NOT_FOUND', `No existe(n) el/los folio(s): ${missing.join(', ')}.`);
  const parameters = await loadParameters(empCod, pool);
  return normalizedFolios.map((folio) => buildLabel(headers.get(folio), details.get(folio) || [], parameters));
};

const printFolios = async (empCod, payload = {}, dependencies = {}) => {
  const poolProvider = dependencies.poolProvider || getPool;
  const pool = await poolProvider();
  const tempCod = await getActiveSeason(empCod, pool);
  const labels = await loadPrintLabels(empCod, payload.folios, { ...dependencies, poolProvider: async () => pool });
  const printers = await getPrinters(empCod, pool, payload.printerId ?? null);
  const printer = printers.find((item) => item.ip);
  if (!printer)
    throw new ImpVentanaError(
      409,
      'PRINT_PRINTER_NOT_CONFIGURED',
      'No hay una impresora de red configurada. Registre la Zebra GK420t con su dirección IP antes de imprimir.'
    );

  const printerClient = dependencies.printerClient || { sendZpl };
  let sent = 0;
  try {
    for (const label of labels) {
      await printerClient.sendZpl({
        host: printer.ip,
        port: Number(process.env.PRINT_PORT || 9100),
        timeoutMs: Number(process.env.PRINT_TIMEOUT_MS || 5000),
        zpl: label.zpl
      });
      sent += 1;
    }
  } catch (error) {
    const delivered = sent ? ` Se enviaron ${sent} etiqueta(s) antes del error.` : '';
    throw new ImpVentanaError(502, 'PRINT_DELIVERY_FAILED', `No se pudo enviar la etiqueta a ${printer.name || printer.ip}: ${error.message}.${delivered}`);
  }
  return { mode: 'direct', sent, printer, tempCod };
};

module.exports = {
  permission,
  PRINT_STATUS,
  ImpVentanaError,
  buildLabelZpl,
  labelData,
  listPrintWindow: (empCod, query, dependencies = {}) => listTarjas(empCod, query, dependencies),
  getPrintWindowConfig,
  loadPrintLabels,
  printFolios,
  normalizeFolios
};

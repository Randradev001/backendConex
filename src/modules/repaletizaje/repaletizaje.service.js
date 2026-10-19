const { getPool, sql } = require('../../conectorMysql/conectorSqlServer');
const { nextCorrelative } = require('../../services/gxCorrelatives.service');
const { renderRepaletizajePdf } = require('./repaletizaje.pdf');

const permission = { sistema: 100, modulo: 20, programa: 2 };

class RepaletizajeError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const trim = (value) => String(value ?? '').trim();

// PS_SALREP01 is the temporary pool used by RepSubir.  GeneXus relates a
// pool row to the selected folio detail by these attributes (buscaCorr), not
// by requiring the folio to already exist in REPALETIZAJE2.
const raiseAttributeKey = (row) => [
  Number(row.species || 0),
  Number(row.variety || 0),
  trim(row.product).toUpperCase(),
  Number(row.container || 0),
  Number(row.category || 0),
  trim(row.caliber).toUpperCase()
].join('|');

// The selector exposes the inspected folio balance from Sol3CajasDes. If a
// PS_SALREP01 row is not present for the current session, keep that same
// balance in the detail grid instead of showing a misleading zero.
const sourceRaiseAvailableBoxes = (row) => Math.max(0, Number(
  row.discountedBoxes ?? row.totalBoxes ?? row.originalBoxes ?? 0
));

const mergeRaisePoolAvailability = (details = [], poolRows = []) => {
  const poolByAttributes = new Map();
  for (const poolRow of poolRows) {
    const key = raiseAttributeKey(poolRow);
    const current = poolByAttributes.get(key) || { reservedBoxes: 0, occupiedBoxes: 0 };
    current.reservedBoxes += Number(poolRow.reservedBoxes || 0);
    current.occupiedBoxes += Number(poolRow.occupiedBoxes || 0);
    poolByAttributes.set(key, current);
  }
  return details.map((row) => {
    const poolTotals = poolByAttributes.get(raiseAttributeKey(row));
    if (poolTotals) {
      return { ...row, reservedBoxes: poolTotals.reservedBoxes, occupiedBoxes: poolTotals.occupiedBoxes };
    }
    const existingReserved = Number(row.reservedBoxes || 0);
    const existingOccupied = Number(row.occupiedBoxes || 0);
    if (existingReserved > 0 || existingOccupied > 0) {
      return {
        ...row,
        availableBoxes: Math.max(0, existingReserved - existingOccupied)
      };
    }
    const fallbackAvailable = sourceRaiseAvailableBoxes(row);
    return {
      ...row,
      reservedBoxes: fallbackAvailable,
      occupiedBoxes: 0,
      availableBoxes: fallbackAvailable
    };
  });
};

const aggregateRaisePoolRows = (poolRows = []) => {
  const rowsByAttributes = new Map();
  for (const poolRow of poolRows) {
    const key = raiseAttributeKey(poolRow);
    const current = rowsByAttributes.get(key);
    if (!current) {
      rowsByAttributes.set(key, {
        ...poolRow,
        reservedBoxes: Number(poolRow.reservedBoxes || 0),
        occupiedBoxes: Number(poolRow.occupiedBoxes || 0)
      });
      continue;
    }
    current.reservedBoxes += Number(poolRow.reservedBoxes || 0);
    current.occupiedBoxes += Number(poolRow.occupiedBoxes || 0);
  }
  return Array.from(rowsByAttributes.values());
};

// The XPZ displays the PSR pool as the editable grid.  A pool row can be
// mapped to the selected folio detail by attributes, or become a new
// correlativo when that folio does not have the same detail yet.
const buildRaiseDetails = (sourceDetails = [], poolRows = []) => {
  if (!poolRows.length) return mergeRaisePoolAvailability(sourceDetails, poolRows);
  const aggregatedPoolRows = aggregateRaisePoolRows(poolRows);
  // The selected folio is the identity of the grid. Do not replace its
  // details with unrelated rows from the current repaletizaje pool; only
  // overlay a PSR balance when the business attributes match.
  if (sourceDetails.length) {
    const poolByAttributes = new Map(aggregatedPoolRows.map((row) => [raiseAttributeKey(row), row]));
    const mappedSourceDetails = sourceDetails.map((source) => {
      const poolRow = poolByAttributes.get(raiseAttributeKey(source));
      if (poolRow) {
        const reservedBoxes = Number(poolRow.reservedBoxes || 0);
        const occupiedBoxes = Number(poolRow.occupiedBoxes || 0);
        return {
          ...source,
          reservedBoxes,
          occupiedBoxes,
          availableBoxes: Math.max(0, reservedBoxes - occupiedBoxes)
        };
      }
      const fallbackAvailable = sourceRaiseAvailableBoxes(source);
      return {
        ...source,
        reservedBoxes: fallbackAvailable,
        occupiedBoxes: 0,
        availableBoxes: fallbackAvailable
      };
    });
    const detailsByCorr = new Map();
    for (const detail of mappedSourceDetails) {
      const corr = Number(detail.corr || 0);
      if (!detailsByCorr.has(corr)) detailsByCorr.set(corr, detail);
    }
    return Array.from(detailsByCorr.values());
  }
  const sourceByAttributes = new Map();
  for (const source of sourceDetails) {
    const key = raiseAttributeKey(source);
    if (!sourceByAttributes.has(key)) sourceByAttributes.set(key, source);
  }
  // buscaCorr starts Correl at zero and increments only when no source detail
  // matches the pool row; preserve that XPZ sequence for new details.
  let correl = 0;
  const mappedDetails = aggregatedPoolRows.map((poolRow) => {
    const source = sourceByAttributes.get(raiseAttributeKey(poolRow));
    const corr = source ? Number(source.corr) : ++correl;
    if (source) correl = corr;
    const reservedBoxes = Number(poolRow.reservedBoxes || 0);
    const occupiedBoxes = Number(poolRow.occupiedBoxes || 0);
    return {
      ...(source || {}),
      corr,
      movementDate: source?.movementDate || null,
      species: Number(poolRow.species || source?.species || 0),
      variety: Number(poolRow.variety || source?.variety || 0),
      varietyName: trim(source?.varietyName || poolRow.varietyName),
      product: trim(poolRow.product || source?.product),
      productName: trim(source?.productName || poolRow.productName),
      container: Number(poolRow.container || source?.container || 0),
      containerName: trim(source?.containerName || poolRow.containerName),
      category: Number(poolRow.category || source?.category || 0),
      categoryName: trim(source?.categoryName || poolRow.categoryName),
      caliber: trim(poolRow.caliber || source?.caliber),
      originalBoxes: Number(source?.originalBoxes || 0),
      originalKilos: Number(source?.originalKilos || 0),
      currentBoxes: Number(source?.currentBoxes ?? source?.repalletizedBoxes ?? 0),
      currentKilos: Number(source?.currentKilos ?? source?.repalletizedKilos ?? 0),
      discountedBoxes: Number(source?.discountedBoxes || 0),
      reservedBoxes,
      occupiedBoxes,
      availableBoxes: Math.max(0, reservedBoxes - occupiedBoxes) || sourceRaiseAvailableBoxes(source || poolRow)
    };
  });
  // REPALETIZAJE2 uses the correlativo as the detail identity.  A malformed
  // legacy join can still map two pool rows to the same correlativo even when
  // their raw attributes differ; never expose duplicate IDs to the grid or
  // allow the same detail to be submitted twice.
  const detailsByCorr = new Map();
  for (const detail of mappedDetails) {
    const corr = Number(detail.corr || 0);
    if (!detailsByCorr.has(corr)) detailsByCorr.set(corr, detail);
  }
  return Array.from(detailsByCorr.values());
};

const localIsoDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const isoDate = (value, label) => {
  const raw = trim(value);
  const displayMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const date = displayMatch
    ? `${displayMatch[3]}-${displayMatch[2]}-${displayMatch[1]}`
    : raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', `${label} debe ser una fecha válida.`);
  }
  return date;
};

const integer = (value, label, { optional = false, min = 0, max = 9999999999 } = {}) => {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', `${label} debe ser un número entero válido.`);
  }
  return parsed;
};

const defaultRange = (now = new Date()) => {
  const toDate = new Date(now);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 30);
  return { from: localIsoDate(fromDate), to: localIsoDate(toDate) };
};

const listFilters = (query = {}, now = new Date()) => {
  const defaults = defaultRange(now);
  const from = isoDate(query.from || defaults.from, 'Fecha desde');
  const to = isoDate(query.to || defaults.to, 'Fecha hasta');
  if (from > to) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', 'La fecha desde no puede ser posterior a la fecha hasta.');
  }
  const statusValue = trim(query.status);
  const status = !statusValue || statusValue === '9' ? null : integer(statusValue, 'Estado', { max: 5 });
  if (status !== null && ![0, 1, 5].includes(status)) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', 'El estado seleccionado no es válido.');
  }
  return {
    from,
    to,
    status,
    repNum: integer(query.repNum, 'N° interno', { optional: true, min: 1 }),
    repNumF: integer(query.repNumF, 'N° repaletizaje', { optional: true, min: 1 }),
    page: integer(query.page ?? 1, 'Página', { min: 1, max: 100000 }),
    pageSize: integer(query.pageSize ?? 25, 'Tamaño de página', { min: 1, max: 100 })
  };
};

const statusLabel = (status) => ({ 0: 'En proceso', 1: 'Finalizado', 5: 'Anulado' }[Number(status)] || 'Sin estado');

const activeSeason = async (request, empCod) => {
  const result = await request
    .input('EmpCod', sql.SmallInt, empCod)
    .query('SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC');
  const tempCod = result.recordset[0]?.tempCod;
  if (!tempCod) throw new RepaletizajeError(409, 'ACTIVE_SEASON_NOT_FOUND', 'No existe una temporada activa para la empresa.');
  return tempCod;
};

const mapHeader = (row) => ({
  ...row,
  id: `${row.empCod}|${trim(row.tempCod)}|${row.repNum}`,
  status: Number(row.status),
  statusName: statusLabel(row.status),
  repNum: Number(row.repNum),
  repNumF: row.repNumF === null || row.repNumF === undefined ? null : Number(row.repNumF)
});

const mapFolio = (row) => ({
  ...row,
  id: `${trim(row.folio)}|${row.repNum}`,
  folio: trim(row.folio),
  speciesCode: row.speciesCode === null || row.speciesCode === undefined ? null : Number(row.speciesCode),
  originalBoxes: Number(row.originalBoxes || 0),
  repalletizedBoxes: Number(row.repalletizedBoxes || 0),
  discountedBoxes: Number(row.discountedBoxes || 0)
});

const text = (value, label, { required = false, max = 255 } = {}) => {
  const parsed = trim(value);
  if (required && !parsed) throw new RepaletizajeError(400, 'VALIDATION_ERROR', `${label} es obligatorio.`);
  if (parsed.length > max) throw new RepaletizajeError(400, 'VALIDATION_ERROR', `${label} supera el largo permitido.`);
  return parsed;
};

const decimal = (value, label, { optional = false, min = 0, max = 9999999999 } = {}) => {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', `${label} debe ser un número válido.`);
  }
  return parsed;
};

const normalizeLine = (line, index) => ({
  corr: integer(line.corr, `Correlativo ${index + 1}`, { min: 1, max: 32767 }),
  boxes: integer(line.boxes, `Cajas ${index + 1}`, { min: 1, max: 32767 }),
  product: text(line.product, `Producto ${index + 1}`, { required: true, max: 6 }),
  species: integer(line.species, `Especie ${index + 1}`, { min: 0, max: 32767 }),
  variety: integer(line.variety, `Variedad ${index + 1}`, { min: 0, max: 2147483647 }),
  container: integer(line.container, `Envase ${index + 1}`, { min: 0, max: 32767 }),
  category: integer(line.category, `Categoría ${index + 1}`, { min: 0, max: 32767 }),
  caliber: text(line.caliber, `Calibre ${index + 1}`, { max: 10 }),
  movementDate: line.movementDate ? isoDate(line.movementDate, `Fecha ${index + 1}`) : null,
  originalBoxes: integer(line.originalBoxes ?? 0, `Cajas originales ${index + 1}`, { min: 0, max: 32767 }),
  originalKilos: decimal(line.originalKilos ?? 0, `Kilos originales ${index + 1}`, { min: 0 }),
  repalletizedKilos: decimal(line.repalletizedKilos ?? 0, `Kilos repaletizados ${index + 1}`, { min: 0 })
});

const normalizeFolio = (item, index) => {
  const folio = text(item.folio, `Folio ${index + 1}`, { required: true, max: 10 });
  if (!Array.isArray(item.lines) || !item.lines.length) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', `El folio ${folio} debe tener al menos un detalle.`);
  }
  const lines = item.lines.map(normalizeLine);
  const correlations = new Set();
  lines.forEach((line) => {
    if (correlations.has(line.corr)) throw new RepaletizajeError(409, 'DUPLICATE_DETAIL', `El correlativo ${line.corr} está repetido en el folio ${folio}.`);
    correlations.add(line.corr);
  });
  return {
    folio,
    heightCode: integer(item.heightCode ?? 0, `Altura del folio ${folio}`, { min: 0, max: 32767 }),
    baseCode: integer(item.baseCode ?? 0, `Base del folio ${folio}`, { min: 0, max: 32767 }),
    lines
  };
};

// RepAgregar in GX8 creates a new output folio from the temporary PSR pool.
// It must not be confused with Rep01's initial selection of inspection folios.
const normalizeNewFolioPayload = (payload = {}) => {
  const folio = text(payload.folio, 'Folio', { required: true, max: 10 });
  if (!/^\d{1,10}$/.test(folio)) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', 'El folio debe contener solo números (máximo 10 dígitos).');
  }
  const requestNumber = integer(payload.requestNumber ?? payload.nsol, 'N° solicitud', { min: 1, max: 9999999999 });
  const heightCode = integer(payload.heightCode ?? 0, `Altura del folio ${folio}`, { min: 0, max: 32767 });
  const baseCode = integer(payload.baseCode ?? 0, `Base del folio ${folio}`, { min: 0, max: 32767 });
  if (!Array.isArray(payload.lines) || !payload.lines.length) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', `El folio ${folio} debe tener al menos un detalle de cajas.`);
  }
  const lines = payload.lines.map((line, index) => ({
    corr: integer(line.corr ?? index + 1, `Correlativo ${index + 1}`, { min: 1, max: 32767 }),
    boxes: integer(line.boxes, `Cajas a subir ${index + 1}`, { min: 1, max: 32767 }),
    species: integer(line.species, `Especie ${index + 1}`, { min: 0, max: 32767 }),
    variety: integer(line.variety, `Variedad ${index + 1}`, { min: 0, max: 2147483647 }),
    product: text(line.product, `Producto ${index + 1}`, { required: true, max: 6 }),
    container: integer(line.container, `Envase ${index + 1}`, { min: 0, max: 32767 }),
    category: integer(line.category, `Categoría ${index + 1}`, { min: 0, max: 32767 }),
    caliber: text(line.caliber, `Calibre ${index + 1}`, { max: 10 })
  }));
  const correlations = new Set();
  const attributes = new Set();
  lines.forEach((line) => {
    if (correlations.has(line.corr)) throw new RepaletizajeError(409, 'DUPLICATE_DETAIL', `El correlativo ${line.corr} está repetido en el folio ${folio}.`);
    correlations.add(line.corr);
    const key = `${line.species}|${line.variety}|${line.product}|${line.container}|${line.category}|${line.caliber}`;
    if (attributes.has(key)) throw new RepaletizajeError(409, 'DUPLICATE_DETAIL', `El detalle del folio ${folio} está repetido.`);
    attributes.add(key);
  });
  return { mode: 'new', folio, requestNumber, heightCode, baseCode, lines };
};

const normalizeSavePayload = (payload = {}) => {
  const date = isoDate(payload.date, 'Fecha');
  const daCod = integer(payload.daCod, 'Autorizador', { min: 1, max: 32767 });
  if (!Array.isArray(payload.folios) || !payload.folios.length) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', 'Debe seleccionar al menos un folio.');
  }
  const folios = payload.folios.map(normalizeFolio);
  const seen = new Set();
  folios.forEach((item) => {
    if (seen.has(item.folio)) throw new RepaletizajeError(409, 'DUPLICATE_FOLIO', `El folio ${item.folio} está repetido.`);
    seen.add(item.folio);
  });
  return { date, daCod, folios };
};

const normalizeLowerPayload = (payload = {}) => {
  const folio = text(payload.folio, 'Folio', { required: true, max: 10 });
  if (!Array.isArray(payload.lines) || !payload.lines.length) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', `El folio ${folio} debe tener al menos un detalle para bajar cajas.`);
  }
  const lines = payload.lines.map((line, index) => ({
    corr: integer(line.corr, `Correlativo ${index + 1}`, { min: 1, max: 32767 }),
    boxes: integer(line.boxes, `Cajas a bajar ${index + 1}`, { min: 1, max: 32767 })
  }));
  const correlations = new Set();
  lines.forEach((line) => {
    if (correlations.has(line.corr)) throw new RepaletizajeError(409, 'DUPLICATE_DETAIL', `El correlativo ${line.corr} está repetido en el folio ${folio}.`);
    correlations.add(line.corr);
  });
  return { folio, lines };
};

const normalizeRaisePayload = (payload = {}) => {
  const folio = text(payload.folio, 'Folio', { required: true, max: 10 });
  if (!Array.isArray(payload.lines) || !payload.lines.length) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', `El folio ${folio} debe tener al menos un detalle para subir cajas.`);
  }
  const lines = payload.lines.map((line, index) => {
    const attributeFields = ['species', 'variety', 'product', 'container', 'category', 'caliber'];
    const hasAttributes = attributeFields.some((field) => line[field] !== undefined && line[field] !== null);
    const hasAllAttributes = attributeFields.every((field) => line[field] !== undefined && line[field] !== null);
    if (hasAttributes && !hasAllAttributes) {
      throw new RepaletizajeError(400, 'VALIDATION_ERROR', `El detalle ${index + 1} debe incluir todos sus atributos.`);
    }
    return {
      corr: integer(line.corr, `Correlativo ${index + 1}`, { min: 1, max: 32767 }),
      boxes: integer(line.boxes, `Cajas a subir ${index + 1}`, { min: 1, max: 32767 }),
      ...(hasAllAttributes ? {
        species: integer(line.species, `Especie ${index + 1}`, { min: 0, max: 32767 }),
        variety: integer(line.variety, `Variedad ${index + 1}`, { min: 0, max: 2147483647 }),
        product: text(line.product, `Producto ${index + 1}`, { max: 6 }),
        container: integer(line.container, `Envase ${index + 1}`, { min: 0, max: 32767 }),
        category: integer(line.category, `Categoría ${index + 1}`, { min: 0, max: 32767 }),
        caliber: text(line.caliber, `Calibre ${index + 1}`, { max: 10 })
      } : {})
    };
  });
  const correlations = new Set();
  lines.forEach((line) => {
    if (correlations.has(line.corr)) throw new RepaletizajeError(409, 'DUPLICATE_DETAIL', `El correlativo ${line.corr} está repetido en el folio ${folio}.`);
    correlations.add(line.corr);
  });
  return { folio, lines };
};

const editorData = async (empCod) => {
  const pool = await getPool();
  const request = pool.request();
  const tempCod = await activeSeason(request, empCod);
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .query(`
      SELECT DACod code,RTRIM(DANombre) name
      FROM DESPAAUTO WHERE EmpCod=@EmpCod AND ISNULL(DAVig,0)=1 ORDER BY DANombre,DACod;
      SELECT TAlCod code,RTRIM(TAlDesc) name FROM TIPALT WHERE EmpCod=@EmpCod ORDER BY TAlCod;
      SELECT TBPCod code,RTRIM(TBPDesc) name FROM TIPBPA WHERE EmpCod=@EmpCod ORDER BY TBPCod;
      SELECT TOP 1 RTRIM(EmpNom) companyName,ISNULL(EmpTReg,0) exportData FROM DEFEMP WHERE EmpCod=@EmpCod;
      SELECT s.SolNum solNum,COALESCE(h.SolnumI,s.SolNum) requestNumber,RTRIM(s.Sol2Folio) folio,
        s.Sol2Espe speciesCode,RTRIM(e.EspeNom) speciesName,s.Sol2CAlt heightCode,s.Sol2CBase baseCode,
        SUM(ISNULL(d.Sol3CajasDes,0)-ISNULL(d.Sol3CajasRep,0)) availableBoxes
      FROM SOLICITUDES2 s
      JOIN SOLICITUDES1 h ON h.EmpCod=s.EmpCod AND h.TempCod=s.TempCod AND h.SolNum=s.SolNum
      LEFT JOIN ESPECIES e ON e.EmpCod=s.EmpCod AND e.Especod=s.Sol2Espe
      JOIN SOLICITUDES3 d ON d.EmpCod=s.EmpCod AND d.TempCod=s.TempCod AND d.SolNum=s.SolNum AND d.Sol2Folio=s.Sol2Folio
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND ISNULL(h.SolEstado,0)=1 AND ISNULL(s.Sol2Dispo,0)=0
        AND NOT EXISTS (
          SELECT 1
          FROM REPALETIZAJE1 r
          JOIN REPALETIZAJE rh ON rh.EmpCod=r.EmpCod AND rh.TempCod=r.TempCod AND rh.REPNum=r.REPNum
          WHERE r.EmpCod=s.EmpCod AND r.TempCod=s.TempCod AND r.REP0Fol=s.Sol2Folio
            AND ISNULL(rh.REPEstado,0)<>5
        )
      GROUP BY s.SolNum,h.SolnumI,s.Sol2Folio,s.Sol2Espe,e.EspeNom,s.Sol2CAlt,s.Sol2CBase
      HAVING SUM(ISNULL(d.Sol3CajasDes,0)-ISNULL(d.Sol3CajasRep,0))>0
      ORDER BY s.SolNum DESC,s.Sol2Folio;

      -- RepSubir in GX8 searches the inspected folio independently from the
      -- folio already present in the current repaletizaje.  Keep this list
      -- separate from the initial Rep01 list, which intentionally excludes
      -- active associations.
      SELECT s.SolNum solNum,COALESCE(h.SolnumI,s.SolNum) requestNumber,RTRIM(s.Sol2Folio) folio,
        s.Sol2Espe speciesCode,RTRIM(e.EspeNom) speciesName,s.Sol2CAlt heightCode,s.Sol2CBase baseCode,
        SUM(ISNULL(d.Sol3CajasDes,0)) availableBoxes
      FROM SOLICITUDES2 s
      JOIN SOLICITUDES1 h ON h.EmpCod=s.EmpCod AND h.TempCod=s.TempCod AND h.SolNum=s.SolNum
      LEFT JOIN ESPECIES e ON e.EmpCod=s.EmpCod AND e.Especod=s.Sol2Espe
      JOIN SOLICITUDES3 d ON d.EmpCod=s.EmpCod AND d.TempCod=s.TempCod AND d.SolNum=s.SolNum AND d.Sol2Folio=s.Sol2Folio
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND ISNULL(h.SolEstado,0)=1 AND ISNULL(s.Sol2Dispo,0)=0
      GROUP BY s.SolNum,h.SolnumI,s.Sol2Folio,s.Sol2Espe,e.EspeNom,s.Sol2CAlt,s.Sol2CBase
      HAVING SUM(ISNULL(d.Sol3CajasDes,0))>0
      ORDER BY s.SolNum DESC,s.Sol2Folio;

      SELECT s.SolNum solNum,COALESCE(h.SolnumI,s.SolNum) requestNumber,RTRIM(s.Sol2Folio) folio,
        s.Sol2Espe speciesCode,RTRIM(e.EspeNom) speciesName,s.Sol2CAlt heightCode,s.Sol2CBase baseCode,
        SUM(ISNULL(d.Sol3CajasRep,0)) repalletizedBoxes
      FROM SOLICITUDES2 s
      JOIN SOLICITUDES1 h ON h.EmpCod=s.EmpCod AND h.TempCod=s.TempCod AND h.SolNum=s.SolNum
      LEFT JOIN ESPECIES e ON e.EmpCod=s.EmpCod AND e.Especod=s.Sol2Espe
      JOIN SOLICITUDES3 d ON d.EmpCod=s.EmpCod AND d.TempCod=s.TempCod AND d.SolNum=s.SolNum AND d.Sol2Folio=s.Sol2Folio
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND ISNULL(h.SolEstado,0)=1 AND ISNULL(s.Sol2Dispo,0)=0
      GROUP BY s.SolNum,h.SolnumI,s.Sol2Folio,s.Sol2Espe,e.EspeNom,s.Sol2CAlt,s.Sol2CBase
      HAVING SUM(ISNULL(d.Sol3CajasRep,0))>0
      ORDER BY s.SolNum DESC,s.Sol2Folio;
    `);
  return {
    tempCod,
    companyName: result.recordsets[3]?.[0]?.companyName || '',
    exportData: Number(result.recordsets[3]?.[0]?.exportData || 0),
    authorizedBy: result.recordsets[0] || [],
    heights: result.recordsets[1] || [],
    bases: result.recordsets[2] || [],
    folios: result.recordsets[4] || [],
    raiseFolios: result.recordsets[5] || [],
    lowerFolios: result.recordsets[6] || []
  };
};

const addSource = async (empCod, loginValue, repNumValue) => {
  const login = text(loginValue, 'Usuario', { required: true, max: 20 });
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('Login', sql.Char(20), login)
    .input('RepNum', sql.Decimal(10, 0), repNum)
    .query(`
      SELECT TOP 1 REPEstado status
      FROM REPALETIZAJE WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;

      SELECT ps.PSR_Espe species, RTRIM(e.EspeNom) speciesName,
        ps.PSR_Var variety, RTRIM(v.VarNom) varietyName,
        RTRIM(ps.PSR_Prod) product, RTRIM(p.ProdNom) productName,
        ps.PSR_Env container, RTRIM(n.EnvNom) containerName,
        ps.PSR_Cat category, RTRIM(c.CatNom) categoryName,
        RTRIM(ps.PSR_Cal) caliber,
        ISNULL(ps.PSR_Cajas,0) totalBoxes, ISNULL(ps.PSR_CajasO,0) occupiedBoxes,
        CASE WHEN ISNULL(ps.PSR_Cajas,0)-ISNULL(ps.PSR_CajasO,0)>0
          THEN ISNULL(ps.PSR_Cajas,0)-ISNULL(ps.PSR_CajasO,0) ELSE 0 END availableBoxes
      FROM PS_SALREP01 ps
      LEFT JOIN ESPECIES e ON e.EmpCod=ps.EmpCod AND e.Especod=ps.PSR_Espe
      LEFT JOIN ESPECIES1 v ON v.EmpCod=ps.EmpCod AND v.Especod=ps.PSR_Espe AND v.VarCod=ps.PSR_Var
      LEFT JOIN PRODUCTORES p ON p.EmpCod=ps.EmpCod AND p.ProdCod=ps.PSR_Prod
      LEFT JOIN ENVCAT n ON n.EmpCod=ps.EmpCod AND n.EnvCod=ps.PSR_Env
      LEFT JOIN ENVCAT1 c ON c.EmpCod=ps.EmpCod AND c.EnvCod=ps.PSR_Env AND c.Catcod=ps.PSR_Cat
      WHERE ps.EmpCod=@EmpCod AND ps.TempCod=@TempCod AND ps.PSR_Login=@Login AND ps.PSR_NREp=@RepNum
        AND ISNULL(ps.PSR_Cajas,0)-ISNULL(ps.PSR_CajasO,0)>0
      ORDER BY ps.PSR_Espe,ps.PSR_Var,ps.PSR_Prod,ps.PSR_Env,ps.PSR_Cat,ps.PSR_Cal;
    `);
  if (!result.recordsets[0]?.[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
  if (Number(result.recordsets[0][0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'Solo se puede agregar un folio en un repaletizaje en proceso.');
  return {
    tempCod,
    rows: (result.recordsets[1] || []).map((row, index) => ({
      id: index + 1,
      corr: index + 1,
      species: Number(row.species || 0), speciesName: trim(row.speciesName),
      variety: Number(row.variety || 0), varietyName: trim(row.varietyName),
      product: trim(row.product), productName: trim(row.productName),
      container: Number(row.container || 0), containerName: trim(row.containerName),
      category: Number(row.category || 0), categoryName: trim(row.categoryName),
      caliber: trim(row.caliber), totalBoxes: Number(row.totalBoxes || 0),
      occupiedBoxes: Number(row.occupiedBoxes || 0), availableBoxes: Number(row.availableBoxes || 0), boxes: ''
    })),
    totalAvailableBoxes: (result.recordsets[1] || []).reduce((sum, row) => sum + Number(row.availableBoxes || 0), 0)
  };
};

const checkNewFolio = async (empCod, folioValue) => {
  const folio = text(folioValue, 'Folio', { required: true, max: 10 });
  if (!/^\d{1,10}$/.test(folio)) {
    throw new RepaletizajeError(400, 'VALIDATION_ERROR', 'El folio debe contener solo números (máximo 10 dígitos).');
  }
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('Folio', sql.Char(10), folio)
    .query(`
      SELECT TOP 1 1 found
      FROM SOLICITUDES2 s
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND s.SolNum>0 AND s.Sol2Folio=@Folio;

      SELECT TOP 1 r.REPNum associatedRepNum
      FROM REPALETIZAJE1 r
      JOIN REPALETIZAJE h ON h.EmpCod=r.EmpCod AND h.TempCod=r.TempCod AND h.REPNum=r.REPNum
      WHERE r.EmpCod=@EmpCod AND r.TempCod=@TempCod AND r.REP0Fol=@Folio AND ISNULL(h.REPEstado,0)<>5;
    `);
  const requestExists = Boolean(result.recordsets[0]?.[0]);
  const association = result.recordsets[1]?.[0];
  return {
    tempCod,
    folio,
    exists: requestExists || Boolean(association),
    existsInRequest: requestExists,
    associatedRepNum: association?.associatedRepNum == null ? null : Number(association.associatedRepNum)
  };
};

const sourceFolio = async (request, empCod, tempCod, folio) => {
  const result = await request
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('Folio', sql.Char(10), folio)
    .query(`
      SELECT TOP 1 rh.REPNum associatedRepNum
      FROM REPALETIZAJE1 r
      JOIN REPALETIZAJE rh ON rh.EmpCod=r.EmpCod AND rh.TempCod=r.TempCod AND rh.REPNum=r.REPNum
      WHERE r.EmpCod=@EmpCod AND r.TempCod=@TempCod AND r.REP0Fol=@Folio AND ISNULL(rh.REPEstado,0)<>5;

      SELECT TOP 1 s.SolNum solNum,COALESCE(h.SolnumI,s.SolNum) requestNumber,s.Sol2Espe speciesCode,
        s.Sol2CAlt heightCode,s.Sol2CBase baseCode,s.Sol2Dispo dispatched
      FROM SOLICITUDES2 s JOIN SOLICITUDES1 h ON h.EmpCod=s.EmpCod AND h.TempCod=s.TempCod AND h.SolNum=s.SolNum
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND s.Sol2Folio=@Folio
        AND ISNULL(h.SolEstado,0)=1
        AND ISNULL(s.Sol2Dispo,0)=0
        AND NOT EXISTS (
          SELECT 1
          FROM REPALETIZAJE1 r
          JOIN REPALETIZAJE rh ON rh.EmpCod=r.EmpCod AND rh.TempCod=r.TempCod AND rh.REPNum=r.REPNum
          WHERE r.EmpCod=s.EmpCod AND r.TempCod=s.TempCod AND r.REP0Fol=s.Sol2Folio
            AND ISNULL(rh.REPEstado,0)<>5
        );
      SELECT d.Sol3Corr corr,CONVERT(char(10),d.sol3fecha,23) movementDate,d.Sol3espe species,d.Sol3Var variety,
        RTRIM(v.VarNom) varietyName,d.Sol3prod product,RTRIM(p.ProdNom) productName,
        d.Sol3Env container,RTRIM(n.EnvNom) containerName,d.Sol3CaT category,RTRIM(c.CatNom) categoryName,RTRIM(d.Sol3Cal) caliber,
        ISNULL(d.Sol3CajasDes,0) totalBoxes,ISNULL(d.Sol3CajasRep,0) repalletizedBoxes,
        ISNULL(d.Sol3KilosDes,0) totalKilos,ISNULL(d.Sol3KilosRep,0) repalletizedKilos
      FROM SOLICITUDES3 d
      LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=d.Sol3prod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Sol3espe AND v.VarCod=d.Sol3Var
      LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Sol3Env
      LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.Sol3Env AND c.Catcod=d.Sol3CaT
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.Sol2Folio=@Folio
      ORDER BY d.Sol3Corr;
    `);
  if (result.recordsets[0]?.[0]) {
    throw new RepaletizajeError(409, 'FOLIO_ALREADY_ASSOCIATED', `El folio ${folio} ya está asociado a un repaletizaje.`);
  }
  const header = result.recordsets[1]?.[0];
  if (!header || Number(header.dispatched || 0) !== 0) {
    throw new RepaletizajeError(409, 'FOLIO_NOT_AVAILABLE', `El folio ${folio} no está disponible.`);
  }
  if (!result.recordsets[2]?.length) throw new RepaletizajeError(409, 'FOLIO_WITHOUT_DETAILS', `El folio ${folio} no tiene detalle.`);
  return { header, details: result.recordsets[2] };
};

const lowerSourceFolio = async (request, empCod, tempCod, folio) => {
  const result = await request
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('Folio', sql.Char(10), folio)
    .query(`
      SELECT TOP 1 s.SolNum solNum,COALESCE(h.SolnumI,s.SolNum) requestNumber,s.Sol2Espe speciesCode,
        s.Sol2CAlt heightCode,s.Sol2CBase baseCode,s.Sol2Dispo dispatched
      FROM SOLICITUDES2 s JOIN SOLICITUDES1 h ON h.EmpCod=s.EmpCod AND h.TempCod=s.TempCod AND h.SolNum=s.SolNum
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND s.Sol2Folio=@Folio
        AND ISNULL(h.SolEstado,0)=1 AND ISNULL(s.Sol2Dispo,0)=0;
      SELECT d.Sol3Corr corr,CONVERT(char(10),d.sol3fecha,23) movementDate,d.Sol3espe species,d.Sol3Var variety,
        RTRIM(v.VarNom) varietyName,d.Sol3prod product,RTRIM(p.ProdNom) productName,
        d.Sol3Env container,RTRIM(n.EnvNom) containerName,d.Sol3CaT category,RTRIM(c.CatNom) categoryName,RTRIM(d.Sol3Cal) caliber,
        ISNULL(d.Sol3Cajas,0) originalBoxes,ISNULL(d.Sol3Kilos,0) originalKilos,
        ISNULL(d.Sol3CajasRep,0) repalletizedBoxes,ISNULL(d.Sol3KilosRep,0) repalletizedKilos,
        ISNULL(d.Sol3CajasDes,0) discountedBoxes,ISNULL(d.Sol3KilosDes,0) discountedKilos
      FROM SOLICITUDES3 d
      LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=d.Sol3prod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Sol3espe AND v.VarCod=d.Sol3Var
      LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Sol3Env
      LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.Sol3Env AND c.Catcod=d.Sol3CaT
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.Sol2Folio=@Folio
        AND ISNULL(d.Sol3CajasRep,0)>0
      ORDER BY d.Sol3Corr;
    `);
  const header = result.recordsets[0]?.[0];
  if (!header || Number(header.dispatched || 0) !== 0) {
    throw new RepaletizajeError(409, 'FOLIO_NOT_AVAILABLE', `El folio ${folio} no está disponible para bajar cajas.`);
  }
  if (!result.recordsets[1]?.length) throw new RepaletizajeError(409, 'FOLIO_WITHOUT_REPALLETIZED_BOXES', `El folio ${folio} no tiene cajas repaletizadas para bajar.`);
  return { header, details: result.recordsets[1] };
};

const applyPendingLowerAdjustments = (details, pendingMovementByCorr = new Map()) => details.map((row) => {
  const corr = Number(row.corr || 0);
  const hasMovement = pendingMovementByCorr.has(corr);
  const movement = hasMovement ? Number(pendingMovementByCorr.get(corr) || 0) : 0;
  const discountedBoxes = Math.max(0, Number(row.discountedBoxes || row.originalBoxes || 0) + movement);
  return {
    ...row,
    // RepBajar loads Sol3CajasRep = PSRM_Cajas * -1 and then subtracts
    // that signed value from Sol3CajasDes.
    discountedBoxes,
    // With no pending PSRM movement the XPZ lets the operator lower up to
    // the current CajasDes balance.  Once a negative PSRM row exists, the
    // editable value is that staged amount (the legacy panel does not apply
    // the same detail twice in one session).
    lowerableBoxes: hasMovement
      ? movement < 0 ? Math.max(0, -movement) : 0
      : discountedBoxes
  };
});

const getSourceFolio = async (empCod, folioValue) => {
  const folio = text(folioValue, 'Folio', { required: true, max: 10 });
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const source = await sourceFolio(new sql.Request(pool), empCod, tempCod, folio);
  return {
    tempCod,
    header: source.header,
    details: source.details.map((row) => ({
      corr: Number(row.corr), movementDate: row.movementDate, species: Number(row.species || 0), variety: Number(row.variety || 0),
      varietyName: trim(row.varietyName), product: trim(row.product), productName: trim(row.productName),
      container: Number(row.container || 0), containerName: trim(row.containerName), category: Number(row.category || 0), categoryName: trim(row.categoryName), caliber: trim(row.caliber),
      totalBoxes: Number(row.totalBoxes || 0), repalletizedBoxes: Number(row.repalletizedBoxes || 0),
      availableBoxes: Math.max(0, Number(row.totalBoxes || 0) - Number(row.repalletizedBoxes || 0)),
      totalKilos: Number(row.totalKilos || 0), repalletizedKilos: Number(row.repalletizedKilos || 0)
    }))
  };
};

const getLowerSourceFolio = async (empCod, login, folioValue, repNumValue) => {
  const folio = text(folioValue, 'Folio', { required: true, max: 10 });
  const repNum = integer(repNumValue, 'N° interno', { optional: true, min: 1 });
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const source = await lowerSourceFolio(new sql.Request(pool), empCod, tempCod, folio);
  let pendingMovementByCorr = new Map();
  if (repNum !== null) {
    const pending = await new sql.Request(pool)
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TempCod', sql.Char(9), tempCod)
      .input('Login', sql.Char(20), text(login, 'Usuario', { required: true, max: 20 }))
      .input('RepNum', sql.Decimal(10, 0), repNum)
      .input('Folio', sql.Char(10), folio)
      .query(`
        SELECT PSRM_Corr corr, SUM(ISNULL(PSRM_Cajas,0)) movement
        FROM PS_SALREP02
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSRM_Login=@Login
          AND PSRM_Repa=@RepNum AND PSRM_Folio=@Folio
        GROUP BY PSRM_Corr;
      `);
    pendingMovementByCorr = new Map(pending.recordset.map((row) => [Number(row.corr), Number(row.movement || 0)]));
  }
  return {
    tempCod,
    header: source.header,
    details: applyPendingLowerAdjustments(source.details.map((row) => ({
      corr: Number(row.corr), movementDate: row.movementDate, species: Number(row.species || 0), variety: Number(row.variety || 0),
      varietyName: trim(row.varietyName), product: trim(row.product), productName: trim(row.productName),
      container: Number(row.container || 0), containerName: trim(row.containerName), category: Number(row.category || 0), categoryName: trim(row.categoryName), caliber: trim(row.caliber),
      originalBoxes: Number(row.originalBoxes || 0), originalKilos: Number(row.originalKilos || 0),
      repalletizedBoxes: Number(row.repalletizedBoxes || 0), repalletizedKilos: Number(row.repalletizedKilos || 0),
      discountedBoxes: Number(row.discountedBoxes || 0), discountedKilos: Number(row.discountedKilos || 0),
      lowerableBoxes: Number(row.repalletizedBoxes || 0)
    })), pendingMovementByCorr)
  };
};

const raiseSourceFolio = async (request, empCod, tempCod, login, repNum, folio) => {
  const result = await request
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('Login', sql.Char(20), login)
    .input('RepNum', sql.Decimal(10, 0), repNum)
    .input('Folio', sql.Char(10), folio)
    .query(`
      SELECT TOP 1 r.REP0Nsol requestNumber,r.REP0Calt heightCode,r.REP0CBase baseCode
      FROM REPALETIZAJE1 r
      WHERE r.EmpCod=@EmpCod AND r.TempCod=@TempCod AND r.REPNum=@RepNum AND r.REP0Fol=@Folio;
      SELECT TOP 1 1 negativeMovement
      FROM REPALETIZAJE2 d
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum AND d.REP0Fol=@Folio
        AND ISNULL(d.REP1CajasRep,0)<0;
      SELECT d.Rep1Corr corr,CONVERT(char(10),d.REP1FecPro,23) movementDate,
        d.REP1Espe species,d.Rep1Var variety,RTRIM(v.VarNom) varietyName,
        d.REP1Prod product,RTRIM(p.ProdNom) productName,d.Rep1Env container,RTRIM(n.EnvNom) containerName,
        d.Rep1Cat category,RTRIM(c.CatNom) categoryName,RTRIM(d.REP1Cal) caliber,
        ISNULL(s.Sol3Cajas,d.REP1CajasINS) originalBoxes,ISNULL(s.Sol3Kilos,d.REP1KilosINS) originalKilos,
        ISNULL(d.REP1CajasRep,0) currentBoxes,ISNULL(d.REP1KilosRep,0) currentKilos,
        ISNULL(ps.PSR_Cajas,0) reservedBoxes,ISNULL(ps.PSR_CajasO,0) occupiedBoxes
      FROM REPALETIZAJE2 d
      JOIN REPALETIZAJE1 r ON r.EmpCod=d.EmpCod AND r.TempCod=d.TempCod AND r.REPNum=d.REPNum AND r.REP0Fol=d.REP0Fol
      LEFT JOIN SOLICITUDES3 s ON s.EmpCod=r.EmpCod AND s.TempCod=r.TempCod AND s.SolNum=r.REP0Nsol
        AND s.Sol2Folio=r.REP0Fol AND s.Sol3Corr=d.Rep1Corr
      LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=d.REP1Prod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.REP1Espe AND v.VarCod=d.Rep1Var
      LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Rep1Env
      LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.Rep1Env AND c.Catcod=d.Rep1Cat
      LEFT JOIN PS_SALREP01 ps ON ps.EmpCod=d.EmpCod AND ps.TempCod=d.TempCod AND ps.PSR_Login=@Login AND ps.PSR_NREp=d.REPNum
        AND ps.PSR_Espe=d.REP1Espe AND ps.PSR_Var=d.Rep1Var AND ps.PSR_Prod=d.REP1Prod
        AND ps.PSR_Env=d.Rep1Env AND ps.PSR_Cat=d.Rep1Cat AND ps.PSR_Cal=d.REP1Cal
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum AND d.REP0Fol=@Folio
        AND d.Rep1Mov=1 AND ISNULL(d.REP1CajasRep,0)>0
      ORDER BY d.Rep1Corr;

    `);
  const header = result.recordsets[0]?.[0];
  if (!header) throw new RepaletizajeError(404, 'FOLIO_NOT_IN_REPALETIZAJE', `El folio ${folio} no pertenece al repaletizaje.`);
  if (result.recordsets[1]?.[0]) throw new RepaletizajeError(409, 'RAISE_NOT_ALLOWED', `El folio ${folio} tiene cajas bajadas en este repaletizaje y no permite subir cajas.`);
  if (!result.recordsets[2]?.length) throw new RepaletizajeError(409, 'FOLIO_WITHOUT_RESERVATION', `El folio ${folio} no tiene cajas reservadas para subir.`);
  return { header, details: result.recordsets[2] };
};

// RepSubir's source is the inspected folio, not only a folio already stored
// in the current repaletizaje.  This mirrors the two GX8 grids: the first
// reads SOLICITUDES3 (or a newly-created REPALETIZAJE2 folio), while the
// available quantity comes from the current PS_SALREP01 reservation.
const raiseSourceFolioXpz = async (request, empCod, tempCod, login, repNum, folio) => {
  const result = await request
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('Login', sql.Char(20), login)
    .input('RepNum', sql.Decimal(10, 0), repNum)
    .input('Folio', sql.Char(10), folio)
    .query(`
      SELECT TOP 1 s.SolNum solNum,COALESCE(h.SolnumI,s.SolNum) requestNumber,s.Sol2Espe speciesCode,
        s.Sol2CAlt heightCode,s.Sol2CBase baseCode,s.Sol2Dispo dispatched
      FROM SOLICITUDES2 s
      JOIN SOLICITUDES1 h ON h.EmpCod=s.EmpCod AND h.TempCod=s.TempCod AND h.SolNum=s.SolNum
      WHERE s.EmpCod=@EmpCod AND s.TempCod=@TempCod AND s.Sol2Folio=@Folio
        AND ISNULL(h.SolEstado,0)=1 AND ISNULL(s.Sol2Dispo,0)=0
      ORDER BY s.SolNum DESC;

      SELECT d.Sol3Corr corr,CONVERT(char(10),d.Sol3Fecha,23) movementDate,
        d.Sol3Espe species,d.Sol3Var variety,RTRIM(v.VarNom) varietyName,
        d.Sol3Prod product,RTRIM(p.ProdNom) productName,d.Sol3Env container,RTRIM(n.EnvNom) containerName,
        d.Sol3CaT category,RTRIM(c.CatNom) categoryName,RTRIM(d.Sol3Cal) caliber,
        ISNULL(d.Sol3Cajas,0) originalBoxes,ISNULL(d.Sol3Kilos,0) originalKilos,
        ISNULL(d.Sol3CajasRep,0) repalletizedBoxes,ISNULL(d.Sol3KilosRep,0) repalletizedKilos,
        ISNULL(d.Sol3CajasDes,0) discountedBoxes,ISNULL(d.Sol3KilosDes,0) discountedKilos,
        0 reservedBoxes,0 occupiedBoxes
      FROM SOLICITUDES3 d
      JOIN SOLICITUDES2 s ON s.EmpCod=d.EmpCod AND s.TempCod=d.TempCod AND s.SolNum=d.SolNum AND s.Sol2Folio=d.Sol2Folio
      JOIN SOLICITUDES1 h ON h.EmpCod=s.EmpCod AND h.TempCod=s.TempCod AND h.SolNum=s.SolNum
      LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=d.Sol3Prod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Sol3Espe AND v.VarCod=d.Sol3Var
      LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.Sol3Env
      LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.Sol3Env AND c.Catcod=d.Sol3CaT
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.Sol2Folio=@Folio
        AND ISNULL(h.SolEstado,0)=1 AND ISNULL(s.Sol2Dispo,0)=0
        AND s.SolNum=(
          SELECT TOP 1 s2.SolNum
          FROM SOLICITUDES2 s2
          JOIN SOLICITUDES1 h2 ON h2.EmpCod=s2.EmpCod AND h2.TempCod=s2.TempCod AND h2.SolNum=s2.SolNum
          WHERE s2.EmpCod=@EmpCod AND s2.TempCod=@TempCod AND s2.Sol2Folio=@Folio
            AND ISNULL(h2.SolEstado,0)=1 AND ISNULL(s2.Sol2Dispo,0)=0
          ORDER BY s2.SolNum DESC
        )
      ORDER BY d.Sol3Corr;

      SELECT TOP 1 r.REP0Nsol solNum,r.REP0Nsol requestNumber,r.REP0Espe speciesCode,r.REP0Calt heightCode,r.REP0CBase baseCode,0 dispatched
      FROM REPALETIZAJE1 r
      WHERE r.EmpCod=@EmpCod AND r.TempCod=@TempCod AND r.REPNum=@RepNum AND r.REP0Fol=@Folio;

      SELECT d.Rep1Corr corr,CONVERT(char(10),d.REP1FecPro,23) movementDate,
        d.REP1Espe species,d.Rep1Var variety,RTRIM(v.VarNom) varietyName,
        d.REP1Prod product,RTRIM(p.ProdNom) productName,d.REP1Env container,RTRIM(n.EnvNom) containerName,
        d.REP1Cat category,RTRIM(c.CatNom) categoryName,RTRIM(d.REP1Cal) caliber,
        ISNULL(d.REP1CajasINS,0) originalBoxes,ISNULL(d.REP1KilosINS,0) originalKilos,
        ISNULL(d.REP1CajasRep,0) repalletizedBoxes,ISNULL(d.REP1KilosRep,0) repalletizedKilos,
        ISNULL(d.REP1CajasDes,0) discountedBoxes,ISNULL(d.REP1KilosDes,0) discountedKilos,
        0 reservedBoxes,0 occupiedBoxes
      FROM REPALETIZAJE2 d
      LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=d.REP1Prod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.REP1Espe AND v.VarCod=d.REP1Var
      LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.REP1Env
      LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.REP1Env AND c.Catcod=d.REP1Cat
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum AND d.REP0Fol=@Folio
        AND d.Rep1Mov=1 AND ISNULL(d.REP1CajasRep,0)>0
      ORDER BY d.Rep1Corr;

      -- RepSubir's second GX8 grid is the PSR pool of the current
      -- repaletizaje.  It is deliberately independent of the selected folio:
      -- the selected folio only supplies the detail/correlative that is
      -- updated after buscaCorr matches these attributes.
      SELECT ps.PSR_Espe species,ps.PSR_Var variety,RTRIM(ps.PSR_Prod) product,
        RTRIM(v.VarNom) varietyName,RTRIM(p.ProdNom) productName,
        ps.PSR_Env container,RTRIM(n.EnvNom) containerName,ps.PSR_Cat category,
        RTRIM(c.CatNom) categoryName,RTRIM(ps.PSR_Cal) caliber,
        ISNULL(ps.PSR_Cajas,0) reservedBoxes,ISNULL(ps.PSR_CajasO,0) occupiedBoxes
      FROM PS_SALREP01 ps
      LEFT JOIN PRODUCTORES p ON p.EmpCod=ps.EmpCod AND p.ProdCod=ps.PSR_Prod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=ps.EmpCod AND v.Especod=ps.PSR_Espe AND v.VarCod=ps.PSR_Var
      LEFT JOIN ENVCAT n ON n.EmpCod=ps.EmpCod AND n.EnvCod=ps.PSR_Env
      LEFT JOIN ENVCAT1 c ON c.EmpCod=ps.EmpCod AND c.EnvCod=ps.PSR_Env AND c.Catcod=ps.PSR_Cat
      WHERE ps.EmpCod=@EmpCod AND ps.TempCod=@TempCod AND ps.PSR_Login=@Login AND ps.PSR_NREp=@RepNum
        AND ISNULL(ps.PSR_Cajas,0)>0;
    `);
  const requestHeader = result.recordsets[0]?.[0];
  const currentHeader = result.recordsets[2]?.[0];
  const header = requestHeader || currentHeader;
  const details = requestHeader ? result.recordsets[1] : result.recordsets[3];
  const poolRows = result.recordsets[4] || [];
  if (!header) throw new RepaletizajeError(404, 'FOLIO_NOT_AVAILABLE', `El folio ${folio} no está disponible para subir cajas.`);
  if (!details?.length && !poolRows.length) throw new RepaletizajeError(409, 'FOLIO_WITHOUT_RESERVATION', `El folio ${folio} no tiene cajas reservadas para subir.`);
  return { header, details, poolRows };
};

const getRaiseSourceFolio = async (empCod, loginValue, repNumValue, folioValue) => {
  const login = text(loginValue, 'Usuario', { required: true, max: 20 });
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const folio = text(folioValue, 'Folio', { required: true, max: 10 });
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const headerResult = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
    .query('SELECT TOP 1 REPEstado status FROM REPALETIZAJE WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
  if (!headerResult.recordset[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
  if (Number(headerResult.recordset[0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'Solo se pueden subir cajas en un repaletizaje en proceso.');
  const source = await raiseSourceFolioXpz(new sql.Request(pool), empCod, tempCod, login, repNum, folio);
  const detailsWithPool = buildRaiseDetails(source.details, source.poolRows);
  return {
    tempCod,
    header: source.header,
    details: detailsWithPool.map((row) => {
      // Do not depend on the SQL join's exact CHAR padding.  The XPZ
      // buscaCorr routine matches the PSR pool by the business attributes,
      // so normalize those values before exposing Cajas Disp. to the UI.
      const reservedBoxes = Number(row.reservedBoxes || 0);
      const occupiedBoxes = Number(row.occupiedBoxes || 0);
      const availableBoxes = row.availableBoxes === undefined || row.availableBoxes === null
        ? Math.max(0, reservedBoxes - occupiedBoxes)
        : Number(row.availableBoxes || 0);
      return {
        corr: Number(row.corr), movementDate: row.movementDate, species: Number(row.species || 0), variety: Number(row.variety || 0),
        varietyName: trim(row.varietyName), product: trim(row.product), productName: trim(row.productName),
        container: Number(row.container || 0), containerName: trim(row.containerName), category: Number(row.category || 0), categoryName: trim(row.categoryName), caliber: trim(row.caliber),
        originalBoxes: Number(row.originalBoxes || 0), originalKilos: Number(row.originalKilos || 0),
        currentBoxes: Number(row.currentBoxes ?? row.repalletizedBoxes ?? 0), currentKilos: Number(row.currentKilos ?? row.repalletizedKilos ?? 0),
        discountedBoxes: Number(row.discountedBoxes || 0), reservedBoxes, occupiedBoxes,
        availableBoxes
      };
    })
  };
};

const writeFolio = async (transaction, { empCod, tempCod, login, repNum, item }) => {
  const source = await sourceFolio(new sql.Request(transaction), empCod, tempCod, item.folio);
  const height = item.heightCode || Number(source.header.heightCode || 0);
  const base = item.baseCode || Number(source.header.baseCode || 0);
  let totalRepalletized = 0;
  let totalOriginal = 0;
  for (const line of item.lines) {
    const original = source.details.find((detail) => Number(detail.corr) === line.corr);
    if (!original) throw new RepaletizajeError(409, 'DETAIL_NOT_FOUND', `El correlativo ${line.corr} no existe en el folio ${item.folio}.`);
    const available = Math.max(0, Number(original.totalBoxes || 0) - Number(original.repalletizedBoxes || 0));
    if (line.boxes > available) {
      throw new RepaletizajeError(409, 'INSUFFICIENT_BOXES', `El folio ${item.folio}, correlativo ${line.corr}, solo tiene ${available} cajas disponibles.`);
    }
    const originalBoxes = line.originalBoxes || Number(original.totalBoxes || 0);
    const originalKilos = line.originalKilos || Number(original.totalKilos || 0);
    const existing = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod)
      .input('Login', sql.Char(20), login).input('RepNum', sql.Decimal(10, 0), repNum)
      .input('Species', sql.SmallInt, Number(original.species || 0)).input('Variety', sql.Int, Number(original.variety || 0))
      .input('Product', sql.Char(6), trim(original.product)).input('Container', sql.SmallInt, Number(original.container || 0))
      .input('Category', sql.SmallInt, Number(original.category || 0)).input('Caliber', sql.Char(10), trim(original.caliber))
      .query(`SELECT TOP 1 PSR_Cajas totalBoxes,PSR_CajasO occupied FROM PS_SALREP01 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species
          AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber;`);
    const current = existing.recordset[0];
    if (current && line.boxes > Number(current.totalBoxes || 0) - Number(current.occupied || 0)) {
      throw new RepaletizajeError(409, 'INSUFFICIENT_BOXES', `El detalle ${item.folio}/${line.corr} ya fue reservado por otro cambio.`);
    }
    const psr = new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login)
      .input('RepNum', sql.Decimal(10, 0), repNum).input('Species', sql.SmallInt, Number(original.species || 0))
      .input('Variety', sql.Int, Number(original.variety || 0)).input('Product', sql.Char(6), trim(original.product))
      .input('Container', sql.SmallInt, Number(original.container || 0)).input('Category', sql.SmallInt, Number(original.category || 0))
      .input('Caliber', sql.Char(10), trim(original.caliber)).input('TotalBoxes', sql.SmallInt, Number(current?.totalBoxes || original.totalBoxes || 0))
      .input('Boxes', sql.SmallInt, line.boxes);
    await psr.query(current
      ? `UPDATE PS_SALREP01 SET PSR_CajasO=ISNULL(PSR_CajasO,0)+@Boxes WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber;`
      : `INSERT INTO PS_SALREP01 (EmpCod,TempCod,PSR_Login,PSR_NREp,PSR_Espe,PSR_Var,PSR_Prod,PSR_Env,PSR_Cat,PSR_Cal,PSR_Cajas,PSR_CajasO) VALUES (@EmpCod,@TempCod,@Login,@RepNum,@Species,@Variety,@Product,@Container,@Category,@Caliber,@TotalBoxes,@Boxes);`);
    await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login)
      .input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), item.folio).input('Corr', sql.SmallInt, line.corr)
      .input('Boxes', sql.SmallInt, line.boxes).query(`INSERT INTO PS_SALREP02 (EmpCod,TempCod,PSRM_Login,PSRM_Repa,PSRM_Folio,PSRM_Corr,PSRM_Cajas) VALUES (@EmpCod,@TempCod,@Login,@RepNum,@Folio,@Corr,@Boxes);`);
    await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .input('Folio', sql.Char(10), item.folio).input('Corr', sql.SmallInt, line.corr).input('MovementDate', sql.DateTime, line.movementDate || original.movementDate)
      .input('Product', sql.Char(6), trim(original.product)).input('Species', sql.SmallInt, Number(original.species || 0)).input('Variety', sql.Int, Number(original.variety || 0))
      .input('Container', sql.SmallInt, Number(original.container || 0)).input('Category', sql.SmallInt, Number(original.category || 0)).input('Caliber', sql.Char(10), trim(original.caliber))
      .input('InsBoxes', sql.SmallInt, originalBoxes).input('InsKilos', sql.Money, originalKilos)
      .input('RepBoxes', sql.SmallInt, line.boxes).input('RepKilos', sql.Money, line.repalletizedKilos)
      .query(`INSERT INTO REPALETIZAJE2 (EmpCod,TempCod,REPNum,REP0Fol,Rep1Corr,Rep1Mov,REP1FecPro,REP1Prod,REP1Espe,Rep1Var,REP1Env,Rep1Cat,REP1Cal,REP1CajasINS,REP1KilosINS,REP1CajasRep,REP1KilosRep,REP1CajasDes,Rep1KilosDes)
        VALUES (@EmpCod,@TempCod,@RepNum,@Folio,@Corr,1,@MovementDate,@Product,@Species,@Variety,@Container,@Category,@Caliber,@InsBoxes,@InsKilos,@RepBoxes,@RepKilos,@InsBoxes+@RepBoxes,@InsKilos+@RepKilos);`);
    totalRepalletized += line.boxes;
    totalOriginal += originalBoxes;
  }
  await new sql.Request(transaction)
    .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), item.folio)
    .input('Species', sql.SmallInt, Number(source.header.speciesCode || 0)).input('OriginalBoxes', sql.SmallInt, totalOriginal).input('Boxes', sql.SmallInt, totalRepalletized)
    .input('Request', sql.Decimal(10, 0), Number(source.header.solNum || 0)).input('Height', sql.SmallInt, height).input('Base', sql.SmallInt, base)
    .query(`INSERT INTO REPALETIZAJE1 (EmpCod,TempCod,REPNum,REP0Fol,REp0Espe,Rep0Cajas,REp0CajasR,REP0CajasDes,REP0Nsol,REP0Calt,REP0CBase,REP0TipAct)
      VALUES (@EmpCod,@TempCod,@RepNum,@Folio,@Species,@OriginalBoxes,@Boxes,@OriginalBoxes+@Boxes,@Request,@Height,@Base,0);`);
  return { folio: item.folio, boxes: totalRepalletized };
};

const lowerRepaletizajeBoxes = async (empCod, login, repNumValue, payload) => {
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const input = normalizeLowerPayload(payload);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeSeason(new sql.Request(transaction), empCod);
    const header = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query('SELECT TOP 1 REPEstado status FROM REPALETIZAJE WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
    if (!header.recordset[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
    if (Number(header.recordset[0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'Solo se pueden bajar cajas en un repaletizaje en proceso.');

    const source = await lowerSourceFolio(new sql.Request(transaction), empCod, tempCod, input.folio);
    const sourceByCorr = new Map(source.details.map((row) => [Number(row.corr), row]));
    let totalLowered = 0;
    let totalOriginal = 0;
    const saved = [];
    for (const line of input.lines) {
      const original = sourceByCorr.get(line.corr);
      if (!original) throw new RepaletizajeError(409, 'DETAIL_NOT_FOUND', `El correlativo ${line.corr} no tiene cajas repaletizadas en el folio ${input.folio}.`);
      const stagedMovement = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod)
        .input('Login', sql.Char(20), login).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, line.corr)
        .query('SELECT TOP 1 PSRM_Cajas movement FROM PS_SALREP02 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSRM_Login=@Login AND PSRM_Repa=@RepNum AND PSRM_Folio=@Folio AND PSRM_Corr=@Corr;');
      const previousLowered = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, line.corr)
        .query('SELECT COALESCE(SUM(CASE WHEN REP1CajasRep<0 THEN -REP1CajasRep ELSE 0 END),0) lowered FROM REPALETIZAJE2 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio AND Rep1Corr=@Corr;');
      const alreadyLowered = Number(previousLowered.recordset[0]?.lowered || 0);
      const hasStagedMovement = Boolean(stagedMovement.recordset[0]);
      const stagedLowerable = hasStagedMovement
        ? Math.max(0, -Number(stagedMovement.recordset[0].movement || 0))
        : null;
      const lowerable = hasStagedMovement
        ? stagedLowerable
        : Math.max(0, Number(original.discountedBoxes || original.originalBoxes || 0) - alreadyLowered);
      if (line.boxes > lowerable) {
        throw new RepaletizajeError(409, 'INSUFFICIENT_REPALLETIZED_BOXES', `El detalle ${input.folio}/${line.corr} solo permite bajar ${lowerable} cajas.`);
      }

      const weight = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('Env', sql.SmallInt, Number(original.container || 0))
        .query('SELECT TOP 1 COALESCE(EnvPesoSag,EnvPeso,0) weight,COALESCE(EnvDestare,0) tare FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@Env;');
      const kilos = line.boxes * (Number(weight.recordset[0]?.weight || 0) - Number(weight.recordset[0]?.tare || 0));
      const psr = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Species', sql.SmallInt, Number(original.species || 0)).input('Variety', sql.Int, Number(original.variety || 0))
        .input('Product', sql.Char(6), trim(original.product)).input('Container', sql.SmallInt, Number(original.container || 0))
        .input('Category', sql.SmallInt, Number(original.category || 0)).input('Caliber', sql.Char(10), trim(original.caliber))
        .query('SELECT TOP 1 1 found FROM PS_SALREP01 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber;');
      const reserve = new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Species', sql.SmallInt, Number(original.species || 0)).input('Variety', sql.Int, Number(original.variety || 0))
        .input('Product', sql.Char(6), trim(original.product)).input('Container', sql.SmallInt, Number(original.container || 0))
        .input('Category', sql.SmallInt, Number(original.category || 0)).input('Caliber', sql.Char(10), trim(original.caliber)).input('Boxes', sql.SmallInt, line.boxes);
      await reserve.query(psr.recordset[0]
        ? 'UPDATE PS_SALREP01 SET PSR_Cajas=ISNULL(PSR_Cajas,0)+@Boxes WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber;'
        : 'INSERT INTO PS_SALREP01 (EmpCod,TempCod,PSR_Login,PSR_NREp,PSR_Espe,PSR_Var,PSR_Prod,PSR_Env,PSR_Cat,PSR_Cal,PSR_Cajas,PSR_CajasO) VALUES (@EmpCod,@TempCod,@Login,@RepNum,@Species,@Variety,@Product,@Container,@Category,@Caliber,@Boxes,0);');
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login)
        .input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, line.corr).input('Delta', sql.SmallInt, -line.boxes)
        .query(`UPDATE PS_SALREP02 SET PSRM_Cajas=ISNULL(PSRM_Cajas,0)+@Delta
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSRM_Login=@Login AND PSRM_Repa=@RepNum AND PSRM_Folio=@Folio AND PSRM_Corr=@Corr;
          IF @@ROWCOUNT=0 INSERT INTO PS_SALREP02 (EmpCod,TempCod,PSRM_Login,PSRM_Repa,PSRM_Folio,PSRM_Corr,PSRM_Cajas)
          VALUES (@EmpCod,@TempCod,@Login,@RepNum,@Folio,@Corr,@Delta);`);
      const nextMovement = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, line.corr)
        .query('SELECT COALESCE(MAX(Rep1Mov),0)+1 movement FROM REPALETIZAJE2 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio AND Rep1Corr=@Corr;');
      const movement = Number(nextMovement.recordset[0]?.movement || 1);
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, line.corr).input('Movement', sql.SmallInt, movement).input('MovementDate', sql.DateTime, original.movementDate || new Date())
        .input('Product', sql.Char(6), trim(original.product)).input('Species', sql.SmallInt, Number(original.species || 0)).input('Variety', sql.Int, Number(original.variety || 0))
        .input('Container', sql.SmallInt, Number(original.container || 0)).input('Category', sql.SmallInt, Number(original.category || 0)).input('Caliber', sql.Char(10), trim(original.caliber))
        .input('InsBoxes', sql.SmallInt, Number(original.discountedBoxes || original.originalBoxes || 0)).input('InsKilos', sql.Money, Number(original.discountedKilos || original.originalKilos || 0))
        .input('RepBoxes', sql.SmallInt, -line.boxes).input('RepKilos', sql.Money, -kilos)
        .query(`INSERT INTO REPALETIZAJE2 (EmpCod,TempCod,REPNum,REP0Fol,Rep1Corr,Rep1Mov,REP1FecPro,REP1Prod,REP1Espe,Rep1Var,Rep1Env,Rep1Cat,REP1Cal,REP1CajasINS,REP1KilosINS,REP1CajasRep,REP1KilosRep,REP1CajasDes,Rep1KilosDes)
          VALUES (@EmpCod,@TempCod,@RepNum,@Folio,@Corr,@Movement,@MovementDate,@Product,@Species,@Variety,@Container,@Category,@Caliber,@InsBoxes,@InsKilos,@RepBoxes,@RepKilos,@InsBoxes+@RepBoxes,@InsKilos+@RepKilos);`);
      totalLowered += line.boxes;
      totalOriginal += Number(original.discountedBoxes || original.originalBoxes || 0);
      saved.push({ corr: line.corr, boxes: line.boxes, movement });
    }

    const existingFolio = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio)
      .query('SELECT TOP 1 1 found FROM REPALETIZAJE1 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio;');
    if (existingFolio.recordset[0]) {
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio).input('Boxes', sql.SmallInt, totalLowered)
        .query('UPDATE REPALETIZAJE1 SET REP0CajasR=ISNULL(REP0CajasR,0)-@Boxes,REP0CajasDes=ISNULL(REP0Cajas,0)+ISNULL(REP0CajasR,0)-@Boxes WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio;');
    } else {
      // GRepBaja2_2 runs the same `repa` subroutine as GX8: if the source
      // folio already belongs to a finalized repaletizaje, the new row is a
      // repaletizaje action (REP0TipAct=1) and keeps that prior REPNum as
      // REP0Nsol; otherwise it remains linked to the inspection request.
      const finalizedSource = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), input.folio)
        .query(`SELECT TOP 1 r.REPNum FROM REPALETIZAJE1 r
          JOIN REPALETIZAJE h ON h.EmpCod=r.EmpCod AND h.TempCod=r.TempCod AND h.REPNum=r.REPNum
          WHERE r.EmpCod=@EmpCod AND r.TempCod=@TempCod AND r.REP0Fol=@Folio AND h.REPEstado=1;`);
      const actionType = finalizedSource.recordset[0] ? 1 : 0;
      const requestNumber = finalizedSource.recordset[0]
        ? Number(finalizedSource.recordset[0].REPNum)
        : Number(source.header.solNum || source.header.requestNumber || 0);
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio)
        .input('Species', sql.SmallInt, Number(source.header.speciesCode || 0)).input('OriginalBoxes', sql.SmallInt, totalOriginal).input('Boxes', sql.SmallInt, totalLowered)
        .input('Request', sql.Decimal(10, 0), requestNumber).input('Height', sql.SmallInt, Number(source.header.heightCode || 0)).input('Base', sql.SmallInt, Number(source.header.baseCode || 0)).input('ActionType', sql.SmallInt, actionType)
        .query(`INSERT INTO REPALETIZAJE1 (EmpCod,TempCod,REPNum,REP0Fol,REp0Espe,Rep0Cajas,REp0CajasR,REP0CajasDes,REP0Nsol,REP0Calt,REP0CBase,REP0TipAct)
          VALUES (@EmpCod,@TempCod,@RepNum,@Folio,@Species,@OriginalBoxes,-@Boxes,@OriginalBoxes-@Boxes,@Request,@Height,@Base,@ActionType);`);
    }
    await transaction.commit();
    return { repNum, folio: input.folio, status: 0, lines: saved };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const raiseRepaletizajeBoxes = async (empCod, login, repNumValue, payload) => {
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const input = normalizeRaisePayload(payload);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeSeason(new sql.Request(transaction), empCod);
    const header = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query('SELECT TOP 1 REPEstado status FROM REPALETIZAJE WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
    if (!header.recordset[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
    if (Number(header.recordset[0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'Solo se pueden subir cajas en un repaletizaje en proceso.');

    const source = await raiseSourceFolio(new sql.Request(transaction), empCod, tempCod, login, repNum, input.folio);
    const sourceByCorr = new Map(source.details.map((row) => [Number(row.corr), row]));
    const saved = [];
    for (const line of input.lines) {
      const original = sourceByCorr.get(line.corr);
      if (!original) throw new RepaletizajeError(409, 'DETAIL_NOT_FOUND', `El correlativo ${line.corr} no está disponible para subir cajas en el folio ${input.folio}.`);
      const available = Math.max(0, Number(original.reservedBoxes || 0) - Number(original.occupiedBoxes || 0));
      if (line.boxes > available) {
        throw new RepaletizajeError(409, 'INSUFFICIENT_BOXES', `El detalle ${input.folio}/${line.corr} solo tiene ${available} cajas disponibles para subir.`);
      }

      const weight = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('Env', sql.SmallInt, Number(original.container || 0))
        .query('SELECT TOP 1 COALESCE(EnvPesoSag,EnvPeso,0) weight,COALESCE(EnvDestare,0) tare FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@Env;');
      const kilos = line.boxes * (Number(weight.recordset[0]?.weight || 0) - Number(weight.recordset[0]?.tare || 0));
      const psr = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Species', sql.SmallInt, Number(original.species || 0)).input('Variety', sql.Int, Number(original.variety || 0))
        .input('Product', sql.Char(6), trim(original.product)).input('Container', sql.SmallInt, Number(original.container || 0))
        .input('Category', sql.SmallInt, Number(original.category || 0)).input('Caliber', sql.Char(10), trim(original.caliber)).input('Boxes', sql.SmallInt, line.boxes)
        .query(`UPDATE PS_SALREP01 SET PSR_CajasO=ISNULL(PSR_CajasO,0)+@Boxes
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species
            AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber
            AND ISNULL(PSR_CajasO,0)+@Boxes<=ISNULL(PSR_Cajas,0);`);
      if (!psr.rowsAffected.some((count) => count > 0)) throw new RepaletizajeError(409, 'RESERVATION_NOT_FOUND', `No quedan cajas reservadas para subir en el detalle ${input.folio}/${line.corr}.`);

      const psrm = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login)
        .input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, line.corr).input('Boxes', sql.SmallInt, line.boxes)
        .query(`UPDATE PS_SALREP02 SET PSRM_Cajas=ISNULL(PSRM_Cajas,0)+@Boxes
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSRM_Login=@Login AND PSRM_Repa=@RepNum AND PSRM_Folio=@Folio AND PSRM_Corr=@Corr;
          IF @@ROWCOUNT=0 INSERT INTO PS_SALREP02 (EmpCod,TempCod,PSRM_Login,PSRM_Repa,PSRM_Folio,PSRM_Corr,PSRM_Cajas)
          VALUES (@EmpCod,@TempCod,@Login,@RepNum,@Folio,@Corr,@Boxes);`);

      const movement = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, line.corr).input('Boxes', sql.SmallInt, line.boxes).input('Kilos', sql.Money, kilos)
        .query(`UPDATE REPALETIZAJE2 SET REP1CajasRep=ISNULL(REP1CajasRep,0)+@Boxes,Rep1KilosRep=ISNULL(Rep1KilosRep,0)+@Kilos,
            REP1CajasDes=ISNULL(REP1CajasDes,0)+@Boxes,Rep1KilosDes=ISNULL(Rep1KilosDes,0)+@Kilos
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio AND Rep1Corr=@Corr AND Rep1Mov=1;`);
      if (!movement.rowsAffected.some((count) => count > 0)) throw new RepaletizajeError(409, 'DETAIL_NOT_FOUND', `No existe el detalle ${input.folio}/${line.corr} en el repaletizaje.`);
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Folio', sql.Char(10), input.folio).input('Boxes', sql.SmallInt, line.boxes)
        .query('UPDATE REPALETIZAJE1 SET REP0CajasR=ISNULL(REP0CajasR,0)+@Boxes,REP0CajasDes=ISNULL(REP0Cajas,0)+ISNULL(REP0CajasR,0)+@Boxes WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio;');
      saved.push({ corr: line.corr, boxes: line.boxes });
    }
    await transaction.commit();
    return { repNum, folio: input.folio, status: 0, lines: saved };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

// Transactional implementation of RepSubir.  The legacy procedure first
// consumes the reservation (PSR_CajasO/PSRM) and then creates or updates the
// folio/detail in the current repaletizaje.  Keeping those writes in one
// serializable transaction prevents two operators from consuming the same
// reserved boxes.
const raiseRepaletizajeBoxesXpz = async (empCod, login, repNumValue, payload) => {
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const input = normalizeRaisePayload(payload);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeSeason(new sql.Request(transaction), empCod);
    const header = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query('SELECT TOP 1 REPEstado status FROM REPALETIZAJE WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
    if (!header.recordset[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
    if (Number(header.recordset[0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'Solo se pueden subir cajas en un repaletizaje en proceso.');

    const source = await raiseSourceFolioXpz(new sql.Request(transaction), empCod, tempCod, login, repNum, input.folio);
    const sourceDetails = buildRaiseDetails(source.details, source.poolRows);
    const sourceByCorr = new Map(sourceDetails.map((row) => [Number(row.corr), row]));
    const saved = [];
    let totalRaised = 0;
    for (const line of input.lines) {
      const original = line.species === undefined
        ? sourceByCorr.get(line.corr)
        : sourceDetails.find((row) => raiseAttributeKey(row) === raiseAttributeKey(line)) || sourceByCorr.get(line.corr);
      if (!original) throw new RepaletizajeError(409, 'DETAIL_NOT_FOUND', `El correlativo ${line.corr} no está disponible para subir cajas en el folio ${input.folio}.`);
      const corr = Number(original.corr || line.corr);
      const available = Math.max(0, Number(original.reservedBoxes || 0) - Number(original.occupiedBoxes || 0));
      if (line.boxes > available) {
        throw new RepaletizajeError(409, 'INSUFFICIENT_BOXES', `El detalle ${input.folio}/${line.corr} solo tiene ${available} cajas disponibles para subir.`);
      }

      const existingMovement = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, corr)
        .query('SELECT TOP 1 REP1CajasRep currentBoxes FROM REPALETIZAJE2 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio AND Rep1Corr=@Corr AND Rep1Mov=1;');
      if (existingMovement.recordset[0] && Number(existingMovement.recordset[0].currentBoxes || 0) < 0) {
        throw new RepaletizajeError(409, 'RAISE_NOT_ALLOWED', `El detalle ${input.folio}/${line.corr} tiene cajas bajadas en este repaletizaje y no permite subir cajas.`);
      }

      const weight = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('Env', sql.SmallInt, Number(original.container || 0))
        .query('SELECT TOP 1 COALESCE(EnvPesoSag,EnvPeso,0) weight,COALESCE(EnvDestare,0) tare FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@Env;');
      const kilos = line.boxes * (Number(weight.recordset[0]?.weight || 0) - Number(weight.recordset[0]?.tare || 0));
      const psr = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Species', sql.SmallInt, Number(original.species || 0)).input('Variety', sql.Int, Number(original.variety || 0))
        .input('Product', sql.Char(6), trim(original.product)).input('Container', sql.SmallInt, Number(original.container || 0))
        .input('Category', sql.SmallInt, Number(original.category || 0)).input('Caliber', sql.Char(10), trim(original.caliber)).input('Boxes', sql.SmallInt, line.boxes)
        .query(`UPDATE PS_SALREP01 SET PSR_CajasO=ISNULL(PSR_CajasO,0)+@Boxes
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species
            AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber
            AND ISNULL(PSR_CajasO,0)+@Boxes<=ISNULL(PSR_Cajas,0);`);
      if (!psr.rowsAffected.some((count) => count > 0)) throw new RepaletizajeError(409, 'RESERVATION_NOT_FOUND', `No quedan cajas reservadas para subir en el detalle ${input.folio}/${line.corr}.`);

      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login)
        .input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, corr).input('Boxes', sql.SmallInt, line.boxes)
        .query(`UPDATE PS_SALREP02 SET PSRM_Cajas=ISNULL(PSRM_Cajas,0)+@Boxes
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSRM_Login=@Login AND PSRM_Repa=@RepNum AND PSRM_Folio=@Folio AND PSRM_Corr=@Corr;
          IF @@ROWCOUNT=0 INSERT INTO PS_SALREP02 (EmpCod,TempCod,PSRM_Login,PSRM_Repa,PSRM_Folio,PSRM_Corr,PSRM_Cajas)
          VALUES (@EmpCod,@TempCod,@Login,@RepNum,@Folio,@Corr,@Boxes);`);

      const movementRequest = new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, corr).input('Boxes', sql.SmallInt, line.boxes).input('Kilos', sql.Money, kilos)
        .input('MovementDate', sql.DateTime, original.movementDate || new Date()).input('Product', sql.Char(6), trim(original.product))
        .input('Species', sql.SmallInt, Number(original.species || 0)).input('Variety', sql.Int, Number(original.variety || 0))
        .input('Container', sql.SmallInt, Number(original.container || 0)).input('Category', sql.SmallInt, Number(original.category || 0)).input('Caliber', sql.Char(10), trim(original.caliber))
        .input('InsBoxes', sql.SmallInt, Number(original.originalBoxes || 0)).input('InsKilos', sql.Money, Number(original.originalKilos || 0));
      await movementRequest.query(existingMovement.recordset[0]
        ? `UPDATE REPALETIZAJE2 SET REP1CajasRep=ISNULL(REP1CajasRep,0)+@Boxes,Rep1KilosRep=ISNULL(Rep1KilosRep,0)+@Kilos,
            REP1CajasDes=ISNULL(REP1CajasDes,0)+@Boxes,Rep1KilosDes=ISNULL(Rep1KilosDes,0)+@Kilos
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio AND Rep1Corr=@Corr AND Rep1Mov=1;`
        : `INSERT INTO REPALETIZAJE2 (EmpCod,TempCod,REPNum,REP0Fol,Rep1Corr,Rep1Mov,REP1FecPro,REP1Prod,REP1Espe,Rep1Var,Rep1Env,Rep1Cat,REP1Cal,REP1CajasINS,REP1KilosINS,REP1CajasRep,REP1KilosRep,REP1CajasDes,Rep1KilosDes)
          VALUES (@EmpCod,@TempCod,@RepNum,@Folio,@Corr,1,@MovementDate,@Product,@Species,@Variety,@Container,@Category,@Caliber,@InsBoxes,@InsKilos,@Boxes,@Kilos,@InsBoxes+@Boxes,@InsKilos+@Kilos);`);
      totalRaised += line.boxes;
      saved.push({ corr, boxes: line.boxes });
    }

    const existingFolio = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio)
      .query('SELECT TOP 1 REP0Cajas,REP0CajasR FROM REPALETIZAJE1 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio;');
    if (existingFolio.recordset[0]) {
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio).input('Boxes', sql.SmallInt, totalRaised)
        .query('UPDATE REPALETIZAJE1 SET REP0CajasR=ISNULL(REP0CajasR,0)+@Boxes,REP0CajasDes=ISNULL(REP0Cajas,0)+ISNULL(REP0CajasR,0)+@Boxes WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio;');
    } else {
      const sourceOriginal = sourceDetails.reduce((sum, row) => sum + Number(row.originalBoxes || 0), 0);
      const finalized = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), input.folio)
        .query(`SELECT TOP 1 1 found FROM REPALETIZAJE1 r JOIN REPALETIZAJE h ON h.EmpCod=r.EmpCod AND h.TempCod=r.TempCod AND h.REPNum=r.REPNum
          WHERE r.EmpCod=@EmpCod AND r.TempCod=@TempCod AND r.REP0Fol=@Folio AND h.REPEstado=1;`);
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio)
        .input('Species', sql.SmallInt, Number(sourceDetails[0]?.species || 0)).input('OriginalBoxes', sql.SmallInt, sourceOriginal).input('Boxes', sql.SmallInt, totalRaised)
        .input('Request', sql.Decimal(10, 0), finalized.recordset[0] ? Number(finalized.recordset[0].REPNum) : Number(source.header.solNum || source.header.requestNumber || 0)).input('Height', sql.SmallInt, Number(source.header.heightCode || 0)).input('Base', sql.SmallInt, Number(source.header.baseCode || 0)).input('ActionType', sql.SmallInt, finalized.recordset[0] ? 1 : 0)
        .query(`INSERT INTO REPALETIZAJE1 (EmpCod,TempCod,REPNum,REP0Fol,REp0Espe,Rep0Cajas,REp0CajasR,REP0CajasDes,REP0Nsol,REP0Calt,REP0CBase,REP0TipAct)
          VALUES (@EmpCod,@TempCod,@RepNum,@Folio,@Species,@OriginalBoxes,@Boxes,@OriginalBoxes+@Boxes,@Request,@Height,@Base,@ActionType);`);
    }
    await transaction.commit();
    return { repNum, folio: input.folio, status: 0, lines: saved };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const listRepaletizajes = async (empCod, query = {}) => {
  const filters = listFilters(query);
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const result = await pool
    .request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('From', sql.Date, filters.from)
    .input('To', sql.Date, filters.to)
    .input('Status', sql.SmallInt, filters.status)
    .input('RepNum', sql.Decimal(10, 0), filters.repNum)
    .input('RepNumF', sql.Decimal(10, 0), filters.repNumF)
    .input('Offset', sql.Int, (filters.page - 1) * filters.pageSize)
    .input('PageSize', sql.Int, filters.pageSize)
    .query(`
      SELECT COUNT(*) total
      FROM REPALETIZAJE h
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
        AND h.REPFecha>=@From AND h.REPFecha<DATEADD(day,1,@To)
        AND (@Status IS NULL OR h.REPEstado=@Status)
        AND (@RepNum IS NULL OR h.REPNum=@RepNum)
        AND (@RepNumF IS NULL OR h.REPNumF=@RepNumF);

      SELECT h.EmpCod empCod,RTRIM(h.TempCod) tempCod,h.REPNum repNum,h.REPNumF repNumF,
        CONVERT(char(10),h.REPFecha,23) date,CONVERT(char(10),h.REPFecCrea,23) createdDate,
        RTRIM(h.REPLogCrea) createdLogin,h.REPEstado status,h.DACod authorizedCode,
        RTRIM(d.DANombre) authorizedBy
      FROM REPALETIZAJE h
      LEFT JOIN DESPAAUTO d ON d.EmpCod=h.EmpCod AND d.DACod=h.DACod
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
        AND h.REPFecha>=@From AND h.REPFecha<DATEADD(day,1,@To)
        AND (@Status IS NULL OR h.REPEstado=@Status)
        AND (@RepNum IS NULL OR h.REPNum=@RepNum)
        AND (@RepNumF IS NULL OR h.REPNumF=@RepNumF)
      ORDER BY h.REPFecha DESC,h.REPNum DESC
      OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    `);
  return {
    tempCod,
    filters,
    rows: (result.recordsets[1] || []).map(mapHeader),
    total: Number(result.recordsets[0]?.[0]?.total || 0),
    page: filters.page,
    pageSize: filters.pageSize
  };
};

const listRepaletizajeFolios = async (empCod, repNumValue, query = {}) => {
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const page = integer(query.page ?? 1, 'Página', { min: 1, max: 100000 });
  const pageSize = integer(query.pageSize ?? 25, 'Tamaño de página', { min: 1, max: 100 });
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const result = await pool
    .request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('RepNum', sql.Decimal(10, 0), repNum)
    .input('Offset', sql.Int, (page - 1) * pageSize)
    .input('PageSize', sql.Int, pageSize)
    .query(`
      SELECT COUNT(*) total
      FROM REPALETIZAJE1 d
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum;

      SELECT TOP 1 h.REPNum
      FROM REPALETIZAJE h
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.REPNum=@RepNum;

      SELECT d.EmpCod empCod,RTRIM(d.TempCod) tempCod,d.REPNum repNum,RTRIM(d.REP0Fol) folio,
        d.REp0Espe speciesCode,RTRIM(e.EspeNom) speciesName,d.Rep0Cajas originalBoxes,
        d.REp0CajasR repalletizedBoxes,d.REP0CajasDes discountedBoxes,d.REP0Nsol requestNumber,
        d.REP0Calt heightCode,RTRIM(alt.TAlDesc) heightName,d.REP0CBase baseCode,RTRIM(bp.TBPDesc) baseName,d.REP0TipAct actionType
      FROM REPALETIZAJE1 d
      LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.REp0Espe
      LEFT JOIN TIPALT alt ON alt.EmpCod=d.EmpCod AND alt.TAlCod=d.REP0Calt
      LEFT JOIN TIPBPA bp ON bp.EmpCod=d.EmpCod AND bp.TBPCod=d.REP0CBase
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum
      ORDER BY d.REP0Fol
      OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    `);
  if (!result.recordsets[1]?.[0]) {
    throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe en la temporada activa.');
  }
  return {
    tempCod,
    repNum,
    rows: (result.recordsets[2] || []).map(mapFolio),
    total: Number(result.recordsets[0]?.[0]?.total || 0),
    page,
    pageSize
  };
};

const getRepaletizaje = async (empCod, repNumValue) => {
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
    .query(`
      SELECT TOP 1 h.EmpCod empCod,RTRIM(h.TempCod) tempCod,h.REPNum repNum,h.REPNumF repNumF,
        CONVERT(char(10),h.REPFecha,23) date,CONVERT(char(10),h.REPFecCrea,23) createdDate,
        RTRIM(h.REPLogCrea) createdLogin,h.REPEstado status,h.DACod authorizedCode,RTRIM(a.DANombre) authorizedBy,
         RTRIM(e.EmpNom) companyName,
         STUFF((
           SELECT ' ' + countryNames.destinationName
           FROM (
             SELECT DISTINCT RTRIM(dest.DestNom) destinationName
             FROM REPALETIZAJE1 r
             INNER JOIN SOLICITUDES1 s ON s.EmpCod=r.EmpCod AND s.TempCod=r.TempCod AND s.SolNum=r.REP0Nsol
             LEFT JOIN DESTINOS dest ON dest.DestCod=s.SolDest
             WHERE r.EmpCod=h.EmpCod AND r.TempCod=h.TempCod AND r.REPNum=h.REPNum
               AND NULLIF(RTRIM(dest.DestNom),'') IS NOT NULL
           ) countryNames
           ORDER BY countryNames.destinationName
           FOR XML PATH(''), TYPE
         ).value('.', 'nvarchar(max)'), 1, 1, '') countryName
      FROM REPALETIZAJE h LEFT JOIN DESPAAUTO a ON a.EmpCod=h.EmpCod AND a.DACod=h.DACod
        LEFT JOIN DEFEMP e ON e.EmpCod=h.EmpCod
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.REPNum=@RepNum;
      SELECT d.EmpCod empCod,RTRIM(d.TempCod) tempCod,d.REPNum repNum,RTRIM(d.REP0Fol) folio,d.REp0Espe speciesCode,
        RTRIM(e.EspeNom) speciesName,d.Rep0Cajas originalBoxes,d.REp0CajasR repalletizedBoxes,d.REP0CajasDes discountedBoxes,
        d.REP0Nsol requestNumber,d.REP0Calt heightCode,d.REP0CBase baseCode,d.REP0TipAct actionType
      FROM REPALETIZAJE1 d LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.REp0Espe
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum ORDER BY d.REP0Fol;
      SELECT d.EmpCod empCod,RTRIM(d.TempCod) tempCod,d.REPNum repNum,RTRIM(d.REP0Fol) folio,d.Rep1Corr corr,d.Rep1Mov movement,
        CONVERT(char(10),d.REP1FecPro,23) movementDate,RTRIM(d.REP1Prod) product,d.REP1Espe speciesCode,RTRIM(e.EspeNom) speciesName,
        d.Rep1Var variety,d.REP1Env container,RTRIM(n.EnvNom) containerName,d.REP1Cat category,RTRIM(c.CatNom) categoryName,
        RTRIM(d.REP1Cal) caliber,d.REP1CajasINS originalBoxes,d.REP1KilosINS originalKilos,d.REP1CajasRep repalletizedBoxes,
        d.REP1KilosRep repalletizedKilos,d.REP1CajasDes discountedBoxes,d.Rep1KilosDes discountedKilos
      FROM REPALETIZAJE2 d LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.REP1Espe
        LEFT JOIN ENVCAT n ON n.EmpCod=d.EmpCod AND n.EnvCod=d.REP1Env
        LEFT JOIN ENVCAT1 c ON c.EmpCod=d.EmpCod AND c.EnvCod=d.REP1Env AND c.Catcod=d.REP1Cat
      WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum ORDER BY d.REP0Fol,d.Rep1Corr,d.Rep1Mov;
    `);
  if (!result.recordsets[0]?.[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe en la temporada activa.');
  return {
    header: mapHeader(result.recordsets[0][0]),
    folios: (result.recordsets[1] || []).map(mapFolio),
    movements: result.recordsets[2] || []
  };
};

const createRepaletizaje = async (empCod, login, payload) => {
  const input = normalizeSavePayload(payload);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeSeason(new sql.Request(transaction), empCod);
    const auth = await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('DACod', sql.SmallInt, input.daCod)
      .query('SELECT TOP 1 DACod FROM DESPAAUTO WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND DACod=@DACod AND ISNULL(DAVig,0)=1;');
    if (!auth.recordset[0]) throw new RepaletizajeError(409, 'AUTHORIZED_BY_NOT_VALID', 'El autorizador no está vigente.');
    const repNum = await nextCorrelative({ transaction, empCod, code: 'REPINT', digits: 10 });
    await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .input('Date', sql.Date, input.date).input('Login', sql.Char(10), text(login, 'Usuario', { required: true, max: 10 }))
      .input('DaCod', sql.SmallInt, input.daCod).query(`INSERT INTO REPALETIZAJE
        (EmpCod,TempCod,REPNum,REPNumF,REPFecha,REPLogCrea,REPFecCrea,REPEstado,DACod)
        VALUES (@EmpCod,@TempCod,@RepNum,0,@Date,@Login,GETDATE(),0,@DaCod);`);
    const saved = [];
    for (const item of input.folios) saved.push(await writeFolio(transaction, { empCod, tempCod, login, repNum, item }));
    await transaction.commit();
    return { repNum, tempCod, status: 0, folios: saved };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const appendRepaletizajeFolios = async (empCod, login, repNumValue, payload) => {
  if (payload?.mode === 'new') return appendNewRepaletizajeFolio(empCod, login, repNumValue, payload);
  throw new RepaletizajeError(409, 'NEW_FOLIO_REQUIRED', 'RepAgregar solo permite crear un folio nuevo desde las cajas disponibles del repaletizaje.');
};

const appendNewRepaletizajeFolio = async (empCod, loginValue, repNumValue, payload) => {
  const login = text(loginValue, 'Usuario', { required: true, max: 20 });
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const input = normalizeNewFolioPayload(payload);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeSeason(new sql.Request(transaction), empCod);
    const current = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query('SELECT TOP 1 REPEstado status,CONVERT(char(10),REPFecha,23) date FROM REPALETIZAJE WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
    if (!current.recordset[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
    if (Number(current.recordset[0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'Solo se puede modificar un repaletizaje en proceso.');

    const auth = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('DACod', sql.SmallInt, integer(payload.daCod, 'Autorizador', { min: 1, max: 32767 }))
      .query('SELECT TOP 1 DACod FROM DESPAAUTO WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND DACod=@DACod AND ISNULL(DAVig,0)=1;');
    if (!auth.recordset[0]) throw new RepaletizajeError(409, 'AUTHORIZED_BY_NOT_VALID', 'El autorizador no está vigente.');

    const existingSource = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), input.folio)
      .query('SELECT TOP 1 1 found FROM SOLICITUDES2 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Sol2Folio=@Folio AND SolNum>0;');
    if (existingSource.recordset[0]) {
      throw new RepaletizajeError(409, 'FOLIO_EXISTS', `El folio ${input.folio} ya existe en una solicitud y no puede agregarse como folio nuevo.`);
    }
    const existingAssociation = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), input.folio)
      .query(`SELECT TOP 1 r.REPNum
        FROM REPALETIZAJE1 r WITH (UPDLOCK,HOLDLOCK)
        JOIN REPALETIZAJE h WITH (UPDLOCK,HOLDLOCK)
          ON h.EmpCod=r.EmpCod AND h.TempCod=r.TempCod AND h.REPNum=r.REPNum
        WHERE r.EmpCod=@EmpCod AND r.TempCod=@TempCod AND r.REP0Fol=@Folio AND ISNULL(h.REPEstado,0)<>5;`);
    if (existingAssociation.recordset[0]) {
      throw new RepaletizajeError(409, 'FOLIO_ALREADY_ASSOCIATED', `El folio ${input.folio} ya está asociado a un repaletizaje.`);
    }

    const approvedRequest = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Request', sql.Decimal(10, 0), input.requestNumber)
      .query(`SELECT TOP 1 SolNum
        FROM SOLICITUDES1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolEstado=1
          AND (SolNum=@Request OR SolnumI=@Request);`);
    if (!approvedRequest.recordset[0]) throw new RepaletizajeError(409, 'REQUEST_NOT_APPROVED', `La solicitud ${input.requestNumber} no existe o no está aprobada.`);
    // PTraeNumSol in GX8 resolves a displayed SolnumI back to the internal
    // SolNum before RepAgregar writes REP0Nsol.  Persist that internal key so
    // later joins to SOLICITUDES2/3 and Finalizar use the same relation.
    const internalRequestNumber = Number(approvedRequest.recordset[0].SolNum);

    await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .input('Date', sql.Date, isoDate(payload.date, 'Fecha')).input('DaCod', sql.SmallInt, integer(payload.daCod, 'Autorizador', { min: 1, max: 32767 }))
      .query('UPDATE REPALETIZAJE SET REPFecha=@Date,DACod=@DaCod WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');

    const species = input.lines[0].species;
    const totalBoxes = input.lines.reduce((sum, line) => sum + line.boxes, 0);
    for (const [index, line] of input.lines.entries()) {
      const psrParams = (request) => request
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login)
        .input('RepNum', sql.Decimal(10, 0), repNum).input('Species', sql.SmallInt, line.species).input('Variety', sql.Int, line.variety)
        .input('Product', sql.Char(6), line.product).input('Container', sql.SmallInt, line.container).input('Category', sql.SmallInt, line.category).input('Caliber', sql.Char(10), line.caliber);
      const poolRow = await psrParams(new sql.Request(transaction)).query(`SELECT TOP 1 PSR_Cajas totalBoxes,PSR_CajasO occupied
        FROM PS_SALREP01 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species
          AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber;`);
      if (!poolRow.recordset[0]) throw new RepaletizajeError(409, 'POOL_DETAIL_NOT_FOUND', `El detalle ${index + 1} ya no está disponible en el repaletizaje.`);
      const available = Math.max(0, Number(poolRow.recordset[0].totalBoxes || 0) - Number(poolRow.recordset[0].occupied || 0));
      if (line.boxes > available) throw new RepaletizajeError(409, 'INSUFFICIENT_BOXES', `El detalle ${index + 1} solo tiene ${available} cajas disponibles.`);
      const reserved = await psrParams(new sql.Request(transaction)).input('Boxes', sql.SmallInt, line.boxes).query(`
        UPDATE PS_SALREP01 SET PSR_CajasO=ISNULL(PSR_CajasO,0)+@Boxes
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species
          AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber
          AND ISNULL(PSR_CajasO,0)+@Boxes<=ISNULL(PSR_Cajas,0);`);
      if (!reserved.rowsAffected.some((count) => count > 0)) throw new RepaletizajeError(409, 'INSUFFICIENT_BOXES', `El detalle ${index + 1} ya fue reservado por otro cambio.`);
      const corr = index + 1;
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login)
        .input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, corr).input('Boxes', sql.SmallInt, line.boxes)
        .query(`INSERT INTO PS_SALREP02 (EmpCod,TempCod,PSRM_Login,PSRM_Repa,PSRM_Folio,PSRM_Corr,PSRM_Cajas)
          VALUES (@EmpCod,@TempCod,@Login,@RepNum,@Folio,@Corr,@Boxes);`);
      await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Folio', sql.Char(10), input.folio).input('Corr', sql.SmallInt, corr).input('Product', sql.Char(6), line.product)
        .input('Species', sql.SmallInt, line.species).input('Variety', sql.Int, line.variety).input('Container', sql.SmallInt, line.container)
        .input('Category', sql.SmallInt, line.category).input('Caliber', sql.Char(10), line.caliber).input('Boxes', sql.SmallInt, line.boxes)
        .query(`INSERT INTO REPALETIZAJE2
          (EmpCod,TempCod,REPNum,REP0Fol,Rep1Corr,Rep1Mov,REP1FecPro,REP1Prod,REP1Espe,Rep1Var,Rep1Env,Rep1Cat,REP1Cal,REP1CajasINS,REP1KilosINS,REP1CajasRep,REP1KilosRep,REP1CajasDes,Rep1KilosDes)
          VALUES (@EmpCod,@TempCod,@RepNum,@Folio,@Corr,1,GETDATE(),@Product,@Species,@Variety,@Container,@Category,@Caliber,0,0,@Boxes,0,@Boxes,0);`);
    }
    await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .input('Folio', sql.Char(10), input.folio).input('Species', sql.SmallInt, species).input('Boxes', sql.SmallInt, totalBoxes)
      .input('Request', sql.Decimal(10, 0), internalRequestNumber).input('Height', sql.SmallInt, input.heightCode).input('Base', sql.SmallInt, input.baseCode)
      .query(`INSERT INTO REPALETIZAJE1
        (EmpCod,TempCod,REPNum,REP0Fol,REp0Espe,Rep0Cajas,REp0CajasR,REP0CajasDes,REP0Nsol,REP0Calt,REP0CBase,REP0TipAct)
        VALUES (@EmpCod,@TempCod,@RepNum,@Folio,@Species,0,@Boxes,@Boxes,@Request,@Height,@Base,1);`);
    await transaction.commit();
    return { repNum, tempCod, status: 0, folios: [{ folio: input.folio, boxes: totalBoxes, actionType: 1 }] };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const removeRepaletizajeFolio = async (empCod, login, repNumValue, folioValue) => {
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const folio = text(folioValue, 'Folio', { required: true, max: 10 });
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeSeason(new sql.Request(transaction), empCod);
    const header = await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query('SELECT TOP 1 REPEstado status FROM REPALETIZAJE WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
    if (!header.recordset[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
    if (Number(header.recordset[0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'Solo se puede modificar un repaletizaje en proceso.');
    const movements = await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), folio)
      .query('SELECT Rep1Corr corr,Rep1Espe species,Rep1Var variety,Rep1Prod product,Rep1Env container,Rep1Cat category,Rep1Cal caliber,Rep1CajasRep boxes FROM REPALETIZAJE2 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio;');
    if (!movements.recordset.length) throw new RepaletizajeError(404, 'FOLIO_NOT_FOUND', 'El folio no pertenece al repaletizaje.');
    for (const row of movements.recordset) {
      if (Number(row.boxes || 0) < 0) {
        const reserved = await new sql.Request(transaction)
          .input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login).input('RepNum', sql.Decimal(10, 0), repNum)
          .input('Species', sql.SmallInt, row.species).input('Variety', sql.Int, row.variety).input('Product', sql.Char(6), trim(row.product))
          .input('Container', sql.SmallInt, row.container).input('Category', sql.SmallInt, row.category).input('Caliber', sql.Char(10), trim(row.caliber))
          .query('SELECT TOP 1 ISNULL(PSR_CajasO,0) occupied FROM PS_SALREP01 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber;');
        if (Number(reserved.recordset[0]?.occupied || 0) > 0) {
          throw new RepaletizajeError(409, 'FOLIO_HAS_OCCUPIED_BOXES', 'No se puede quitar un folio mientras tenga cajas ocupadas.');
        }
      }
      await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Login', sql.Char(20), login).input('RepNum', sql.Decimal(10, 0), repNum)
        .input('Species', sql.SmallInt, row.species).input('Variety', sql.Int, row.variety).input('Product', sql.Char(6), trim(row.product)).input('Container', sql.SmallInt, row.container).input('Category', sql.SmallInt, row.category).input('Caliber', sql.Char(10), trim(row.caliber)).input('Boxes', sql.SmallInt, Number(row.boxes || 0))
        .input('Folio', sql.Char(10), folio).input('Corr', sql.SmallInt, row.corr)
        .query('UPDATE PS_SALREP01 SET PSR_CajasO=CASE WHEN @Boxes>0 THEN ISNULL(PSR_CajasO,0)-@Boxes ELSE ISNULL(PSR_CajasO,0) END,PSR_Cajas=CASE WHEN @Boxes<0 THEN ISNULL(PSR_Cajas,0)+@Boxes ELSE ISNULL(PSR_Cajas,0) END WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_Login=@Login AND PSR_NREp=@RepNum AND PSR_Espe=@Species AND PSR_Var=@Variety AND PSR_Prod=@Product AND PSR_Env=@Container AND PSR_Cat=@Category AND PSR_Cal=@Caliber; DELETE FROM PS_SALREP02 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSRM_Login=@Login AND PSRM_Repa=@RepNum AND PSRM_Folio=@Folio AND PSRM_Corr=@Corr;');
    }
    await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('Folio', sql.Char(10), folio).query('DELETE FROM REPALETIZAJE2 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio; DELETE FROM REPALETIZAJE1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum AND REP0Fol=@Folio;');
    await transaction.commit();
    return { repNum, folio };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const finalizeRepaletizaje = async (
  empCod,
  repNumValue,
  {
    poolProvider = getPool,
    transactionFactory = (pool) => new sql.Transaction(pool),
    requestFactory = (transaction) => new sql.Request(transaction),
    nextNumber = nextCorrelative
  } = {}
) => {
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const pool = await poolProvider();
  const transaction = transactionFactory(pool);
  const request = () => requestFactory(transaction);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeSeason(request(), empCod);
    const header = await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query('SELECT TOP 1 REPEstado status FROM REPALETIZAJE WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
    if (!header.recordset[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
    if (Number(header.recordset[0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'El repaletizaje ya no está en proceso.');

    // PFinRepa processes the REP0 (folio) level, not the temporary PS_SALREP
    // pool.  REP0CajasR is the quantity moved for the folio and is the value
    // written to SOLICITUDES2; REP1CajasRep is only used for each SOLICITUDES3
    // detail and for calculating the total kilos.
    const folios = await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query(`SELECT REP0Fol folio,REP0Nsol requestNumber,REP0Espe species,
        REP0Cajas originalBoxes,REP0CajasR repalletizedBoxes,REP0CajasDes discountedBoxes,
        REP0Calt heightCode,REP0CBase baseCode,REP0TipAct actionType
        FROM REPALETIZAJE1 WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum
        ORDER BY REP0Fol;`);
    const rows = await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query(`SELECT d.*,r.REP0Nsol requestNumber,r.REP0Espe species,
        r.REP0Cajas originalBoxes,r.REP0CajasR repalletizedBoxes,r.REP0CajasDes discountedBoxes,
        r.REP0Calt heightCode,r.REP0CBase baseCode,r.REP0TipAct actionType
        FROM REPALETIZAJE2 d
        JOIN REPALETIZAJE1 r ON r.EmpCod=d.EmpCod AND r.TempCod=d.TempCod
          AND r.REPNum=d.REPNum AND r.REP0Fol=d.REP0Fol
        WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum
        ORDER BY d.REP0Fol,d.Rep1Corr;`);

    const grouped = new Map();
    for (const row of folios.recordset) {
      const folio = trim(row.folio);
      grouped.set(folio, {
        folio,
        request: Number(row.requestNumber || 0),
        species: Number(row.species || 0),
        actionType: Number(row.actionType || 0),
        boxes: Number(row.repalletizedBoxes || 0),
        kilos: 0,
        heightCode: Number(row.heightCode || 0),
        baseCode: Number(row.baseCode || 0),
        rows: []
      });
    }

    // The generated procedure uses the REP1 weight subtype (EnvPeso) minus
    // tare (EnvDestare), never the SAG display weight.  It also creates a
    // detail row when the folio is new (RepAgregar).
    for (const row of rows.recordset) {
      const folio = trim(row.REP0Fol);
      if (!grouped.has(folio)) {
        grouped.set(folio, {
          folio,
          request: Number(row.requestNumber || 0),
          species: Number(row.species || row.REP1Espe || 0),
          actionType: Number(row.actionType || 0),
          boxes: Number(row.repalletizedBoxes || 0),
          kilos: 0,
          heightCode: Number(row.heightCode || 0),
          baseCode: Number(row.baseCode || 0),
          rows: []
        });
      }
      const bucket = grouped.get(folio);
      const weight = await request().input('EmpCod', sql.SmallInt, empCod).input('Env', sql.SmallInt, row.REP1Env)
        .query('SELECT TOP 1 COALESCE(EnvPeso,0) weight,COALESCE(EnvDestare,0) tare FROM ENVCAT WHERE EmpCod=@EmpCod AND EnvCod=@Env;');
      const factor = Number(weight.recordset[0]?.weight || 0) - Number(weight.recordset[0]?.tare || 0);
      const boxes = Number(row.REP1CajasRep || 0);
      const kilos = boxes * factor;
      bucket.kilos += kilos;
      bucket.rows.push({ ...row, kilos, boxes });
    }

    for (const bucket of grouped.values()) {
      // SOLICITUDES3 is looked up by folio/correlative, just as the XPZ
      // For Each does.  Therefore a RepAgregar folio is inserted here when
      // it has no request rows yet; existing rows are updated in place.
      for (const row of bucket.rows) {
        const existingDetail = await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), bucket.folio).input('Corr', sql.SmallInt, row.Rep1Corr)
          .query('SELECT TOP 1 SolNum FROM SOLICITUDES3 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum>0 AND Sol2Folio=@Folio AND Sol3Corr=@Corr;');
        if (existingDetail.recordset[0]) {
          await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), bucket.folio).input('Corr', sql.SmallInt, row.Rep1Corr).input('Boxes', sql.SmallInt, row.boxes).input('Kilos', sql.Money, row.kilos)
            .query('UPDATE SOLICITUDES3 SET Sol3CajasRep=ISNULL(Sol3CajasRep,0)+@Boxes,Sol3KilosRep=ISNULL(Sol3KilosRep,0)+@Kilos,Sol3CajasDes=ISNULL(Sol3CajasDes,0)+@Boxes,Sol3KilosDes=ISNULL(Sol3KilosDes,0)+@Kilos WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum>0 AND Sol2Folio=@Folio AND Sol3Corr=@Corr;');
        } else {
          // buscasol in the XPZ reuses the request already attached to the
          // folio when a detail is missing, instead of blindly trusting the
          // REP0 value.
          const sourceRequest = await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), bucket.folio)
            .query('SELECT TOP 1 SolNum FROM SOLICITUDES2 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum>0 AND Sol2Folio=@Folio;');
          const detailRequest = Number(sourceRequest.recordset[0]?.SolNum || bucket.request);
          await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Request', sql.Decimal(10, 0), detailRequest).input('Folio', sql.Char(10), bucket.folio).input('Corr', sql.SmallInt, row.Rep1Corr)
            .input('Date', sql.DateTime, row.REP1FecPro || null).input('Species', sql.SmallInt, row.REP1Espe || bucket.species).input('Variety', sql.Int, row.REP1Var)
            .input('Product', sql.Char(6), trim(row.REP1Prod)).input('Container', sql.SmallInt, row.REP1Env).input('Category', sql.SmallInt, row.REP1Cat).input('Caliber', sql.Char(10), trim(row.REP1Cal))
            .input('Boxes', sql.SmallInt, row.boxes).input('Kilos', sql.Money, row.kilos)
            .query(`INSERT INTO SOLICITUDES3
              (EmpCod,TempCod,SolNum,Sol2Folio,Sol3Corr,sol3fecha,Sol3espe,Sol3Var,Sol3prod,Sol3Env,Sol3CaT,Sol3Cal,sol3Tipo,Sol3Cajas,Sol3Kilos,Sol3CajasRep,Sol3KilosRep,Sol3CajasDes,Sol3KilosDes)
              VALUES (@EmpCod,@TempCod,@Request,@Folio,@Corr,@Date,@Species,@Variety,@Product,@Container,@Category,@Caliber,1,0,0,@Boxes,@Kilos,@Boxes,@Kilos);`);
        }
      }

      const existingFolio = await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), bucket.folio)
        .query('SELECT TOP 1 SolNum FROM SOLICITUDES2 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum>0 AND Sol2Folio=@Folio;');
      if (existingFolio.recordset[0]) {
        await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Folio', sql.Char(10), bucket.folio).input('Boxes', sql.SmallInt, bucket.boxes).input('Kilos', sql.Money, bucket.kilos)
          .input('Height', sql.SmallInt, bucket.heightCode).input('Base', sql.SmallInt, bucket.baseCode)
          .query('UPDATE SOLICITUDES2 SET Sol2CajasREP=ISNULL(Sol2CajasREP,0)+@Boxes,Sol2KilosRep=0,Sol2CajasDes=ISNULL(Sol2CajasDes,0)+@Boxes,Sol2KilosDes=ISNULL(Sol2KilosDes,0)+@Kilos,Sol2CAlt=@Height,Sol2CBase=@Base WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum>0 AND Sol2Folio=@Folio;');
      } else {
        await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Request', sql.Decimal(10, 0), bucket.request).input('Species', sql.SmallInt, bucket.species).input('Folio', sql.Char(10), bucket.folio)
          .input('Boxes', sql.SmallInt, bucket.boxes).input('Kilos', sql.Money, bucket.kilos).input('Height', sql.SmallInt, bucket.heightCode).input('Base', sql.SmallInt, bucket.baseCode)
          .query(`INSERT INTO SOLICITUDES2
            (EmpCod,TempCod,SolNum,Sol2Espe,Sol2Folio,Sol2Cajas,Sol2Kilos,Sol2CajasREP,Sol2KilosRep,Sol2CajasDes,Sol2KilosDes,Sol2Dispo,Sol2CAlt,Sol2CBase)
            VALUES (@EmpCod,@TempCod,@Request,@Species,@Folio,0,0,@Boxes,0,@Boxes,@Kilos,0,@Height,@Base);`);
      }
    }

    const repNumF = await nextNumber({ transaction, empCod, code: 'REPA', digits: 10 });
    // PFinRepa only changes the header.  The XPZ does not delete PS_SALREP01
    // or PS_SALREP02 here; those rows remain the audit trail of the movement.
    await request().input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).input('RepNumF', sql.Decimal(10, 0), repNumF)
      .query('UPDATE REPALETIZAJE SET REPEstado=1,REPNumF=@RepNumF WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
    await transaction.commit();
    return { repNum, repNumF, status: 1 };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const annulRepaletizaje = async (empCod, repNumValue) => {
  const repNum = integer(repNumValue, 'N° interno', { min: 1 });
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tempCod = await activeSeason(new sql.Request(transaction), empCod);
    const header = await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum)
      .query('SELECT TOP 1 REPEstado status FROM REPALETIZAJE WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum;');
    if (!header.recordset[0]) throw new RepaletizajeError(404, 'NOT_FOUND', 'El repaletizaje no existe.');
    if (Number(header.recordset[0].status) !== 0) throw new RepaletizajeError(409, 'READ_ONLY_STATUS', 'Solo se puede anular un repaletizaje en proceso.');
    const rows = await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).query('SELECT d.*,r.REP0Nsol requestNumber FROM REPALETIZAJE2 d JOIN REPALETIZAJE1 r ON r.EmpCod=d.EmpCod AND r.TempCod=d.TempCod AND r.REPNum=d.REPNum AND r.REP0Fol=d.REP0Fol WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.REPNum=@RepNum;');
    const grouped = new Map();
    for (const row of rows.recordset) {
      const key = `${trim(row.REP0Fol)}|${row.requestNumber}`;
      if (!grouped.has(key)) grouped.set(key, { folio: trim(row.REP0Fol), request: Number(row.requestNumber || 0) });
    }
    for (const bucket of grouped.values()) {
      const source = await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Request', sql.Decimal(10, 0), bucket.request).input('Folio', sql.Char(10), bucket.folio).query('SELECT TOP 1 Sol2Dispo FROM SOLICITUDES2 WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND SolNum=@Request AND Sol2Folio=@Folio;');
      if (source.recordset[0] && Number(source.recordset[0].Sol2Dispo || 0) !== 0) throw new RepaletizajeError(409, 'FOLIO_DISPATCHED', `El folio ${bucket.folio} ya fue despachado y no puede anularse.`);
    }
    await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('RepNum', sql.Decimal(10, 0), repNum).query('UPDATE REPALETIZAJE SET REPEstado=5 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND REPNum=@RepNum; DELETE FROM PS_SALREP02 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSRM_Repa=@RepNum; DELETE FROM PS_SALREP01 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PSR_NREp=@RepNum;');
    await transaction.commit();
    return { repNum, status: 5 };
  } catch (error) {
    if (!transaction._aborted) await transaction.rollback().catch(() => undefined);
    throw error;
  }
};

const generateRepaletizajePdf = async (empCod, repNumValue) => {
  const detail = await getRepaletizaje(empCod, repNumValue);
  return { filename: `Repaletizaje_${detail.header.repNumF || detail.header.repNum}.pdf`, content: await renderRepaletizajePdf(detail) };
};

const generateRepaletizajeArchive = async (empCod, repNumValue) => {
  const detail = await getRepaletizaje(empCod, repNumValue);
  if (Number(detail.header.status) !== 1 || !detail.header.repNumF) throw new RepaletizajeError(409, 'NOT_FINALIZED', 'El repaletizaje debe estar finalizado para generar el archivo.');
  const pool = await getPool();
  const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query('SELECT TOP 1 PAR1Valor1 plantCode FROM PARAMGE1 WHERE EmpCod=@EmpCod AND PARCod=20 AND PAR1Cod=30;');
  const plant = trim(result.recordset[0]?.plantCode) || String(empCod);
  // ArchiRepa writes the plant code followed by the number of folios. The
  // repaletizaje number travels in each application line only through the
  // source request/folio data, not in this header line.
  const lines = [`${plant}${detail.folios.length}`];
  for (const folio of detail.folios) {
    const movements = detail.movements.filter((row) => trim(row.folio) === trim(folio.folio));
    const request = folio.requestNumber || '';
    const date = detail.header.date ? detail.header.date.replaceAll('-', '') : '';
    const boxes = folio.discountedBoxes || 0;
    const action = Number(folio.originalBoxes || 0) === 0 ? 'A' : Number(boxes) === 0 ? 'E' : 'M';
    const species = folio.speciesCode || 0;
    if (movements.length) {
      movements.forEach((movement) => {
        const movementBoxes = Number(movement.repalletizedBoxes || boxes || 0);
        lines.push(`${action}${request}${folio.folio}${movementBoxes}${species}0${date}`);
      });
    } else {
      lines.push(`${action}${request}${folio.folio}${boxes}${species}0${date}`);
    }
  }
  lines.push('&&');
  return { filename: `${plant}${detail.header.repNumF}.REP`, content: Buffer.from(`${lines.join('\r\n')}\r\n`, 'latin1') };
};

module.exports = {
  permission,
  RepaletizajeError,
  defaultRange,
  listFilters,
  statusLabel,
  listRepaletizajes,
  listRepaletizajeFolios,
  editorData,
  getAddSource: addSource,
  checkNewFolio,
  getSourceFolio,
  getLowerSourceFolio,
  getRaiseSourceFolio,
  getRepaletizaje,
  createRepaletizaje,
  appendRepaletizajeFolios,
  raiseRepaletizajeBoxes: raiseRepaletizajeBoxesXpz,
  lowerRepaletizajeBoxes,
  removeRepaletizajeFolio,
  finalizeRepaletizaje,
  annulRepaletizaje,
  generateRepaletizajePdf,
  generateRepaletizajeArchive,
  normalizeSavePayload,
  normalizeNewFolioPayload,
  normalizeLowerPayload,
  normalizeRaisePayload,
  applyPendingLowerAdjustments,
  mergeRaisePoolAvailability,
  buildRaiseDetails
};

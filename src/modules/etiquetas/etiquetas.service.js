const { getPool, sql } = require('../../conectorMysql/conectorSqlServer');
const { CORE_VERSION, ZplValidationError, parseZpl, validateDocument, generateZpl, escapeFieldData } = require('./zpl/zplCore');

const ETIQUETAS_PERMISSION = Object.freeze({ sistema: 110, modulo: 1, programa: 1 });
const LABELARY_DPMM = Object.freeze({ 152: 6, 203: 8, 300: 12, 600: 24 });

class EtiquetaError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'EtiquetaError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const normalizeCompany = (value) => {
  const empCod = Number(value);
  if (!Number.isInteger(empCod) || empCod <= 0 || empCod > 32767) {
    throw new EtiquetaError(401, 'INVALID_SESSION_COMPANY', 'La empresa de la sesion no es valida.');
  }
  return empCod;
};

const normalizeConfigCode = (value) => {
  const code = String(value ?? '').trim().toUpperCase();
  if (!code || code.length > 10 || !/^[A-Z0-9_.-]+$/.test(code)) {
    throw new EtiquetaError(400, 'INVALID_CONFIG_CODE', 'El codigo CONFIGETI debe tener entre 1 y 10 caracteres validos.');
  }
  return code;
};

const normalizeLogin = (value) => String(value || 'MIGRACION').trim().slice(0, 10) || 'MIGRACION';

const revisionBuffer = (value) => {
  if (!value) return null;
  try {
    const revision = Buffer.from(String(value), 'base64');
    if (revision.length !== 8) throw new Error('invalid');
    return revision;
  } catch {
    throw new EtiquetaError(400, 'INVALID_REVISION', 'La revision del diseño no es valida.');
  }
};

const revisionText = (value) => value ? Buffer.from(value).toString('base64') : null;
const trim = (value) => value == null ? null : String(value).trim();

const DATA_BINDINGS = Object.freeze({
  1: ['especie', 'especie_externa'],
  3: ['variedad', 'variedad'],
  4: ['productor', 'productor_codigo'],
  5: ['comuna', 'comuna'],
  6: ['provincia', 'provincia'],
  7: ['envase', 'envase_externo'],
  10: ['categoria', 'categoria_externa'],
  11: ['calibre', 'calibre'],
  13: ['productor_secundario', 'productor_secundario']
});

const dataPlaceholder = (codeValue, external) => {
  const code = Number(codeValue || 0);
  if (code === 2) return external ? '{{especie_externa}}-{{variedad}}' : '{{especie}}-{{variedad}}';
  if (code === 12) return '{{comuna}}-{{provincia}}';
  const binding = DATA_BINDINGS[code];
  return binding ? `{{${binding[external ? 1 : 0]}}}` : '';
};

const resolveConfigPart = (row, side) => {
  if (!row) return '';
  const suffix = side === 'b' ? 'b' : '';
  const mode = String(row[`ConfLin1${suffix}`] || '').trim().toUpperCase();
  const fixed = String(row[`ConfText1${side === 'b' ? 'b' : 'a'}`] || '').trim();
  const code = row[`ConfDato1${side === 'b' ? 'b' : 'a'}`];
  const dynamic = dataPlaceholder(code, mode === 'NE' || mode === 'TNE');
  if (mode === 'ST') return fixed;
  if (mode === 'N' || mode === 'NE') return dynamic;
  if (mode === 'TN' || mode === 'TNE') return `${fixed}-${dynamic}`;
  return fixed;
};

const buildVinasaZpl = (rows = []) => {
  const byLine = new Map(rows.map((row) => [Number(row.ConfLinea), row]));
  const a = (line) => escapeFieldData(resolveConfigPart(byLine.get(line), 'a'));
  const b = (line) => escapeFieldData(resolveConfigPart(byLine.get(line), 'b'));
  return [
    '^XA~TA000~JSN^LT0^MNW^MTT^PON^PMN^LH0,0^JMA^PR2,2~SD15^JUS^LRN^CI0',
    '^MMT',
    '^PW799',
    '^LL0400',
    '^LS0',
    `^FT479,246^A0I,25,24^FH\\^FD${b(3)}^FS`,
    `^FT784,246^A0I,25,24^FH\\^FD${a(3)}^FS`,
    `^FT189,302^A0I,25,24^FH\\^FD${b(2)}^FS`,
    `^FT181,350^A0I,28,28^FH\\^FD${b(1)}^FS`,
    `^FT550,296^A0I,39,38^FH\\^FD${a(2)}^FS`,
    `^FT775,350^A0I,45,45^FH\\^FD${a(12)}^FS`,
    `^FT707,296^A0I,39,38^FH\\^FD${a(1)}^FS`,
    '^FO17,281^GB772,0,4^FS',
    '^FO13,139^GB777,0,3^FS',
    `^FT359,21^A0I,20,19^FH\\^FD${a(11)}^FS`,
    `^FT359,111^A0I,20,19^FH\\^FD${b(8)} {{fecha}}^FS`,
    `^FT359,81^A0I,20,19^FH\\^FD${a(9)}^FS`,
    `^FT359,51^A0I,20,19^FH\\^FD${a(10)}^FS`,
    `^FT479,174^A0I,20,19^FH\\^FD${b(6)}^FS`,
    `^FT479,150^A0I,20,19^FH\\^FD${b(5)}^FS`,
    `^FT784,174^A0I,20,19^FH\\^FD${a(6)}^FS`,
    `^FT784,150^A0I,20,19^FH\\^FD${a(5)}^FS`,
    `^FT479,203^A0I,39,38^FH\\^FD${b(4)}^FS`,
    // Eti_CV_VINA2016 elimina los ceros del código de calibre antes de imprimirlo.
    '^FT178,181^A0I,79,79^FH\\^FD{{calibre_sin_ceros}}^FS',
    `^FT784,203^A0I,39,38^FH\\^FD${a(4)}^FS`,
    '^FO182,147^GB0,131,8^FS',
    '^FO490,147^GB0,132,8^FS',
    // Módulo 2 deja zona de silencio y evita invadir los textos regulatorios.
    '^BY2,3,64^FT739,60^BCI,,Y,N',
    '^FD>;{{codigo}}^FS',
    '^PQ1,0,1,Y',
    '^XZ'
  ].join('\n');
};

const configurationSql = `
  SELECT
    ConfLinea,
    LTRIM(RTRIM(ConfText1a)) AS ConfText1a,
    LTRIM(RTRIM(ConfLin1)) AS ConfLin1,
    LTRIM(RTRIM(ConfDato1a)) AS ConfDato1a,
    LTRIM(RTRIM(ConfText1b)) AS ConfText1b,
    LTRIM(RTRIM(ConfLin1b)) AS ConfLin1b,
    LTRIM(RTRIM(ConfDato1b)) AS ConfDato1b,
    LTRIM(RTRIM(ConfTipFecha)) AS ConfTipFecha,
    LTRIM(RTRIM(ConfSepFec)) AS ConfSepFec,
    LTRIM(RTRIM(ConfTipEti)) AS ConfTipEti
  FROM dbo.CONFIGETI
  WHERE EmpCod=@EmpCod AND ConfCod=@ConfCod
  ORDER BY ConfLinea;
`;

const templateSql = `
  SELECT EtiNombre, EtiDescripcion, EtiDesignJson, EtiZpl, EtiActiva,
    EtiSchemaVersion, EtiParserVersion, EtiGeneratorVersion,
    EtiLoginC, EtiFechaC, EtiLoginM, EtiFechaM, EtiRowVersion
  FROM dbo.ETIQUETAPLANTILLA
  WHERE EmpCod=@EmpCod AND ConfCod=@ConfCod;
`;

const listSql = `
  SELECT
    LTRIM(RTRIM(c.ConfCod)) AS ConfCod,
    COUNT(*) AS ConfigurationLines,
    MAX(CASE WHEN c.ConfLinea=1 THEN LTRIM(RTRIM(c.ConfTipEti)) END) AS LabelType,
    MAX(CASE WHEN c.ConfLinea=1 THEN LTRIM(RTRIM(c.ConfText1a)) END) AS ExampleText,
    t.EtiNombre, t.EtiDescripcion, t.EtiAnchoMm, t.EtiAltoMm, t.EtiDpi,
    t.EtiActiva, t.EtiLoginM, t.EtiFechaM, t.EtiRowVersion
  FROM dbo.CONFIGETI c
  LEFT JOIN dbo.ETIQUETAPLANTILLA t
    ON t.EmpCod=c.EmpCod AND t.ConfCod=c.ConfCod
  WHERE c.EmpCod=@EmpCod
  GROUP BY c.ConfCod, t.EtiNombre, t.EtiDescripcion, t.EtiAnchoMm,
    t.EtiAltoMm, t.EtiDpi, t.EtiActiva, t.EtiLoginM, t.EtiFechaM,
    t.EtiRowVersion
  ORDER BY c.ConfCod;
`;

const addScope = (request, empCod, confCod) => request
  .input('EmpCod', sql.SmallInt, empCod)
  .input('ConfCod', sql.Char(10), confCod);

const mapResult = (confCod, lines, row) => {
  let design = null;
  if (row?.EtiDesignJson) {
    try {
      design = JSON.parse(row.EtiDesignJson);
    } catch {
      throw new EtiquetaError(500, 'CORRUPT_LABEL_DESIGN', 'El diseño almacenado no contiene JSON valido.');
    }
  }
  return {
    configuration: {
      code: confCod,
      type: trim(lines[0]?.ConfTipEti),
      lines
    },
    template: row ? {
      name: trim(row.EtiNombre),
      description: trim(row.EtiDescripcion),
      active: Boolean(row.EtiActiva),
      schemaVersion: row.EtiSchemaVersion,
      parserVersion: trim(row.EtiParserVersion),
      generatorVersion: trim(row.EtiGeneratorVersion),
      design,
      zpl: row.EtiZpl,
      revision: revisionText(row.EtiRowVersion),
      createdBy: trim(row.EtiLoginC),
      createdAt: row.EtiFechaC,
      updatedBy: trim(row.EtiLoginM),
      updatedAt: row.EtiFechaM
    } : null
  };
};

const mapListRow = (row) => ({
  code: trim(row.ConfCod),
  configurationLines: Number(row.ConfigurationLines || 0),
  type: trim(row.LabelType),
  exampleText: trim(row.ExampleText),
  hasDesign: Boolean(row.EtiRowVersion),
  name: trim(row.EtiNombre),
  description: trim(row.EtiDescripcion),
  widthMm: row.EtiAnchoMm == null ? null : Number(row.EtiAnchoMm),
  heightMm: row.EtiAltoMm == null ? null : Number(row.EtiAltoMm),
  dpi: row.EtiDpi == null ? null : Number(row.EtiDpi),
  active: row.EtiRowVersion ? Boolean(row.EtiActiva) : null,
  updatedBy: trim(row.EtiLoginM),
  updatedAt: row.EtiFechaM || null,
  revision: revisionText(row.EtiRowVersion)
});

const translateDatabaseError = (error) => {
  if (error instanceof EtiquetaError || error instanceof ZplValidationError) return error;
  if (Number(error?.number) === 208 && /ETIQUETAPLANTILLA/i.test(String(error?.message))) {
    return new EtiquetaError(503, 'LABEL_SCHEMA_MISSING', 'Falta aplicar la migracion de ETIQUETAPLANTILLA.');
  }
  return error;
};

const createEtiquetaService = ({ poolProvider = getPool, fetchImpl = global.fetch } = {}) => {
  const list = async (company) => {
    const empCod = normalizeCompany(company);
    try {
      const pool = await poolProvider();
      const result = await pool.request()
        .input('EmpCod', sql.SmallInt, empCod)
        .query(listSql);
      return { rows: result.recordset.map(mapListRow) };
    } catch (error) {
      throw translateDatabaseError(error);
    }
  };

  const get = async (company, code) => {
    const empCod = normalizeCompany(company);
    const confCod = normalizeConfigCode(code);
    try {
      const pool = await poolProvider();
      const configuration = await addScope(pool.request(), empCod, confCod).query(configurationSql);
      if (!configuration.recordset.length) {
        throw new EtiquetaError(404, 'CONFIGETI_NOT_FOUND', 'La configuracion de etiqueta no existe en la empresa autenticada.');
      }
      const template = await addScope(pool.request(), empCod, confCod).query(templateSql);
      return mapResult(confCod, configuration.recordset, template.recordset[0]);
    } catch (error) {
      throw translateDatabaseError(error);
    }
  };

  const save = async (company, loginValue, code, payload = {}) => {
    const empCod = normalizeCompany(company);
    const confCod = normalizeConfigCode(code);
    const login = normalizeLogin(loginValue);
    const suppliedRevision = revisionBuffer(payload.revision);
    const design = validateDocument(payload.design);
    design.name = String(payload.name || design.name || confCod).trim().slice(0, 100);
    design.description = String(payload.description ?? design.description ?? '').trim().slice(0, 250);
    const zpl = generateZpl(design);
    const pool = await poolProvider();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const configuration = await addScope(new sql.Request(transaction), empCod, confCod).query(configurationSql);
      if (!configuration.recordset.length) {
        throw new EtiquetaError(404, 'CONFIGETI_NOT_FOUND', 'La configuracion de etiqueta no existe en la empresa autenticada.');
      }
      const existing = await addScope(new sql.Request(transaction), empCod, confCod)
        .query('SELECT EtiRowVersion FROM dbo.ETIQUETAPLANTILLA WITH (UPDLOCK, HOLDLOCK) WHERE EmpCod=@EmpCod AND ConfCod=@ConfCod;');

      if (existing.recordset.length && !suppliedRevision) {
        throw new EtiquetaError(409, 'LABEL_REVISION_REQUIRED', 'El diseño ya existe; recargue antes de sobrescribirlo.');
      }
      if (existing.recordset.length && !Buffer.from(existing.recordset[0].EtiRowVersion).equals(suppliedRevision)) {
        throw new EtiquetaError(409, 'LABEL_REVISION_CONFLICT', 'Otro usuario modifico el diseño. Recargue antes de guardar.');
      }

      const request = addScope(new sql.Request(transaction), empCod, confCod)
        .input('EtiNombre', sql.NVarChar(100), design.name)
        .input('EtiDescripcion', sql.NVarChar(250), design.description || null)
        .input('EtiAnchoMm', sql.Decimal(9, 3), design.widthMm)
        .input('EtiAltoMm', sql.Decimal(9, 3), design.heightMm)
        .input('EtiDpi', sql.SmallInt, design.dpi)
        .input('EtiAnchoDots', sql.Int, design.widthDots)
        .input('EtiAltoDots', sql.Int, design.heightDots)
        .input('EtiDesignJson', sql.NVarChar(sql.MAX), JSON.stringify(design))
        .input('EtiZpl', sql.NVarChar(sql.MAX), zpl)
        .input('EtiVersion', sql.VarChar(20), CORE_VERSION)
        .input('EtiLogin', sql.VarChar(10), login);

      if (existing.recordset.length) {
        request.input('Revision', sql.VarBinary(8), suppliedRevision);
        const updated = await request.query(`
          UPDATE dbo.ETIQUETAPLANTILLA SET
            EtiNombre=@EtiNombre, EtiDescripcion=@EtiDescripcion,
            EtiAnchoMm=@EtiAnchoMm, EtiAltoMm=@EtiAltoMm, EtiDpi=@EtiDpi,
            EtiAnchoDots=@EtiAnchoDots, EtiAltoDots=@EtiAltoDots,
            EtiDesignJson=@EtiDesignJson, EtiZpl=@EtiZpl,
            EtiSchemaVersion=1, EtiParserVersion=@EtiVersion, EtiGeneratorVersion=@EtiVersion,
            EtiActiva=1, EtiLoginM=@EtiLogin, EtiFechaM=SYSDATETIME()
          WHERE EmpCod=@EmpCod AND ConfCod=@ConfCod AND EtiRowVersion=@Revision;
        `);
        if (updated.rowsAffected[0] !== 1) {
          throw new EtiquetaError(409, 'LABEL_REVISION_CONFLICT', 'Otro usuario modifico el diseño. Recargue antes de guardar.');
        }
      } else {
        await request.query(`
          INSERT dbo.ETIQUETAPLANTILLA (
            EmpCod, ConfCod, EtiNombre, EtiDescripcion, EtiAnchoMm, EtiAltoMm, EtiDpi,
            EtiAnchoDots, EtiAltoDots, EtiDesignJson, EtiZpl, EtiSchemaVersion,
            EtiParserVersion, EtiGeneratorVersion, EtiActiva,
            EtiLoginC, EtiFechaC, EtiLoginM, EtiFechaM
          ) VALUES (
            @EmpCod, @ConfCod, @EtiNombre, @EtiDescripcion, @EtiAnchoMm, @EtiAltoMm, @EtiDpi,
            @EtiAnchoDots, @EtiAltoDots, @EtiDesignJson, @EtiZpl, 1,
            @EtiVersion, @EtiVersion, 1, @EtiLogin, SYSDATETIME(), @EtiLogin, SYSDATETIME()
          );
        `);
      }
      await transaction.commit();
      return get(empCod, confCod);
    } catch (error) {
      if (transaction._aborted !== true) {
        try { await transaction.rollback(); } catch { /* la transaccion ya puede estar cerrada */ }
      }
      throw translateDatabaseError(error);
    }
  };

  const importZpl = async (company, code, payload = {}) => {
    const current = await get(company, code);
    const design = parseZpl(payload.zpl, {
      dpi: payload.dpi,
      name: payload.name || `Etiqueta ${current.configuration.code}`,
      description: payload.description
    });
    return { configuration: current.configuration, design, zpl: generateZpl(design) };
  };

  const rescue = async (company, code) => {
    const current = await get(company, code);
    const type = String(current.configuration.type || '').trim().toUpperCase();
    if (type !== 'VINASA') {
      throw new EtiquetaError(422, 'HISTORICAL_FORMAT_NOT_SUPPORTED', `El rescate automatico del formato ${type || '(sin tipo)'} aun no esta implementado.`);
    }
    const zpl = buildVinasaZpl(current.configuration.lines);
    const design = parseZpl(zpl, {
      dpi: 203,
      name: `Etiqueta ${current.configuration.code}`,
      description: 'Diseño rescatado de Eti_CV_VINA2016 y CONFIGETI. Revisar antes de guardar.'
    });
    // Eti_CV_VINA2016 imprime todos sus campos invertidos; el editor los rota
    // como conjunto para trabajar en la orientación de lectura sin alterar ZPL.
    design.displayRotation = 180;
    return {
      configuration: current.configuration,
      design,
      zpl,
      source: {
        procedure: 'Eti_CV_VINA2016',
        dispatcher: 'Impi_Etiquetas',
        persisted: false,
        warnings: ['La inicializacion Zebra fue consolidada en un solo bloque editable.', 'La impresion fisica aun requiere validacion.']
      }
    };
  };

  const render = async (company, code, payload = {}) => {
    const current = await get(company, code);
    const design = payload.design ? validateDocument(payload.design) : current.template?.design;
    if (!design) throw new EtiquetaError(404, 'LABEL_DESIGN_NOT_FOUND', 'La configuracion aun no tiene diseño visual.');
    return {
      configuration: current.configuration,
      zpl: generateZpl(design, { variableValues: payload.variables || {} })
    };
  };

  const preview = async (company, code, payload = {}) => {
    if (typeof fetchImpl !== 'function') throw new EtiquetaError(503, 'LABEL_PREVIEW_UNAVAILABLE', 'El render remoto no esta disponible.');
    const current = await get(company, code);
    const design = payload.design ? validateDocument(payload.design) : current.template?.design;
    if (!design) throw new EtiquetaError(404, 'LABEL_DESIGN_NOT_FOUND', 'La configuracion aun no tiene diseño visual.');
    const zpl = generateZpl(design, { variableValues: payload.variables || {}, useSamples: true });
    const dpmm = LABELARY_DPMM[design.dpi];
    const widthInches = (design.widthMm / 25.4).toFixed(3);
    const heightInches = (design.heightMm / 25.4).toFixed(3);
    const baseUrl = String(process.env.LABELARY_BASE_URL || 'https://api.labelary.com').replace(/\/$/, '');
    const response = await fetchImpl(`${baseUrl}/v1/printers/${dpmm}dpmm/labels/${widthInches}x${heightInches}/0/`, {
      method: 'POST',
      headers: { Accept: 'image/png', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: zpl,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new EtiquetaError(502, 'LABEL_PREVIEW_FAILED', `El render ZPL respondio HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new EtiquetaError(502, 'LABEL_PREVIEW_INVALID', 'El render ZPL devolvio una imagen invalida.');
    return bytes;
  };

  const remove = async (company, code, payload = {}) => {
    const empCod = normalizeCompany(company);
    const confCod = normalizeConfigCode(code);
    const revision = revisionBuffer(payload.revision);
    if (!revision) throw new EtiquetaError(400, 'LABEL_REVISION_REQUIRED', 'La revision del diseño es obligatoria para eliminarlo.');
    try {
      const pool = await poolProvider();
      const result = await addScope(pool.request(), empCod, confCod)
        .input('Revision', sql.VarBinary(8), revision)
        .query(`
          DECLARE @Existing bit = CASE WHEN EXISTS (
            SELECT 1 FROM dbo.ETIQUETAPLANTILLA WHERE EmpCod=@EmpCod AND ConfCod=@ConfCod
          ) THEN 1 ELSE 0 END;

          DELETE dbo.ETIQUETAPLANTILLA
          WHERE EmpCod=@EmpCod AND ConfCod=@ConfCod AND EtiRowVersion=@Revision;

          DECLARE @Deleted int = @@ROWCOUNT;
          SELECT @Existing AS Existing, @Deleted AS Deleted;
        `);
      const outcome = result.recordset[0] || {};
      if (!outcome.Existing) throw new EtiquetaError(404, 'LABEL_DESIGN_NOT_FOUND', 'La configuracion no tiene un diseño visual guardado.');
      if (Number(outcome.Deleted) !== 1) {
        throw new EtiquetaError(409, 'LABEL_REVISION_CONFLICT', 'Otro usuario modifico el diseño. Recargue antes de eliminarlo.');
      }
      return { deleted: true, code: confCod };
    } catch (error) {
      throw translateDatabaseError(error);
    }
  };

  return { list, get, save, importZpl, rescue, render, preview, remove };
};

const service = createEtiquetaService();

module.exports = {
  ...service,
  createEtiquetaService,
  ETIQUETAS_PERMISSION,
  EtiquetaError,
  normalizeCompany,
  normalizeConfigCode,
  revisionBuffer,
  buildVinasaZpl
};

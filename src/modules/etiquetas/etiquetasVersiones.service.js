const { getPool, sql } = require('../../conectorMysql/conectorSqlServer');
const { CORE_VERSION, parseZpl, validateDocument, generateZpl } = require('./zpl/zplCore');
const {
  EtiquetaError,
  normalizeCompany,
  normalizeConfigCode,
  revisionBuffer,
  buildVinasaZpl
} = require('./etiquetas.service');

const LABELARY_DPMM = Object.freeze({ 152: 6, 203: 8, 300: 12, 600: 24 });
const trim = (value) => (value == null ? null : String(value).trim());
const revisionText = (value) => (value ? Buffer.from(value).toString('base64') : null);
const normalizeVersion = (value) => {
  const version = Number(value);
  if (!Number.isInteger(version) || version <= 0) throw new EtiquetaError(400, 'INVALID_LABEL_VERSION', 'La versión debe ser un entero positivo.');
  return version;
};
const normalizeTypeCode = (value) => {
  const typeCode = Number(value);
  if (!Number.isInteger(typeCode) || typeCode <= 0 || typeCode > 999) {
    throw new EtiquetaError(400, 'INVALID_LABEL_TYPE', 'Debe seleccionar un tipo de etiqueta válido.');
  }
  return typeCode;
};
const normalizeText = (value, name, max, required = false) => {
  const text = String(value ?? '').trim();
  if (required && !text) throw new EtiquetaError(400, 'INVALID_LABEL_DATA', `${name} es obligatorio.`);
  if (text.length > max) throw new EtiquetaError(400, 'INVALID_LABEL_DATA', `${name} admite hasta ${max} caracteres.`);
  return text || null;
};
const addLabelScope = (request, empCod, etiCod) => request
  .input('EmpCod', sql.SmallInt, empCod)
  .input('EtiCod', sql.Char(10), etiCod);
const addVersionScope = (request, empCod, etiCod, version) => addLabelScope(request, empCod, etiCod)
  .input('EtiVersion', sql.Int, version);

const blankDesign = (name) => ({
  schemaVersion: 1,
  name,
  description: '',
  widthMm: 100,
  heightMm: 50,
  dpi: 203,
  widthDots: 799,
  heightDots: 400,
  displayRotation: 0,
  elements: [],
  variables: []
});

const configurationSql = `
  SELECT ConfLinea, LTRIM(RTRIM(ConfText1a)) ConfText1a,
    LTRIM(RTRIM(ConfLin1)) ConfLin1, ConfDato1a,
    LTRIM(RTRIM(ConfText1b)) ConfText1b,
    LTRIM(RTRIM(ConfLin1b)) ConfLin1b, ConfDato1b,
    ConfTipFecha, LTRIM(RTRIM(ConfSepFec)) ConfSepFec,
    LTRIM(RTRIM(ConfTipEti)) ConfTipEti
  FROM dbo.CONFIGETI
  WHERE EmpCod=@EmpCod AND ConfCod=@ConfCod
  ORDER BY ConfLinea;
`;

const mapVersion = (row, includeDesign = false) => {
  let design;
  if (includeDesign) {
    try { design = JSON.parse(row.EtiDesignJson); } catch {
      throw new EtiquetaError(500, 'CORRUPT_LABEL_DESIGN', 'La versión contiene un diseño JSON inválido.');
    }
  }
  return {
    number: Number(row.EtiVersion),
    name: trim(row.EtiVersionNombre),
    description: trim(row.EtiVersionDescripcion),
    widthMm: Number(row.EtiAnchoMm),
    heightMm: Number(row.EtiAltoMm),
    dpi: Number(row.EtiDpi),
    current: Boolean(row.EtiVigente),
    createdBy: trim(row.EtiLoginC),
    createdAt: row.EtiFechaC,
    updatedBy: trim(row.EtiLoginM),
    updatedAt: row.EtiFechaM,
    revision: revisionText(row.EtiRowVersion),
    ...(includeDesign ? { design, zpl: row.EtiZpl } : {})
  };
};

const createEtiquetaVersionService = ({ poolProvider = getPool, fetchImpl = global.fetch } = {}) => {
  const listTypes = async (company) => {
    const empCod = normalizeCompany(company);
    const pool = await poolProvider();
    const result = await pool.request()
      .input('EmpCod', sql.SmallInt, empCod)
      .query(`SELECT TEtCod AS code, LTRIM(RTRIM(TEtDesc)) AS name
        FROM dbo.TIPETI WHERE EmpCod=@EmpCod AND TEtCod>0 ORDER BY TEtDesc,TEtCod;`);
    return { rows: result.recordset.map((row) => ({ code: Number(row.code), name: trim(row.name) })) };
  };

  const list = async (company) => {
    const empCod = normalizeCompany(company);
    const pool = await poolProvider();
    const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
      SELECT e.EtiCod, e.EtiNombre, e.EtiDescripcion, e.TEtCod,
        LTRIM(RTRIM(t.TEtDesc)) AS TEtDesc, e.EtiTipo,
        e.EtiConfCodOrigen, e.EtiActiva, e.EtiLoginC, e.EtiFechaC,
        e.EtiLoginM, e.EtiFechaM, e.EtiRowVersion AS HeaderRowVersion,
        v.EtiVersion, v.EtiVersionNombre, v.EtiVersionDescripcion,
        v.EtiAnchoMm, v.EtiAltoMm, v.EtiDpi, v.EtiVigente,
        JSON_VALUE(v.EtiDesignJson, '$.displayRotation') AS DisplayRotation,
        v.EtiLoginC AS VersionLoginC, v.EtiFechaC AS VersionFechaC,
        v.EtiLoginM AS VersionLoginM, v.EtiFechaM AS VersionFechaM,
        v.EtiRowVersion AS VersionRowVersion
      FROM dbo.ETIQUETA e
      LEFT JOIN dbo.ETIQUETAVERSION v
        ON v.EmpCod=e.EmpCod AND v.EtiCod=e.EtiCod
      LEFT JOIN dbo.TIPETI t
        ON t.EmpCod=e.EmpCod AND t.TEtCod=e.TEtCod
      WHERE e.EmpCod=@EmpCod
      ORDER BY e.EtiCod, v.EtiVersion DESC;
    `);
    const labels = new Map();
    for (const row of result.recordset) {
      const code = trim(row.EtiCod);
      if (!labels.has(code)) labels.set(code, {
        code,
        name: trim(row.EtiNombre),
        description: trim(row.EtiDescripcion),
        typeCode: row.TEtCod == null ? null : Number(row.TEtCod),
        typeName: trim(row.TEtDesc),
        format: trim(row.EtiTipo),
        legacyConfigCode: trim(row.EtiConfCodOrigen),
        active: Boolean(row.EtiActiva),
        createdBy: trim(row.EtiLoginC),
        createdAt: row.EtiFechaC,
        updatedBy: trim(row.EtiLoginM),
        updatedAt: row.EtiFechaM,
        revision: revisionText(row.HeaderRowVersion),
        versions: []
      });
      if (row.EtiVersion != null) labels.get(code).versions.push({
        number: Number(row.EtiVersion),
        name: trim(row.EtiVersionNombre),
        description: trim(row.EtiVersionDescripcion),
        widthMm: Number(row.EtiAnchoMm),
        heightMm: Number(row.EtiAltoMm),
        dpi: Number(row.EtiDpi),
        displayRotation: Number(row.DisplayRotation || 0),
        current: Boolean(row.EtiVigente),
        createdBy: trim(row.VersionLoginC),
        createdAt: row.VersionFechaC,
        updatedBy: trim(row.VersionLoginM),
        updatedAt: row.VersionFechaM,
        revision: revisionText(row.VersionRowVersion)
      });
    }
    return { rows: [...labels.values()] };
  };

  const createLabel = async (company, loginValue, payload = {}) => {
    const empCod = normalizeCompany(company);
    const code = normalizeConfigCode(payload.code);
    const login = String(loginValue || 'MIGRACION').trim().slice(0, 10) || 'MIGRACION';
    const typeCode = normalizeTypeCode(payload.typeCode);
    const name = normalizeText(payload.name, 'Nombre', 100, true);
    const description = normalizeText(payload.description, 'Descripción', 250);
    try {
      const pool = await poolProvider();
      const validType = await pool.request()
        .input('EmpCod', sql.SmallInt, empCod)
        .input('TEtCod', sql.SmallInt, typeCode)
        .query('SELECT 1 AS found FROM dbo.TIPETI WHERE EmpCod=@EmpCod AND TEtCod=@TEtCod AND TEtCod>0;');
      if (!validType.recordset.length) throw new EtiquetaError(400, 'INVALID_LABEL_TYPE', 'El tipo de etiqueta no existe en la empresa autenticada.');
      await addLabelScope(pool.request(), empCod, code)
        .input('Nombre', sql.NVarChar(100), name)
        .input('Descripcion', sql.NVarChar(250), description)
        .input('TEtCod', sql.SmallInt, typeCode)
        .input('Login', sql.VarChar(10), login)
        .query(`INSERT dbo.ETIQUETA (
          EmpCod,EtiCod,EtiNombre,EtiDescripcion,TEtCod,EtiActiva,
          EtiLoginC,EtiFechaC,EtiLoginM,EtiFechaM
        ) VALUES (@EmpCod,@EtiCod,@Nombre,@Descripcion,@TEtCod,1,@Login,SYSDATETIME(),@Login,SYSDATETIME());`);
      return { created: true, code };
    } catch (error) {
      if (Number(error?.number) === 2627 || Number(error?.number) === 2601) throw new EtiquetaError(409, 'LABEL_ALREADY_EXISTS', 'Ya existe una etiqueta con ese código.');
      throw error;
    }
  };

  const updateLabel = async (company, loginValue, codeValue, payload = {}) => {
    const empCod = normalizeCompany(company);
    const code = normalizeConfigCode(codeValue);
    const revision = revisionBuffer(payload.revision);
    if (!revision) throw new EtiquetaError(400, 'LABEL_REVISION_REQUIRED', 'La revisión de la etiqueta es obligatoria.');
    const login = String(loginValue || 'MIGRACION').trim().slice(0, 10) || 'MIGRACION';
    const typeCode = normalizeTypeCode(payload.typeCode);
    const pool = await poolProvider();
    const validType = await pool.request()
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TEtCod', sql.SmallInt, typeCode)
      .query('SELECT 1 AS found FROM dbo.TIPETI WHERE EmpCod=@EmpCod AND TEtCod=@TEtCod AND TEtCod>0;');
    if (!validType.recordset.length) throw new EtiquetaError(400, 'INVALID_LABEL_TYPE', 'El tipo de etiqueta no existe en la empresa autenticada.');
    const result = await addLabelScope(pool.request(), empCod, code)
      .input('Nombre', sql.NVarChar(100), normalizeText(payload.name, 'Nombre', 100, true))
      .input('Descripcion', sql.NVarChar(250), normalizeText(payload.description, 'Descripción', 250))
      .input('TEtCod', sql.SmallInt, typeCode)
      .input('Activa', sql.Bit, payload.active === false ? 0 : 1)
      .input('Login', sql.VarChar(10), login)
      .input('Revision', sql.VarBinary(8), revision)
      .query(`UPDATE dbo.ETIQUETA SET EtiNombre=@Nombre,EtiDescripcion=@Descripcion,
        TEtCod=@TEtCod,EtiActiva=@Activa,EtiLoginM=@Login,EtiFechaM=SYSDATETIME()
        WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod AND EtiRowVersion=@Revision;`);
    if (result.rowsAffected[0] !== 1) throw new EtiquetaError(409, 'LABEL_REVISION_CONFLICT', 'La etiqueta fue modificada por otro usuario. Recargue la pantalla.');
    return { updated: true, code };
  };

  const removeLabel = async (company, codeValue, payload = {}) => {
    const empCod = normalizeCompany(company);
    const code = normalizeConfigCode(codeValue);
    const revision = revisionBuffer(payload.revision);
    if (!revision) throw new EtiquetaError(400, 'LABEL_REVISION_REQUIRED', 'La revisión de la etiqueta es obligatoria.');
    const pool = await poolProvider();
    const result = await addLabelScope(pool.request(), empCod, code)
      .input('Revision', sql.VarBinary(8), revision)
      .query('DELETE dbo.ETIQUETA WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod AND EtiRowVersion=@Revision;');
    if (result.rowsAffected[0] !== 1) throw new EtiquetaError(409, 'LABEL_REVISION_CONFLICT', 'La etiqueta fue modificada o ya no existe.');
    return { deleted: true, code };
  };

  const getVersion = async (company, codeValue, versionValue) => {
    const empCod = normalizeCompany(company);
    const code = normalizeConfigCode(codeValue);
    const version = normalizeVersion(versionValue);
    const pool = await poolProvider();
    const result = await addVersionScope(pool.request(), empCod, code, version).query(`
      SELECT e.EtiNombre,e.TEtCod,LTRIM(RTRIM(t.TEtDesc)) AS TEtDesc,
        e.EtiTipo,e.EtiConfCodOrigen,
        v.* FROM dbo.ETIQUETA e
      INNER JOIN dbo.ETIQUETAVERSION v ON v.EmpCod=e.EmpCod AND v.EtiCod=e.EtiCod
      LEFT JOIN dbo.TIPETI t ON t.EmpCod=e.EmpCod AND t.TEtCod=e.TEtCod
      WHERE e.EmpCod=@EmpCod AND e.EtiCod=@EtiCod AND v.EtiVersion=@EtiVersion;
    `);
    if (!result.recordset.length) throw new EtiquetaError(404, 'LABEL_VERSION_NOT_FOUND', 'La versión de etiqueta no existe.');
    const row = result.recordset[0];
    const mapped = mapVersion(row, true);
    return {
      configuration: { code, type: trim(row.EtiTipo), lines: [] },
      label: {
        code,
        name: trim(row.EtiNombre),
        typeCode: row.TEtCod == null ? null : Number(row.TEtCod),
        typeName: trim(row.TEtDesc),
        legacyConfigCode: trim(row.EtiConfCodOrigen)
      },
      versionNumber: version,
      template: {
        name: mapped.name,
        description: mapped.description,
        active: mapped.current,
        design: mapped.design,
        zpl: mapped.zpl,
        revision: mapped.revision,
        createdBy: mapped.createdBy,
        createdAt: mapped.createdAt,
        updatedBy: mapped.updatedBy,
        updatedAt: mapped.updatedAt
      }
    };
  };

  const createVersion = async (company, loginValue, codeValue, payload = {}) => {
    const empCod = normalizeCompany(company);
    const code = normalizeConfigCode(codeValue);
    const login = String(loginValue || 'MIGRACION').trim().slice(0, 10) || 'MIGRACION';
    const pool = await poolProvider();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const header = await addLabelScope(new sql.Request(transaction), empCod, code).query(`
        SELECT EtiNombre,EtiTipo,EtiConfCodOrigen FROM dbo.ETIQUETA WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod;`);
      if (!header.recordset.length) throw new EtiquetaError(404, 'LABEL_NOT_FOUND', 'La etiqueta no existe.');
      const next = await addLabelScope(new sql.Request(transaction), empCod, code).query(`
        SELECT ISNULL(MAX(EtiVersion),0)+1 AS NextVersion, COUNT(*) AS VersionCount
        FROM dbo.ETIQUETAVERSION WITH (UPDLOCK,HOLDLOCK)
        WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod;`);
      const number = Number(next.recordset[0].NextVersion);
      const source = String(payload.source || 'blank').toLowerCase();
      let design;
      if (source === 'copy') {
        const sourceVersion = normalizeVersion(payload.sourceVersion);
        const copied = await addVersionScope(new sql.Request(transaction), empCod, code, sourceVersion)
          .query('SELECT EtiDesignJson FROM dbo.ETIQUETAVERSION WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod AND EtiVersion=@EtiVersion;');
        if (!copied.recordset.length) throw new EtiquetaError(404, 'LABEL_VERSION_NOT_FOUND', 'La versión de origen no existe.');
        design = validateDocument(JSON.parse(copied.recordset[0].EtiDesignJson));
      } else if (source === 'gx8') {
        const legacyCode = trim(header.recordset[0].EtiConfCodOrigen);
        if (!legacyCode) throw new EtiquetaError(422, 'HISTORICAL_SOURCE_NOT_FOUND', 'La etiqueta no tiene una configuración GX8 asociada.');
        const historical = await new sql.Request(transaction)
          .input('EmpCod', sql.SmallInt, empCod)
          .input('ConfCod', sql.Char(10), legacyCode)
          .query(configurationSql);
        const type = String(historical.recordset[0]?.ConfTipEti || header.recordset[0].EtiTipo || '').trim().toUpperCase();
        if (type !== 'VINASA') throw new EtiquetaError(422, 'HISTORICAL_FORMAT_NOT_SUPPORTED', `El rescate automático de ${type || '(sin tipo)'} aún no está implementado.`);
        design = parseZpl(buildVinasaZpl(historical.recordset), { dpi: 203, name: `Versión ${number} · ${code}` });
        design.displayRotation = 180;
      } else {
        design = blankDesign(`Versión ${number} · ${code}`);
      }
      design.name = normalizeText(payload.name, 'Nombre de versión', 100) || `Versión ${number}`;
      design.description = normalizeText(payload.description, 'Descripción', 250) || '';
      const zpl = generateZpl(design);
      const makeCurrent = Number(next.recordset[0].VersionCount) === 0 || payload.current === true;
      if (makeCurrent) await addLabelScope(new sql.Request(transaction), empCod, code)
        .query('UPDATE dbo.ETIQUETAVERSION SET EtiVigente=0 WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod;');
      await addVersionScope(new sql.Request(transaction), empCod, code, number)
        .input('Nombre', sql.NVarChar(100), design.name)
        .input('Descripcion', sql.NVarChar(250), design.description || null)
        .input('AnchoMm', sql.Decimal(9, 3), design.widthMm)
        .input('AltoMm', sql.Decimal(9, 3), design.heightMm)
        .input('Dpi', sql.SmallInt, design.dpi)
        .input('AnchoDots', sql.Int, design.widthDots)
        .input('AltoDots', sql.Int, design.heightDots)
        .input('Json', sql.NVarChar(sql.MAX), JSON.stringify(design))
        .input('Zpl', sql.NVarChar(sql.MAX), zpl)
        .input('Core', sql.VarChar(20), CORE_VERSION)
        .input('Vigente', sql.Bit, makeCurrent ? 1 : 0)
        .input('Login', sql.VarChar(10), login)
        .query(`INSERT dbo.ETIQUETAVERSION (
          EmpCod,EtiCod,EtiVersion,EtiVersionNombre,EtiVersionDescripcion,
          EtiAnchoMm,EtiAltoMm,EtiDpi,EtiAnchoDots,EtiAltoDots,EtiDesignJson,EtiZpl,
          EtiSchemaVersion,EtiParserVersion,EtiGeneratorVersion,EtiVigente,
          EtiLoginC,EtiFechaC,EtiLoginM,EtiFechaM
        ) VALUES (@EmpCod,@EtiCod,@EtiVersion,@Nombre,@Descripcion,@AnchoMm,@AltoMm,
          @Dpi,@AnchoDots,@AltoDots,@Json,@Zpl,1,@Core,@Core,@Vigente,
          @Login,SYSDATETIME(),@Login,SYSDATETIME());`);
      await transaction.commit();
      return getVersion(empCod, code, number);
    } catch (error) {
      if (transaction._aborted !== true) { try { await transaction.rollback(); } catch { /* cerrada */ } }
      throw error;
    }
  };

  const saveVersion = async (company, loginValue, codeValue, versionValue, payload = {}) => {
    const empCod = normalizeCompany(company);
    const code = normalizeConfigCode(codeValue);
    const version = normalizeVersion(versionValue);
    const revision = revisionBuffer(payload.revision);
    if (!revision) throw new EtiquetaError(400, 'LABEL_REVISION_REQUIRED', 'La revisión del diseño es obligatoria.');
    const login = String(loginValue || 'MIGRACION').trim().slice(0, 10) || 'MIGRACION';
    const design = validateDocument(payload.design);
    design.name = normalizeText(payload.name || design.name, 'Nombre de versión', 100, true);
    design.description = normalizeText(payload.description ?? design.description, 'Descripción', 250) || '';
    const zpl = generateZpl(design);
    const pool = await poolProvider();
    const result = await addVersionScope(pool.request(), empCod, code, version)
      .input('Revision', sql.VarBinary(8), revision)
      .input('Nombre', sql.NVarChar(100), design.name)
      .input('Descripcion', sql.NVarChar(250), design.description || null)
      .input('AnchoMm', sql.Decimal(9, 3), design.widthMm)
      .input('AltoMm', sql.Decimal(9, 3), design.heightMm)
      .input('Dpi', sql.SmallInt, design.dpi)
      .input('AnchoDots', sql.Int, design.widthDots)
      .input('AltoDots', sql.Int, design.heightDots)
      .input('Json', sql.NVarChar(sql.MAX), JSON.stringify(design))
      .input('Zpl', sql.NVarChar(sql.MAX), zpl)
      .input('Core', sql.VarChar(20), CORE_VERSION)
      .input('Login', sql.VarChar(10), login)
      .query(`UPDATE dbo.ETIQUETAVERSION SET EtiVersionNombre=@Nombre,
        EtiVersionDescripcion=@Descripcion,EtiAnchoMm=@AnchoMm,EtiAltoMm=@AltoMm,
        EtiDpi=@Dpi,EtiAnchoDots=@AnchoDots,EtiAltoDots=@AltoDots,
        EtiDesignJson=@Json,EtiZpl=@Zpl,EtiSchemaVersion=1,
        EtiParserVersion=@Core,EtiGeneratorVersion=@Core,
        EtiLoginM=@Login,EtiFechaM=SYSDATETIME()
        WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod AND EtiVersion=@EtiVersion
          AND EtiRowVersion=@Revision;`);
    if (result.rowsAffected[0] !== 1) throw new EtiquetaError(409, 'LABEL_REVISION_CONFLICT', 'La versión fue modificada por otro usuario. Recargue antes de guardar.');
    return getVersion(empCod, code, version);
  };

  const removeVersion = async (company, codeValue, versionValue, payload = {}) => {
    const empCod = normalizeCompany(company);
    const code = normalizeConfigCode(codeValue);
    const version = normalizeVersion(versionValue);
    const revision = revisionBuffer(payload.revision);
    if (!revision) throw new EtiquetaError(400, 'LABEL_REVISION_REQUIRED', 'La revisión de la versión es obligatoria.');
    const pool = await poolProvider();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const result = await addVersionScope(new sql.Request(transaction), empCod, code, version)
        .input('Revision', sql.VarBinary(8), revision)
        .query(`DELETE dbo.ETIQUETAVERSION
          OUTPUT deleted.EtiVigente AS WasCurrent
          WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod AND EtiVersion=@EtiVersion
            AND EtiRowVersion=@Revision;`);
      if (!result.recordset.length) throw new EtiquetaError(409, 'LABEL_REVISION_CONFLICT', 'La versión fue modificada o ya no existe.');
      if (result.recordset[0].WasCurrent) await addLabelScope(new sql.Request(transaction), empCod, code).query(`
        UPDATE dbo.ETIQUETAVERSION SET EtiVigente=1
        WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod AND EtiVersion=(
          SELECT MAX(EtiVersion) FROM dbo.ETIQUETAVERSION WHERE EmpCod=@EmpCod AND EtiCod=@EtiCod
        );`);
      await transaction.commit();
      return { deleted: true, code, version };
    } catch (error) {
      if (transaction._aborted !== true) { try { await transaction.rollback(); } catch { /* cerrada */ } }
      throw error;
    }
  };

  const importZpl = async (company, code, version, payload = {}) => {
    const current = await getVersion(company, code, version);
    const design = parseZpl(payload.zpl, { dpi: payload.dpi, name: payload.name || current.template.name, description: payload.description });
    return { ...current, design, zpl: generateZpl(design) };
  };

  const render = async (company, code, version, payload = {}) => {
    const current = await getVersion(company, code, version);
    const design = payload.design ? validateDocument(payload.design) : current.template.design;
    return { configuration: current.configuration, zpl: generateZpl(design, { variableValues: payload.variables || {} }) };
  };

  const preview = async (company, code, version, payload = {}) => {
    if (typeof fetchImpl !== 'function') throw new EtiquetaError(503, 'LABEL_PREVIEW_UNAVAILABLE', 'El render remoto no está disponible.');
    const current = await getVersion(company, code, version);
    const design = payload.design ? validateDocument(payload.design) : current.template.design;
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
    if (!response.ok) throw new EtiquetaError(502, 'LABEL_PREVIEW_FAILED', `El render ZPL respondió HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new EtiquetaError(502, 'LABEL_PREVIEW_INVALID', 'El render ZPL devolvió una imagen inválida.');
    return bytes;
  };

  return { listTypes, list, createLabel, updateLabel, removeLabel, createVersion, getVersion, saveVersion, removeVersion, importZpl, render, preview };
};

const service = createEtiquetaVersionService();
module.exports = { ...service, createEtiquetaVersionService, normalizeVersion, normalizeTypeCode, blankDesign };

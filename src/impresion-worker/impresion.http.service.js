const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { validateDocument, generateZpl } = require('../modules/etiquetas/zpl/zplCore');
const { sendZpl } = require('./printerClient');

class ImpresionHttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const positiveInteger = (value, name) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new ImpresionHttpError(400, 'INVALID_PRINT_DATA', `${name} debe ser un entero positivo.`);
  return number;
};
const trim = (value) => String(value ?? '').trim();
const printerPayload = (payload = {}) => {
  const id = positiveInteger(payload.id, 'Línea');
  if (id > 9999) throw new ImpresionHttpError(400, 'INVALID_PRINTER_DATA', 'La línea excede el rango permitido.');
  const name = trim(payload.name);
  const ip = trim(payload.ip);
  if (!name || name.length > 50) throw new ImpresionHttpError(400, 'INVALID_PRINTER_DATA', 'El nombre es obligatorio y admite hasta 50 caracteres.');
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new ImpresionHttpError(400, 'INVALID_PRINTER_DATA', 'La dirección IP no es válida.');
  }
  return { id, name, ip };
};
const TEST_VALUES = Object.freeze({
  codigo: '00000100203400701016000', producto: 'CEREZAS', especie: 'CEREZAS',
  variedad: 'BING', fecha: '09/09/2026', productor: 'PRODUCTOR PRUEBA',
  comuna: 'COMUNA PRUEBA', provincia: 'PROVINCIA PRUEBA', calibre: '00LL',
  envase: '5 KG', envase_externo: '5 KG', categoria: 'EXPORTACIÓN', lote: '1'
});
const testVariables = (design, supplied = {}) => Object.fromEntries((design.variables || []).map((variable) => {
  const name = trim(variable.name).toLowerCase();
  const explicit = Object.prototype.hasOwnProperty.call(supplied, name) ? supplied[name] : undefined;
  const stored = trim(variable.sampleValue);
  const sample = stored && stored.toLowerCase() !== name ? stored : TEST_VALUES[name];
  return [name, explicit ?? sample ?? `PRUEBA ${name.toUpperCase()}`];
}));

const createImpresionHttpService = ({ poolProvider = getPool, send = sendZpl } = {}) => {
  const listPrinters = async (company) => {
    const empCod = positiveInteger(company, 'Empresa');
    const pool = await poolProvider();
    const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
      SELECT i.CIMPID AS id,LTRIM(RTRIM(i.CIMPNombre)) AS name,LTRIM(RTRIM(i.CIMPIP)) AS ip,
        MIN(l.LinMaquina) AS machine, MAX(LTRIM(RTRIM(l.LinDesc))) AS lineDescription
      FROM dbo.ConfImpresoras i
      LEFT JOIN dbo.LINEAS l ON l.EmpCod=i.EmpCod AND l.LinID=i.CIMPID
      WHERE i.EmpCod=@EmpCod
      GROUP BY i.CIMPID,i.CIMPNombre,i.CIMPIP
      ORDER BY i.CIMPID;
    `);
    return { rows: result.recordset.map((row) => ({ id: Number(row.id), name: trim(row.name), ip: trim(row.ip), machine: row.machine == null ? null : Number(row.machine), lineDescription: trim(row.lineDescription) })) };
  };

  const createPrinter = async (company, payload = {}) => {
    const empCod = positiveInteger(company, 'Empresa');
    const printer = printerPayload(payload);
    const pool = await poolProvider();
    try {
      await pool.request().input('EmpCod', sql.SmallInt, empCod).input('Id', sql.SmallInt, printer.id)
        .input('Name', sql.Char(50), printer.name).input('Ip', sql.Char(15), printer.ip).query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.LINEAS WHERE EmpCod=@EmpCod AND LinID=@Id)
            THROW 50044, 'La línea seleccionada no existe en la empresa autenticada.', 1;
          IF EXISTS (SELECT 1 FROM dbo.ConfImpresoras WHERE EmpCod=@EmpCod AND CIMPID=@Id)
            THROW 50045, 'La línea ya tiene una impresora configurada.', 1;
          INSERT dbo.ConfImpresoras(EmpCod,CIMPID,CIMPNombre,CIMPIP)
          VALUES(@EmpCod,@Id,@Name,@Ip);
        `);
    } catch (error) {
      if (Number(error.number) === 50044) throw new ImpresionHttpError(404, 'LINE_NOT_FOUND', error.message);
      if ([50045, 2601, 2627].includes(Number(error.number))) throw new ImpresionHttpError(409, 'PRINTER_LINE_EXISTS', 'La línea ya tiene una impresora configurada.');
      throw error;
    }
    return { created: true, printer };
  };

  const updatePrinter = async (company, idValue, payload = {}) => {
    const empCod = positiveInteger(company, 'Empresa');
    const printer = printerPayload({ ...payload, id: idValue });
    const pool = await poolProvider();
    const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).input('Id', sql.SmallInt, printer.id)
      .input('Name', sql.Char(50), printer.name).input('Ip', sql.Char(15), printer.ip)
      .query('UPDATE dbo.ConfImpresoras SET CIMPNombre=@Name,CIMPIP=@Ip WHERE EmpCod=@EmpCod AND CIMPID=@Id;');
    if (result.rowsAffected[0] !== 1) throw new ImpresionHttpError(404, 'PRINTER_NOT_FOUND', 'La configuración de impresora no existe.');
    return { updated: true, printer };
  };

  const deletePrinter = async (company, idValue) => {
    const empCod = positiveInteger(company, 'Empresa');
    const id = positiveInteger(idValue, 'Línea');
    const pool = await poolProvider();
    const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).input('Id', sql.SmallInt, id)
      .query('DELETE FROM dbo.ConfImpresoras WHERE EmpCod=@EmpCod AND CIMPID=@Id;');
    if (result.rowsAffected[0] !== 1) throw new ImpresionHttpError(404, 'PRINTER_NOT_FOUND', 'La configuración de impresora no existe.');
    return { deleted: true, id };
  };

  const printLabelTest = async (company, payload = {}) => {
    const empCod = positiveInteger(company, 'Empresa');
    const printerId = positiveInteger(payload.printerId, 'Impresora');
    const labelCode = trim(payload.labelCode).slice(0, 10);
    const version = positiveInteger(payload.version, 'Versión');
    if (!labelCode) throw new ImpresionHttpError(400, 'INVALID_PRINT_DATA', 'La etiqueta es obligatoria.');
    const pool = await poolProvider();
    const result = await pool.request().input('EmpCod', sql.SmallInt, empCod)
      .input('PrinterId', sql.SmallInt, printerId).input('EtiCod', sql.Char(10), labelCode)
      .input('Version', sql.Int, version).query(`
        SELECT TOP (1) LTRIM(RTRIM(i.CIMPNombre)) AS PrinterName,LTRIM(RTRIM(i.CIMPIP)) AS PrinterIp,
          e.EtiActiva,v.EtiDesignJson
        FROM dbo.ConfImpresoras i
        CROSS JOIN dbo.ETIQUETA e
        INNER JOIN dbo.ETIQUETAVERSION v ON v.EmpCod=e.EmpCod AND v.EtiCod=e.EtiCod AND v.EtiVersion=@Version
        WHERE i.EmpCod=@EmpCod AND i.CIMPID=@PrinterId
          AND e.EmpCod=@EmpCod AND e.EtiCod=@EtiCod;
      `);
    if (!result.recordset.length) throw new ImpresionHttpError(404, 'PRINT_TARGET_NOT_FOUND', 'No existe la impresora, etiqueta o versión seleccionada.');
    const row = result.recordset[0];
    if (!row.EtiActiva) throw new ImpresionHttpError(409, 'LABEL_INACTIVE', 'La etiqueta está inactiva.');
    if (!trim(row.PrinterIp)) throw new ImpresionHttpError(422, 'PRINTER_WITHOUT_IP', 'La impresora no tiene una IP configurada.');
    let design;
    try { design = payload.design ? validateDocument(payload.design) : validateDocument(JSON.parse(row.EtiDesignJson)); }
    catch (error) { throw new ImpresionHttpError(400, 'INVALID_LABEL_DESIGN', error.message); }
    const zpl = generateZpl(design, { variableValues: testVariables(design, payload.variables || {}) });
    await send({ host: trim(row.PrinterIp), port: Number(process.env.PRINT_PORT || 9100), timeoutMs: Number(process.env.PRINT_TIMEOUT_MS || 5000), zpl });
    return { printed: true, printer: { id: printerId, name: trim(row.PrinterName), ip: trim(row.PrinterIp) }, label: { code: labelCode, version } };
  };

  const simulateLine = async (company, machineValue, lineValue) => {
    const empCod = positiveInteger(company, 'Empresa');
    const machine = positiveInteger(machineValue, 'Máquina');
    const line = positiveInteger(lineValue, 'Línea');
    const workerCompany = Number(process.env.PRINT_EMP_COD || 1);
    if (empCod !== workerCompany) throw new ImpresionHttpError(422, 'PRINT_COMPANY_NOT_CONFIGURED', `El worker está configurado para la empresa ${workerCompany}.`);
    const pool = await poolProvider();
    const schema = await pool.request().query(`
      SELECT COL_LENGTH(N'dbo.OrdenImpresion',N'OPLCFechaIns') AS FechaInsBytes,
        CASE WHEN EXISTS (
          SELECT 1 FROM sys.triggers
          WHERE parent_id=OBJECT_ID(N'dbo.OrdenImpresion') AND name=N'Imprime' AND is_disabled=0
        ) THEN 1 ELSE 0 END AS LegacyTriggerActive;
    `);
    if (schema.recordset[0]?.FechaInsBytes == null) {
      throw new ImpresionHttpError(503, 'PRINT_SCHEMA_MISSING', 'Falta aplicar la migración del worker de impresión.');
    }
    if (schema.recordset[0]?.LegacyTriggerActive) {
      throw new ImpresionHttpError(409, 'LEGACY_PRINT_TRIGGER_ACTIVE', 'Debe deshabilitar el trigger histórico Imprime antes de simular una orden.');
    }
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const request = new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod)
        .input('Machine', sql.SmallInt, machine).input('Line', sql.SmallInt, line);
      const result = await request.query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.LINEAS WHERE EmpCod=@EmpCod AND LinMaquina=@Machine AND LinID=@Line)
          THROW 50043, 'La línea indicada no existe en la empresa autenticada.', 1;

        IF COLUMNPROPERTY(OBJECT_ID(N'dbo.OrdenImpresion'),N'OPLCID','IsIdentity')=1
          INSERT dbo.OrdenImpresion(OPLCIMP,OPLCFecha,OPLCProc,OPLCFechaIns)
            OUTPUT INSERTED.OPLCID AS id VALUES(@Line,NULL,0,GETDATE());
        ELSE BEGIN
          DECLARE @Next decimal(10,0);
          SELECT @Next=ISNULL(MAX(OPLCID),0)+1 FROM dbo.OrdenImpresion WITH (UPDLOCK,HOLDLOCK);
          INSERT dbo.OrdenImpresion(OPLCID,OPLCIMP,OPLCFecha,OPLCProc,OPLCFechaIns)
            OUTPUT INSERTED.OPLCID AS id VALUES(@Next,@Line,NULL,0,GETDATE());
        END;
      `);
      await transaction.commit();
      return { queued: true, id: Number(result.recordset[0].id), machine, line };
    } catch (error) {
      await transaction.rollback();
      if (Number(error.number) === 50043) throw new ImpresionHttpError(404, 'LINE_NOT_FOUND', error.message);
      throw error;
    }
  };

  return { listPrinters, createPrinter, updatePrinter, deletePrinter, printLabelTest, simulateLine };
};

module.exports = { createImpresionHttpService, ImpresionHttpError, printerPayload, testVariables };

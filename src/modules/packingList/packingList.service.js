const { getPool, sql } = require('../../conectorMysql/conectorSqlServer');
const { nextCorrelative } = require('../../services/gxCorrelatives.service');

const permission = { sistema: 100, modulo: 2, programa: 13 };
class PackingListError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (message, status = 400, code = 'VALIDATION_ERROR') => { throw new PackingListError(status, code, message); };
const number = (value, label, max = 9999999999) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) fail(`${label} debe ser un número válido.`);
  return parsed;
};
const type = (value) => {
  const parsed = number(value, 'El tipo', 4);
  return parsed;
};
const date = (value, label) => {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00`))) fail(`${label} debe ser una fecha válida.`);
  return text;
};
const optionalDate = (value, label) => value ? date(value, label) : null;
const text = (value, length) => String(value || '').trim().slice(0, length);
const base = (request, empCod, tempCod) => request.input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod);
const activeSeason = async (request, empCod) => {
  const result = await request.input('EmpCod', sql.SmallInt, empCod).query('SELECT TOP 1 RTRIM(TempCod) tempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC');
  if (!result.recordset[0]) fail('La empresa no tiene temporada activa.', 409, 'NO_ACTIVE_SEASON');
  return result.recordset[0].tempCod;
};
const key = (request, empCod, tempCod, packNumI) => base(request, empCod, tempCod).input('PackNumI', sql.Decimal(10, 0), packNumI);

const getFormData = async (empCod) => {
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const [clients, ports] = await Promise.all([
    pool.request().input('EmpCod', sql.SmallInt, empCod).query('SELECT CliCod id,RTRIM(CliNom) name FROM CLIENTES WHERE EmpCod=@EmpCod ORDER BY CliNom'),
    pool.request().query('SELECT PuCod id,RTRIM(PuNombre) name,RTRIM(PUCodHomo) homologation FROM PUERTOS ORDER BY PuNombre')
  ]);
  return { tempCod, clients: clients.recordset, ports: ports.recordset };
};

const list = async (empCod, filters = {}) => {
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const packTipo = filters.type && filters.type !== 'all' ? type(filters.type) : 0;
  const search = text(filters.search, 40);
  const from = optionalDate(filters.from, 'La fecha desde');
  const to = optionalDate(filters.to, 'La fecha hasta');
  if (from && to && from > to) fail('La fecha desde no puede ser posterior a la fecha hasta.');
  const result = await base(pool.request(), empCod, tempCod)
    .input('PackTipo', sql.SmallInt, packTipo).input('Search', sql.VarChar(40), search)
    .input('From', sql.Date, from).input('To', sql.Date, to)
    .query(`SELECT p.PackNumI id,p.PackTipo type,p.PackNumG sourceNumber,
      CONVERT(char(10),p.PackFecha,23) packingDate,CONVERT(char(10),p.PackFecZar,23) departureDate,
      RTRIM(c.CliNom) clientName,p.CliCod clientId,p.PackTotCajas boxes,p.PackTotPal pallets,
      p.PackKilos kilos,p.PackKilosB grossKilos,p.PackGuia guideNumber,p.PackEstado status,
      RTRIM(p.PackPatente) patent,RTRIM(p.PackNave) vessel
      FROM PACKLIST p LEFT JOIN CLIENTES c ON c.EmpCod=p.EmpCod AND c.CliCod=p.CliCod
      WHERE p.EmpCod=@EmpCod AND p.TempCod=@TempCod AND (@PackTipo=0 OR p.PackTipo=@PackTipo)
        AND (@From IS NULL OR p.PackFecha>=@From)
        AND (@To IS NULL OR p.PackFecha<DATEADD(day,1,@To))
        AND (@Search='' OR CONVERT(varchar(20),p.PackNumI) LIKE '%'+@Search+'%'
          OR CONVERT(varchar(20),p.PackNumG) LIKE '%'+@Search+'%'
          OR c.CliNom LIKE '%'+@Search+'%')
      ORDER BY p.PackNumI DESC`);
  const rows = result.recordset;
  return { tempCod, rows, summary: { total: rows.length, boxes: rows.reduce((sum, row) => sum + Number(row.boxes || 0), 0), linked: rows.filter((row) => Number(row.guideNumber) > 0).length } };
};

const sources = async (empCod, requestedType) => {
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const packTipo = type(requestedType);
  const request = base(pool.request(), empCod, tempCod).input('PackTipo', sql.SmallInt, packTipo);
  const query = packTipo === 4 ? `
    SELECT TOP 100 h.DesOTNumI sourceNumber,CONVERT(char(10),h.DesOTFecha,23) sourceDate,
      h.DesOTTotCaj boxes,h.DesOTTotKil kilos,h.CliCod clientId,RTRIM(c.CliNom) clientName,
      (SELECT COUNT(*) FROM PACKLIST p WHERE p.EmpCod=h.EmpCod AND p.TempCod=h.TempCod AND p.PackTipo=4 AND p.PackNumG=h.DesOTNumI) existingCount
    FROM DESCLI_FP h LEFT JOIN CLIENTES c ON c.EmpCod=h.EmpCod AND c.CliCod=h.CliCod
    WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DesOTTipo=3 AND h.DesOTNumI>0
    ORDER BY h.DesOTNumI DESC` : `
    SELECT TOP 100 h.DORNumf sourceNumber,CONVERT(char(10),h.DorFecha,23) sourceDate,
      h.DorTotCajas boxes,h.DorTotKilos kilos,CAST(NULL AS int) clientId,CAST(NULL AS varchar(100)) clientName,
      (SELECT COUNT(*) FROM PACKLIST p WHERE p.EmpCod=h.EmpCod AND p.TempCod=h.TempCod AND p.PackTipo=h.DorTipPlani AND p.PackNumG=h.DORNumf) existingCount
    FROM DESORIGEN h WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
      AND h.DorTipPlani=@PackTipo AND h.DORNumf>0 AND h.DorEstado=1
    ORDER BY h.DORNumf DESC`;
  const result = await request.query(query);
  return { tempCod, rows: result.recordset };
};

const getDetail = async (empCod, packNumI) => {
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const id = number(packNumI, 'El packing');
  const header = await key(pool.request(), empCod, tempCod, id).query(`
    SELECT p.*,RTRIM(c.CliNom) clientName,RTRIM(po.PuNombre) originPortName,RTRIM(pd.PuNombre) destinationPortName,
      RTRIM(e.ExpNom) exporterName,RTRIM(co.ConsNom) consigneeName,RTRIM(d.DestNom) destinationName,
      RTRIM(a.AgeNom) agentName,RTRIM(da.DANombre) dispatcherName,
      RTRIM(x.TransportistaNombre) guideCarrier,RTRIM(x.TransportistaRut) guideCarrierRut,
      RTRIM(x.PatenteCarro) guideTrailerPlate,CONVERT(char(10),x.FechaLlegada,23) guideArrivalDate,
      RTRIM(x.OrigenDireccion) guideOriginAddress,RTRIM(x.OrigenComuna) guideOriginCommune,
      RTRIM(x.DestinoDireccion) guideDestinationAddress,RTRIM(x.DestinoComuna) guideDestinationCommune
    FROM PACKLIST p LEFT JOIN CLIENTES c ON c.EmpCod=p.EmpCod AND c.CliCod=p.CliCod
    LEFT JOIN PUERTOS po ON po.PuCod=p.PackPuOr LEFT JOIN PUERTOS pd ON pd.PuCod=p.PackPuDe
    LEFT JOIN EXPORT1 e ON e.EmpCod=p.EmpCod AND e.ExpCod=p.ExpCod
    LEFT JOIN CONSIG co ON co.EmpCod=p.EmpCod AND co.ConsCod=p.ConsCod
    LEFT JOIN DESTINOS d ON d.DestCod=p.DestCod
    LEFT JOIN AGENTES a ON a.EmpCod=p.EmpCod AND a.AgeCod=p.AgeCod
    LEFT JOIN DESPAAUTO da ON da.EmpCod=p.EmpCod AND da.DACod=p.DACod
    LEFT JOIN integracion.PackingGuiaDatos x ON x.EmpCod=p.EmpCod AND x.TempCod=p.TempCod AND x.PackNumI=p.PackNumI
    WHERE p.EmpCod=@EmpCod AND p.TempCod=@TempCod AND p.PackNumI=@PackNumI`);
  const row = header.recordset[0];
  if (!row) fail('No se encontró el packing list en la temporada activa.', 404, 'NOT_FOUND');
  const details = Number(row.PackTipo) === 4
    ? await base(pool.request(), empCod, tempCod).input('SourceNumber', sql.Decimal(10, 0), row.PackNumG).query(`
      SELECT RTRIM(d.DesOT1Folio) folio,d.DesOT1Espe species,d.DesOT1Cajas boxes,d.DesOT1Kilos kilos,
        d.DesOT1Cor sequence FROM DESCLI_FP1 d WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.DesOTNumI=@SourceNumber ORDER BY d.DesOT1Cor`)
    : await base(pool.request(), empCod, tempCod).input('PackTipo', sql.SmallInt, row.PackTipo)
      .input('SourceNumber', sql.Decimal(10, 0), row.PackNumG).query(`
      SELECT RTRIM(d.dor1Folio) folio,COALESCE(NULLIF(RTRIM(d.Dor1Nespe),''),CONVERT(varchar(20),d.dor1espe)) species,
        d.Dor1Cajas boxes,d.Dor1Kilos kilos,d.Dor1Nsol requestNumber
      FROM DESORIGEN h JOIN DESORIGEN1 d ON d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod
        AND d.DorTipPlani=h.DorTipPlani AND d.DORNum=h.DORNum
      WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DorTipPlani=@PackTipo AND h.DORNumf=@SourceNumber
      ORDER BY d.dor1Folio`);
  return { tempCod, header: row, details: details.recordset };
};

const create = async (empCod, login, input = {}) => {
  const packTipo = type(input.type);
  const sourceNumber = number(input.sourceNumber, 'El documento de origen');
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const tempCod = await activeSeason(new sql.Request(transaction), empCod);
    const sourceQuery = packTipo === 4
      ? `SELECT h.DesOTNumI sourceNumber,h.DesOTFecha packingDate,h.DesOTTotCaj boxes,h.DesOTTotKil kilos,
           CAST(0 AS int) pallets,CAST(0 AS decimal(18,2)) guide,h.CliCod sourceClient,
           CAST(NULL AS int) originPort,CAST(NULL AS int) destinationPort,CAST(NULL AS int) dispatcher,
           CAST(NULL AS int) exporter,CAST(NULL AS int) consignee,CAST(NULL AS int) destination,CAST(NULL AS int) agent,
           CAST(NULL AS varchar(30)) patent,CAST(NULL AS varchar(30)) vessel,CAST(NULL AS varchar(20)) container
         FROM DESCLI_FP h WITH (UPDLOCK,HOLDLOCK) WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod AND h.DesOTTipo=3 AND h.DesOTNumI=@SourceNumber`
      : `SELECT h.DORNumf sourceNumber,h.DorFecha packingDate,h.DorTotCajas boxes,h.DorTotKilos kilos,
           CAST(0 AS int) pallets,h.DorNguia guide,CAST(NULL AS int) sourceClient,
           h.DorPuertoE originPort,h.DorPuertoD destinationPort,h.DACod dispatcher,
           h.ExpCod exporter,h.ConsCod consignee,h.DestCod destination,h.AgeCod agent,
           h.DorPatente patent,h.DorNave vessel,h.DorContenedor container
         FROM DESORIGEN h WITH (UPDLOCK,HOLDLOCK) WHERE h.EmpCod=@EmpCod AND h.TempCod=@TempCod
           AND h.DorTipPlani=@PackTipo AND h.DORNumf=@SourceNumber AND h.DorEstado=1`;
    const sourceRows = await base(new sql.Request(transaction), empCod, tempCod)
      .input('PackTipo', sql.SmallInt, packTipo).input('SourceNumber', sql.Decimal(10, 0), sourceNumber).query(sourceQuery);
    if (sourceRows.recordset.length !== 1) fail('El documento de origen no existe, no está finalizado o su número no es único.', 409, 'SOURCE_UNAVAILABLE');
    const source = sourceRows.recordset[0];
    const duplicate = await base(new sql.Request(transaction), empCod, tempCod)
      .input('PackTipo', sql.SmallInt, packTipo).input('SourceNumber', sql.Decimal(10, 0), sourceNumber)
      .query('SELECT TOP 1 PackNumI FROM PACKLIST WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND PackTipo=@PackTipo AND PackNumG=@SourceNumber');
    if (duplicate.recordset.length) fail('Ya existe un packing list para este documento de origen.', 409, 'DUPLICATE_SOURCE');
    const clientId = source.sourceClient ? Number(source.sourceClient) : null;
    if (clientId) {
      const client = await new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('CliCod', sql.Int, clientId)
        .query('SELECT TOP 1 CliCod FROM CLIENTES WHERE EmpCod=@EmpCod AND CliCod=@CliCod');
      if (!client.recordset.length) fail('El cliente del documento de origen no pertenece a la empresa.');
    }
    const packNumI = await nextCorrelative({ transaction, empCod, code: 'PACKLIST', digits: 10 });
    await base(new sql.Request(transaction), empCod, tempCod)
      .input('PackNumI', sql.Decimal(10, 0), packNumI).input('PackTipo', sql.SmallInt, packTipo)
      .input('PackNumG', sql.Decimal(10, 0), sourceNumber).input('PackFecha', sql.DateTime, source.packingDate || new Date())
      .input('PackFecZar', sql.DateTime, null).input('CliCod', sql.Int, clientId)
      .input('PackTotCajas', sql.SmallInt, source.boxes || 0).input('PackTotPal', sql.SmallInt, source.pallets || 0)
      .input('PackKilos', sql.Money, source.kilos || 0).input('PackGuia', sql.Decimal(10, 0), source.guide || 0)
      .input('PackPuOr', sql.SmallInt, source.originPort || 0).input('PackPuDe', sql.SmallInt, source.destinationPort || 0)
      .input('DACod', sql.SmallInt, source.dispatcher || 0).input('ExpCod', sql.SmallInt, source.exporter || 0)
      .input('ConsCod', sql.SmallInt, source.consignee || 0).input('DestCod', sql.SmallInt, source.destination || 0)
      .input('AgeCod', sql.SmallInt, source.agent || 0).input('PackPatente', sql.Char(30), text(source.patent, 30))
      .input('PackNave', sql.Char(30), text(source.vessel, 30)).input('PAckNContenedor', sql.Char(20), text(source.container, 20))
      .input('PackLoginC', sql.Char(10), text(login, 10)).query(`
      INSERT INTO PACKLIST (EmpCod,TempCod,PackNumI,PackTipo,PackNumG,PackFecha,PackFecZar,
        CliCod,PackTotCajas,PackTotPal,PackKilos,PackGuia,PackEstado,PackPuOr,PackPuDe,DACod,
        ExpCod,ConsCod,DestCod,AgeCod,PackPatente,PackNave,PAckNContenedor,PackLoginC,PackFecINS)
      VALUES (@EmpCod,@TempCod,@PackNumI,@PackTipo,@PackNumG,@PackFecha,@PackFecZar,
        @CliCod,@PackTotCajas,@PackTotPal,@PackKilos,@PackGuia,0,@PackPuOr,@PackPuDe,@DACod,
        @ExpCod,@ConsCod,@DestCod,@AgeCod,@PackPatente,@PackNave,@PAckNContenedor,@PackLoginC,GETDATE())`);
    await transaction.commit();
    return { id: packNumI, tempCod };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const update = async (empCod, packNumI, input = {}) => {
  const pool = await getPool();
  const tempCod = await activeSeason(pool.request(), empCod);
  const id = number(packNumI, 'El packing');
  const clientId = number(input.clientId, 'El cliente');
  const departureDate = date(input.departureDate, 'La fecha de zarpe');
  const departureTime = text(input.departureTime, 8);
  if (departureTime && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(departureTime)) fail('La hora de salida no es válida.');
  const arrivalDate = optionalDate(input.arrivalDate, 'La fecha estimada de llegada');
  const result = await key(pool.request(), empCod, tempCod, id)
    .input('CliCod', sql.Int, clientId).input('PackFecZar', sql.DateTime, departureDate)
    .input('PackChofer', sql.Char(30), text(input.driver, 30))
    .input('PackRutChofer', sql.Char(12), text(input.driverRut, 12))
    .input('PackPatente', sql.Char(30), text(input.patent, 30))
    .input('PackHora', sql.Char(8), departureTime)
    .input('PackEmptrans', sql.Char(15), text(input.transportCompany, 15))
    .input('PackTipCamion', sql.Char(15), text(input.truckType, 15))
    .input('PackObs1', sql.Char(50), text(input.observation, 50))
    .query(`UPDATE p SET CliCod=@CliCod,PackFecZar=@PackFecZar,PackChofer=@PackChofer,
      PackRutChofer=@PackRutChofer,PackPatente=@PackPatente,PackHora=@PackHora,
      PackEmptrans=@PackEmptrans,PackTipCamion=@PackTipCamion,PackObs1=@PackObs1
      FROM PACKLIST p WHERE p.EmpCod=@EmpCod AND p.TempCod=@TempCod AND p.PackNumI=@PackNumI
      AND ISNULL(p.PackEstado,0)=0
      AND EXISTS(SELECT 1 FROM CLIENTES c WHERE c.EmpCod=p.EmpCod AND c.CliCod=@CliCod)`);
  if (!result.rowsAffected[0]) fail('No fue posible editar el packing. Verifique cliente, estado y guía asociada.', 409, 'NOT_EDITABLE');
  await key(pool.request(), empCod, tempCod, id)
    .input('TransportistaNombre', sql.NVarChar(150), text(input.transportCompany, 150))
    .input('TransportistaRut', sql.NVarChar(20), text(input.carrierRut, 20))
    .input('PatenteCarro', sql.NVarChar(20), text(input.trailerPlate, 20))
    .input('FechaLlegada', sql.Date, arrivalDate)
    .input('OrigenDireccion', sql.NVarChar(200), text(input.originAddress, 200))
    .input('OrigenComuna', sql.NVarChar(100), text(input.originCommune, 100))
    .input('DestinoDireccion', sql.NVarChar(200), text(input.destinationAddress, 200))
    .input('DestinoComuna', sql.NVarChar(100), text(input.destinationCommune, 100))
    .query(`MERGE integracion.PackingGuiaDatos AS target
      USING (SELECT @EmpCod EmpCod,@TempCod TempCod,@PackNumI PackNumI) AS source
      ON target.EmpCod=source.EmpCod AND target.TempCod=source.TempCod AND target.PackNumI=source.PackNumI
      WHEN MATCHED THEN UPDATE SET TransportistaNombre=@TransportistaNombre,TransportistaRut=@TransportistaRut,
        PatenteCarro=@PatenteCarro,FechaLlegada=@FechaLlegada,OrigenDireccion=@OrigenDireccion,
        OrigenComuna=@OrigenComuna,DestinoDireccion=@DestinoDireccion,DestinoComuna=@DestinoComuna,ActualizadoEn=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (EmpCod,TempCod,PackNumI,TransportistaNombre,TransportistaRut,PatenteCarro,
        FechaLlegada,OrigenDireccion,OrigenComuna,DestinoDireccion,DestinoComuna)
        VALUES (@EmpCod,@TempCod,@PackNumI,@TransportistaNombre,@TransportistaRut,@PatenteCarro,
        @FechaLlegada,@OrigenDireccion,@OrigenComuna,@DestinoDireccion,@DestinoComuna);`);
  return { id };
};

module.exports = { permission, PackingListError, getFormData, list, sources, getDetail, create, update };

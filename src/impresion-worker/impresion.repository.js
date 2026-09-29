const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { PRINT_STATUS } = require('./constants');

const trim = (value) => String(value ?? '').trim();

const createImpresionRepository = ({ poolProvider = getPool, empCod = Number(process.env.PRINT_EMP_COD || 1) } = {}) => {
  const claimNext = async (workerId) => {
    const pool = await poolProvider();
    const result = await pool.request()
      .input('Worker', sql.VarChar(80), String(workerId).slice(0, 80))
      .input('Pending', sql.SmallInt, PRINT_STATUS.PENDING)
      .input('Processing', sql.SmallInt, PRINT_STATUS.PROCESSING)
      .query(`
        ;WITH siguiente AS (
          SELECT TOP (1) *
          FROM dbo.OrdenImpresion WITH (UPDLOCK, READPAST, ROWLOCK)
          WHERE OPLCProc=@Pending
          ORDER BY ISNULL(OPLCFechaIns, CONVERT(datetime,'19000101',112)), OPLCID
        )
        UPDATE siguiente
        SET OPLCProc=@Processing, OPLCTomadaEn=GETDATE(), OPLCWorker=@Worker,
            OPLCIntentos=ISNULL(OPLCIntentos,0)+1, OPLCError=NULL
        OUTPUT INSERTED.OPLCID AS id, INSERTED.OPLCIMP AS lineId;
      `);
    const row = result.recordset[0];
    return row ? { id: Number(row.id), lineId: Number(row.lineId) } : null;
  };

  const loadContext = async (job) => {
    const pool = await poolProvider();
    const request = pool.request()
      .input('EmpCod', sql.SmallInt, empCod)
      .input('LinID', sql.SmallInt, job.lineId);
    const result = await request.query(`
      DECLARE @TempCod char(9), @Ordpnum decimal(10,0), @LabelCode char(10);
      SELECT TOP (1) @TempCod=TempCod FROM dbo.TEMP01
      WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempCod DESC;
      SELECT TOP (1) @Ordpnum=Ordpnum, @LabelCode=OrdpCodEti
      FROM dbo.ORDPROC WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OrdpEstado=1
      ORDER BY Ordpnum DESC;

      SELECT TOP (1)
        l.EmpCod, l.LinMaquina, l.LinID, l.LinEstado,
        c.Calibre, c.EnvCod, c.Catcod, c.Especod, c.LConfCodPer,
        o.Ordpnum, o.OrdpFecha, o.ProdCod, o.VarCod,
        LTRIM(RTRIM(e.EspeNom)) AS EspeNom,
        LTRIM(RTRIM(v.VarNom)) AS VarNom,
        LTRIM(RTRIM(p.ProdNom)) AS ProdNom,
        LTRIM(RTRIM(p.ProdComuna)) AS ProdComuna,
        LTRIM(RTRIM(p.ProdProvincia)) AS ProdProvincia,
        LTRIM(RTRIM(env.EnvNom)) AS EnvNom,
        LTRIM(RTRIM(env.EnvNomExt)) AS EnvNomExt,
        LTRIM(RTRIM(cat.CatNom)) AS CatNom,
        cal.CalCod,
        LTRIM(RTRIM(i.CIMPNombre)) AS CIMPNombre,
        LTRIM(RTRIM(i.CIMPIP)) AS CIMPIP,
        LTRIM(RTRIM(lbl.EtiCod)) AS EtiCod,
        ver.EtiVersion, ver.EtiDesignJson
      FROM dbo.LINEAS l
      LEFT JOIN dbo.LINCONFIG c ON c.EmpCod=l.EmpCod AND c.LinMaquina=l.LinMaquina
        AND c.LinID=l.LinID AND c.ConfID=1
      LEFT JOIN dbo.ORDPROC o ON o.EmpCod=@EmpCod AND o.TempCod=@TempCod AND o.Ordpnum=@Ordpnum
      LEFT JOIN dbo.ESPECIES e ON e.EmpCod=c.EmpCod AND e.Especod=c.Especod
      LEFT JOIN dbo.ESPECIES1 v ON v.EmpCod=o.EmpCod AND v.Especod=o.Especod AND v.VarCod=o.VarCod
      LEFT JOIN dbo.PRODUCTORES p ON p.EmpCod=o.EmpCod AND p.ProdCod=o.ProdCod
      LEFT JOIN dbo.ENVCAT env ON env.EmpCod=c.EmpCod AND env.EnvCod=c.EnvCod
      LEFT JOIN dbo.ENVCAT1 cat ON cat.EmpCod=c.EmpCod AND cat.EnvCod=c.EnvCod AND cat.Catcod=c.Catcod
      LEFT JOIN dbo.CALIBRES cal ON cal.EmpCod=c.EmpCod AND cal.Especod=c.Especod AND cal.Calibre=c.Calibre
      LEFT JOIN dbo.ConfImpresoras i ON i.EmpCod=l.EmpCod AND i.CIMPID=l.LinID
      LEFT JOIN dbo.ETIXCAL x ON x.EmpCod=o.EmpCod AND x.TempCod=o.TempCod
        AND x.Ordpnum=o.Ordpnum AND x.Calibre=c.Calibre
      LEFT JOIN dbo.ETIQUETA lbl ON lbl.EmpCod=o.EmpCod
        AND lbl.EtiCod=COALESCE(NULLIF(x.ConfCod,''),@LabelCode) AND lbl.EtiActiva=1
      LEFT JOIN dbo.ETIQUETAVERSION ver ON ver.EmpCod=lbl.EmpCod AND ver.EtiCod=lbl.EtiCod AND ver.EtiVigente=1
      WHERE l.EmpCod=@EmpCod AND l.LinID=@LinID
      ORDER BY CASE WHEN l.LinMaquina=l.LinID THEN 0 ELSE 1 END, l.LinMaquina;
    `);
    if (!result.recordset.length) throw new Error(`No existe la línea ${job.lineId} para la empresa ${empCod}.`);
    const row = result.recordset[0];
    if (row.Ordpnum == null) throw new Error('No existe una orden de proceso activa.');
    if (!trim(row.CIMPIP)) throw new Error(`La línea ${job.lineId} no tiene una IP configurada en ConfImpresoras.`);
    if (!trim(row.EtiCod) || row.EtiVersion == null || !row.EtiDesignJson) throw new Error('La orden activa no tiene una etiqueta vigente disponible.');
    let labelDesign;
    try { labelDesign = JSON.parse(row.EtiDesignJson); } catch { throw new Error('El diseño vigente de la etiqueta contiene JSON inválido.'); }
    return {
      empCod: Number(row.EmpCod), machine: Number(row.LinMaquina), lineId: Number(row.LinID), lineState: Number(row.LinEstado),
      caliber: trim(row.Calibre), envCode: Number(row.EnvCod), categoryCode: Number(row.Catcod), personCode: Number(row.LConfCodPer || 0),
      processNumber: Number(row.Ordpnum), processDate: row.OrdpFecha, producerCode: trim(row.ProdCod),
      speciesName: trim(row.EspeNom), varietyName: trim(row.VarNom), producerName: trim(row.ProdNom),
      producerCommune: trim(row.ProdComuna), producerProvince: trim(row.ProdProvincia),
      containerName: trim(row.EnvNom), containerExternalName: trim(row.EnvNomExt), categoryName: trim(row.CatNom), caliberCode: Number(row.CalCod),
      printerName: trim(row.CIMPNombre), printerIp: trim(row.CIMPIP), printerPort: Number(process.env.PRINT_PORT || 9100),
      printerTimeoutMs: Number(process.env.PRINT_TIMEOUT_MS || 5000), labelCode: trim(row.EtiCod),
      labelVersion: Number(row.EtiVersion), labelDesign
    };
  };

  const nextBoxNumber = async (company) => {
    const pool = await poolProvider();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, company)
        .input('GenCod', sql.Char(8), 'ETILIN')
        .query(`
          DECLARE @Next decimal(10,0);
          SELECT @Next=ISNULL(GenCor10,0)+1 FROM dbo.GenCor WITH (UPDLOCK,HOLDLOCK)
          WHERE EmpCod=@EmpCod AND GenCod=@GenCod;
          IF @Next IS NULL BEGIN
            SET @Next=1;
            INSERT dbo.GenCor(EmpCod,GenCod,GenCor10,GenCor5) VALUES(@EmpCod,@GenCod,@Next,0);
          END ELSE UPDATE dbo.GenCor SET GenCor10=@Next WHERE EmpCod=@EmpCod AND GenCod=@GenCod;
          SELECT @Next AS value;
        `);
      await transaction.commit();
      return Number(result.recordset[0].value);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  const savePrepared = async (id, data) => {
    const pool = await poolProvider();
    await pool.request().input('Id', sql.Decimal(10, 0), id)
      .input('EtiCod', sql.Char(10), data.labelCode).input('Version', sql.Int, data.labelVersion)
      .input('Zpl', sql.NVarChar(sql.MAX), data.zpl)
      .query('UPDATE dbo.OrdenImpresion SET OPLCEtiCod=@EtiCod,OPLCEtiVersion=@Version,OPLCZpl=@Zpl WHERE OPLCID=@Id AND OPLCProc=9;');
  };

  const finish = async (id, status, message = null) => {
    const pool = await poolProvider();
    await pool.request().input('Id', sql.Decimal(10, 0), id).input('Status', sql.SmallInt, status)
      .input('Error', sql.NVarChar(1000), message ? String(message).slice(0, 1000) : null)
      .query('UPDATE dbo.OrdenImpresion SET OPLCProc=@Status,OPLCError=@Error WHERE OPLCID=@Id AND OPLCProc=9;');
  };

  const markPrinted = async (id) => {
    const pool = await poolProvider();
    const result = await pool.request().input('Id', sql.Decimal(10, 0), id)
      .query('UPDATE dbo.OrdenImpresion SET OPLCProc=1,OPLCFecha=GETDATE(),OPLCError=NULL WHERE OPLCID=@Id AND OPLCProc=9;');
    if (result.rowsAffected[0] !== 1) throw new Error(`No se pudo confirmar la orden ${id} como impresa.`);
  };

  return { claimNext, loadContext, nextBoxNumber, savePrepared, finish, markPrinted };
};

module.exports = { createImpresionRepository };

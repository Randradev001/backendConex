const { sql, getPool } = require('../conectorMysql/conectorSqlServer');

class OrdenesProcesoError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const int = (v, name, min = 0) => { const n = Number(v); if (!Number.isInteger(n) || n < min) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', `${name} no es valido.`); return n; };
const money = (v, name, min = 0) => { const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < min) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', `${name} no es valido.`); return n; };
const optionalDate = (value, name) => {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00`))) {
    throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', `${name} no es valida.`);
  }
  return text;
};
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;

const normalizeCommercialRows = (rows) => {
  if (!Array.isArray(rows)) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La fruta comercial debe enviarse como una lista.');
  if (rows.length > 100) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La cuadratura admite hasta 100 lineas comerciales.');
  const seen = new Set();
  return rows.map((row, index) => {
    const speciesCode = int(row?.speciesCode, `especie comercial ${index + 1}`, 1);
    const varietyCode = int(row?.varietyCode, `variedad comercial ${index + 1}`, 1);
    const containers = int(row?.containers, `envases comerciales ${index + 1}`, 0);
    const kilos = money(row?.kilos, `kilos comerciales ${index + 1}`, 0);
    if (containers > 32767) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', `Los envases comerciales ${index + 1} superan el maximo permitido.`);
    if (kilos > 99999999.99 || Math.abs(kilos * 100 - Math.round(kilos * 100)) > 0.000001) {
      throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', `Los kilos comerciales ${index + 1} deben tener hasta dos decimales.`);
    }
    if (containers === 0 && kilos === 0) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', `La linea comercial ${index + 1} no tiene cantidades.`);
    const key = `${speciesCode}:${varietyCode}`;
    if (seen.has(key)) throw new OrdenesProcesoError(400, 'DUPLICATE_COMMERCIAL_LINE', 'No repita una misma especie y variedad en la fruta comercial.');
    seen.add(key);
    return {
      speciesCode,
      varietyCode,
      containers,
      kilos: roundMoney(kilos),
      observation: String(row?.observation || 'Ingreso por Proceso - Sistema').trim().slice(0, 50)
    };
  });
};

const listLots = async (empCod, input = {}) => {
  const from = optionalDate(input.from, 'La fecha de recepcion desde');
  const to = optionalDate(input.to, 'La fecha de recepcion hasta');
  if (from && to && from > to) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La fecha de recepcion desde no puede ser posterior a hasta.');
  const pool = await getPool();
  const request = pool.request().input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), input.tempCod ? String(input.tempCod).trim() : null)
    .input('Especod', sql.SmallInt, input.species ? int(input.species, 'especie', 1) : null)
    .input('VarCod', sql.Int, input.variety ? int(input.variety, 'variedad', 1) : null)
    .input('ProdCod', sql.Char(6), input.producer ? String(input.producer).trim() : null)
    .input('Lot', sql.Decimal(10, 0), input.lot ? int(input.lot, 'lote', 1) : null)
    .input('FromDate', sql.Date, from)
    .input('ToDate', sql.Date, to)
    .input('QualityMin', sql.Decimal(7, 2), input.qualityMin !== undefined ? money(input.qualityMin, 'calidad minima') : 0)
    .input('QualityMax', sql.Decimal(7, 2), input.qualityMax !== undefined ? money(input.qualityMax, 'calidad maxima') : 100);
  const result = await request.query(`
    SELECT d.Mov1Nlote lot,RTRIM(h.TempCod) tempCod,d.Mov1Espe species,RTRIM(e.EspeNom) speciesName,
      d.Mov1Var variety,RTRIM(v.VarNom) varietyName,RTRIM(h.MovProd) producerCode,RTRIM(p.ProdNom) producerName,
      COALESCE(d.Mov1NumE,0) containers,COALESCE(d.Mov1KilN,0) netKilos,
      COALESCE(u.usedContainers,0) usedContainers,COALESCE(u.usedKilos,0) usedKilos,
      COALESCE(d.Mov1NumE,0)-COALESCE(u.usedContainers,0) availableContainers,
      COALESCE(d.Mov1KilN,0)-COALESCE(u.usedKilos,0) availableKilos,
      CONVERT(char(10),h.MovFecha,23) movementDate,
      quality.qualityPercentage
    FROM MOVFRUT h JOIN MOVFRUT1 d ON d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd
    LEFT JOIN PRODUCTORES p ON p.EmpCod=d.EmpCod AND p.ProdCod=h.MovProd
    LEFT JOIN ESPECIES e ON e.EmpCod=d.EmpCod AND e.Especod=d.Mov1Espe
    LEFT JOIN ESPECIES1 v ON v.EmpCod=d.EmpCod AND v.Especod=d.Mov1Espe AND v.VarCod=d.Mov1Var
    OUTER APPLY (SELECT TOP 1 c.CalRecId,c.CalRecPorCalidad qualityPercentage
      FROM CALRECEP c
      WHERE c.EmpCod=d.EmpCod AND c.TempCod=d.TempCod AND c.Mov1Nlote=d.Mov1Nlote
        AND c.CalRecEstado='F'
      ORDER BY c.CalRecFecha DESC,c.CalRecId DESC) quality
    OUTER APPLY (SELECT TOP 1 r.CalRevDecision reviewDecision
      FROM CALRECEPREVISION r
      WHERE r.EmpCod=d.EmpCod AND r.CalRecId=quality.CalRecId
      ORDER BY r.CalRevId DESC) review
    OUTER APPLY (SELECT SUM(o.Ordp1Env) usedContainers,SUM(o.Ordp1Kilos) usedKilos FROM ORDPROC1 o WHERE o.EmpCod=d.EmpCod AND o.TempCod=d.TempCod AND o.Ordp1Nlote=d.Mov1Nlote) u
    WHERE h.EmpCod=@EmpCod AND h.TMcod=1 AND COALESCE(h.Movauto,0)=0
      AND h.TempCod=COALESCE(@TempCod,(SELECT TOP 1 t.TempCod FROM TEMP01 t WHERE t.EmpCod=@EmpCod AND t.TempActiva=1 ORDER BY t.TempFecAbre DESC,t.TempCod DESC))
      AND (@Especod IS NULL OR d.Mov1Espe=@Especod)
      AND (@VarCod IS NULL OR d.Mov1Var=@VarCod) AND (@ProdCod IS NULL OR h.MovProd=@ProdCod)
      AND (@Lot IS NULL OR d.Mov1Nlote=@Lot)
      AND (@FromDate IS NULL OR h.MovFecha>=@FromDate)
      AND (@ToDate IS NULL OR h.MovFecha<DATEADD(day,1,@ToDate))
      AND COALESCE(quality.qualityPercentage, 0) BETWEEN @QualityMin AND @QualityMax
      AND COALESCE(d.Mov1NumE,0)>COALESCE(u.usedContainers,0)
    ORDER BY h.MovFecha,h.MovProd,d.Mov1Nlote;
  `);
  return { rows: result.recordset || [] };
};

const create = async (empCod, login, body = {}) => {
  const tempCod = String(body.tempCod || '').trim();
  if (!tempCod) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La temporada es obligatoria.');
  if (!Array.isArray(body.lots) || !body.lots.length) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'Debe seleccionar al menos un lote.');
  const process = body.process || {};
  const processDate = process.date ? new Date(process.date) : new Date();
  if (Number.isNaN(processDate.getTime())) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La fecha del proceso no es valida.');
  const variety = int(process.variety, 'variedad', 1);
  const exporter = int(process.exporter, 'exportadora', 1);
  const label = String(process.label || '').trim();
  if (!label) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La etiqueta es obligatoria.');
  const pool = await getPool(); const transaction = new sql.Transaction(pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod);
    const max = await request.query('SELECT ISNULL(MAX(Ordpnum),0)+1 nextNumber FROM ORDPROC WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod;');
    const ordpnum = Number(max.recordset[0].nextNumber);
    const details = [];
    for (const raw of body.lots) {
      const lot = int(raw.lot, 'lote', 1); const env = int(raw.containers, 'envases', 1); const kilos = money(raw.kilos, 'kilos', 0.001);
      const check = new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Lot', sql.Decimal(10, 0), lot);
      const found = await check.query(`SELECT TOP 1 d.Mov1Espe species,d.Mov1Var variety,h.MovProd producer,d.Mov1Cuar cuartel,d.Mov1TEnv containerType,d.Mov1Condi conditionCode,d.Mov1NumE containers,d.Mov1KilN kilos,
        COALESCE((SELECT SUM(o.Ordp1Env) FROM ORDPROC1 o WITH (UPDLOCK,HOLDLOCK) WHERE o.EmpCod=d.EmpCod AND o.TempCod=d.TempCod AND o.Ordp1Nlote=d.Mov1Nlote),0) usedContainers,
        COALESCE((SELECT SUM(o.Ordp1Kilos) FROM ORDPROC1 o WITH (UPDLOCK,HOLDLOCK) WHERE o.EmpCod=d.EmpCod AND o.TempCod=d.TempCod AND o.Ordp1Nlote=d.Mov1Nlote),0) usedKilos
        FROM MOVFRUT h JOIN MOVFRUT1 d ON d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd
        WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.Mov1Nlote=@Lot AND h.TMcod=1 AND COALESCE(h.Movauto,0)=0;`);
      if (!found.recordset.length) throw new OrdenesProcesoError(409, 'LOT_NOT_AVAILABLE', `El lote ${lot} no esta disponible.`);
      const row = found.recordset[0]; if (env > Number(row.containers) - Number(row.usedContainers) || kilos > Number(row.kilos) - Number(row.usedKilos)) throw new OrdenesProcesoError(409, 'LOT_QUANTITY_EXCEEDED', `La cantidad del lote ${lot} supera el saldo disponible.`);
      details.push({ lot, env, kilos, species: row.species, variety: row.variety, producer: row.producer, cuartel: row.cuartel, containerType: row.containerType, conditionCode: row.conditionCode });
    }
    const first = details[0]; if (details.some((d) => String(d.producer).trim() !== String(first.producer).trim())) throw new OrdenesProcesoError(409, 'MULTI_PRODUCER_NOT_ALLOWED', 'Todos los lotes deben pertenecer al mismo productor.'); const totals = details.reduce((a, d) => ({ env: a.env + d.env, kilos: a.kilos + d.kilos }), { env: 0, kilos: 0 });
    const insert = new sql.Request(transaction).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), tempCod).input('Ordpnum', sql.Decimal(10, 0), ordpnum).input('Producer', sql.Char(6), first.producer).input('Fecha', sql.DateTime, processDate).input('Species', sql.SmallInt, first.species).input('Variety', sql.Int, variety).input('Exporter', sql.SmallInt, exporter).input('Label', sql.Char(10), label).input('TotEnv', sql.Int, totals.env).input('TotKilos', sql.Money, totals.kilos).input('Login', sql.Char(10), String(login || '').slice(0, 10));
    await insert.query(`INSERT ORDPROC (EmpCod,TempCod,Ordpnum,ProdCod,OrdpFecha,Especod,VarCod,ExpCod,OrdpTotEnv,OrdpTotKilos,OrdpEnvExp,OrdpKilosExp,OrdpEnvCom,OrdpKilosCom,OrdpDesecho,OrdploginC,OrdpFecC,OrdpEstado,OrdpLoginA,OrdpCodEti) VALUES (@EmpCod,@TempCod,@Ordpnum,@Producer,@Fecha,@Species,@Variety,@Exporter,@TotEnv,@TotKilos,0,0,0,0,0,@Login,GETDATE(),0,'',@Label);`);
    for (const d of details) await new sql.Request(transaction).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),tempCod).input('Ordpnum',sql.Decimal(10,0),ordpnum).input('Lot',sql.Decimal(10,0),d.lot).input('Env',sql.Int,d.env).input('Kilos',sql.Money,d.kilos).query('INSERT ORDPROC1 (EmpCod,TempCod,Ordpnum,Ordp1Nlote,Ordp1Env,Ordp1Kilos) VALUES (@EmpCod,@TempCod,@Ordpnum,@Lot,@Env,@Kilos);');
    const movement = new sql.Request(transaction).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),tempCod).input('Guide',sql.Decimal(10,0),ordpnum).input('Producer',sql.Char(6),first.producer).input('Date',sql.DateTime,processDate).input('TotEnv',sql.Int,totals.env).input('TotKilos',sql.Money,totals.kilos).input('Login',sql.Char(10),String(login || '').slice(0,10));
    await movement.query(`INSERT MOVFRUT (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,MovFecha,MovObs,TMcod,TMSCod,MovTotE,MovTotKilN,MovTotKilB,MovLoginC,MovFecC,Movauto) VALUES (@EmpCod,@TempCod,90,90,@Guide,@Producer,@Date,'Salida por Proceso',2,1,@TotEnv,@TotKilos,0,@Login,GETDATE(),0);`);
    for (const d of details) await new sql.Request(transaction).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),tempCod).input('Guide',sql.Decimal(10,0),ordpnum).input('Lot',sql.Decimal(10,0),d.lot).input('Env',sql.Int,d.env).input('Kilos',sql.Money,d.kilos).input('Species',sql.SmallInt,d.species).input('Variety',sql.Int,d.variety).input('Cuartel',sql.Int,d.cuartel || 0).input('ContainerType',sql.SmallInt,d.containerType || 0).input('ConditionCode',sql.SmallInt,d.conditionCode || 0).input('Date',sql.DateTime,processDate).query('INSERT MOVFRUT1 (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,Mov1Nlote,Mov1Cuar,Mov1Espe,Mov1Var,Mov1TEnv,Mov1Condi,Mov1Destare,Mov1NumE,Mov1Peso,Mov1KilB,Mov1KilN,Mov1TM,Mov1STM,Mov1Fecha,Mov1AA,Mov1MM) VALUES (@EmpCod,@TempCod,90,90,(SELECT Ordpnum FROM ORDPROC WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Guide),(SELECT MovProd FROM MOVFRUT WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OriCod=90 AND MovTDoc=90 AND MovNGuia=@Guide),@Lot,@Cuartel,@Species,@Variety,@ContainerType,@ConditionCode,0,@Env,0,0,@Kilos,2,1,@Date,YEAR(@Date),MONTH(@Date));');
    await transaction.commit(); return { success: true, tempCod, ordpnum, totals, details };
  } catch (error) { await transaction.rollback(); if (error instanceof OrdenesProcesoError) throw error; throw new OrdenesProcesoError(500, 'ORDER_CREATE_ERROR', error.message); }
};

const getOrder = async (empCod, tempCod, ordpnum) => {
  const pool = await getPool();
  const request = pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), String(tempCod || '').trim())
    .input('Ordpnum', sql.Decimal(10, 0), int(ordpnum, 'orden', 1));
  const header = await request.query(`
    SELECT TOP 1 o.*,
      RTRIM(p.ProdNom) ProdNom,
      RTRIM(e.EspeNom) EspeNom,
      RTRIM(v.VarNom) VarNom, RTRIM(x.ExpNom) ExpNom
    FROM ORDPROC o
    LEFT JOIN PRODUCTORES p ON p.EmpCod=o.EmpCod AND p.ProdCod=o.ProdCod
    LEFT JOIN ESPECIES e ON e.EmpCod=o.EmpCod AND e.Especod=o.Especod
    LEFT JOIN ESPECIES1 v ON v.EmpCod=o.EmpCod AND v.Especod=o.Especod AND v.VarCod=o.VarCod
    LEFT JOIN EXPORT1 x ON x.EmpCod=o.EmpCod AND x.ExpCod=o.ExpCod
    WHERE o.EmpCod=@EmpCod AND o.TempCod=@TempCod AND o.Ordpnum=@Ordpnum;
    SELECT d.*, RTRIM(p.ProdNom) ProdNom, RTRIM(e.EspeNom) EspeNom, RTRIM(v.VarNom) VarNom, quality.qualityPercentage
    FROM ORDPROC1 d
    LEFT JOIN MOVFRUT1 m ON m.EmpCod=d.EmpCod AND m.TempCod=d.TempCod AND m.OriCod=90 AND m.MovTDoc=90 AND m.MovNGuia=d.Ordpnum AND m.Mov1Nlote=d.Ordp1Nlote
    LEFT JOIN PRODUCTORES p ON p.EmpCod=m.EmpCod AND p.ProdCod=(SELECT TOP 1 MovProd FROM MOVFRUT WHERE EmpCod=m.EmpCod AND TempCod=m.TempCod AND OriCod=90 AND MovTDoc=90 AND MovNGuia=m.MovNGuia)
    LEFT JOIN ESPECIES e ON e.EmpCod=m.EmpCod AND e.Especod=m.Mov1Espe
    LEFT JOIN ESPECIES1 v ON v.EmpCod=m.EmpCod AND v.Especod=m.Mov1Espe AND v.VarCod=m.Mov1Var
    OUTER APPLY (SELECT TOP 1 c.CalRecPorCalidad qualityPercentage FROM CALRECEP c WHERE c.EmpCod=d.EmpCod AND c.TempCod=d.TempCod AND c.Mov1Nlote=d.Ordp1Nlote AND c.CalRecEstado='F' ORDER BY c.CalRecFecha DESC,c.CalRecHora DESC,c.CalRecId DESC) quality
    WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.Ordpnum=@Ordpnum
    ORDER BY d.Ordp1Nlote;
    SELECT EmpCod,RTRIM(EmpNom) EmpNom,RTRIM(EmpGiro) EmpGiro,RTRIM(Empdir) EmpDir,EmpRut,RTRIM(EmpDV) EmpDV
    FROM DEFEMP WHERE EmpCod=@EmpCod;
  `);
  if (!header.recordsets[0].length) throw new OrdenesProcesoError(404, 'ORDER_NOT_FOUND', 'La orden de proceso no existe.');
  return { header: header.recordsets[0][0], details: header.recordsets[1] || [], company: header.recordsets[2]?.[0] || null };
};

const buildQuadrature = (order, speciesRows = []) => {
  const processedContainers = Number(order.OrdpTotEnv || 0);
  const processedKilos = Number(order.OrdpTotKilos || 0);
  const readContainers = speciesRows.reduce((total, row) => total + Number(row.readContainers || 0), 0);
  const readKilos = speciesRows.reduce((total, row) => total + Number(row.readKilos || 0), 0);
  const commercialContainers = Number(order.OrdpEnvCom || 0);
  const commercialKilos = Number(order.OrdpKilosCom || 0);
  const projectedWasteKilos = processedKilos - readKilos - commercialKilos;
  const state = Number(order.OrdpEstado);

  return {
    order: {
      tempCod: String(order.TempCod || '').trim(),
      ordpnum: Number(order.Ordpnum),
      date: order.OrdpFecha,
      state,
      speciesCode: Number(order.Especod),
      speciesName: String(order.EspeNom || '').trim(),
      varietyCode: Number(order.VarCod),
      varietyName: String(order.VarNom || '').trim(),
      producerCode: String(order.ProdCod || '').trim(),
      producerName: String(order.ProdNom || '').trim()
    },
    totals: {
      processedContainers,
      processedKilos,
      readContainers,
      readKilos,
      commercialContainers,
      commercialKilos,
      containerDifference: processedContainers - readContainers - commercialContainers,
      projectedWasteKilos,
      storedWasteKilos: Number(order.OrdpDesecho || 0),
      yieldPercentage: processedKilos > 0 ? (readKilos / processedKilos) * 100 : 0,
      readingPercentage: processedContainers > 0 ? (readContainers / processedContainers) * 100 : 0
    },
    status:
      readContainers < 0 || readKilos < 0
        ? 'invalid-readings'
        : state === 5
          ? 'squared'
          : readContainers === 0
            ? 'without-readings'
            : projectedWasteKilos < 0
              ? 'over-reading'
              : 'pending',
    species: speciesRows.map((row) => ({
      speciesCode: Number(row.speciesCode),
      speciesName: String(row.speciesName || '').trim(),
      varietyCode: Number(row.varietyCode),
      varietyName: String(row.varietyName || '').trim(),
      readContainers: Number(row.readContainers || 0),
      readKilos: Number(row.readKilos || 0),
      records: Number(row.records || 0),
      kilosPercentage: readKilos > 0 ? (Number(row.readKilos || 0) / readKilos) * 100 : 0,
      firstReading: row.firstReading,
      lastReading: row.lastReading
    }))
  };
};

const getQuadrature = async (empCod, tempCod, ordpnumInput, { poolProvider = getPool } = {}) => {
  const temp = String(tempCod || '').trim();
  const ordpnum = int(ordpnumInput, 'orden', 1);
  if (!temp) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La temporada es obligatoria.');
  const pool = await poolProvider();
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), temp)
    .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
    .query(`
      SELECT TOP (1) o.TempCod,o.Ordpnum,o.OrdpFecha,o.OrdpEstado,o.Especod,o.VarCod,o.ProdCod,
        o.OrdpTotEnv,o.OrdpTotKilos,o.OrdpEnvExp,o.OrdpKilosExp,o.OrdpEnvCom,o.OrdpKilosCom,o.OrdpDesecho,
        RTRIM(e.EspeNom) EspeNom,RTRIM(v.VarNom) VarNom,RTRIM(p.ProdNom) ProdNom
      FROM ORDPROC o
      LEFT JOIN ESPECIES e ON e.EmpCod=o.EmpCod AND e.Especod=o.Especod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=o.EmpCod AND v.Especod=o.Especod AND v.VarCod=o.VarCod
      LEFT JOIN PRODUCTORES p ON p.EmpCod=o.EmpCod
        AND p.ProdCod COLLATE DATABASE_DEFAULT=o.ProdCod COLLATE DATABASE_DEFAULT
      WHERE o.EmpCod=@EmpCod AND o.TempCod=@TempCod AND o.Ordpnum=@Ordpnum;

      SELECT c.Especod speciesCode,RTRIM(e.EspeNom) speciesName,c.VarCod varietyCode,RTRIM(v.VarNom) varietyName,
        SUM(COALESCE(c.CAPCantidad,0)) readContainers,SUM(COALESCE(c.CAPKilos,0)) readKilos,COUNT(*) records,
        MIN(c.CAPFecLog) firstReading,MAX(c.CAPFecLog) lastReading
      FROM CAP001 c
      LEFT JOIN ESPECIES e ON e.EmpCod=c.EmpCod AND e.Especod=c.Especod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=c.EmpCod AND v.Especod=c.Especod AND v.VarCod=c.VarCod
      WHERE c.EmpCod=@EmpCod AND c.TempCod=@TempCod AND c.CAPNproc=@Ordpnum
      GROUP BY c.Especod,e.EspeNom,c.VarCod,v.VarNom
      ORDER BY SUM(COALESCE(c.CAPKilos,0)) DESC,c.Especod,c.VarCod;

      SELECT f.FCONumI lineNumber,f.Especod speciesCode,RTRIM(e.EspeNom) speciesName,
        f.VarCod varietyCode,RTRIM(v.VarNom) varietyName,COALESCE(f.FCONEnv,0) containers,
        COALESCE(f.FCOKilos,0) kilos,RTRIM(f.FCOOBS) observation
      FROM FCOMERCIAL f
      LEFT JOIN ESPECIES e ON e.EmpCod=f.EmpCod AND e.Especod=f.Especod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=f.EmpCod AND v.Especod=f.Especod AND v.VarCod=f.VarCod
      WHERE f.EmpCod=@EmpCod AND f.TempCod=@TempCod AND f.FCOProceso=@Ordpnum
        AND f.TMcod=1 AND f.TMSCod=50
      ORDER BY f.FCONumI;

      SELECT e.Especod speciesCode,RTRIM(e.EspeNom) speciesName,
        v.VarCod varietyCode,RTRIM(v.VarNom) varietyName
      FROM ESPECIES e
      JOIN ESPECIES1 v ON v.EmpCod=e.EmpCod AND v.Especod=e.Especod
      WHERE e.EmpCod=@EmpCod
      ORDER BY e.EspeNom,v.VarNom;

      IF OBJECT_ID(N'dbo.ORDPROC_CUADRATURA_AUDIT', N'U') IS NOT NULL
        SELECT TOP (20) AuditId auditId,AuditAction action,PreviousState previousState,
          NewState newState,ReadContainers readContainers,ReadKilos readKilos,
          CommercialContainers commercialContainers,CommercialKilos commercialKilos,
          WasteKilos wasteKilos,RTRIM(Reason) reason,RTRIM(AuditLogin) login,AuditDate date
        FROM ORDPROC_CUADRATURA_AUDIT
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum
        ORDER BY AuditId DESC;
      ELSE
        SELECT CAST(NULL AS bigint) auditId,CAST(NULL AS varchar(12)) action,
          CAST(NULL AS smallint) previousState,CAST(NULL AS smallint) newState,
          CAST(NULL AS int) readContainers,CAST(NULL AS money) readKilos,
          CAST(NULL AS int) commercialContainers,CAST(NULL AS money) commercialKilos,
          CAST(NULL AS money) wasteKilos,CAST(NULL AS nvarchar(200)) reason,
          CAST(NULL AS char(10)) login,CAST(NULL AS datetime) date WHERE 1=0;
    `);
  const order = result.recordsets[0]?.[0];
  if (!order) throw new OrdenesProcesoError(404, 'ORDER_NOT_FOUND', 'La orden de proceso no existe.');
  const quadrature = buildQuadrature(order, result.recordsets[1] || []);
  return {
    ...quadrature,
    commercial: (result.recordsets[2] || []).map((row) => ({
      lineNumber: Number(row.lineNumber),
      speciesCode: Number(row.speciesCode),
      speciesName: String(row.speciesName || '').trim(),
      varietyCode: Number(row.varietyCode),
      varietyName: String(row.varietyName || '').trim(),
      containers: Number(row.containers || 0),
      kilos: Number(row.kilos || 0),
      observation: String(row.observation || '').trim()
    })),
    history: (result.recordsets[4] || []).map((row) => ({
      auditId: Number(row.auditId),
      action: String(row.action || '').trim(),
      previousState: Number(row.previousState),
      newState: Number(row.newState),
      readContainers: Number(row.readContainers || 0),
      readKilos: Number(row.readKilos || 0),
      commercialContainers: Number(row.commercialContainers || 0),
      commercialKilos: Number(row.commercialKilos || 0),
      wasteKilos: Number(row.wasteKilos || 0),
      reason: String(row.reason || '').trim(),
      login: String(row.login || '').trim(),
      date: row.date
    })),
    catalogs: {
      speciesVarieties: (result.recordsets[3] || []).map((row) => ({
        speciesCode: Number(row.speciesCode),
        speciesName: String(row.speciesName || '').trim(),
        varietyCode: Number(row.varietyCode),
        varietyName: String(row.varietyName || '').trim()
      }))
    }
  };
};

const getProcessReport = async (empCod, tempCod, ordpnumInput, { poolProvider = getPool } = {}) => {
  const temp = String(tempCod || '').trim();
  const ordpnum = int(ordpnumInput, 'orden', 1);
  if (!temp) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La temporada es obligatoria.');
  const pool = await poolProvider();
  const result = await pool.request()
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), temp)
    .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
    .query(`
      SELECT TOP (1) o.*,RTRIM(p.ProdNom) ProdNom,RTRIM(p.ProdProvincia) ProdProvincia,
        RTRIM(p.ProdComuna) ProdComuna,RTRIM(e.EspeNom) EspeNom,RTRIM(v.VarNom) VarNom
      FROM ORDPROC o
      LEFT JOIN PRODUCTORES p ON p.EmpCod=o.EmpCod AND p.ProdCod=o.ProdCod
      LEFT JOIN ESPECIES e ON e.EmpCod=o.EmpCod AND e.Especod=o.Especod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=o.EmpCod AND v.Especod=o.Especod AND v.VarCod=o.VarCod
      WHERE o.EmpCod=@EmpCod AND o.TempCod=@TempCod AND o.Ordpnum=@Ordpnum;

      SELECT Ordp1Nlote,Ordp1Env,Ordp1Kilos
      FROM ORDPROC1
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum
      ORDER BY Ordp1Nlote;

      SELECT c.EnvCod,RTRIM(e.EnvNom) EnvNom,c.Catcod,RTRIM(k.CatNom) CatNom,RTRIM(c.Calibre) Calibre,
        SUM(COALESCE(c.CAPCantidad,0)) Cajas,SUM(COALESCE(c.CAPKilos,0)) Kilos
      FROM CAP001 c
      LEFT JOIN ENVCAT e ON e.EmpCod=c.EmpCod AND e.EnvCod=c.EnvCod
      LEFT JOIN ENVCAT1 k ON k.EmpCod=c.EmpCod AND k.EnvCod=c.EnvCod AND k.Catcod=c.Catcod
      WHERE c.EmpCod=@EmpCod AND c.TempCod=@TempCod AND c.CAPNproc=@Ordpnum
      GROUP BY c.EnvCod,e.EnvNom,c.Catcod,k.CatNom,c.Calibre
      ORDER BY e.EnvNom,k.CatNom,c.Calibre;

      SELECT TOP (1) EmpCod,RTRIM(EmpNom) EmpNom,RTRIM(EmpGiro) EmpGiro,
        RTRIM(Empdir) EmpDir,EmpRut,RTRIM(EmpDV) EmpDV
      FROM DEFEMP WHERE EmpCod=@EmpCod;
    `);
  const order = result.recordsets[0]?.[0];
  if (!order) throw new OrdenesProcesoError(404, 'ORDER_NOT_FOUND', 'La orden de proceso no existe.');
  if (![4, 5].includes(Number(order.OrdpEstado))) {
    throw new OrdenesProcesoError(409, 'PROCESS_REPORT_NOT_AVAILABLE', 'El informe de proceso solo esta disponible para ordenes finalizadas o cuadradas.');
  }
  const processedKilos = Number(order.OrdpTotKilos || 0);
  const exportKilos = Number(order.OrdpKilosExp || 0);
  return {
    order,
    lots: result.recordsets[1] || [],
    detail: result.recordsets[2] || [],
    company: result.recordsets[3]?.[0] || null,
    yieldPercentage: processedKilos > 0 ? (exportKilos / processedKilos) * 100 : 0
  };
};

const finalizeQuadrature = async (
  empCod,
  login,
  tempCod,
  ordpnumInput,
  body = {},
  { poolProvider = getPool, transactionFactory, requestFactory = (target) => new sql.Request(target) } = {}
) => {
  const temp = String(tempCod || '').trim();
  const ordpnum = int(ordpnumInput, 'orden', 1);
  if (!temp) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La temporada es obligatoria.');
  const commercial = normalizeCommercialRows(body.commercial || []);
  const commercialContainers = commercial.reduce((total, row) => total + row.containers, 0);
  const commercialKilos = roundMoney(commercial.reduce((total, row) => total + row.kilos, 0));
  const pool = await poolProvider();
  const transaction = transactionFactory ? transactionFactory(pool) : new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const baseRequest = () => requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TempCod', sql.Char(9), temp)
      .input('Ordpnum', sql.Decimal(10, 0), ordpnum);
    const current = await baseRequest().query(`
      SELECT TOP (1) OrdpEstado,OrdpFecha,OrdpTotEnv,OrdpTotKilos
      FROM ORDPROC WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;
    `);
    if (!current.recordset.length) throw new OrdenesProcesoError(404, 'ORDER_NOT_FOUND', 'La orden de proceso no existe.');
    const order = current.recordset[0];
    if (Number(order.OrdpEstado) === 5) throw new OrdenesProcesoError(409, 'QUADRATURE_ALREADY_COMPLETED', 'La orden ya se encuentra cuadrada.');
    if (Number(order.OrdpEstado) !== 4) throw new OrdenesProcesoError(409, 'ORDER_NOT_FINISHED', 'Solo una orden terminada puede cuadrarse.');

    const duplicate = await baseRequest().query(`
      SELECT TOP (1) FCONumI
      FROM FCOMERCIAL WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FCOProceso=@Ordpnum
        AND TMcod=1 AND TMSCod=50;
    `);
    if (duplicate.recordset.length) throw new OrdenesProcesoError(409, 'QUADRATURE_ALREADY_EXISTS', 'La orden ya tiene movimientos comerciales de cuadratura.');

    const readingsResult = await baseRequest().query(`
      SELECT COALESCE(SUM(COALESCE(CAPCantidad,0)),0) readContainers,
        COALESCE(SUM(COALESCE(CAPKilos,0)),0) readKilos,
        SUM(CASE WHEN COALESCE(CAPCantidad,0)<0 OR COALESCE(CAPKilos,0)<0 THEN 1 ELSE 0 END) invalidReadings,
        COUNT(*) readingRecords
      FROM CAP001 WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND CAPNproc=@Ordpnum;
    `);
    const readings = readingsResult.recordset[0] || {};
    const readContainers = Number(readings.readContainers || 0);
    const readKilos = roundMoney(readings.readKilos || 0);
    if (Number(readings.invalidReadings || 0) > 0 || readContainers < 0 || readKilos < 0) {
      throw new OrdenesProcesoError(409, 'INVALID_READINGS', 'Existen lecturas negativas. Corrija las cajas antes de cuadrar.');
    }
    if (Number(readings.readingRecords || 0) === 0 && body.confirmWithoutReadings !== true) {
      throw new OrdenesProcesoError(409, 'READINGS_CONFIRMATION_REQUIRED', 'La orden no tiene cajas leidas. Confirme expresamente si desea cuadrarla sin lecturas.');
    }

    for (const row of commercial) {
      const catalog = await requestFactory(transaction)
        .input('EmpCod', sql.SmallInt, empCod)
        .input('Species', sql.SmallInt, row.speciesCode)
        .input('Variety', sql.Int, row.varietyCode)
        .query(`
          SELECT TOP (1) v.VarCod
          FROM ESPECIES e
          JOIN ESPECIES1 v ON v.EmpCod=e.EmpCod AND v.Especod=e.Especod
          WHERE e.EmpCod=@EmpCod AND e.Especod=@Species AND v.VarCod=@Variety;
        `);
      if (!catalog.recordset.length) throw new OrdenesProcesoError(400, 'INVALID_COMMERCIAL_CLASSIFICATION', 'Una especie o variedad comercial no existe para la empresa.');
    }

    let wasteKilos = roundMoney(Number(order.OrdpTotKilos || 0) - readKilos - commercialKilos);
    if (wasteKilos < -0.01) throw new OrdenesProcesoError(409, 'QUADRATURE_OVER_READING', 'Los kilos leidos y comerciales superan los kilos procesados.');
    if (wasteKilos < 0) wasteKilos = 0;

    await baseRequest()
      .input('ReadContainers', sql.Int, readContainers)
      .input('ReadKilos', sql.Money, readKilos)
      .input('CommercialContainers', sql.Int, commercialContainers)
      .input('CommercialKilos', sql.Money, commercialKilos)
      .input('WasteKilos', sql.Money, wasteKilos)
      .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10))
      .query(`
        UPDATE ORDPROC
        SET OrdpEnvExp=@ReadContainers,OrdpKilosExp=@ReadKilos,
          OrdpEnvCom=@CommercialContainers,OrdpKilosCom=@CommercialKilos,
          OrdpDesecho=@WasteKilos,OrdpEstado=5,OrdpFecA=GETDATE(),OrdpLoginA=@Login
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;
      `);

    for (let index = 0; index < commercial.length; index += 1) {
      const row = commercial[index];
      await baseRequest()
        .input('LineNumber', sql.Decimal(10, 0), index + 1)
        .input('ProcessDate', sql.DateTime, order.OrdpFecha)
        .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10))
        .input('Containers', sql.SmallInt, row.containers)
        .input('Kilos', sql.Money, row.kilos)
        .input('Species', sql.SmallInt, row.speciesCode)
        .input('Variety', sql.Int, row.varietyCode)
        .input('Observation', sql.Char(50), row.observation)
        .query(`
          INSERT FCOMERCIAL
            (EmpCod,TempCod,FCOProceso,FCONumI,FCOFecha,FCOLoginI,FCOFecC,TMcod,TMSCod,
             FCONEnv,FCOKilos,Especod,VarCod,FCOOBS,FCOOrigen)
          VALUES
            (@EmpCod,@TempCod,@Ordpnum,@LineNumber,@ProcessDate,@Login,GETDATE(),1,50,
             @Containers,@Kilos,@Species,@Variety,@Observation,0);
        `);
    }

    await baseRequest()
      .input('ReadContainers', sql.Int, readContainers)
      .input('ReadKilos', sql.Money, readKilos)
      .input('CommercialContainers', sql.Int, commercialContainers)
      .input('CommercialKilos', sql.Money, commercialKilos)
      .input('WasteKilos', sql.Money, wasteKilos)
      .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10))
      .query(`
        IF OBJECT_ID(N'dbo.ORDPROC_CUADRATURA_AUDIT', N'U') IS NOT NULL
          INSERT ORDPROC_CUADRATURA_AUDIT
            (EmpCod,TempCod,Ordpnum,AuditAction,PreviousState,NewState,ReadContainers,
             ReadKilos,CommercialContainers,CommercialKilos,WasteKilos,Reason,AuditLogin)
          VALUES
            (@EmpCod,@TempCod,@Ordpnum,'CLOSE',4,5,@ReadContainers,@ReadKilos,
             @CommercialContainers,@CommercialKilos,@WasteKilos,NULL,@Login);
      `);

    await transaction.commit();
    return {
      success: true,
      message: `Orden ${ordpnum} cuadrada correctamente.`,
      tempCod: temp,
      ordpnum,
      state: 5,
      totals: { readContainers, readKilos, commercialContainers, commercialKilos, wasteKilos }
    };
  } catch (error) {
    await transaction.rollback();
    if (error instanceof OrdenesProcesoError) throw error;
    throw new OrdenesProcesoError(500, 'QUADRATURE_SAVE_ERROR', error.message);
  }
};

const reopenQuadrature = async (
  empCod,
  login,
  tempCod,
  ordpnumInput,
  body = {},
  { poolProvider = getPool, transactionFactory, requestFactory = (target) => new sql.Request(target) } = {}
) => {
  const temp = String(tempCod || '').trim();
  const ordpnum = int(ordpnumInput, 'orden', 1);
  const reason = String(body.reason || '').trim();
  if (!temp) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La temporada es obligatoria.');
  if (reason.length < 10 || reason.length > 200) {
    throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'El motivo de reapertura debe tener entre 10 y 200 caracteres.');
  }
  const pool = await poolProvider();
  const transaction = transactionFactory ? transactionFactory(pool) : new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TempCod', sql.Char(9), temp)
      .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
      .input('Reason', sql.NVarChar(200), reason)
      .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10));
    const current = await request.query(`
      SELECT TOP (1) OrdpEstado,OrdpEnvExp,OrdpKilosExp,OrdpEnvCom,OrdpKilosCom,OrdpDesecho
      FROM ORDPROC WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;
    `);
    if (!current.recordset.length) throw new OrdenesProcesoError(404, 'ORDER_NOT_FOUND', 'La orden de proceso no existe.');
    const order = current.recordset[0];
    if (Number(order.OrdpEstado) !== 5) throw new OrdenesProcesoError(409, 'QUADRATURE_NOT_COMPLETED', 'Solo una orden cuadrada puede reabrirse.');

    await requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TempCod', sql.Char(9), temp)
      .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
      .input('ReadContainers', sql.Int, Number(order.OrdpEnvExp || 0))
      .input('ReadKilos', sql.Money, Number(order.OrdpKilosExp || 0))
      .input('CommercialContainers', sql.Int, Number(order.OrdpEnvCom || 0))
      .input('CommercialKilos', sql.Money, Number(order.OrdpKilosCom || 0))
      .input('WasteKilos', sql.Money, Number(order.OrdpDesecho || 0))
      .input('Reason', sql.NVarChar(200), reason)
      .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10))
      .query(`
      IF OBJECT_ID(N'dbo.ORDPROC_CUADRATURA_AUDIT', N'U') IS NOT NULL
        INSERT ORDPROC_CUADRATURA_AUDIT
          (EmpCod,TempCod,Ordpnum,AuditAction,PreviousState,NewState,ReadContainers,
           ReadKilos,CommercialContainers,CommercialKilos,WasteKilos,Reason,AuditLogin)
        VALUES
          (@EmpCod,@TempCod,@Ordpnum,'REOPEN',5,4,@ReadContainers,@ReadKilos,
           @CommercialContainers,@CommercialKilos,@WasteKilos,@Reason,@Login);
    `);

    await requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TempCod', sql.Char(9), temp)
      .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
      .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10))
      .query(`
      DELETE FROM FCOMERCIAL
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND FCOProceso=@Ordpnum
        AND TMcod=1 AND TMSCod=50;
      UPDATE ORDPROC
      SET OrdpEstado=4,OrdpEnvExp=0,OrdpKilosExp=0,OrdpEnvCom=0,OrdpKilosCom=0,
        OrdpDesecho=0,OrdpFecA=GETDATE(),OrdpLoginA=@Login
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;
    `);
    await transaction.commit();
    return { success: true, message: `Cuadratura de la orden ${ordpnum} reabierta correctamente.`, tempCod: temp, ordpnum, state: 4 };
  } catch (error) {
    await transaction.rollback();
    if (error instanceof OrdenesProcesoError) throw error;
    throw new OrdenesProcesoError(500, 'QUADRATURE_REOPEN_ERROR', error.message);
  }
};

const setProcessActive = async (
  empCod,
  login,
  tempCod,
  ordpnumInput,
  active,
  { poolProvider = getPool, transactionFactory, requestFactory = (target) => new sql.Request(target) } = {}
) => {
  const ordpnum = int(ordpnumInput, 'orden', 1);
  const temp = String(tempCod || '').trim();
  if (!temp) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La temporada es obligatoria.');
  if (typeof active !== 'boolean') throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'El estado solicitado no es valido.');

  const pool = await poolProvider();
  const transaction = transactionFactory ? transactionFactory(pool) : new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = requestFactory(transaction)
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TempCod', sql.Char(9), temp)
      .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
      .input('Login', sql.Char(10), String(login || '').trim().slice(0, 10));
    const current = await request.query(`
      SELECT TOP (1) OrdpEstado
      FROM ORDPROC WITH (UPDLOCK,HOLDLOCK)
      WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;
    `);
    if (!current.recordset.length) throw new OrdenesProcesoError(404, 'ORDER_NOT_FOUND', 'La orden de proceso no existe.');

    const currentState = Number(current.recordset[0].OrdpEstado);
    if (active && currentState === 1) throw new OrdenesProcesoError(409, 'ORDER_ALREADY_ACTIVE', 'La orden de proceso ya esta activa.');
    if (!active && currentState !== 1) throw new OrdenesProcesoError(409, 'ORDER_NOT_ACTIVE', 'La orden de proceso no esta activa.');
    if (active && ![0, 4].includes(currentState)) {
      throw new OrdenesProcesoError(409, 'ORDER_NOT_STARTABLE', 'Solo una orden ingresada o terminada puede iniciar el proceso.');
    }

    if (active) {
      const activeOrder = await requestFactory(transaction)
        .input('EmpCod', sql.SmallInt, empCod)
        .input('TempCod', sql.Char(9), temp)
        .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
        .query(`
          SELECT TOP (1) Ordpnum
          FROM ORDPROC WITH (UPDLOCK,HOLDLOCK)
          WHERE EmpCod=@EmpCod AND TempCod=@TempCod
            AND OrdpEstado=1 AND Ordpnum<>@Ordpnum
          ORDER BY Ordpnum DESC;
        `);
      if (activeOrder.recordset.length) {
        throw new OrdenesProcesoError(409, 'ACTIVE_ORDER_EXISTS', `La orden ${activeOrder.recordset[0].Ordpnum} ya esta activa. Debe desactivarla antes de iniciar otra.`);
      }
      await request.query(`
        UPDATE ORDPROC
        SET OrdpEstado=1, OrdpFecA=GETDATE(), OrdpLoginA=@Login,
            OrdpHHIniP=COALESCE(OrdpHHIniP,GETDATE()), OrdpHHFinP=NULL
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;
      `);
    } else {
      await request.query(`
        UPDATE ORDPROC
        SET OrdpEstado=0, OrdpHHFinP=GETDATE()
        WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;
      `);
    }

    await transaction.commit();
    return {
      success: true,
      tempCod: temp,
      ordpnum,
      active,
      state: active ? 1 : 0,
      message: active
        ? currentState === 4
          ? `Orden ${ordpnum} reactivada para continuar la lectura.`
          : `Orden ${ordpnum} iniciada correctamente.`
        : `Orden ${ordpnum} desactivada correctamente.`
    };
  } catch (error) {
    await transaction.rollback();
    if (error instanceof OrdenesProcesoError) throw error;
    throw new OrdenesProcesoError(500, 'ORDER_STATE_ERROR', error.message);
  }
};

const update = async (empCod, login, tempCod, ordpnumInput, body = {}) => {
  const ordpnum = int(ordpnumInput, 'orden', 1); const temp = String(tempCod || '').trim(); const process = body.process || {};
  if (!temp) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La temporada es obligatoria.');
  if (!Array.isArray(body.lots) || !body.lots.length) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'Debe seleccionar al menos un lote.');
  const processDate = process.date ? new Date(process.date) : new Date(); if (Number.isNaN(processDate.getTime())) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La fecha del proceso no es valida.');
  const variety = int(process.variety, 'variedad', 1); const exporter = int(process.exporter, 'exportadora', 1); const label = String(process.label || '').trim(); if (!label) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', 'La etiqueta es obligatoria.');
  const pool = await getPool(); const tx = new sql.Transaction(pool); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const exists = await new sql.Request(tx).input('EmpCod', sql.SmallInt, empCod).input('TempCod', sql.Char(9), temp).input('Ordpnum', sql.Decimal(10, 0), ordpnum).query('SELECT TOP 1 ProdCod,OrdpEstado FROM ORDPROC WITH (UPDLOCK,HOLDLOCK) WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;');
    if (!exists.recordset.length) throw new OrdenesProcesoError(404, 'ORDER_NOT_FOUND', 'La orden de proceso no existe.');
    if (Number(exists.recordset[0].OrdpEstado) !== 0) throw new OrdenesProcesoError(409, 'ORDER_NOT_EDITABLE', 'La orden no se puede editar en su estado actual.');
    const details = [];
    for (const raw of body.lots) {
      const lot = int(raw.lot, 'lote', 1); const env = int(raw.containers, 'envases', 1); const kilos = money(raw.kilos, 'kilos', 0.001);
      const q = new sql.Request(tx).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),temp).input('Lot',sql.Decimal(10,0),lot).input('Ordpnum',sql.Decimal(10,0),ordpnum);
      const found = await q.query(`SELECT TOP 1 d.Mov1Espe species,d.Mov1Var variety,h.MovProd producer,d.Mov1Cuar cuartel,d.Mov1TEnv containerType,d.Mov1Condi conditionCode,d.Mov1NumE containers,d.Mov1KilN kilos,
        COALESCE((SELECT SUM(o.Ordp1Env) FROM ORDPROC1 o WITH (UPDLOCK,HOLDLOCK) WHERE o.EmpCod=d.EmpCod AND o.TempCod=d.TempCod AND o.Ordp1Nlote=d.Mov1Nlote AND o.Ordpnum<>@Ordpnum),0) usedContainers,
        COALESCE((SELECT SUM(o.Ordp1Kilos) FROM ORDPROC1 o WITH (UPDLOCK,HOLDLOCK) WHERE o.EmpCod=d.EmpCod AND o.TempCod=d.TempCod AND o.Ordp1Nlote=d.Mov1Nlote AND o.Ordpnum<>@Ordpnum),0) usedKilos
        FROM MOVFRUT h JOIN MOVFRUT1 d ON d.EmpCod=h.EmpCod AND d.TempCod=h.TempCod AND d.OriCod=h.OriCod AND d.MovTDoc=h.MovTDoc AND d.MovNGuia=h.MovNGuia AND d.MovProd=h.MovProd WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod AND d.Mov1Nlote=@Lot AND h.TMcod=1 AND COALESCE(h.Movauto,0)=0;`);
      if (!found.recordset.length) throw new OrdenesProcesoError(409, 'LOT_NOT_AVAILABLE', `El lote ${lot} no esta disponible.`); const row = found.recordset[0];
      if (env > Number(row.containers)-Number(row.usedContainers) || kilos > Number(row.kilos)-Number(row.usedKilos)) throw new OrdenesProcesoError(409, 'LOT_QUANTITY_EXCEEDED', `La cantidad del lote ${lot} supera el saldo disponible.`);
      details.push({ lot, env, kilos, species:row.species, variety:row.variety, producer:row.producer, cuartel:row.cuartel, containerType:row.containerType, conditionCode:row.conditionCode });
    }
    const first = details[0]; if (details.some((d) => String(d.producer).trim() !== String(first.producer).trim())) throw new OrdenesProcesoError(409, 'MULTI_PRODUCER_NOT_ALLOWED', 'Todos los lotes deben pertenecer al mismo productor.'); const totals = details.reduce((a,d)=>({env:a.env+d.env,kilos:a.kilos+d.kilos}),{env:0,kilos:0});
    const old = await new sql.Request(tx).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),temp).input('Ordpnum',sql.Decimal(10,0),ordpnum).query('SELECT TOP 1 ProdCod FROM ORDPROC WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;'); const oldProd = old.recordset[0].ProdCod;
    await new sql.Request(tx).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),temp).input('Ordpnum',sql.Decimal(10,0),ordpnum).query('DELETE FROM ORDPROC1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum; DELETE FROM MOVFRUT1 WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OriCod=90 AND MovTDoc=90 AND MovNGuia=@Ordpnum; DELETE FROM MOVFRUT WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OriCod=90 AND MovTDoc=90 AND MovNGuia=@Ordpnum;');
    const h = new sql.Request(tx).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),temp).input('Ordpnum',sql.Decimal(10,0),ordpnum).input('Producer',sql.Char(6),first.producer).input('Fecha',sql.DateTime,processDate).input('Species',sql.SmallInt,first.species).input('Variety',sql.Int,variety).input('Exporter',sql.SmallInt,exporter).input('Label',sql.Char(10),label).input('TotEnv',sql.Int,totals.env).input('TotKilos',sql.Money,totals.kilos);
    await h.query('UPDATE ORDPROC SET ProdCod=@Producer,OrdpFecha=@Fecha,Especod=@Species,VarCod=@Variety,ExpCod=@Exporter,OrdpTotEnv=@TotEnv,OrdpTotKilos=@TotKilos,OrdpCodEti=@Label WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;');
    for (const d of details) await new sql.Request(tx).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),temp).input('Ordpnum',sql.Decimal(10,0),ordpnum).input('Lot',sql.Decimal(10,0),d.lot).input('Env',sql.Int,d.env).input('Kilos',sql.Money,d.kilos).query('INSERT ORDPROC1 (EmpCod,TempCod,Ordpnum,Ordp1Nlote,Ordp1Env,Ordp1Kilos) VALUES (@EmpCod,@TempCod,@Ordpnum,@Lot,@Env,@Kilos);');
    const m = new sql.Request(tx).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),temp).input('Guide',sql.Decimal(10,0),ordpnum).input('Producer',sql.Char(6),first.producer).input('Date',sql.DateTime,processDate).input('TotEnv',sql.Int,totals.env).input('TotKilos',sql.Money,totals.kilos).input('Login',sql.Char(10),String(login||'').slice(0,10)); await m.query(`INSERT MOVFRUT (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,MovFecha,MovObs,TMcod,TMSCod,MovTotE,MovTotKilN,MovTotKilB,MovLoginC,MovFecC,Movauto) VALUES (@EmpCod,@TempCod,90,90,@Guide,@Producer,@Date,'Salida por Proceso',2,1,@TotEnv,@TotKilos,0,@Login,GETDATE(),0);`);
    for (const d of details) await new sql.Request(tx).input('EmpCod',sql.SmallInt,empCod).input('TempCod',sql.Char(9),temp).input('Guide',sql.Decimal(10,0),ordpnum).input('Producer',sql.Char(6),first.producer).input('Lot',sql.Decimal(10,0),d.lot).input('Env',sql.Int,d.env).input('Kilos',sql.Money,d.kilos).input('Species',sql.SmallInt,d.species).input('Variety',sql.Int,d.variety).input('Cuartel',sql.Int,d.cuartel||0).input('ContainerType',sql.SmallInt,d.containerType||0).input('ConditionCode',sql.SmallInt,d.conditionCode||0).input('Date',sql.DateTime,processDate).query('INSERT MOVFRUT1 (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,Mov1Nlote,Mov1Cuar,Mov1Espe,Mov1Var,Mov1TEnv,Mov1Condi,Mov1Destare,Mov1NumE,Mov1Peso,Mov1KilB,Mov1KilN,Mov1TM,Mov1STM,Mov1Fecha,Mov1AA,Mov1MM) VALUES (@EmpCod,@TempCod,90,90,@Guide,@Producer,@Lot,@Cuartel,@Species,@Variety,@ContainerType,@ConditionCode,0,@Env,0,0,@Kilos,2,1,@Date,YEAR(@Date),MONTH(@Date));');
    await tx.commit(); return { success:true, tempCod:temp, ordpnum, totals, details };
  } catch (error) { await tx.rollback(); if (error instanceof OrdenesProcesoError) throw error; throw new OrdenesProcesoError(500,'ORDER_UPDATE_ERROR',error.message); }
};

module.exports = {
  OrdenesProcesoError,
  listLots,
  create,
  update,
  getOrder,
  getProcessReport,
  getQuadrature,
  buildQuadrature,
  normalizeCommercialRows,
  finalizeQuadrature,
  reopenQuadrature,
  setProcessActive
};

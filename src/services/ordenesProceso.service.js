const { sql, getPool } = require('../conectorMysql/conectorSqlServer');

class OrdenesProcesoError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const int = (v, name, min = 0) => { const n = Number(v); if (!Number.isInteger(n) || n < min) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', `${name} no es valido.`); return n; };
const money = (v, name, min = 0) => { const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < min) throw new OrdenesProcesoError(400, 'VALIDATION_ERROR', `${name} no es valido.`); return n; };

const listLots = async (empCod, input = {}) => {
  const pool = await getPool();
  const request = pool.request().input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), input.tempCod ? String(input.tempCod).trim() : null)
    .input('Especod', sql.SmallInt, input.species ? int(input.species, 'especie', 1) : null)
    .input('VarCod', sql.Int, input.variety ? int(input.variety, 'variedad', 1) : null)
    .input('ProdCod', sql.Char(6), input.producer ? String(input.producer).trim() : null)
    .input('Lot', sql.Decimal(10, 0), input.lot ? int(input.lot, 'lote', 1) : null)
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
    OUTER APPLY (SELECT TOP 1 c.CalRecPorCalidad qualityPercentage
      FROM CALRECEP c
      WHERE c.EmpCod=d.EmpCod AND c.TempCod=d.TempCod AND c.Mov1Nlote=d.Mov1Nlote
        AND c.CalRecEstado='F'
      ORDER BY c.CalRecFecha DESC,c.CalRecId DESC) quality
    OUTER APPLY (SELECT SUM(o.Ordp1Env) usedContainers,SUM(o.Ordp1Kilos) usedKilos FROM ORDPROC1 o WHERE o.EmpCod=d.EmpCod AND o.TempCod=d.TempCod AND o.Ordp1Nlote=d.Mov1Nlote) u
    WHERE h.EmpCod=@EmpCod AND h.TMcod=1 AND COALESCE(h.Movauto,0)=0
      AND h.TempCod=COALESCE(@TempCod,(SELECT TOP 1 t.TempCod FROM TEMP01 t WHERE t.EmpCod=@EmpCod AND t.TempActiva=1 ORDER BY t.TempFecAbre DESC,t.TempCod DESC))
      AND (@Especod IS NULL OR d.Mov1Espe=@Especod)
      AND (@VarCod IS NULL OR d.Mov1Var=@VarCod) AND (@ProdCod IS NULL OR h.MovProd=@ProdCod)
      AND (@Lot IS NULL OR d.Mov1Nlote=@Lot)
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
    await insert.query(`INSERT ORDPROC (EmpCod,TempCod,Ordpnum,ProdCod,OrdpFecha,Especod,VarCod,OrdpTotEnv,OrdpTotKilos,OrdpEnvExp,OrdpKilosExp,OrdpEnvCom,OrdpKilosCom,OrdpDesecho,OrdploginC,OrdpFecC,OrdpEstado,OrdpLoginA,OrdpCodEti) VALUES (@EmpCod,@TempCod,@Ordpnum,@Producer,@Fecha,@Species,@Variety,@TotEnv,@TotKilos,0,0,0,0,0,@Login,GETDATE(),0,'',@Label);`);
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
  `);
  if (!header.recordsets[0].length) throw new OrdenesProcesoError(404, 'ORDER_NOT_FOUND', 'La orden de proceso no existe.');
  return { header: header.recordsets[0][0], details: header.recordsets[1] || [] };
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

module.exports = { OrdenesProcesoError, listLots, create, update, getOrder };

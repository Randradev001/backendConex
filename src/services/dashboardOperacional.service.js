const { getPool, sql } = require('../conectorMysql/conectorSqlServer');

const number = (value) => Number(value || 0);

async function getDashboard(empCod) {
  const pool = await getPool();
  const result = await pool.request().input('EmpCod', sql.SmallInt, empCod).query(`
    DECLARE @Today date=CAST(GETDATE() AS date);
    DECLARE @TempCod char(9)=(SELECT TOP 1 TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempActiva=1 ORDER BY TempFecAbre DESC,TempCod DESC);
    SELECT RTRIM(@TempCod) season,@Today today;

    SELECT
      SUM(CASE WHEN CAST(OrdpFecha AS date)=@Today THEN COALESCE(OrdpKilosExp,0) ELSE 0 END) dayExport,
      SUM(CASE WHEN CAST(OrdpFecha AS date)=@Today THEN COALESCE(OrdpKilosCom,0) ELSE 0 END) dayCommercial,
      SUM(CASE WHEN CAST(OrdpFecha AS date)=@Today THEN COALESCE(OrdpDesecho,0) ELSE 0 END) dayWaste,
      SUM(COALESCE(OrdpKilosExp,0)) seasonExport,SUM(COALESCE(OrdpKilosCom,0)) seasonCommercial,
      SUM(COALESCE(OrdpDesecho,0)) seasonWaste
    FROM ORDPROC WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND OrdpEstado=5;

    SELECT TOP 12 v.VarCod code,RTRIM(COALESCE(v.VarNom,CONCAT('Variedad ',o.VarCod))) name,
      SUM(COALESCE(o.OrdpKilosExp,0)+COALESCE(o.OrdpKilosCom,0)+COALESCE(o.OrdpDesecho,0)) kilos
    FROM ORDPROC o LEFT JOIN ESPECIES1 v ON v.EmpCod=o.EmpCod AND v.Especod=o.Especod AND v.VarCod=o.VarCod
    WHERE o.EmpCod=@EmpCod AND o.TempCod=@TempCod AND o.OrdpEstado=5
    GROUP BY v.VarCod,v.VarNom,o.VarCod ORDER BY kilos DESC;

    SELECT COUNT(*) trucksToday FROM DESORIGEN
    WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND DorEstado=1 AND CAST(DorFecha AS date)=@Today;

    ;WITH Lots AS (
      SELECT d.EmpCod,d.TempCod,d.OriCod,d.MovTDoc,d.MovNGuia,d.MovProd,d.Mov1Nlote,MAX(COALESCE(d.Mov1KilN,0)) kilos
      FROM MOVFRUT1 d WHERE d.EmpCod=@EmpCod AND d.TempCod=@TempCod
      GROUP BY d.EmpCod,d.TempCod,d.OriCod,d.MovTDoc,d.MovNGuia,d.MovProd,d.Mov1Nlote
    ), Quality AS (
      SELECT c.*,ROW_NUMBER() OVER(PARTITION BY c.EmpCod,c.TempCod,c.OriCod,c.MovTDoc,c.MovNGuia,c.MovProd,c.Mov1Nlote ORDER BY c.CalRecFecha DESC,c.CalRecHora DESC,c.CalRecId DESC) rn
      FROM CALRECEP c WHERE c.EmpCod=@EmpCod AND c.TempCod=@TempCod AND c.CalRecEstado='F'
    )
    SELECT COUNT(*) receivedLots,SUM(CASE WHEN q.CalRecId IS NOT NULL THEN 1 ELSE 0 END) qualityLots,
      SUM(CASE WHEN q.CalRecPorCalidad>=90 THEN 1 ELSE 0 END) lotsOver90,
      SUM(CASE WHEN q.CalRecPorCalidad>=90 THEN l.kilos ELSE 0 END) kilosOver90,
      SUM(CASE WHEN q.CalRecId IS NOT NULL AND q.CalRecPorCalidad<90 THEN l.kilos ELSE 0 END) kilosUnder90
    FROM Lots l LEFT JOIN Quality q ON q.EmpCod=l.EmpCod AND q.TempCod=l.TempCod AND q.OriCod=l.OriCod
      AND q.MovTDoc=l.MovTDoc AND q.MovNGuia=l.MovNGuia AND q.MovProd=l.MovProd AND q.Mov1Nlote=l.Mov1Nlote AND q.rn=1;

    SELECT COUNT(*) pestFindingsToday
    FROM CALRECEPPLAGA p JOIN CALRECEP c ON c.EmpCod=p.EmpCod AND c.CalRecId=p.CalRecId
    WHERE c.EmpCod=@EmpCod AND c.CalRecEstado='F' AND c.CalRecFecha=@Today;
    SELECT TOP 8 RTRIM(m.MAPlaDes) name,COUNT(*) quantity
    FROM CALRECEPPLAGA p JOIN CALRECEP c ON c.EmpCod=p.EmpCod AND c.CalRecId=p.CalRecId
      JOIN MAPlagas m ON m.EmpCod=p.EmpCod AND m.Especod=p.Especod AND m.MAPlaCod=p.MAPlaCod
    WHERE c.EmpCod=@EmpCod AND c.CalRecEstado='F' AND c.CalRecFecha=@Today
    GROUP BY m.MAPlaDes ORDER BY quantity DESC,name;

    SELECT
      SUM(CASE WHEN CAST(FacFecha AS date)=@Today AND FacEmisor=1 THEN COALESCE(FacTotal,0) ELSE 0 END) dayCommercial,
      SUM(CASE WHEN CAST(FacFecha AS date)=@Today AND FacEmisor=2 THEN COALESCE(FacTotal,0) ELSE 0 END) dayExport,
      SUM(CASE WHEN FacEmisor=1 THEN COALESCE(FacTotal,0) ELSE 0 END) seasonCommercial,
      SUM(CASE WHEN FacEmisor=2 THEN COALESCE(FacTotal,0) ELSE 0 END) seasonExport
    FROM FACTURA WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND COALESCE(FacEstado,0)<>5;

    SELECT TOP 12 c.EnvCod code,RTRIM(COALESCE(e.EnvNom,CONCAT('Envase ',c.EnvCod))) name,
      COUNT(*) units,SUM(COALESCE(c.CAPKilos,0)) kilos
    FROM CAP001 c LEFT JOIN ENVCAT e ON e.EmpCod=c.EmpCod AND e.EnvCod=c.EnvCod
    WHERE c.EmpCod=@EmpCod AND c.TempCod=@TempCod AND c.CAPEst=0
    GROUP BY c.EnvCod,e.EnvNom ORDER BY units DESC;
  `);
  const [context, processed, varieties, trucks, quality, pestTotal, pests, billing, stock] = result.recordsets;
  const p = processed[0] || {}; const q = quality[0] || {}; const b = billing[0] || {};
  return {
    context: context[0] || {},
    processed: {
      day: { export: number(p.dayExport), commercial: number(p.dayCommercial), waste: number(p.dayWaste) },
      season: { export: number(p.seasonExport), commercial: number(p.seasonCommercial), waste: number(p.seasonWaste) }
    },
    varieties: varieties.map((row) => ({ ...row, kilos: number(row.kilos) })),
    trucksToday: number(trucks[0]?.trucksToday),
    quality: Object.fromEntries(Object.entries(q).map(([key, value]) => [key, number(value)])),
    pestsToday: { total: number(pestTotal[0]?.pestFindingsToday), items: pests.map((row) => ({ ...row, quantity: number(row.quantity) })) },
    billing: {
      day: { commercial: number(b.dayCommercial), export: number(b.dayExport) },
      season: { commercial: number(b.seasonCommercial), export: number(b.seasonExport) }
    },
    lineStock: stock.map((row) => ({ ...row, units: number(row.units), kilos: number(row.kilos) }))
  };
}

module.exports = { getDashboard };

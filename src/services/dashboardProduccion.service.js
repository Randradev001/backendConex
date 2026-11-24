const { getPool, sql } = require('../conectorMysql/conectorSqlServer');

class DashboardProduccionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const numeric = (value) => Number(value || 0);
const round = (value, decimals = 2) => Number(Number(value || 0).toFixed(decimals));

const weightedQuality = (rows = []) => {
  const valid = rows.filter((row) => {
    const quality = Number(row.quality);
    return row.quality !== null && row.quality !== undefined && row.quality !== ''
      && Number.isFinite(quality) && quality >= 0 && quality <= 100 && Number(row.kilos) > 0;
  });
  const kilos = valid.reduce((total, row) => total + Number(row.kilos), 0);
  if (!kilos) return { average: null, kilos: 0, lots: 0 };
  const weighted = valid.reduce((total, row) => total + Number(row.quality) * Number(row.kilos), 0);
  return { average: round(weighted / kilos), kilos: round(kilos), lots: valid.length };
};

const buildDashboard = ({ context, order, production, qualityRows, varieties, calibers, parameter }) => {
  const capacity = Number(parameter?.PAR1Valor1);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new DashboardProduccionError(
      409,
      'PALLET_PARAMETER_INVALID',
      'El parámetro de cajas por pallet PARAMGE1 70/1 no está configurado para la empresa.'
    );
  }

  const boxes = numeric(production?.boxes);
  const producedKilos = numeric(production?.kilos);
  const incomingKilos = numeric(order?.OrdpTotKilos);
  const exportPercentage = incomingKilos > 0 ? round((producedKilos / incomingKilos) * 100) : null;
  const quality = weightedQuality(qualityRows);

  return {
    context: {
      season: String(context?.season || '').trim(),
      today: context?.today || null
    },
    order: order
      ? {
          number: Number(order.Ordpnum),
          date: order.OrdpFecha,
          state: Number(order.OrdpEstado),
          species: String(order.EspeNom || '').trim(),
          variety: String(order.VarNom || '').trim(),
          producer: String(order.ProdNom || '').trim(),
          exporter: String(order.ExpNom || '').trim(),
          incomingKilos
        }
      : null,
    production: {
      boxes,
      kilos: round(producedKilos),
      palletCapacity: capacity,
      approximatePallets: Math.floor(boxes / capacity)
    },
    quality: {
      weightedAverage: quality.average,
      evaluatedKilos: quality.kilos,
      evaluatedLots: quality.lots
    },
    estimate: {
      exportPercentage,
      commercialPercentage: exportPercentage === null ? null : round(100 - exportPercentage),
      overProduction: exportPercentage !== null && exportPercentage > 100
    },
    varieties: (varieties || []).map((row) => ({
      code: Number(row.code),
      name: String(row.name || `Variedad ${row.code}`).trim()
    })),
    calibers: (calibers || []).map((row) => ({
      code: String(row.code || '').trim(),
      boxes: numeric(row.boxes)
    }))
  };
};

async function getDashboard(empCod, { poolProvider = getPool } = {}) {
  const company = Number(empCod);
  if (!Number.isInteger(company) || company < 1) {
    throw new DashboardProduccionError(400, 'INVALID_COMPANY', 'La empresa de la sesión no es válida.');
  }

  const pool = await poolProvider();
  const result = await pool.request().input('EmpCod', sql.SmallInt, company).query(`
    DECLARE @Today date=CONVERT(date,GETDATE());
    DECLARE @TempCod char(9)=(
      SELECT TOP (1) TempCod FROM TEMP01
      WHERE EmpCod=@EmpCod AND TempActiva=1
      ORDER BY TempFecAbre DESC,TempCod DESC
    );
    DECLARE @Ordpnum decimal(10,0)=(
      SELECT TOP (1) Ordpnum FROM ORDPROC
      WHERE EmpCod=@EmpCod
        AND TempCod COLLATE DATABASE_DEFAULT=@TempCod COLLATE DATABASE_DEFAULT
        AND OrdpEstado IN (0,1,4)
      ORDER BY CASE OrdpEstado WHEN 1 THEN 0 WHEN 4 THEN 1 ELSE 2 END,OrdpFecha DESC,Ordpnum DESC
    );

    SELECT RTRIM(@TempCod) season,CONVERT(char(10),@Today,23) today;

    SELECT TOP (1) o.Ordpnum,CONVERT(char(10),o.OrdpFecha,23) OrdpFecha,o.OrdpEstado,o.OrdpTotKilos,
      RTRIM(e.EspeNom) EspeNom,RTRIM(v.VarNom) VarNom,RTRIM(p.ProdNom) ProdNom,RTRIM(x.ExpNom) ExpNom
    FROM ORDPROC o
    LEFT JOIN ESPECIES e ON e.EmpCod=o.EmpCod AND e.Especod=o.Especod
    LEFT JOIN ESPECIES1 v ON v.EmpCod=o.EmpCod AND v.Especod=o.Especod AND v.VarCod=o.VarCod
    LEFT JOIN PRODUCTORES p ON p.EmpCod=o.EmpCod
      AND p.ProdCod COLLATE DATABASE_DEFAULT=o.ProdCod COLLATE DATABASE_DEFAULT
    LEFT JOIN EXPORT1 x ON x.EmpCod=o.EmpCod AND x.ExpCod=o.ExpCod
    WHERE o.EmpCod=@EmpCod
      AND o.TempCod COLLATE DATABASE_DEFAULT=@TempCod COLLATE DATABASE_DEFAULT
      AND o.Ordpnum=@Ordpnum;

    SELECT COALESCE(SUM(COALESCE(c.CAPCantidad,0)),0) boxes,COALESCE(SUM(COALESCE(c.CAPKilos,0)),0) kilos
    FROM CAP001 c
    WHERE c.EmpCod=@EmpCod
      AND c.TempCod COLLATE DATABASE_DEFAULT=@TempCod COLLATE DATABASE_DEFAULT
      AND c.CAPNproc=@Ordpnum;

    SELECT d.Ordp1Nlote lot,COALESCE(d.Ordp1Kilos,0) kilos,q.CalRecPorCalidad quality
    FROM ORDPROC1 d
    JOIN ORDPROC o ON o.EmpCod=d.EmpCod
      AND o.TempCod COLLATE DATABASE_DEFAULT=d.TempCod COLLATE DATABASE_DEFAULT
      AND o.Ordpnum=d.Ordpnum
    OUTER APPLY (
      SELECT TOP (1) c.CalRecPorCalidad
      FROM CALRECEP c
      WHERE c.EmpCod=d.EmpCod
        AND c.TempCod COLLATE DATABASE_DEFAULT=d.TempCod COLLATE DATABASE_DEFAULT
        AND c.Mov1Nlote=d.Ordp1Nlote
        AND c.CalRecEstado='F'
        AND (o.ProdCod IS NULL OR c.MovProd COLLATE DATABASE_DEFAULT=o.ProdCod COLLATE DATABASE_DEFAULT)
      ORDER BY c.CalRecFecha DESC,c.CalRecHora DESC,c.CalRecId DESC
    ) q
    WHERE d.EmpCod=@EmpCod
      AND d.TempCod COLLATE DATABASE_DEFAULT=@TempCod COLLATE DATABASE_DEFAULT
      AND d.Ordpnum=@Ordpnum
    ORDER BY d.Ordp1Nlote;

    SELECT source.VarCod code,RTRIM(COALESCE(v.VarNom,CONCAT('Variedad ',source.VarCod))) name
    FROM (
      SELECT o.Especod,o.VarCod
      FROM ORDPROC o
      WHERE o.EmpCod=@EmpCod
        AND o.TempCod COLLATE DATABASE_DEFAULT=@TempCod COLLATE DATABASE_DEFAULT
        AND o.Ordpnum=@Ordpnum
        AND o.VarCod IS NOT NULL
      UNION
      SELECT c.Especod,c.VarCod
      FROM CAP001 c
      WHERE c.EmpCod=@EmpCod
        AND c.TempCod COLLATE DATABASE_DEFAULT=@TempCod COLLATE DATABASE_DEFAULT
        AND c.CAPNproc=@Ordpnum
        AND c.VarCod IS NOT NULL
    ) source
    LEFT JOIN ESPECIES1 v ON v.EmpCod=@EmpCod AND v.Especod=source.Especod AND v.VarCod=source.VarCod
    ORDER BY name;

    SELECT RTRIM(c.Calibre) code,SUM(COALESCE(c.CAPCantidad,0)) boxes
    FROM CAP001 c
    LEFT JOIN CALIBRES m ON m.EmpCod=c.EmpCod AND m.Especod=c.Especod
      AND m.Calibre COLLATE DATABASE_DEFAULT=c.Calibre COLLATE DATABASE_DEFAULT
    WHERE c.EmpCod=@EmpCod
      AND c.TempCod COLLATE DATABASE_DEFAULT=@TempCod COLLATE DATABASE_DEFAULT
      AND c.CAPNproc=@Ordpnum
    GROUP BY c.Calibre
    ORDER BY MIN(COALESCE(m.CalOrden,m.CalCod,32767)),RTRIM(c.Calibre);

    SELECT TOP (1) PAR1Valor1
    FROM PARAMGE1
    WHERE EmpCod=@EmpCod AND PARCod=70 AND PAR1Cod=1;
  `);

  return buildDashboard({
    context: result.recordsets[0]?.[0],
    order: result.recordsets[1]?.[0],
    production: result.recordsets[2]?.[0],
    qualityRows: result.recordsets[3] || [],
    varieties: result.recordsets[4] || [],
    calibers: result.recordsets[5] || [],
    parameter: result.recordsets[6]?.[0]
  });
}

module.exports = { DashboardProduccionError, buildDashboard, getDashboard, weightedQuality };

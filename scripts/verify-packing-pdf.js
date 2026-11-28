// Solo lectura. Una temporada explícita permite revisar históricos sin cambiar TEMP01.
const fs = require('node:fs');
const path = require('node:path');
const connector = require('../src/conectorMysql/conectorSqlServer');

async function run() {
  const [company = '1', packing = '1', season] = process.argv.slice(2);
  const empCod = Number(company);
  const pool = await connector.getPool();
  const original = connector.getPool;
  try {
    if (season) {
      const found = await pool.request().input('EmpCod', connector.sql.SmallInt, empCod).input('TempCod', connector.sql.Char(9), season)
        .query('SELECT TempCod FROM TEMP01 WHERE EmpCod=@EmpCod AND TempCod=@TempCod');
      if (!found.recordset.length) throw new Error('Temporada inexistente para la empresa');
      connector.getPool = async () => ({ request() {
        const request = pool.request();
        const query = request.query.bind(request);
        request.query = (statement) => statement.includes('FROM TEMP01')
          ? Promise.resolve({ recordset: [{ tempCod: season }] }) : query(statement);
        return request;
      } });
    }
    const service = require('../src/modules/packingList/packingList.service');
    const output = path.resolve(__dirname, '../output/pdf');
    fs.mkdirSync(output, { recursive: true });
    for (const report of ['packing01', 'packing02']) {
      const data = await service.getReportData(empCod, packing, report);
      const file = await service.getPdf(empCod, packing, report);
      fs.writeFileSync(path.join(output, file.filename), file.buffer);
      console.log(JSON.stringify({ report, packing, season: data.tempCod, lines: data.groups.reduce((n, s) => n + s.rows.length, 0), totals: data.totals, bytes: file.buffer.length, file: file.filename }));
    }
  } finally { connector.getPool = original; await pool.close(); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });

// Ensaya el servicio real en SQL local; el commit se sustituye por rollback.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const connector = require('../src/conectorMysql/conectorSqlServer');
const realSql = connector.sql;
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function run() {
  if (!['localhost', '127.0.0.1'].includes(process.env.SQLSERVER_HOST) || process.env.SQLSERVER_DATABASE !== 'CONEX')
    throw new Error('Esta verificación se limita a CONEX local');
  const pool = await connector.getPool();
  try {
    const active = (await pool.request().query('SELECT TOP 1 EmpCod,TempCod FROM TEMP01 WHERE TempActiva=1 ORDER BY EmpCod')).recordset[0];
    assert.ok(active, 'Temporada activa');
    const target = (await pool.request().input('emp', realSql.SmallInt, active.EmpCod).input('season', realSql.Char(9), active.TempCod)
      .query('SELECT TOP 1 PackNumI,CliCod FROM PACKLIST WHERE EmpCod=@emp AND TempCod=@season AND CliCod>0 ORDER BY PackNumI DESC')).recordset[0];
    assert.ok(target, 'Packing local para el ensayo');
    const read = async () => {
      const req = pool.request().input('emp', realSql.SmallInt, active.EmpCod).input('season', realSql.Char(9), active.TempCod).input('id', realSql.Decimal(10, 0), target.PackNumI);
      const result = await req.query(`SELECT * FROM PACKLIST WHERE EmpCod=@emp AND TempCod=@season AND PackNumI=@id;
        SELECT * FROM integracion.PackingGuiaDatos WHERE EmpCod=@emp AND TempCod=@season AND PackNumI=@id;`);
      return result.recordsets;
    };
    const before = hash(await read());
    let rolledBack = false;
    class VerificationTransaction extends realSql.Transaction {
      async begin(...args) {
        await super.begin(...args);
        // El estado de ensayo existe solo dentro de esta transacción revertida.
        await new realSql.Request(this).input('emp', realSql.SmallInt, active.EmpCod).input('season', realSql.Char(9), active.TempCod)
          .input('id', realSql.Decimal(10, 0), target.PackNumI)
          .query('UPDATE PACKLIST SET PackEstado=0 WHERE EmpCod=@emp AND TempCod=@season AND PackNumI=@id');
      }
      async commit() { await super.rollback(); rolledBack = true; }
    }
    connector.sql = { ...realSql, Transaction: VerificationTransaction };
    const service = require('../src/modules/packingList/packingList.service');
    connector.sql = realSql;
    const form = await service.getFormData(active.EmpCod);
    const port = form.ports.find((item) => Number(item.homologation) > 0);
    const input = { clientId: target.CliCod, departureDate: '2026-11-13', arrivalDate: '2026-11-13', departureTime: '10:30',
      driver: 'ENSAYO LOCAL', driverRut: '12.345.678-5', patent: 'ABCD12', trailerPlate: 'EFGH34', transportCompany: 'ENSAYO', carrierRut: '12.345.678-5',
      originAddress: 'ORIGEN DE ENSAYO', originCommune: 'Codegua', destinationAddress: 'DESTINO DE ENSAYO', destinationCommune: 'Valparaíso',
      exporterId: form.exporters[0]?.id || '', originPortId: port?.id || '', vessel: 'ENSAYO SQL CON ROLLBACK',
      seal1: '775', thermograph1: 'N02NVV-400737', customsDeclaration: '124670039', transferIndicatorDte: 9, dispatchTypeDte: 2 };
    await service.update(active.EmpCod, target.PackNumI, input);
    assert.equal(rolledBack, true);
    assert.equal(hash(await read()), before, 'Cabecera y extensión quedaron intactas tras el ensayo');
    console.log(JSON.stringify({ sql: 'CONEX local', packing: target.PackNumI, serviceUpdate: true,
      advancedFieldsAndExtension: true, transactionRolledBack: true, sourceUnchanged: true }));
  } finally { connector.sql = realSql; await pool.close(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });

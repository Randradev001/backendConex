const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const crypto = require('node:crypto');

const tokenHash = (token) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

async function issueAperpAccess(empCod, login) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
  const pool = await getPool();
  await pool.request().input('hash', sql.Char(64), tokenHash(token))
    .input('emp', sql.Int, empCod).input('login', sql.VarChar(40), String(login).trim())
    .input('expires', sql.DateTime2, expiresAt)
    .query(`DELETE FROM integracion.GuiaAcceso WHERE ExpiraEn<DATEADD(minute,-10,SYSUTCDATETIME());
      INSERT INTO integracion.GuiaAcceso (TokenHash,EmpCod,UsuLogin,ExpiraEn) VALUES (@hash,@emp,@login,@expires)`);
  return { ticket: token, expiresAt };
}

// A read-only adapter for Conex's historical guides. New guide records remain in APERP.
async function listLegacyGuides(empCod) {
  const pool = await getPool();
  const result = await pool.request().input('emp', sql.SmallInt, empCod).query(`
    SELECT
      CONCAT('CONEX-', h.TemporadaCodigo, '-', CONVERT(varchar(20), h.NumeroInternoOrigen)) AS id,
      h.NumeroInternoOrigen AS internalNumber,
      h.FolioLegado AS folio,
      CONVERT(varchar(10), h.FechaGuia, 23) AS issueDate,
      h.TemporadaCodigo AS season,
      'CONEX' AS system,
      CONCAT('LEGADO_', CONVERT(varchar(10), h.EstadoLegado)) AS status,
      CONCAT('LEGADO_', CONVERT(varchar(10), h.TipoLegado)) AS type,
      COALESCE(c.Nombre, CONCAT('Cliente ', h.ClienteOrigen)) AS receiver,
      h.HastaTexto AS destination,
      h.TotalCajas AS quantity,
      'cajas' AS unit,
      'Guía histórica Conex' AS source,
      h.PackingNumeroInterno AS packingNumber,
      h.ClienteOrigen AS clientCode
    FROM integracion.vGuiaCabeceraOrigen h
    LEFT JOIN integracion.vClienteGuiaOrigen c
      ON c.EmpresaOrigen=h.EmpresaOrigen AND c.ClienteOrigen=h.ClienteOrigen
    WHERE h.EmpresaOrigen=@emp
    ORDER BY h.FechaGuia DESC, h.TemporadaCodigo DESC, h.NumeroInternoOrigen DESC`);
  return result.recordset;
}

module.exports = { listLegacyGuides, issueAperpAccess };

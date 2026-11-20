const { sql } = require('../conectorMysql/conectorSqlServer');

class ActiveSeasonError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
    this.code = 'ACTIVE_SEASON_INVALID';
  }
}

const requestFor = (source) => source instanceof sql.Transaction ? new sql.Request(source) : source.request();

const getActiveSeason = async (source, empCod, { lock = false } = {}) => {
  const result = await requestFor(source)
    .input('EmpCodActiveSeason', sql.SmallInt, empCod)
    .query(`
      SELECT RTRIM(TempCod) AS tempCod, RTRIM(TempDes) AS description
      FROM TEMP01 ${lock ? 'WITH (UPDLOCK,HOLDLOCK)' : ''}
      WHERE EmpCod=@EmpCodActiveSeason AND TempActiva=1
      ORDER BY TempFecAbre DESC,TempCod DESC;
    `);
  if (result.recordset.length !== 1) {
    throw new ActiveSeasonError('Debe existir exactamente una temporada activa para la empresa.');
  }
  return result.recordset[0];
};

module.exports = { ActiveSeasonError, getActiveSeason };

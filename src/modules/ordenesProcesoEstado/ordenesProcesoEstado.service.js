const { getPool, sql } = require('../../conectorMysql/conectorSqlServer');
const { getActiveSeason } = require('../../services/activeSeason.service');

const permission = Object.freeze({ sistema: 110, modulo: 2, programa: 3 });
const states = Object.freeze({
  0: 'Ingresada',
  1: 'En proceso',
  4: 'Cerrada',
  5: 'Cuadrada',
  8: 'Anulada'
});

class OrdenesProcesoEstadoError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const normalizeOrderNumber = (value) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new OrdenesProcesoEstadoError(400, 'INVALID_ORDER_NUMBER', 'El N° de orden no es válido.');
  }
  return number;
};

const normalizeState = (value) => {
  const state = Number(value);
  if (!Number.isInteger(state) || !Object.prototype.hasOwnProperty.call(states, state)) {
    throw new OrdenesProcesoEstadoError(400, 'INVALID_ORDER_STATE', 'El estado seleccionado no es válido.');
  }
  return state;
};

const trim = (value) => String(value ?? '').trim();

const findOrder = async (source, empCod, tempCod, ordpnum, lock = false) => {
  const request = source instanceof sql.Transaction ? new sql.Request(source) : source.request();
  const lockHint = lock ? 'WITH (UPDLOCK,HOLDLOCK)' : '';
  return request
    .input('EmpCod', sql.SmallInt, empCod)
    .input('TempCod', sql.Char(9), tempCod)
    .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
    .query(`
      SELECT TOP (1)
        o.TempCod,o.Ordpnum,o.OrdpEstado,o.ProdCod,o.Especod,o.VarCod,
        RTRIM(p.ProdNom) producerName,
        RTRIM(e.EspeNom) speciesName,
        RTRIM(v.VarNom) varietyName
      FROM ORDPROC o ${lockHint}
      LEFT JOIN PRODUCTORES p ON p.EmpCod=o.EmpCod AND p.ProdCod=o.ProdCod
      LEFT JOIN ESPECIES e ON e.EmpCod=o.EmpCod AND e.Especod=o.Especod
      LEFT JOIN ESPECIES1 v ON v.EmpCod=o.EmpCod AND v.Especod=o.Especod AND v.VarCod=o.VarCod
      WHERE o.EmpCod=@EmpCod AND o.TempCod=@TempCod AND o.Ordpnum=@Ordpnum;
    `);
};

const mapOrder = (row, season) => {
  const state = Number(row.OrdpEstado);
  return {
    tempCod: trim(row.TempCod),
    season: trim(season),
    Ordpnum: Number(row.Ordpnum),
    OrdpEstado: state,
    state,
    stateLabel: states[state] || `Estado ${state}`,
    producerName: trim(row.producerName),
    speciesName: trim(row.speciesName),
    varietyName: trim(row.varietyName)
  };
};

const getOrderState = async (empCod, orderNumber) => {
  const ordpnum = normalizeOrderNumber(orderNumber);
  const pool = await getPool();
  const season = await getActiveSeason(pool, empCod);
  const result = await findOrder(pool, empCod, season.tempCod, ordpnum);
  if (!result.recordset.length) {
    throw new OrdenesProcesoEstadoError(404, 'ORDER_NOT_FOUND', 'La orden no existe en la temporada activa.');
  }
  return mapOrder(result.recordset[0], season.tempCod);
};

const updateOrderState = async (empCod, orderNumber, requestedState) => {
  const ordpnum = normalizeOrderNumber(orderNumber);
  const state = normalizeState(requestedState);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const season = await getActiveSeason(transaction, empCod, { lock: true });
    const current = await findOrder(transaction, empCod, season.tempCod, ordpnum, true);
    if (!current.recordset.length) {
      throw new OrdenesProcesoEstadoError(404, 'ORDER_NOT_FOUND', 'La orden no existe en la temporada activa.');
    }

    const update = await new sql.Request(transaction)
      .input('EmpCod', sql.SmallInt, empCod)
      .input('TempCod', sql.Char(9), season.tempCod)
      .input('Ordpnum', sql.Decimal(10, 0), ordpnum)
      .input('OrdpEstado', sql.SmallInt, state)
      .query('UPDATE ORDPROC SET OrdpEstado=@OrdpEstado WHERE EmpCod=@EmpCod AND TempCod=@TempCod AND Ordpnum=@Ordpnum;');

    if (!update.rowsAffected?.[0]) {
      throw new OrdenesProcesoEstadoError(409, 'ORDER_STATE_NOT_UPDATED', 'No fue posible actualizar el estado de la orden.');
    }

    await transaction.commit();
    const order = mapOrder({ ...current.recordset[0], OrdpEstado: state }, season.tempCod);
    return { ...order, message: `La orden N° ${ordpnum} quedó en estado ${order.stateLabel}.` };
  } catch (error) {
    if (transaction._aborted !== true) {
      try { await transaction.rollback(); } catch (_) { /* rollback best effort */ }
    }
    throw error;
  }
};

module.exports = { permission, states, OrdenesProcesoEstadoError, getOrderState, updateOrderState };

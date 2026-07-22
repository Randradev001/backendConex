const { sql } = require('../conectorMysql/conectorSqlServer');

const CORRELATIVE_COLUMNS = {
  5: 'GenCor5',
  10: 'GenCor10'
};

const nextCorrelative = async ({ transaction, empCod, code, digits }) => {
  const column = CORRELATIVE_COLUMNS[digits];
  if (!column) throw new Error(`Largo de correlativo no soportado: ${digits}`);

  const request = new sql.Request(transaction);
  request.input('empCod', sql.Int, empCod);
  request.input('code', sql.VarChar(8), code);

  // Los bloqueos conservan el comportamiento de TraeCor sin entregar duplicados concurrentes.
  const result = await request.query(`
    DECLARE @exists BIT = 0;
    DECLARE @next BIGINT;

    SELECT
      @exists = 1,
      @next = ISNULL([${column}], 0) + 1
    FROM [GenCor] WITH (UPDLOCK, HOLDLOCK)
    WHERE [EmpCod] = @empCod
      AND [GenCod] = @code;

    IF @exists = 0
    BEGIN
      SET @next = 1;
      INSERT INTO [GenCor] ([EmpCod], [GenCod], [GenCor10], [GenCor5])
      VALUES (
        @empCod,
        @code,
        CASE WHEN ${digits} = 10 THEN @next ELSE 0 END,
        CASE WHEN ${digits} = 5 THEN @next ELSE 0 END
      );
    END
    ELSE
    BEGIN
      UPDATE [GenCor]
      SET [${column}] = @next
      WHERE [EmpCod] = @empCod
        AND [GenCod] = @code;
    END;

    SELECT @next AS [value];
  `);

  return Number(result.recordset[0].value);
};

module.exports = { nextCorrelative };

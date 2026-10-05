const crypto = require('node:crypto');
const { getPool, sql } = require('../conectorMysql/conectorSqlServer');
const { PRINT_CONTEXT_SQL, mapPrintContext } = require('../impresion-worker/impresion.repository');

const mapPreparation = (row) => ({
  localJobId: Number(row.LocalJobId),
  preparationId: String(row.PreparationId),
  printer: {
    id: Number(row.PrinterId),
    name: String(row.PrinterName || '').trim(),
    host: String(row.PrinterHost || '').trim(),
    port: Number(row.PrinterPort)
  },
  label: { code: String(row.LabelCode || '').trim(), version: Number(row.LabelVersion) },
  zpl: String(row.Zpl || ''),
  sha256: String(row.ZplSha256 || '').trim()
});

const createPrintAgentRepository = ({ poolProvider = getPool } = {}) => {
  const getOrCreatePreparation = async ({ agent, localJobId, lineId, prepare }) => {
    const pool = await poolProvider();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const lock = await new sql.Request(transaction)
        .input('Resource', sql.NVarChar(255), `conex-print:${agent.installationId}:${localJobId}`)
        .query("DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=@Resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; SELECT @result AS result;");
      if (Number(lock.recordset[0]?.result) < 0) throw new Error('No se pudo bloquear la preparación de impresión.');

      const existing = await new sql.Request(transaction)
        .input('InstallationId', sql.VarChar(80), agent.installationId)
        .input('LocalJobId', sql.Decimal(18, 0), localJobId)
        .query(`SELECT TOP (1) PreparationId,LocalJobId,PrinterId,PrinterName,PrinterHost,PrinterPort,
          LabelCode,LabelVersion,Zpl,ZplSha256 FROM dbo.PRINTJOBPREPARATION
          WHERE InstallationId=@InstallationId AND LocalJobId=@LocalJobId;`);
      if (existing.recordset[0]) {
        await transaction.commit();
        return mapPreparation(existing.recordset[0]);
      }

      const contextResult = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, agent.empCod)
        .input('LinID', sql.SmallInt, lineId)
        .query(PRINT_CONTEXT_SQL);
      const context = mapPrintContext(contextResult.recordset[0], {
        empCod: agent.empCod,
        lineId,
        printerPort: agent.printerPort,
        printerTimeoutMs: agent.printerTimeoutMs
      });
      if (Number(context.lineState) !== 1) {
        const error = new Error('La línea está inactiva.');
        error.code = 'PRINT_LINE_INACTIVE';
        throw error;
      }

      const sequence = await new sql.Request(transaction)
        .input('EmpCod', sql.SmallInt, agent.empCod)
        .input('GenCod', sql.Char(8), 'ETILIN')
        .query(`
          DECLARE @Next decimal(10,0);
          SELECT @Next=ISNULL(GenCor10,0)+1 FROM dbo.GenCor WITH (UPDLOCK,HOLDLOCK)
          WHERE EmpCod=@EmpCod AND GenCod=@GenCod;
          IF @Next IS NULL BEGIN
            SET @Next=1;
            INSERT dbo.GenCor(EmpCod,GenCod,GenCor10,GenCor5) VALUES(@EmpCod,@GenCod,@Next,0);
          END ELSE UPDATE dbo.GenCor SET GenCor10=@Next WHERE EmpCod=@EmpCod AND GenCod=@GenCod;
          SELECT @Next AS value;
        `);
      const prepared = prepare(context, Number(sequence.recordset[0].value));
      const preparationId = crypto.randomUUID();
      const sha256 = crypto.createHash('sha256').update(prepared.zpl, 'utf8').digest('hex');
      await new sql.Request(transaction)
        .input('PreparationId', sql.UniqueIdentifier, preparationId)
        .input('AgentId', sql.VarChar(80), agent.agentId)
        .input('InstallationId', sql.VarChar(80), agent.installationId)
        .input('LocalJobId', sql.Decimal(18, 0), localJobId)
        .input('EmpCod', sql.SmallInt, agent.empCod)
        .input('LineId', sql.SmallInt, lineId)
        .input('BoxNumber', sql.Decimal(10, 0), Number(sequence.recordset[0].value))
        .input('PrinterId', sql.SmallInt, context.lineId)
        .input('PrinterName', sql.VarChar(50), context.printerName)
        .input('PrinterHost', sql.VarChar(255), context.printerIp)
        .input('PrinterPort', sql.Int, context.printerPort)
        .input('LabelCode', sql.Char(10), prepared.labelCode)
        .input('LabelVersion', sql.Int, prepared.labelVersion)
        .input('Zpl', sql.NVarChar(sql.MAX), prepared.zpl)
        .input('Sha256', sql.Char(64), sha256)
        .query(`INSERT dbo.PRINTJOBPREPARATION(
          PreparationId,AgentId,InstallationId,LocalJobId,EmpCod,LineId,BoxNumber,
          PrinterId,PrinterName,PrinterHost,PrinterPort,LabelCode,LabelVersion,Zpl,ZplSha256,Status,CreatedAt,UpdatedAt
        ) VALUES(
          @PreparationId,@AgentId,@InstallationId,@LocalJobId,@EmpCod,@LineId,@BoxNumber,
          @PrinterId,@PrinterName,@PrinterHost,@PrinterPort,@LabelCode,@LabelVersion,@Zpl,@Sha256,'prepared',GETDATE(),GETDATE()
        );`);
      await transaction.commit();
      return {
        localJobId,
        preparationId,
        printer: { id: context.lineId, name: context.printerName, host: context.printerIp, port: context.printerPort },
        label: { code: prepared.labelCode, version: prepared.labelVersion },
        zpl: prepared.zpl,
        sha256
      };
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  };

  const saveResult = async ({ agent, preparationId, status, detail }) => {
    const pool = await poolProvider();
    const result = await pool.request()
      .input('PreparationId', sql.UniqueIdentifier, preparationId)
      .input('AgentId', sql.VarChar(80), agent.agentId)
      .input('InstallationId', sql.VarChar(80), agent.installationId)
      .input('Status', sql.VarChar(30), status)
      .input('Detail', sql.NVarChar(1000), detail ? String(detail).slice(0, 1000) : null)
      .query(`UPDATE dbo.PRINTJOBPREPARATION SET Status=@Status,ResultDetail=@Detail,
        LastResultAt=GETDATE(),UpdatedAt=GETDATE()
        WHERE PreparationId=@PreparationId AND AgentId=@AgentId AND InstallationId=@InstallationId;
        SELECT @@ROWCOUNT AS affected;`);
    return Number(result.recordset[0]?.affected || 0) === 1;
  };

  return { getOrCreatePreparation, saveResult };
};

module.exports = { createPrintAgentRepository, mapPreparation };

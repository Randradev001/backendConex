/*
  Auditoría de cuadratura de órdenes de proceso.
  Compatible con SQL Server 2016, aditivo e idempotente.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.ORDPROC_CUADRATURA_AUDIT', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ORDPROC_CUADRATURA_AUDIT
  (
    AuditId bigint IDENTITY(1,1) NOT NULL,
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    Ordpnum decimal(10,0) NOT NULL,
    AuditAction varchar(12) NOT NULL,
    PreviousState smallint NOT NULL,
    NewState smallint NOT NULL,
    ReadContainers int NOT NULL CONSTRAINT DF_ORDPROC_CUAD_AUD_ReadEnv DEFAULT (0),
    ReadKilos money NOT NULL CONSTRAINT DF_ORDPROC_CUAD_AUD_ReadKg DEFAULT (0),
    CommercialContainers int NOT NULL CONSTRAINT DF_ORDPROC_CUAD_AUD_ComEnv DEFAULT (0),
    CommercialKilos money NOT NULL CONSTRAINT DF_ORDPROC_CUAD_AUD_ComKg DEFAULT (0),
    WasteKilos money NOT NULL CONSTRAINT DF_ORDPROC_CUAD_AUD_Waste DEFAULT (0),
    Reason nvarchar(200) NULL,
    AuditLogin char(10) NOT NULL,
    AuditDate datetime NOT NULL CONSTRAINT DF_ORDPROC_CUAD_AUD_Date DEFAULT (GETDATE()),
    CONSTRAINT PK_ORDPROC_CUADRATURA_AUDIT PRIMARY KEY (AuditId),
    CONSTRAINT CK_ORDPROC_CUAD_AUD_Action CHECK (AuditAction IN ('CLOSE','REOPEN'))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID(N'dbo.ORDPROC_CUADRATURA_AUDIT')
    AND name=N'IX_ORDPROC_CUADRATURA_AUDIT_Order'
)
  CREATE INDEX IX_ORDPROC_CUADRATURA_AUDIT_Order
    ON dbo.ORDPROC_CUADRATURA_AUDIT (EmpCod,TempCod,Ordpnum,AuditDate DESC);

COMMIT TRANSACTION;

SELECT OBJECT_ID(N'dbo.ORDPROC_CUADRATURA_AUDIT', N'U') AS QuadratureAuditObjectId;

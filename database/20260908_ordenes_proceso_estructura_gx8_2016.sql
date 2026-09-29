/* Corrige ORDPROC/ORDPROC1 auxiliares e incompletas creadas por el instalador inicial. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.ORDPROC', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ORDPROC', N'Ordpnum') IS NULL
BEGIN
  IF EXISTS (SELECT TOP (1) 1 FROM dbo.ORDPROC)
    THROW 50031, 'ORDPROC incompleta contiene datos; se requiere migracion manual antes de reconstruirla.', 1;

  DROP TABLE dbo.ORDPROC;
END;

IF OBJECT_ID(N'dbo.ORDPROC', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ORDPROC
  (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    Ordpnum decimal(10,0) NOT NULL,
    OrdpFecha datetime NULL,
    Especod smallint NULL,
    VarCod int NULL,
    OrdpTotEnv decimal(10,0) NULL,
    OrdpTotKilos money NULL,
    OrdpEnvExp int NULL,
    OrdpKilosExp money NULL,
    OrdpEnvCom int NULL,
    OrdpKilosCom money NULL,
    OrdpDesecho money NULL,
    OrdpFecA datetime NULL,
    OrdpLoginA char(10) NULL,
    OrdpEstado smallint NULL,
    OrdpFecC datetime NULL,
    OrdploginC char(10) NULL,
    ProdCod char(6) NULL,
    ExpCod smallint NULL,
    OrdpCodEti char(10) NULL,
    OrdpTipEnv smallint NULL,
    OrdpHHFinP datetime NULL,
    OrdpHHIniP datetime NULL,
    OrdpETIxCal smallint NULL,
    CONSTRAINT PK_ORDPROC PRIMARY KEY (EmpCod, TempCod, Ordpnum)
  );
END;

IF OBJECT_ID(N'dbo.ORDPROC1', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ORDPROC1', N'Ordpnum') IS NULL
BEGIN
  IF EXISTS (SELECT TOP (1) 1 FROM dbo.ORDPROC1)
    THROW 50032, 'ORDPROC1 incompleta contiene datos; se requiere migracion manual antes de reconstruirla.', 1;

  DROP TABLE dbo.ORDPROC1;
END;

IF OBJECT_ID(N'dbo.ORDPROC1', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ORDPROC1
  (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    Ordpnum decimal(10,0) NOT NULL,
    Ordp1Nlote decimal(10,0) NOT NULL,
    Ordp1Env int NULL,
    Ordp1Kilos money NULL,
    CONSTRAINT PK_ORDPROC1 PRIMARY KEY (EmpCod, TempCod, Ordpnum, Ordp1Nlote)
  );
END;

IF NOT EXISTS
(
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID(N'dbo.ORDPROC') AND name=N'IX_ORDPROC_ACTIVA'
)
  CREATE INDEX IX_ORDPROC_ACTIVA ON dbo.ORDPROC (EmpCod, TempCod, OrdpEstado, Ordpnum);

COMMIT TRANSACTION;

SELECT
  COL_LENGTH(N'dbo.ORDPROC', N'TempCod') AS TempCodBytes,
  COL_LENGTH(N'dbo.ORDPROC', N'Ordpnum') AS OrdpnumBytes,
  COL_LENGTH(N'dbo.ORDPROC', N'OrdpEstado') AS OrdpEstadoBytes,
  COL_LENGTH(N'dbo.ORDPROC1', N'Ordpnum') AS DetalleOrdpnumBytes;

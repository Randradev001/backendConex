/* Ventana de Impresión: peso SAG y cola de impresión de folios.
   Idempotente: puede ejecutarse después del instalador base y de ingreso_tarjas. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.ENVCAT', N'U') IS NULL
  THROW 50080, 'No existe dbo.ENVCAT; ejecute primero el instalador operacional.', 1;

IF COL_LENGTH(N'dbo.ENVCAT', N'EnvPesoSag') IS NULL
  ALTER TABLE dbo.ENVCAT ADD EnvPesoSag decimal(10,4) NULL;

EXEC sys.sp_executesql N'
  UPDATE dbo.ENVCAT
  SET EnvPesoSag=COALESCE(EnvPesoSag,EnvPeso)
  WHERE EnvPesoSag IS NULL;
';

IF OBJECT_ID(N'dbo.OrdenImpresionFolio', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrdenImpresionFolio (
    FPIId decimal(10,0) IDENTITY(1,1) NOT NULL,
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    FPFolio char(10) NOT NULL,
    FPIPrinterId smallint NULL,
    FPIPrinterIp varchar(15) NOT NULL,
    FPIZpl nvarchar(max) NOT NULL,
    FPIProc smallint NOT NULL CONSTRAINT DF_OrdenImpresionFolio_Proc DEFAULT 0,
    FPIFechaIns datetime NOT NULL CONSTRAINT DF_OrdenImpresionFolio_FechaIns DEFAULT GETDATE(),
    FPITomadaEn datetime NULL,
    FPIWorker varchar(80) NULL,
    FPIIntentos int NOT NULL CONSTRAINT DF_OrdenImpresionFolio_Intentos DEFAULT 0,
    FPIError nvarchar(1000) NULL,
    FPIFechaProc datetime NULL,
    CONSTRAINT PK_OrdenImpresionFolio PRIMARY KEY (FPIId)
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID(N'dbo.OrdenImpresionFolio')
    AND name=N'IX_OrdenImpresionFolio_Pendientes'
)
  CREATE INDEX IX_OrdenImpresionFolio_Pendientes
    ON dbo.OrdenImpresionFolio(FPIProc,FPIFechaIns,FPIId);

COMMIT TRANSACTION;

SELECT COL_LENGTH(N'dbo.ENVCAT',N'EnvPesoSag') AS EnvPesoSagLength,
       OBJECT_ID(N'dbo.OrdenImpresionFolio',N'U') AS OrdenImpresionFolioObjectId;

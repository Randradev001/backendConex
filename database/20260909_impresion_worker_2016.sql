/* Soporte aditivo para el worker silencioso de impresión. SQL Server 2016. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.OrdenImpresion', N'U') IS NULL
  THROW 50041, 'No existe dbo.OrdenImpresion.', 1;

IF COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCFechaIns') IS NULL
  ALTER TABLE dbo.OrdenImpresion ADD OPLCFechaIns datetime NULL;
IF NOT EXISTS
(
  SELECT 1 FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
  WHERE dc.parent_object_id=OBJECT_ID(N'dbo.OrdenImpresion') AND c.name=N'OPLCFechaIns'
)
  EXEC sp_executesql N'ALTER TABLE dbo.OrdenImpresion ADD CONSTRAINT DF_OrdenImpresion_FechaIns DEFAULT (GETDATE()) FOR OPLCFechaIns;';
IF COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCTomadaEn') IS NULL
  ALTER TABLE dbo.OrdenImpresion ADD OPLCTomadaEn datetime NULL;
IF COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCWorker') IS NULL
  ALTER TABLE dbo.OrdenImpresion ADD OPLCWorker varchar(80) NULL;
IF COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCIntentos') IS NULL
  ALTER TABLE dbo.OrdenImpresion ADD OPLCIntentos int NOT NULL CONSTRAINT DF_OrdenImpresion_Intentos DEFAULT (0);
IF COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCError') IS NULL
  ALTER TABLE dbo.OrdenImpresion ADD OPLCError nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCEtiCod') IS NULL
  ALTER TABLE dbo.OrdenImpresion ADD OPLCEtiCod char(10) NULL;
IF COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCEtiVersion') IS NULL
  ALTER TABLE dbo.OrdenImpresion ADD OPLCEtiVersion int NULL;
IF COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCZpl') IS NULL
  ALTER TABLE dbo.OrdenImpresion ADD OPLCZpl nvarchar(max) NULL;

EXEC sp_executesql N'
  UPDATE dbo.OrdenImpresion
  SET OPLCFechaIns=COALESCE(OPLCFechaIns, OPLCFecha, GETDATE())
  WHERE OPLCFechaIns IS NULL;';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.OrdenImpresion') AND name=N'IX_OrdenImpresion_Pendientes')
  EXEC sp_executesql N'CREATE INDEX IX_OrdenImpresion_Pendientes
    ON dbo.OrdenImpresion(OPLCProc, OPLCFechaIns, OPLCID)
    INCLUDE(OPLCIMP);';

COMMIT TRANSACTION;

SELECT COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCFechaIns') AS FechaInsBytes,
       COL_LENGTH(N'dbo.OrdenImpresion', N'OPLCZpl') AS ZplBytes;

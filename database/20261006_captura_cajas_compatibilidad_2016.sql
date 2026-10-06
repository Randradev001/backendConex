/* Completa estructuras GX8 requeridas por Captura de cajas en instalaciones parciales. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.CAP001', N'U') IS NULL
  THROW 50061, 'Falta dbo.CAP001; aplique primero el instalador operativo.', 1;

IF COL_LENGTH(N'dbo.CAP001', N'CAPFecha') IS NULL ALTER TABLE dbo.CAP001 ADD CAPFecha datetime NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPMM') IS NULL ALTER TABLE dbo.CAP001 ADD CAPMM smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPAA') IS NULL ALTER TABLE dbo.CAP001 ADD CAPAA smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'Especod') IS NULL ALTER TABLE dbo.CAP001 ADD Especod smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'VarCod') IS NULL ALTER TABLE dbo.CAP001 ADD VarCod int NULL;
IF COL_LENGTH(N'dbo.CAP001', N'ProdCod') IS NULL ALTER TABLE dbo.CAP001 ADD ProdCod char(6) NULL;
IF COL_LENGTH(N'dbo.CAP001', N'Catcod') IS NULL ALTER TABLE dbo.CAP001 ADD Catcod smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPCantidad') IS NULL ALTER TABLE dbo.CAP001 ADD CAPCantidad smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPKilos') IS NULL ALTER TABLE dbo.CAP001 ADD CAPKilos money NULL;
IF COL_LENGTH(N'dbo.CAP001', N'EnvCod') IS NULL ALTER TABLE dbo.CAP001 ADD EnvCod smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'Calibre') IS NULL ALTER TABLE dbo.CAP001 ADD Calibre char(10) NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPEst') IS NULL ALTER TABLE dbo.CAP001 ADD CAPEst smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPNDesp') IS NULL ALTER TABLE dbo.CAP001 ADD CAPNDesp decimal(10,0) NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPTipo') IS NULL ALTER TABLE dbo.CAP001 ADD CAPTipo smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPFecDes') IS NULL ALTER TABLE dbo.CAP001 ADD CAPFecDes datetime NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPCaliO') IS NULL ALTER TABLE dbo.CAP001 ADD CAPCaliO char(10) NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPCatO') IS NULL ALTER TABLE dbo.CAP001 ADD CAPCatO smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPEnvO') IS NULL ALTER TABLE dbo.CAP001 ADD CAPEnvO smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPEtinew') IS NULL ALTER TABLE dbo.CAP001 ADD CAPEtinew char(10) NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPEtiOrig') IS NULL ALTER TABLE dbo.CAP001 ADD CAPEtiOrig char(10) NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CapPerson') IS NULL ALTER TABLE dbo.CAP001 ADD CapPerson int NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPLinea') IS NULL ALTER TABLE dbo.CAP001 ADD CAPLinea smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPMaquina') IS NULL ALTER TABLE dbo.CAP001 ADD CAPMaquina smallint NULL;
IF COL_LENGTH(N'dbo.CAP001', N'CAPLinEmba') IS NULL ALTER TABLE dbo.CAP001 ADD CAPLinEmba smallint NULL;

IF OBJECT_ID(N'dbo.LINCONFIG', N'U') IS NULL
  THROW 50062, 'Falta dbo.LINCONFIG; aplique primero la migracion de Control de lineas.', 1;

IF COL_LENGTH(N'dbo.LINCONFIG', N'VarCod') IS NULL
  ALTER TABLE dbo.LINCONFIG ADD VarCod int NULL;

IF NOT EXISTS
(
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID(N'dbo.CAP001') AND name=N'IND_CAPORDPROC'
)
  CREATE INDEX IND_CAPORDPROC ON dbo.CAP001 (EmpCod, TempCod, CAPNproc);

SELECT requisito.Objeto, requisito.Columna
FROM (VALUES
  (N'dbo.CAP001',N'CAPKilos'),
  (N'dbo.CAP001',N'CAPEst'),
  (N'dbo.CAP001',N'EnvCod'),
  (N'dbo.CAP001',N'Catcod'),
  (N'dbo.CAP001',N'Calibre'),
  (N'dbo.CAP001',N'CAPMaquina'),
  (N'dbo.CAP001',N'CAPLinea'),
  (N'dbo.CAP001',N'CapPerson'),
  (N'dbo.LINCONFIG',N'VarCod')
) requisito(Objeto,Columna)
WHERE COL_LENGTH(requisito.Objeto,requisito.Columna) IS NULL;

PRINT 'Compatibilidad de Captura de cajas disponible.';


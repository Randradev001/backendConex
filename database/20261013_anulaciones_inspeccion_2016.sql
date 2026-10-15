/* Anulaciones de folios inspeccionados (GX AnuINS). SQL Server 2016. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.ANUINS', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ANUINS (
    EmpCod smallint NOT NULL, TempCod char(9) NOT NULL, ANUFolio decimal(10,0) NOT NULL,
    ANUFecha datetime NULL, CAnCod smallint NULL, ANUFecC datetime NULL,
    ANULoginC char(10) NULL, ANUEstado smallint NULL, ANUOBS char(200) NULL,
    AnuTotFol int NULL, DACod smallint NULL,
    CONSTRAINT PK_ANUINS PRIMARY KEY (EmpCod, TempCod, ANUFolio)
  );
END;

/* El instalador inicial creó ANUINS como tabla auxiliar parcial. */
IF COL_LENGTH(N'dbo.ANUINS', N'EmpCod') IS NULL
  ALTER TABLE dbo.ANUINS ADD EmpCod smallint NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'TempCod') IS NULL
  ALTER TABLE dbo.ANUINS ADD TempCod char(9) NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'ANUFolio') IS NULL
  ALTER TABLE dbo.ANUINS ADD ANUFolio decimal(10,0) NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'ANUFecha') IS NULL
  ALTER TABLE dbo.ANUINS ADD ANUFecha datetime NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'DACod') IS NULL
  ALTER TABLE dbo.ANUINS ADD DACod smallint NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'ANUFecC') IS NULL
  ALTER TABLE dbo.ANUINS ADD ANUFecC datetime NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'ANULoginC') IS NULL
  ALTER TABLE dbo.ANUINS ADD ANULoginC char(10) NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'ANUEstado') IS NULL
  ALTER TABLE dbo.ANUINS ADD ANUEstado smallint NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'ANUOBS') IS NULL
  ALTER TABLE dbo.ANUINS ADD ANUOBS char(200) NULL;
IF COL_LENGTH(N'dbo.ANUINS', N'AnuTotFol') IS NULL
  ALTER TABLE dbo.ANUINS ADD AnuTotFol int NULL;

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.ANUINS') AND type='PK')
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.ANUINS WHERE EmpCod IS NULL OR TempCod IS NULL OR ANUFolio IS NULL)
    THROW 50001, 'ANUINS parcial contiene filas sin clave GX; completar la conversión antes de crear la clave.', 1;
  ALTER TABLE dbo.ANUINS ALTER COLUMN EmpCod smallint NOT NULL;
  ALTER TABLE dbo.ANUINS ALTER COLUMN TempCod char(9) NOT NULL;
  ALTER TABLE dbo.ANUINS ALTER COLUMN ANUFolio decimal(10,0) NOT NULL;
  ALTER TABLE dbo.ANUINS ADD CONSTRAINT PK_ANUINS PRIMARY KEY (EmpCod, TempCod, ANUFolio);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ANUINS') AND name=N'IANUINS2')
  CREATE INDEX IANUINS2 ON dbo.ANUINS (EmpCod, TempCod);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ANUINS') AND name=N'IANUINS3')
  CREATE INDEX IANUINS3 ON dbo.ANUINS (EmpCod, DACod);

IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=20 AND ProgCod=4)
  INSERT INTO dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea,ProgIDmenu,ProgTarget)
  VALUES (100,20,4,'Anulaciones Folios Inspeccionados','wanulaciones',1,CAST(GETDATE() AS date),'sag_anulaciones',NULL);

COMMIT TRANSACTION;

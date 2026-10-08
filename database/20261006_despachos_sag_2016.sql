/*
  Completa el modelo fisico de Despachos SAG tomado de GeneXus 8.
  La base operativa puede tener DESORIGEN en una version reducida usada por
  dependencias de maestros; por eso la migracion solo agrega columnas y no
  renombra, elimina ni reemplaza datos existentes.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.DESORIGEN', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DESORIGEN
  (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    DorTipPlani smallint NOT NULL,
    DORNum decimal(10,0) NOT NULL,
    DORNumf decimal(10,0) NULL,
    DorFecha datetime NULL,
    DorPuertoE smallint NULL,
    DorNPuertoE char(25) NULL,
    DorNguia decimal(10,0) NULL,
    DorTipoTrans char(30) NULL,
    DorPatente char(30) NULL,
    DorNSellos char(30) NULL,
    DorUbicacion char(30) NULL,
    DorPuertoD smallint NULL,
    DorNpuertoD char(25) NULL,
    DestCod smallint NULL,
    DestNom char(20) NULL,
    ConsCod smallint NULL,
    ConsNom char(30) NULL,
    AgeCod smallint NULL,
    AgeNom char(30) NULL,
    Agerut decimal(9,0) NULL,
    AgeDv char(1) NULL,
    ExpCod smallint NULL,
    ExpNom char(40) NULL,
    ExpRut decimal(9,0) NULL,
    ExpDv char(1) NULL,
    DorNave char(30) NULL,
    DorObs1 char(200) NULL,
    DACod smallint NULL,
    DANombre char(30) NULL,
    DorTotCajas int NULL,
    DorTotKilos money NULL,
    DorTotFol smallint NULL,
    DorEstado smallint NULL,
    DorLogcre char(10) NULL,
    DorFecCrea datetime NULL,
    DorLogAnula char(10) NULL,
    DorFecAnula datetime NULL,
    Dortrata char(50) NULL,
    DorTrata2 char(50) NULL,
    Dortrata3 char(50) NULL,
    DorCodTrata char(20) NULL,
    DorContenedor char(30) NULL,
    DorPalBin smallint NULL,
    DorTipoD smallint NULL,
    CONSTRAINT PK_DESORIGEN PRIMARY KEY (EmpCod,TempCod,DorTipPlani,DORNum)
  );
END;

IF COL_LENGTH(N'dbo.DESORIGEN', N'DorNPuertoE') IS NULL ALTER TABLE dbo.DESORIGEN ADD DorNPuertoE char(25) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'DorNpuertoD') IS NULL ALTER TABLE dbo.DESORIGEN ADD DorNpuertoD char(25) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'DestNom') IS NULL ALTER TABLE dbo.DESORIGEN ADD DestNom char(20) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'ConsNom') IS NULL ALTER TABLE dbo.DESORIGEN ADD ConsNom char(30) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'AgeNom') IS NULL ALTER TABLE dbo.DESORIGEN ADD AgeNom char(30) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'Agerut') IS NULL ALTER TABLE dbo.DESORIGEN ADD Agerut decimal(9,0) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'AgeDv') IS NULL ALTER TABLE dbo.DESORIGEN ADD AgeDv char(1) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'ExpNom') IS NULL ALTER TABLE dbo.DESORIGEN ADD ExpNom char(40) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'ExpRut') IS NULL ALTER TABLE dbo.DESORIGEN ADD ExpRut decimal(9,0) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'ExpDv') IS NULL ALTER TABLE dbo.DESORIGEN ADD ExpDv char(1) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN', N'DANombre') IS NULL ALTER TABLE dbo.DESORIGEN ADD DANombre char(30) NULL;

IF OBJECT_ID(N'dbo.DESORIGEN1', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DESORIGEN1
  (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    DorTipPlani smallint NOT NULL,
    DORNum decimal(10,0) NOT NULL,
    dor1Folio char(10) NOT NULL,
    dor1espe smallint NULL,
    Dor1Nespe char(20) NULL,
    Dor1Cajas smallint NULL,
    Dor1Kilos money NULL,
    Dor1Nsol decimal(10,0) NULL,
    CONSTRAINT PK_DESORIGEN1 PRIMARY KEY (EmpCod,TempCod,DorTipPlani,DORNum,dor1Folio)
  );
END;

IF COL_LENGTH(N'dbo.DESORIGEN1', N'Dor1Nespe') IS NULL ALTER TABLE dbo.DESORIGEN1 ADD Dor1Nespe char(20) NULL;

IF OBJECT_ID(N'dbo.DESORIGEN2', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DESORIGEN2
  (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    DorTipPlani smallint NOT NULL,
    DORNum decimal(10,0) NOT NULL,
    dor1Folio char(10) NOT NULL,
    Dor2Corr smallint NOT NULL,
    Dor2espe smallint NULL,
    Dor2Nespe char(20) NULL,
    Dor2var int NULL,
    Dor2Nvar char(20) NULL,
    Dor2fecproc datetime NULL,
    Dor2Prod char(6) NULL,
    Dor2NProd char(35) NULL,
    Dor2ComP char(20) NULL,
    Dor2ProvP char(20) NULL,
    Dor2CSG char(10) NULL,
    Dor2env smallint NULL,
    Dor2NeNV char(20) NULL,
    dor2NenvC char(10) NULL,
    Dor2cat smallint NULL,
    Dor2Ncat char(20) NULL,
    Dor2cal char(10) NULL,
    Dor2Cajas smallint NULL,
    Dor2Kilos money NULL,
    CONSTRAINT PK_DESORIGEN2 PRIMARY KEY (EmpCod,TempCod,DorTipPlani,DORNum,dor1Folio,Dor2Corr)
  );
END;

IF COL_LENGTH(N'dbo.DESORIGEN2', N'Dor2Nespe') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD Dor2Nespe char(20) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN2', N'Dor2Nvar') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD Dor2Nvar char(20) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN2', N'Dor2NProd') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD Dor2NProd char(35) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN2', N'Dor2ComP') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD Dor2ComP char(20) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN2', N'Dor2ProvP') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD Dor2ProvP char(20) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN2', N'Dor2CSG') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD Dor2CSG char(10) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN2', N'Dor2NeNV') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD Dor2NeNV char(20) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN2', N'dor2NenvC') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD dor2NenvC char(10) NULL;
IF COL_LENGTH(N'dbo.DESORIGEN2', N'Dor2Ncat') IS NULL ALTER TABLE dbo.DESORIGEN2 ADD Dor2Ncat char(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.DESORIGEN') AND name=N'IX_DESORIGEN_LISTADO')
  CREATE INDEX IX_DESORIGEN_LISTADO ON dbo.DESORIGEN (EmpCod,TempCod,DorTipPlani,DorFecha,DorEstado)
    INCLUDE (DORNum,DORNumf,DorNguia,DorTotCajas,DorTotKilos,DorTotFol);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.DESORIGEN1') AND name=N'IX_DESORIGEN1_PLANILLA')
  CREATE INDEX IX_DESORIGEN1_PLANILLA ON dbo.DESORIGEN1 (EmpCod,TempCod,DorTipPlani,DORNum,dor1Folio);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.DESORIGEN2') AND name=N'IX_DESORIGEN2_PLANILLA')
  CREATE INDEX IX_DESORIGEN2_PLANILLA ON dbo.DESORIGEN2 (EmpCod,TempCod,DorTipPlani,DORNum,dor1Folio,Dor2Corr);

COMMIT TRANSACTION;

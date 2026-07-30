USE [BDCONEXCO];
GO

/* Existing BDCONEXCO tables keep their physical names and receive only missing GX8 data. */
IF COL_LENGTH('dbo.MATemporadas', 'TempFecAbre') IS NULL
  ALTER TABLE dbo.MATemporadas ADD TempFecAbre date NULL;
IF COL_LENGTH('dbo.MATemporadas', 'TempLogA') IS NULL
  ALTER TABLE dbo.MATemporadas ADD TempLogA varchar(10) NULL;
IF COL_LENGTH('dbo.MATemporadas', 'TempFecCierra') IS NULL
  ALTER TABLE dbo.MATemporadas ADD TempFecCierra date NULL;
IF COL_LENGTH('dbo.MATemporadas', 'TempLogC') IS NULL
  ALTER TABLE dbo.MATemporadas ADD TempLogC varchar(10) NULL;
GO

IF COL_LENGTH('dbo.MAEspecies', 'EspeDiaV') IS NULL
  ALTER TABLE dbo.MAEspecies ADD EspeDiaV int NULL;
IF COL_LENGTH('dbo.MAEspecies', 'EspeSag') IS NULL
  ALTER TABLE dbo.MAEspecies ADD EspeSag int NULL;
IF COL_LENGTH('dbo.MAEspecies', 'EspeNomC') IS NULL
  ALTER TABLE dbo.MAEspecies ADD EspeNomC varchar(4) NULL;
IF COL_LENGTH('dbo.MAEspecies', 'EspePLU') IS NULL
  ALTER TABLE dbo.MAEspecies ADD EspePLU varchar(15) NULL;
IF COL_LENGTH('dbo.MAEspecies', 'EspeCMP') IS NULL
  ALTER TABLE dbo.MAEspecies ADD EspeCMP int NULL;
IF COL_LENGTH('dbo.MAEspecies', 'EspeNomExt') IS NULL
  ALTER TABLE dbo.MAEspecies ADD EspeNomExt varchar(20) NULL;
IF COL_LENGTH('dbo.MAEspecies', 'EspeNMP') IS NULL
  ALTER TABLE dbo.MAEspecies ADD EspeNMP varchar(100) NULL;
IF COL_LENGTH('dbo.MAEspecies', 'EspeSECod') IS NULL
  ALTER TABLE dbo.MAEspecies ADD EspeSECod varchar(10) NULL;
GO

IF COL_LENGTH('dbo.MAEspeciesVar', 'varnomC') IS NULL
  ALTER TABLE dbo.MAEspeciesVar ADD varnomC varchar(4) NULL;
IF COL_LENGTH('dbo.MAEspeciesVar', 'VarPLU') IS NULL
  ALTER TABLE dbo.MAEspeciesVar ADD VarPLU varchar(15) NULL;
IF COL_LENGTH('dbo.MAEspeciesVar', 'VarSECod') IS NULL
  ALTER TABLE dbo.MAEspeciesVar ADD VarSECod varchar(10) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id=OBJECT_ID('dbo.MAEspeciesVar')
    AND name='FK_MAEspeciesVar_MAEspecies'
)
  ALTER TABLE dbo.MAEspeciesVar WITH CHECK
    ADD CONSTRAINT FK_MAEspeciesVar_MAEspecies
    FOREIGN KEY (GECODEMP, EspeCod)
    REFERENCES dbo.MAEspecies (GECODEMP, EspeCod);
GO

IF COL_LENGTH('dbo.covEnvases', 'EnvPeso') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvPeso decimal(6,2) NULL;
IF COL_LENGTH('dbo.covEnvases', 'EnvDestare') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvDestare decimal(5,2) NULL;
IF COL_LENGTH('dbo.covEnvases', 'EnvPesoB') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvPesoB decimal(5,2) NULL;
IF COL_LENGTH('dbo.covEnvases', 'EnvUso') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvUso int NULL;
IF COL_LENGTH('dbo.covEnvases', 'EnvnomC') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvnomC varchar(10) NULL;
IF COL_LENGTH('dbo.covEnvases', 'EnvCMP') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvCMP int NULL;
IF COL_LENGTH('dbo.covEnvases', 'EnvNomExt') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvNomExt varchar(20) NULL;
IF COL_LENGTH('dbo.covEnvases', 'EnvNMP') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvNMP varchar(20) NULL;
IF COL_LENGTH('dbo.covEnvases', 'EnvSECod') IS NULL
  ALTER TABLE dbo.covEnvases ADD EnvSECod varchar(10) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID('dbo.covEnvases') AND name='UX_covEnvases_EmpresaCodigo'
)
  CREATE UNIQUE INDEX UX_covEnvases_EmpresaCodigo ON dbo.covEnvases (GECODEMP, envcod);
GO

/* Tables without a BDCONEXCO equivalent retain their GX8 physical names. */
IF OBJECT_ID('dbo.CALIBRES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CALIBRES (
    EmpCod decimal(10,0) NOT NULL,
    Especod smallint NOT NULL,
    Calibre varchar(10) NOT NULL,
    CalCod int NOT NULL,
    CONSTRAINT PK_CALIBRES PRIMARY KEY (EmpCod, Especod, Calibre),
    CONSTRAINT FK_CALIBRES_MAEspecies FOREIGN KEY (EmpCod, Especod)
      REFERENCES dbo.MAEspecies (GECODEMP, EspeCod)
  );
END;
GO

IF OBJECT_ID('dbo.ENVCAT1', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ENVCAT1 (
    EmpCod decimal(10,0) NOT NULL,
    EnvCod smallint NOT NULL,
    Catcod smallint NOT NULL,
    CatNom varchar(20) NOT NULL,
    CatNomC varchar(4) NOT NULL,
    CatnomExt varchar(20) NULL,
    CatSECod varchar(10) NULL,
    CONSTRAINT PK_ENVCAT1 PRIMARY KEY (EmpCod, EnvCod, Catcod),
    CONSTRAINT FK_ENVCAT1_covEnvases FOREIGN KEY (EmpCod, EnvCod)
      REFERENCES dbo.covEnvases (GECODEMP, envcod)
  );
END;
GO

IF OBJECT_ID('dbo.COMUNAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COMUNAS (
    ComCod int NOT NULL,
    Comdesc varchar(50) NOT NULL,
    CONSTRAINT PK_COMUNAS PRIMARY KEY (ComCod)
  );
END;
GO

IF OBJECT_ID('dbo.PRODUCTORES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PRODUCTORES (
    EmpCod decimal(10,0) NOT NULL,
    ProdCod varchar(6) NOT NULL,
    ProdNom varchar(35) NOT NULL,
    ProdRut int NULL,
    ProdDv char(1) NULL,
    ProdComuna varchar(20) NULL,
    ProdProvincia varchar(20) NULL,
    ProdPack varchar(30) NULL,
    ProdPackCom varchar(20) NULL,
    ProdPackProv varchar(20) NULL,
    ProdCodExt varchar(10) NULL,
    Prodnom2 varchar(20) NULL,
    ProdCodSAG varchar(10) NOT NULL,
    ProdSECod varchar(10) NULL,
    CONSTRAINT PK_PRODUCTORES PRIMARY KEY (EmpCod, ProdCod)
  );
END;
GO

IF OBJECT_ID('dbo.PRODUCTORES1', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PRODUCTORES1 (
    EmpCod decimal(10,0) NOT NULL,
    ProdCod varchar(6) NOT NULL,
    CuarCod int NOT NULL,
    CuarNom varchar(35) NOT NULL,
    CuarnomC varchar(4) NOT NULL,
    CONSTRAINT PK_PRODUCTORES1 PRIMARY KEY (EmpCod, ProdCod, CuarCod),
    CONSTRAINT FK_PRODUCTORES1_PRODUCTORES FOREIGN KEY (EmpCod, ProdCod)
      REFERENCES dbo.PRODUCTORES (EmpCod, ProdCod)
  );
END;
GO

IF OBJECT_ID('dbo.GenCor', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.GenCor (
    EmpCod decimal(10,0) NOT NULL,
    GenCod varchar(8) NOT NULL,
    GenCor10 decimal(10,0) NOT NULL CONSTRAINT DF_GenCor_GenCor10 DEFAULT (0),
    GenCor5 decimal(5,0) NOT NULL CONSTRAINT DF_GenCor_GenCor5 DEFAULT (0),
    CONSTRAINT PK_GenCor PRIMARY KEY (EmpCod, GenCod)
  );
END;
GO

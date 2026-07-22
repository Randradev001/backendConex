USE [conex];
GO

-- Columnas presentes en la estructura de las Transactions exportadas desde GX8.
IF COL_LENGTH('dbo.ESPECIES', 'EspeNMP') IS NULL
  ALTER TABLE dbo.ESPECIES ADD EspeNMP VARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.ENVCAT', 'EnvPesoB') IS NULL
  ALTER TABLE dbo.ENVCAT ADD EnvPesoB DECIMAL(5, 2) NULL;
GO

IF COL_LENGTH('dbo.ENVCAT', 'EnvNMP') IS NULL
  ALTER TABLE dbo.ENVCAT ADD EnvNMP VARCHAR(20) NULL;
GO

-- TraeCor usa esta tabla para generar CalCod y otros correlativos del sistema.
IF OBJECT_ID('dbo.GenCor', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.GenCor (
    EmpCod DECIMAL(2, 0) NOT NULL,
    GenCod VARCHAR(8) NOT NULL,
    GenCor10 DECIMAL(10, 0) NOT NULL CONSTRAINT DF_GenCor_GenCor10 DEFAULT (0),
    GenCor5 DECIMAL(5, 0) NOT NULL CONSTRAINT DF_GenCor_GenCor5 DEFAULT (0),
    CONSTRAINT PK_GenCor PRIMARY KEY (EmpCod, GenCod)
  );
END;
GO

/*
  Plantilla visual ZPL vinculada al conjunto EmpCod + ConfCod de CONFIGETI.
  Compatible con SQL Server 2016. No modifica la tabla histórica CONFIGETI.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.CONFIGETI', N'U') IS NULL
  THROW 50001, 'No existe dbo.CONFIGETI.', 1;

IF OBJECT_ID(N'dbo.ETIQUETAPLANTILLA', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ETIQUETAPLANTILLA (
    EmpCod smallint NOT NULL,
    ConfCod char(10) NOT NULL,
    EtiNombre nvarchar(100) NOT NULL,
    EtiDescripcion nvarchar(250) NULL,
    EtiAnchoMm decimal(9,3) NOT NULL,
    EtiAltoMm decimal(9,3) NOT NULL,
    EtiDpi smallint NOT NULL,
    EtiAnchoDots int NOT NULL,
    EtiAltoDots int NOT NULL,
    EtiDesignJson nvarchar(max) NOT NULL,
    EtiZpl nvarchar(max) NOT NULL,
    EtiSchemaVersion int NOT NULL CONSTRAINT DF_ETIQUETAPLANTILLA_Schema DEFAULT (1),
    EtiParserVersion varchar(20) NOT NULL CONSTRAINT DF_ETIQUETAPLANTILLA_Parser DEFAULT ('conex-1'),
    EtiGeneratorVersion varchar(20) NOT NULL CONSTRAINT DF_ETIQUETAPLANTILLA_Generator DEFAULT ('conex-1'),
    EtiActiva bit NOT NULL CONSTRAINT DF_ETIQUETAPLANTILLA_Activa DEFAULT (1),
    EtiLoginC varchar(10) NOT NULL,
    EtiFechaC datetime2(0) NOT NULL CONSTRAINT DF_ETIQUETAPLANTILLA_FechaC DEFAULT (SYSDATETIME()),
    EtiLoginM varchar(10) NOT NULL,
    EtiFechaM datetime2(0) NOT NULL CONSTRAINT DF_ETIQUETAPLANTILLA_FechaM DEFAULT (SYSDATETIME()),
    EtiRowVersion rowversion NOT NULL,
    CONSTRAINT PK_ETIQUETAPLANTILLA PRIMARY KEY (EmpCod, ConfCod),
    CONSTRAINT CK_ETIQUETAPLANTILLA_Dpi CHECK (EtiDpi IN (152, 203, 300, 600)),
    CONSTRAINT CK_ETIQUETAPLANTILLA_Medidas CHECK (
      EtiAnchoMm > 0 AND EtiAltoMm > 0 AND EtiAnchoDots > 0 AND EtiAltoDots > 0
    ),
    CONSTRAINT CK_ETIQUETAPLANTILLA_Json CHECK (ISJSON(EtiDesignJson) = 1)
  );

  CREATE INDEX IX_ETIQUETAPLANTILLA_Activa
    ON dbo.ETIQUETAPLANTILLA (EmpCod, EtiActiva, ConfCod);
END;

SELECT
  OBJECT_ID(N'dbo.ETIQUETAPLANTILLA', N'U') AS EtiquetaPlantillaObjectId,
  CASE WHEN EXISTS (
    SELECT 1
    FROM dbo.PROGRAM
    WHERE SistCod=110 AND Modcod=1 AND ProgCod=1
      AND LOWER(LTRIM(RTRIM(ProgNomGX)))='wconfigeti'
  ) THEN 1 ELSE 0 END AS ProgramaConfigEtiConfirmado;


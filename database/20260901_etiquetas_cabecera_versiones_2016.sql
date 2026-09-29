/*
  Catalogo moderno de etiquetas y versiones editables.
  CONFIGETI se conserva solo como fuente historica de rescate.
  Compatible con SQL Server 2016 y repetible.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.TIPETI', N'U') IS NULL
  THROW 50000, 'No existe dbo.TIPETI.', 1;

IF OBJECT_ID(N'dbo.ETIQUETA', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ETIQUETA (
    EmpCod smallint NOT NULL,
    EtiCod char(10) NOT NULL,
    EtiNombre nvarchar(100) NOT NULL,
    EtiDescripcion nvarchar(250) NULL,
    EtiTipo varchar(20) NULL,
    EtiConfCodOrigen char(10) NULL,
    EtiActiva bit NOT NULL CONSTRAINT DF_ETIQUETA_Activa DEFAULT (1),
    EtiLoginC varchar(10) NOT NULL,
    EtiFechaC datetime2(0) NOT NULL CONSTRAINT DF_ETIQUETA_FechaC DEFAULT (SYSDATETIME()),
    EtiLoginM varchar(10) NOT NULL,
    EtiFechaM datetime2(0) NOT NULL CONSTRAINT DF_ETIQUETA_FechaM DEFAULT (SYSDATETIME()),
    EtiRowVersion rowversion NOT NULL,
    CONSTRAINT PK_ETIQUETA PRIMARY KEY (EmpCod, EtiCod)
  );
  CREATE INDEX IX_ETIQUETA_Activa ON dbo.ETIQUETA (EmpCod, EtiActiva, EtiCod);
END;

/* Algunas instalaciones 2016 definieron TIPETI.TEtCod como int y GX8 usa smallint. */
DECLARE @TEtCodType sysname;
SELECT @TEtCodType=TYPE_NAME(system_type_id)
FROM sys.columns
WHERE object_id=OBJECT_ID(N'dbo.TIPETI') AND name=N'TEtCod';

IF @TEtCodType NOT IN (N'smallint', N'int')
  THROW 50003, 'El tipo de TIPETI.TEtCod no es compatible con la migracion.', 1;

IF COL_LENGTH(N'dbo.ETIQUETA', N'TEtCod') IS NULL
  EXEC(N'ALTER TABLE dbo.ETIQUETA ADD TEtCod ' + @TEtCodType + N' NULL;');
ELSE IF EXISTS
(
  SELECT 1 FROM sys.columns
  WHERE object_id=OBJECT_ID(N'dbo.ETIQUETA') AND name=N'TEtCod'
    AND TYPE_NAME(system_type_id)<>@TEtCodType
)
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_ETIQUETA_TIPETI' AND parent_object_id=OBJECT_ID(N'dbo.ETIQUETA'))
    ALTER TABLE dbo.ETIQUETA DROP CONSTRAINT FK_ETIQUETA_TIPETI;
  EXEC(N'ALTER TABLE dbo.ETIQUETA ALTER COLUMN TEtCod ' + @TEtCodType + N' NULL;');
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_ETIQUETA_TIPETI' AND parent_object_id=OBJECT_ID(N'dbo.ETIQUETA'))
  ALTER TABLE dbo.ETIQUETA WITH CHECK ADD CONSTRAINT FK_ETIQUETA_TIPETI
    FOREIGN KEY (EmpCod, TEtCod) REFERENCES dbo.TIPETI (EmpCod, TEtCod);

IF OBJECT_ID(N'dbo.ETIQUETAVERSION', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ETIQUETAVERSION (
    EmpCod smallint NOT NULL,
    EtiCod char(10) NOT NULL,
    EtiVersion int NOT NULL,
    EtiVersionNombre nvarchar(100) NOT NULL,
    EtiVersionDescripcion nvarchar(250) NULL,
    EtiAnchoMm decimal(9,3) NOT NULL,
    EtiAltoMm decimal(9,3) NOT NULL,
    EtiDpi smallint NOT NULL,
    EtiAnchoDots int NOT NULL,
    EtiAltoDots int NOT NULL,
    EtiDesignJson nvarchar(max) NOT NULL,
    EtiZpl nvarchar(max) NOT NULL,
    EtiSchemaVersion int NOT NULL CONSTRAINT DF_ETIQUETAVERSION_Schema DEFAULT (1),
    EtiParserVersion varchar(20) NOT NULL CONSTRAINT DF_ETIQUETAVERSION_Parser DEFAULT ('conex-1'),
    EtiGeneratorVersion varchar(20) NOT NULL CONSTRAINT DF_ETIQUETAVERSION_Generator DEFAULT ('conex-1'),
    EtiVigente bit NOT NULL CONSTRAINT DF_ETIQUETAVERSION_Vigente DEFAULT (0),
    EtiLoginC varchar(10) NOT NULL,
    EtiFechaC datetime2(0) NOT NULL CONSTRAINT DF_ETIQUETAVERSION_FechaC DEFAULT (SYSDATETIME()),
    EtiLoginM varchar(10) NOT NULL,
    EtiFechaM datetime2(0) NOT NULL CONSTRAINT DF_ETIQUETAVERSION_FechaM DEFAULT (SYSDATETIME()),
    EtiRowVersion rowversion NOT NULL,
    CONSTRAINT PK_ETIQUETAVERSION PRIMARY KEY (EmpCod, EtiCod, EtiVersion),
    CONSTRAINT FK_ETIQUETAVERSION_ETIQUETA FOREIGN KEY (EmpCod, EtiCod)
      REFERENCES dbo.ETIQUETA (EmpCod, EtiCod) ON DELETE CASCADE,
    CONSTRAINT CK_ETIQUETAVERSION_Dpi CHECK (EtiDpi IN (152, 203, 300, 600)),
    CONSTRAINT CK_ETIQUETAVERSION_Medidas CHECK (
      EtiAnchoMm > 0 AND EtiAltoMm > 0 AND EtiAnchoDots > 0 AND EtiAltoDots > 0
    ),
    CONSTRAINT CK_ETIQUETAVERSION_Json CHECK (ISJSON(EtiDesignJson) = 1)
  );
  CREATE UNIQUE INDEX UX_ETIQUETAVERSION_Vigente
    ON dbo.ETIQUETAVERSION (EmpCod, EtiCod) WHERE EtiVigente=1;
END;

/* Cada ConfCod historico se transforma en una cabecera, no en doce ediciones. */
IF OBJECT_ID(N'dbo.CONFIGETI', N'U') IS NOT NULL
BEGIN
  INSERT dbo.ETIQUETA (
    EmpCod, EtiCod, EtiNombre, EtiDescripcion, EtiTipo, EtiConfCodOrigen,
    EtiActiva, EtiLoginC, EtiFechaC, EtiLoginM, EtiFechaM
  )
  SELECT c.EmpCod, c.ConfCod, RTRIM(c.ConfCod),
    N'Importada desde CONFIGETI; las líneas históricas se conservan solo como respaldo.',
    NULLIF(MAX(RTRIM(c.ConfTipEti)), ''), c.ConfCod, 1,
    COALESCE(NULLIF(MAX(RTRIM(c.ConfLogCrea)), ''), 'MIGRACION'),
    COALESCE(MIN(c.ConfFecC), SYSDATETIME()),
    COALESCE(NULLIF(MAX(RTRIM(c.ConfLogCrea)), ''), 'MIGRACION'), SYSDATETIME()
  FROM dbo.CONFIGETI c
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ETIQUETA e WHERE e.EmpCod=c.EmpCod AND e.EtiCod=c.ConfCod
  )
  GROUP BY c.EmpCod, c.ConfCod;
END;

/* Migra cualquier diseño de la primera implementación como versión 1. */
IF OBJECT_ID(N'dbo.ETIQUETAPLANTILLA', N'U') IS NOT NULL
BEGIN
  INSERT dbo.ETIQUETAVERSION (
    EmpCod, EtiCod, EtiVersion, EtiVersionNombre, EtiVersionDescripcion,
    EtiAnchoMm, EtiAltoMm, EtiDpi, EtiAnchoDots, EtiAltoDots,
    EtiDesignJson, EtiZpl, EtiSchemaVersion, EtiParserVersion,
    EtiGeneratorVersion, EtiVigente, EtiLoginC, EtiFechaC, EtiLoginM, EtiFechaM
  )
  SELECT p.EmpCod, p.ConfCod, 1, p.EtiNombre, p.EtiDescripcion,
    p.EtiAnchoMm, p.EtiAltoMm, p.EtiDpi, p.EtiAnchoDots, p.EtiAltoDots,
    p.EtiDesignJson, p.EtiZpl, p.EtiSchemaVersion, p.EtiParserVersion,
    p.EtiGeneratorVersion, 1, p.EtiLoginC, p.EtiFechaC, p.EtiLoginM, p.EtiFechaM
  FROM dbo.ETIQUETAPLANTILLA p
  WHERE EXISTS (
    SELECT 1 FROM dbo.ETIQUETA e WHERE e.EmpCod=p.EmpCod AND e.EtiCod=p.ConfCod
  ) AND NOT EXISTS (
    SELECT 1 FROM dbo.ETIQUETAVERSION v
    WHERE v.EmpCod=p.EmpCod AND v.EtiCod=p.ConfCod AND v.EtiVersion=1
  );
END;

SELECT
  (SELECT COUNT(*) FROM dbo.ETIQUETA) AS Etiquetas,
  (SELECT COUNT(*) FROM dbo.ETIQUETAVERSION) AS Versiones;

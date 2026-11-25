/* Envases de desecho informativos, sin especie ni variedad. Ejecutar antes de desplegar la cuadratura. */
IF OBJECT_ID(N'dbo.ORDPROC_CUADRATURA_AUDIT', N'U') IS NULL
  THROW 51124, 'Falta instalar ORDPROC_CUADRATURA_AUDIT.', 1;

IF COL_LENGTH(N'dbo.ORDPROC_CUADRATURA_AUDIT', N'WasteContainers') IS NULL
  ALTER TABLE dbo.ORDPROC_CUADRATURA_AUDIT ADD WasteContainers int NOT NULL
    CONSTRAINT DF_ORDPROC_CUAD_AUD_WasteEnv DEFAULT (0);

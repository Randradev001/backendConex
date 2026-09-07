/*
  Relaciona la cabecera moderna de etiqueta con el maestro GX8 TIPETI.
  EtiTipo se conserva como formato tecnico de origen (por ejemplo VINASA).
  Compatible con SQL Server 2016 y repetible.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.ETIQUETA', N'U') IS NULL
  THROW 50001, 'No existe dbo.ETIQUETA.', 1;

IF OBJECT_ID(N'dbo.TIPETI', N'U') IS NULL
  THROW 50002, 'No existe dbo.TIPETI.', 1;

IF COL_LENGTH(N'dbo.ETIQUETA', N'TEtCod') IS NULL
  ALTER TABLE dbo.ETIQUETA ADD TEtCod smallint NULL;

GO

IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='ETIQUETA'
    AND COLUMN_NAME='TEtCod' AND DATA_TYPE<>'smallint'
)
  ALTER TABLE dbo.ETIQUETA ALTER COLUMN TEtCod smallint NULL;

GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id=OBJECT_ID(N'dbo.ETIQUETA')
    AND name=N'FK_ETIQUETA_TIPETI'
)
  ALTER TABLE dbo.ETIQUETA WITH CHECK ADD CONSTRAINT FK_ETIQUETA_TIPETI
    FOREIGN KEY (EmpCod, TEtCod) REFERENCES dbo.TIPETI (EmpCod, TEtCod);

SELECT
  COUNT(*) AS Etiquetas,
  SUM(CASE WHEN TEtCod IS NULL THEN 1 ELSE 0 END) AS SinTipoAsignado
FROM dbo.ETIQUETA;

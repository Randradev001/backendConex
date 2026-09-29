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

DECLARE @TEtCodType sysname;
SELECT @TEtCodType=TYPE_NAME(system_type_id)
FROM sys.columns
WHERE object_id=OBJECT_ID(N'dbo.TIPETI') AND name=N'TEtCod';

IF @TEtCodType NOT IN (N'smallint', N'int')
  THROW 50003, 'El tipo de TIPETI.TEtCod no es compatible con la migracion.', 1;

IF COL_LENGTH(N'dbo.ETIQUETA', N'TEtCod') IS NULL
  EXEC(N'ALTER TABLE dbo.ETIQUETA ADD TEtCod ' + @TEtCodType + N' NULL;');
ELSE IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id=OBJECT_ID(N'dbo.ETIQUETA') AND name=N'TEtCod'
    AND TYPE_NAME(system_type_id)<>@TEtCodType
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id=OBJECT_ID(N'dbo.ETIQUETA') AND name=N'FK_ETIQUETA_TIPETI'
  )
    ALTER TABLE dbo.ETIQUETA DROP CONSTRAINT FK_ETIQUETA_TIPETI;
  EXEC(N'ALTER TABLE dbo.ETIQUETA ALTER COLUMN TEtCod ' + @TEtCodType + N' NULL;');
END;

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

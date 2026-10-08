/* Amplia el rango de kilos del detalle de Ingreso de Tarjas.
   FP2Kilos conserva cuatro decimales y pasa de smallmoney a money. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.FOLIOSPROC1', N'U') IS NULL
  THROW 50100, 'No existe dbo.FOLIOSPROC1; aplique primero la migracion de Ingreso de Tarjas.', 1;

IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'FP2Kilos') IS NULL
  THROW 50101, 'No existe la columna dbo.FOLIOSPROC1.FP2Kilos.', 1;

IF EXISTS (
  SELECT 1
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID(N'dbo.FOLIOSPROC1')
    AND c.name = N'FP2Kilos'
    AND t.name <> N'money'
)
  ALTER TABLE dbo.FOLIOSPROC1 ALTER COLUMN FP2Kilos money NULL;

COMMIT TRANSACTION;

SELECT c.name AS ColumnName, t.name AS SqlType, c.max_length AS MaxLength, c.scale AS Scale
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.FOLIOSPROC1')
  AND c.name = N'FP2Kilos';

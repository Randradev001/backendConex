/* Amplía la observación de ANUINS para el formulario web de Anulaciones. */
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.ANUINS', N'U') IS NULL
  THROW 50001, 'No existe dbo.ANUINS; aplique primero la migración de Anulaciones.', 1;

IF COL_LENGTH(N'dbo.ANUINS', N'ANUOBS') IS NULL
  ALTER TABLE dbo.ANUINS ADD ANUOBS char(200) NULL;
ELSE IF COL_LENGTH(N'dbo.ANUINS', N'ANUOBS') < 200
  ALTER TABLE dbo.ANUINS ALTER COLUMN ANUOBS char(200) NULL;

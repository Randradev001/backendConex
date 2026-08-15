/* Retira el maestro alternativo creado por una interpretacion descartada. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.MACalibresCalidad', 'U') IS NOT NULL
  DROP TABLE dbo.MACalibresCalidad;

COMMIT TRANSACTION;

SELECT OBJECT_ID('dbo.MACalibresCalidad', 'U') AS MACalibresCalidadObjectId;

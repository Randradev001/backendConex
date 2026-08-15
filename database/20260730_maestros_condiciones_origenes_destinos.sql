/*
  Completa el contrato GX8 de los maestros Condicion, Origen y Destinos.

  El modelo CONEX original ya contiene las tres tablas. Solo DESTINOS necesita
  recuperar el atributo DestNMP que existe en la Transaction y el reporte GX8.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.CONDICION', N'U') IS NULL
   OR OBJECT_ID(N'dbo.ORIGEN', N'U') IS NULL
   OR OBJECT_ID(N'dbo.DESTINOS', N'U') IS NULL
BEGIN
  RAISERROR('La base seleccionada no contiene los maestros GX8 esperados.', 16, 1);
  RETURN;
END;

BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.DESTINOS', N'DestNMP') IS NULL
  ALTER TABLE dbo.DESTINOS ADD DestNMP char(30) NULL;

COMMIT TRANSACTION;

SELECT
  DB_NAME() AS BaseDatos,
  COL_LENGTH(N'dbo.DESTINOS', N'DestNMP') AS LargoDestNMP,
  (SELECT COUNT(*) FROM dbo.CONDICION) AS Condiciones,
  (SELECT COUNT(*) FROM dbo.ORIGEN) AS Origenes,
  (SELECT COUNT(*) FROM dbo.DESTINOS) AS Destinos;

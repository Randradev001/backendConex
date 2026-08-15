/* Indicador que define si un calibre de la especie participa en recepcion. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.CALIBRES', 'calRecepcion') IS NULL
BEGIN
  EXEC('ALTER TABLE dbo.CALIBRES
    ADD calRecepcion int NOT NULL
      CONSTRAINT DF_CALIBRES_calRecepcion DEFAULT (0) WITH VALUES');

  EXEC('ALTER TABLE dbo.CALIBRES
    ADD CONSTRAINT CK_CALIBRES_calRecepcion CHECK (calRecepcion IN (0,1))');
END;

COMMIT TRANSACTION;

GO

SELECT c.name AS columna,t.name AS tipo,c.is_nullable,dc.definition AS valorDefault
FROM sys.columns c
JOIN sys.tables tb ON tb.object_id=c.object_id
JOIN sys.types t ON t.user_type_id=c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id
WHERE tb.name='CALIBRES' AND c.name='calRecepcion';

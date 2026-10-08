SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.PROGRAM', N'U') IS NULL
  THROW 50073, 'No existe la tabla PROGRAM.', 1;

IF COL_LENGTH(N'dbo.PROGRAM', N'ProgNomGX') < 100
  ALTER TABLE dbo.PROGRAM ALTER COLUMN ProgNomGX varchar(100) NULL;

SELECT c.name,t.name AS type_name,c.max_length
FROM sys.columns c
JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID(N'dbo.PROGRAM') AND c.name=N'ProgNomGX';

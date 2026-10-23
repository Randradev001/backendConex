/*
  Relacion de embalajes con materiales (familia, grupo y articulo).
  Compatible con SQL Server 2016 y repetible.

  Fam, Gru y MaeArt son vistas de solo lectura hacia BDAPERP, por lo que no se
  declaran claves foraneas hacia ellas. MAEmbalaje sigue siendo un maestro local
  y si se protege con FK por empresa y embalaje.

  EmbMatCant conserva cinco decimales. Se usa decimal(12,5) para permitir hasta
  siete digitos enteros sin perder la precision solicitada.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.MAEmbalaje', N'U') IS NULL
  THROW 51140, 'dbo.MAEmbalaje debe existir antes de crear dbo.EmbvsMat.', 1;

IF OBJECT_ID(N'dbo.EmbvsMat', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EmbvsMat
  (
    EmpCod smallint NOT NULL,
    EmbCod smallint NOT NULL,
    FamFam smallint NOT NULL,
    GruGru smallint NOT NULL,
    ArtNum smallint NOT NULL,
    EmbMatCant decimal(12, 5) NOT NULL,
    CONSTRAINT PK_EmbvsMat PRIMARY KEY (EmpCod, EmbCod, FamFam, GruGru, ArtNum),
    CONSTRAINT FK_EmbvsMat_MAEmbalaje
      FOREIGN KEY (EmpCod, EmbCod)
      REFERENCES dbo.MAEmbalaje (EmpCod, EmbCod)
  );
END
ELSE
BEGIN
  IF COL_LENGTH(N'dbo.EmbvsMat', N'EmpCod') IS NULL
    THROW 51141, 'dbo.EmbvsMat existe sin EmpCod; requiere conciliacion.', 1;

  IF COL_LENGTH(N'dbo.EmbvsMat', N'EmbCod') IS NULL
    THROW 51142, 'dbo.EmbvsMat existe sin EmbCod; requiere conciliacion.', 1;

  IF COL_LENGTH(N'dbo.EmbvsMat', N'FamFam') IS NULL
    THROW 51143, 'dbo.EmbvsMat existe sin FamFam; requiere conciliacion.', 1;

  IF COL_LENGTH(N'dbo.EmbvsMat', N'GruGru') IS NULL
    THROW 51144, 'dbo.EmbvsMat existe sin GruGru; requiere conciliacion.', 1;

  IF COL_LENGTH(N'dbo.EmbvsMat', N'ArtNum') IS NULL
    THROW 51145, 'dbo.EmbvsMat existe sin ArtNum; requiere conciliacion.', 1;

  IF COL_LENGTH(N'dbo.EmbvsMat', N'EmbMatCant') IS NULL
    THROW 51146, 'dbo.EmbvsMat existe sin EmbMatCant; requiere conciliacion.', 1;

  IF EXISTS
  (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.EmbvsMat')
      AND name = N'EmbMatCant'
      AND (precision <> 12 OR scale <> 5)
  )
    THROW 51147, 'dbo.EmbvsMat.EmbMatCant debe ser decimal(12,5).', 1;

  IF NOT EXISTS
  (
    SELECT 1
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.EmbvsMat')
      AND name = N'FK_EmbvsMat_MAEmbalaje'
  )
    ALTER TABLE dbo.EmbvsMat
      ADD CONSTRAINT FK_EmbvsMat_MAEmbalaje
        FOREIGN KEY (EmpCod, EmbCod)
        REFERENCES dbo.MAEmbalaje (EmpCod, EmbCod);
END;

IF NOT EXISTS
(
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.EmbvsMat')
    AND name = N'IX_EmbvsMat_Material'
)
  CREATE INDEX IX_EmbvsMat_Material
    ON dbo.EmbvsMat (EmpCod, FamFam, GruGru, ArtNum);

COMMIT TRANSACTION;

SELECT
  c.name AS ColumnName,
  t.name AS TypeName,
  c.precision,
  c.scale,
  c.is_nullable
FROM sys.columns c
INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.EmbvsMat')
ORDER BY c.column_id;

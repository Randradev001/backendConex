/*
  Maestros de familia, grupo y articulo que seran referenciados por EmbvsMat.
  Compatible con SQL Server 2016 y repetible.

  EmpCod es la empresa de negocio; no se usa GECODEMP en estas tablas.
  La tabla EmbvsMat se agregara en una migracion posterior.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Fam', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Fam
  (
    EmpCod smallint NOT NULL,
    FamFam smallint NOT NULL,
    FamDesc varchar(45) NOT NULL,
    CONSTRAINT PK_Fam PRIMARY KEY (EmpCod, FamFam)
  );
END
ELSE IF COL_LENGTH(N'dbo.Fam', N'EmpCod') IS NULL
  THROW 51120, 'dbo.Fam existe sin EmpCod; requiere conciliacion antes de usarla como maestro multiempresa.', 1;

IF OBJECT_ID(N'dbo.Gru', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Gru
  (
    EmpCod smallint NOT NULL,
    FamFam smallint NOT NULL,
    GruGru smallint NOT NULL,
    GruDes varchar(30) NOT NULL,
    CONSTRAINT PK_Gru PRIMARY KEY (EmpCod, FamFam, GruGru)
  );
END
ELSE
BEGIN
  IF COL_LENGTH(N'dbo.Gru', N'EmpCod') IS NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Gru)
      THROW 51121, 'dbo.Gru contiene datos sin EmpCod; requiere conciliacion antes de normalizar la clave.', 1;

    ALTER TABLE dbo.Gru
      ADD EmpCod smallint NOT NULL
        CONSTRAINT DF_Gru_EmpCod DEFAULT (1);
  END;

  DECLARE @GruPk sysname;
  SELECT @GruPk = kc.name
  FROM sys.key_constraints kc
  WHERE kc.parent_object_id = OBJECT_ID(N'dbo.Gru')
    AND kc.type = 'PK';

  IF @GruPk IS NOT NULL
    AND NOT EXISTS
    (
      SELECT 1
      FROM sys.index_columns ic
      INNER JOIN sys.columns c
        ON c.object_id = ic.object_id
       AND c.column_id = ic.column_id
      WHERE ic.object_id = OBJECT_ID(N'dbo.Gru')
        AND ic.index_id = INDEXPROPERTY(OBJECT_ID(N'dbo.Gru'), @GruPk, 'IndexID')
        AND c.name = N'EmpCod'
    )
  BEGIN
    DECLARE @DropGruPk nvarchar(500) = N'ALTER TABLE dbo.Gru DROP CONSTRAINT ' + QUOTENAME(@GruPk);
    EXEC sys.sp_executesql @DropGruPk;
  END;

  IF NOT EXISTS
  (
    SELECT 1
    FROM sys.key_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.Gru')
      AND name = N'PK_Gru'
  )
    ALTER TABLE dbo.Gru ADD CONSTRAINT PK_Gru PRIMARY KEY (EmpCod, FamFam, GruGru);
END;

IF NOT EXISTS
(
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Gru')
    AND name = N'IX_Gru_Empresa_Familia'
)
  CREATE INDEX IX_Gru_Empresa_Familia ON dbo.Gru (EmpCod, FamFam);

IF OBJECT_ID(N'dbo.MaeArt', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MaeArt
  (
    EmpCod smallint NOT NULL,
    FamFam smallint NOT NULL,
    GruGru smallint NOT NULL,
    ArtNum smallint NOT NULL,
    ArtDes varchar(45) NOT NULL,
    CONSTRAINT PK_MaeArt PRIMARY KEY (EmpCod, FamFam, GruGru, ArtNum)
  );
END
ELSE IF COL_LENGTH(N'dbo.MaeArt', N'EmpCod') IS NULL
  THROW 51122, 'dbo.MaeArt existe sin EmpCod; requiere conciliacion antes de usarla como maestro multiempresa.', 1;

IF NOT EXISTS
(
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.MaeArt')
    AND name = N'IX_MaeArt_Empresa_Familia_Grupo'
)
  CREATE INDEX IX_MaeArt_Empresa_Familia_Grupo ON dbo.MaeArt (EmpCod, FamFam, GruGru);

COMMIT TRANSACTION;

SELECT 'Fam' AS TableName, COUNT(*) AS TotalRows FROM dbo.Fam
UNION ALL
SELECT 'Gru', COUNT(*) FROM dbo.Gru
UNION ALL
SELECT 'MaeArt', COUNT(*) FROM dbo.MaeArt;

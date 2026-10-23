/*
  Sustituye las tablas locales Fam, Gru y MaeArt por vistas de solo lectura
  hacia la base de maestros de APERP.

  Ejecutar sobre CONEX en una instancia que pueda resolver BDAPERP como base
  de datos local. Si BDAPERP esta en otra instancia, primero debe existir un
  servidor vinculado y las referencias de tres partes deben cambiarse por
  referencias de cuatro partes.

  La migracion no elimina datos: solo permite retirar tablas locales vacias.
  Si alguna tabla tiene filas o dependencias FK, se detiene.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_ID(N'BDAPERP') IS NULL
  THROW 51130, 'BDAPERP no esta disponible en la misma instancia; configure un servidor vinculado antes de crear las vistas.', 1;

IF OBJECT_ID(N'BDAPERP.dbo.Fam', N'U') IS NULL
  THROW 51131, 'BDAPERP.dbo.Fam no existe o no es accesible.', 1;

IF OBJECT_ID(N'BDAPERP.dbo.Gru', N'U') IS NULL
  THROW 51132, 'BDAPERP.dbo.Gru no existe o no es accesible.', 1;

IF OBJECT_ID(N'BDAPERP.dbo.MaeArt', N'U') IS NULL
  THROW 51133, 'BDAPERP.dbo.MaeArt no existe o no es accesible.', 1;

IF COL_LENGTH(N'BDAPERP.dbo.Fam', N'GECODEMP') IS NULL
  THROW 51134, 'BDAPERP.dbo.Fam no contiene GECODEMP.', 1;

IF COL_LENGTH(N'BDAPERP.dbo.MaeArt', N'gecodemp') IS NULL
  THROW 51135, 'BDAPERP.dbo.MaeArt no contiene gecodemp.', 1;

IF EXISTS
(
  SELECT 1
  FROM sys.tables t
  INNER JOIN sys.partitions p
    ON p.object_id = t.object_id
   AND p.index_id IN (0, 1)
  WHERE t.schema_id = SCHEMA_ID(N'dbo')
    AND t.name IN (N'Fam', N'Gru', N'MaeArt')
    AND p.rows > 0
)
  THROW 51136, 'No se pueden retirar Fam, Gru o MaeArt porque alguna tabla local contiene filas.', 1;

IF EXISTS
(
  SELECT 1
  FROM sys.foreign_keys fk
  WHERE fk.parent_object_id IN
  (
    OBJECT_ID(N'dbo.Fam'), OBJECT_ID(N'dbo.Gru'), OBJECT_ID(N'dbo.MaeArt')
  )
  OR fk.referenced_object_id IN
  (
    OBJECT_ID(N'dbo.Fam'), OBJECT_ID(N'dbo.Gru'), OBJECT_ID(N'dbo.MaeArt')
  )
)
  THROW 51137, 'No se pueden retirar Fam, Gru o MaeArt porque tienen dependencias FK locales.', 1;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.MaeArt', N'U') IS NOT NULL
  DROP TABLE dbo.MaeArt;

IF OBJECT_ID(N'dbo.Gru', N'U') IS NOT NULL
  DROP TABLE dbo.Gru;

IF OBJECT_ID(N'dbo.Fam', N'U') IS NOT NULL
  DROP TABLE dbo.Fam;

IF OBJECT_ID(N'dbo.MaeArt', N'V') IS NOT NULL
  DROP VIEW dbo.MaeArt;

IF OBJECT_ID(N'dbo.Gru', N'V') IS NOT NULL
  DROP VIEW dbo.Gru;

IF OBJECT_ID(N'dbo.Fam', N'V') IS NOT NULL
  DROP VIEW dbo.Fam;

EXEC(N'
CREATE VIEW dbo.Fam
AS
SELECT
  F.[GECODEMP] AS EmpCod,
  F.[FamFam],
  F.[FamDesc],
  F.[FamEQ],
  F.[FamTCod]
FROM [BDAPERP].[dbo].[Fam] AS F;
');

/*
  Algunas copias antiguas de APERP no tienen GECODEMP en Gru porque el
  catalogo era global. Se conserva una forma estable para CONEX y se expone
  EmpCod como NULL en ese caso; cuando APERP tenga GECODEMP se utiliza el
  valor real de la empresa.
*/
IF COL_LENGTH(N'BDAPERP.dbo.Gru', N'GECODEMP') IS NOT NULL
BEGIN
  EXEC(N'
  CREATE VIEW dbo.Gru
  AS
  SELECT
    G.[GECODEMP] AS EmpCod,
    G.[FAMFAM] AS FamFam,
    G.[GRUGRU] AS GruGru,
    G.[GRUDES] AS GruDes
  FROM [BDAPERP].[dbo].[Gru] AS G;
  ');
END
ELSE
BEGIN
  EXEC(N'
  CREATE VIEW dbo.Gru
  AS
  SELECT
    CAST(NULL AS numeric(10, 0)) AS EmpCod,
    G.[FAMFAM] AS FamFam,
    G.[GRUGRU] AS GruGru,
    G.[GRUDES] AS GruDes
  FROM [BDAPERP].[dbo].[Gru] AS G;
  ');
END;

EXEC(N'
CREATE VIEW dbo.MaeArt
AS
SELECT
  A.[gecodemp] AS EmpCod,
  A.[FAMFAM] AS FamFam,
  A.[GRUGRU] AS GruGru,
  A.[ARTNUM] AS ArtNum,
  A.[UMCOD] AS UmCod,
  A.[ARTDES] AS ArtDes,
  A.[ARTCODB] AS ArtCodB,
  A.[ARTLOG] AS ArtLog,
  A.[ARTTIPO] AS ArtTipo,
  A.[ARTDESCOR] AS ArtDescCor
FROM [BDAPERP].[dbo].[MaeArt] AS A;
');

COMMIT TRANSACTION;

SELECT N'Fam' AS ViewName, COUNT_BIG(*) AS TotalRows FROM dbo.Fam
UNION ALL
SELECT N'Gru', COUNT_BIG(*) FROM dbo.Gru
UNION ALL
SELECT N'MaeArt', COUNT_BIG(*) FROM dbo.MaeArt;

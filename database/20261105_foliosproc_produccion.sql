/*
  Homologa dbo.FOLIOSPROC con la estructura local de Conex.

  - No elimina ni actualiza registros existentes.
  - Si la tabla no existe, la crea completa.
  - Si existe, agrega solamente columnas opcionales faltantes.
  - No intenta reconstruir una clave base incompleta con datos existentes.
  - Compatible con SQL Server 2016.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.FOLIOSPROC', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.FOLIOSPROC
    (
      EmpCod       smallint NOT NULL,
      TempCod      char(9) COLLATE Modern_Spanish_CI_AS NOT NULL,
      FPFolio      char(10) COLLATE Modern_Spanish_CI_AS NOT NULL,
      FPOrdProc    decimal(10,0) NULL,
      ExpCod       smallint NULL,
      FPEspe       smallint NULL,
      FPEstado     smallint NULL,
      FPFechaIng   datetime NULL,
      FPIns        decimal(10,0) NULL,
      FPDesOri     decimal(10,0) NULL,
      FPDesOT      decimal(10,0) NULL,
      FPDesUsda    decimal(10,0) NULL,
      FPDisponible smallint NULL,
      TEtCod       smallint NULL,
      TAlCod       smallint NULL,
      TBPCod       smallint NULL,
      FPOrigen     smallint NULL,
      DestCod      smallint NULL,
      FPNCaja      decimal(10,0) NULL,
      FPServicio   varchar(30) COLLATE Modern_Spanish_CI_AS NULL,
      CONSTRAINT PK_FOLIOSPROC
        PRIMARY KEY CLUSTERED (EmpCod,TempCod,FPFolio)
    );
  END;

  /* Las tres columnas base forman la identidad física de la tarja. */
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'EmpCod') IS NULL
     OR COL_LENGTH(N'dbo.FOLIOSPROC', N'TempCod') IS NULL
     OR COL_LENGTH(N'dbo.FOLIOSPROC', N'FPFolio') IS NULL
    THROW 50100, 'FOLIOSPROC existe pero no tiene su clave base EmpCod/TempCod/FPFolio. No se modificó.', 1;

  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPOrdProc') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPOrdProc decimal(10,0) NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'ExpCod') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD ExpCod smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPEspe') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPEspe smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPEstado') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPEstado smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPFechaIng') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPFechaIng datetime NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPIns') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPIns decimal(10,0) NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPDesOri') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPDesOri decimal(10,0) NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPDesOT') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPDesOT decimal(10,0) NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPDesUsda') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPDesUsda decimal(10,0) NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPDisponible') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPDisponible smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'TEtCod') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD TEtCod smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'TAlCod') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD TAlCod smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'TBPCod') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD TBPCod smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPOrigen') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPOrigen smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'DestCod') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD DestCod smallint NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPNCaja') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPNCaja decimal(10,0) NULL;
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPServicio') IS NULL
    ALTER TABLE dbo.FOLIOSPROC ADD FPServicio varchar(30) COLLATE Modern_Spanish_CI_AS NULL;

  /* La clave debe ser exactamente empresa + temporada + folio. */
  IF NOT EXISTS
  (
    SELECT 1
    FROM sys.indexes i
    WHERE i.object_id=OBJECT_ID(N'dbo.FOLIOSPROC')
      AND i.is_primary_key=1
  )
  BEGIN
    IF EXISTS
    (
      SELECT 1
      FROM dbo.FOLIOSPROC
      GROUP BY EmpCod,TempCod,FPFolio
      HAVING COUNT_BIG(*)>1
    )
      THROW 50101, 'FOLIOSPROC tiene claves duplicadas; no se puede crear la PK.', 1;

    ALTER TABLE dbo.FOLIOSPROC
      ADD CONSTRAINT PK_FOLIOSPROC
      PRIMARY KEY CLUSTERED (EmpCod,TempCod,FPFolio);
  END;

  IF NOT EXISTS
  (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC1'
  )
    CREATE INDEX IFOLIOSPROC1 ON dbo.FOLIOSPROC (EmpCod,FPEspe);

  IF NOT EXISTS
  (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC2'
  )
    CREATE INDEX IFOLIOSPROC2 ON dbo.FOLIOSPROC (EmpCod,ExpCod);

  IF NOT EXISTS
  (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC4'
  )
    CREATE INDEX IFOLIOSPROC4 ON dbo.FOLIOSPROC (EmpCod,TBPCod);

  IF NOT EXISTS
  (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC5'
  )
    CREATE INDEX IFOLIOSPROC5 ON dbo.FOLIOSPROC (EmpCod,TAlCod);

  IF NOT EXISTS
  (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC6'
  )
    CREATE INDEX IFOLIOSPROC6 ON dbo.FOLIOSPROC (EmpCod,TEtCod);

  COMMIT TRANSACTION;

  SELECT
    c.column_id AS Posicion,
    c.name AS Columna,
    TYPE_NAME(c.user_type_id) AS Tipo,
    c.max_length AS LargoBytes,
    c.precision AS Precision,
    c.scale AS Escala,
    c.is_nullable AS PermiteNulo,
    c.collation_name AS Collation
  FROM sys.columns c
  WHERE c.object_id=OBJECT_ID(N'dbo.FOLIOSPROC')
  ORDER BY c.column_id;

  SELECT i.name AS Indice,i.is_primary_key AS EsPK,i.is_unique AS EsUnico
  FROM sys.indexes i
  WHERE i.object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND i.index_id>0
  ORDER BY i.index_id;

  SELECT COUNT_BIG(*) AS TotalRegistros FROM dbo.FOLIOSPROC;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

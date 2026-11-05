/*
  Genera/homologa dbo.FOLIOSPROC y dbo.FOLIOSPROC1 en producción.

  Seguridad:
  - Una tabla incompatible sólo se elimina si está vacía.
  - Si una tabla incompatible contiene datos, se detiene sin borrar nada.
  - Todo se ejecuta dentro de una transacción.
  - Compatible con SQL Server 2016.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  /* FOLIOSPROC antigua/incompatible: recrear únicamente si está vacía. */
  IF OBJECT_ID(N'dbo.FOLIOSPROC', N'U') IS NOT NULL
     AND
     (
       COL_LENGTH(N'dbo.FOLIOSPROC', N'EmpCod') IS NULL
       OR COL_LENGTH(N'dbo.FOLIOSPROC', N'TempCod') IS NULL
       OR COL_LENGTH(N'dbo.FOLIOSPROC', N'FPFolio') IS NULL
     )
  BEGIN
    DECLARE @FoliosProcTieneDatos bit=0;
    EXEC sys.sp_executesql
      N'IF EXISTS (SELECT TOP (1) 1 FROM dbo.FOLIOSPROC) SET @TieneDatos=1;',
      N'@TieneDatos bit OUTPUT',
      @TieneDatos=@FoliosProcTieneDatos OUTPUT;

    IF @FoliosProcTieneDatos=1
      THROW 50201, 'FOLIOSPROC tiene datos y una estructura incompatible. No se eliminó ni modificó.', 1;

    DROP TABLE dbo.FOLIOSPROC;
  END;

  /* FOLIOSPROC1 antigua/incompatible: recrear únicamente si está vacía. */
  IF OBJECT_ID(N'dbo.FOLIOSPROC1', N'U') IS NOT NULL
     AND
     (
       COL_LENGTH(N'dbo.FOLIOSPROC1', N'EmpCod') IS NULL
       OR COL_LENGTH(N'dbo.FOLIOSPROC1', N'TempCod') IS NULL
       OR COL_LENGTH(N'dbo.FOLIOSPROC1', N'FPFolio') IS NULL
       OR COL_LENGTH(N'dbo.FOLIOSPROC1', N'FP2NProc') IS NULL
       OR COL_LENGTH(N'dbo.FOLIOSPROC1', N'FP2Cor') IS NULL
     )
  BEGIN
    DECLARE @FoliosProc1TieneDatos bit=0;
    EXEC sys.sp_executesql
      N'IF EXISTS (SELECT TOP (1) 1 FROM dbo.FOLIOSPROC1) SET @TieneDatos=1;',
      N'@TieneDatos bit OUTPUT',
      @TieneDatos=@FoliosProc1TieneDatos OUTPUT;

    IF @FoliosProc1TieneDatos=1
      THROW 50202, 'FOLIOSPROC1 tiene datos y una estructura incompatible. No se eliminó ni modificó.', 1;

    DROP TABLE dbo.FOLIOSPROC1;
  END;

  IF OBJECT_ID(N'dbo.FOLIOSPROC', N'U') IS NULL
  BEGIN
    EXEC sys.sp_executesql N'
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
      );';
  END;

  IF OBJECT_ID(N'dbo.FOLIOSPROC1', N'U') IS NULL
  BEGIN
    EXEC sys.sp_executesql N'
      CREATE TABLE dbo.FOLIOSPROC1
      (
        EmpCod       smallint NOT NULL,
        TempCod      char(9) COLLATE Modern_Spanish_CI_AS NOT NULL,
        FPFolio      char(10) COLLATE Modern_Spanish_CI_AS NOT NULL,
        FP2NProc     decimal(10,0) NOT NULL,
        FP2Cor       smallint NOT NULL,
        FP2Fecha     datetime NULL,
        ProdCod      char(6) COLLATE Modern_Spanish_CI_AS NULL,
        fp2especod   smallint NULL,
        fp2varcod    int NULL,
        EnvCod       smallint NULL,
        Catcod       smallint NULL,
        Calibre      char(10) COLLATE Modern_Spanish_CI_AS NULL,
        FP2Cajas     smallint NULL,
        FP2Kilos     money NULL,
        fp2expcod    smallint NULL,
        Fp2MovRep    smallint NULL,
        Fp2Estado    smallint NULL,
        Fp2Tipo      smallint NULL,
        Fp2Ins       decimal(10,0) NULL,
        Fp2CajasO    smallint NULL,
        FP2CajasRep  smallint NULL,
        CuarCod      int NULL,
        CONSTRAINT PK_FOLIOSPROC1
          PRIMARY KEY CLUSTERED (EmpCod,TempCod,FPFolio,FP2NProc,FP2Cor)
      );';
  END;

  /* Agregar columnas opcionales faltantes a estructuras base compatibles. */
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPOrdProc') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPOrdProc decimal(10,0) NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'ExpCod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD ExpCod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPEspe') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPEspe smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPEstado') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPEstado smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPFechaIng') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPFechaIng datetime NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPIns') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPIns decimal(10,0) NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPDesOri') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPDesOri decimal(10,0) NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPDesOT') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPDesOT decimal(10,0) NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPDesUsda') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPDesUsda decimal(10,0) NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPDisponible') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPDisponible smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'TEtCod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD TEtCod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'TAlCod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD TAlCod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'TBPCod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD TBPCod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPOrigen') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPOrigen smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'DestCod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD DestCod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPNCaja') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPNCaja decimal(10,0) NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC', N'FPServicio') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD FPServicio varchar(30) COLLATE Modern_Spanish_CI_AS NULL;');

  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'FP2Fecha') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD FP2Fecha datetime NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'ProdCod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD ProdCod char(6) COLLATE Modern_Spanish_CI_AS NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'fp2especod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD fp2especod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'fp2varcod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD fp2varcod int NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'EnvCod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD EnvCod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'Catcod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD Catcod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'Calibre') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD Calibre char(10) COLLATE Modern_Spanish_CI_AS NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'FP2Cajas') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD FP2Cajas smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'FP2Kilos') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD FP2Kilos money NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'fp2expcod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD fp2expcod smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'Fp2MovRep') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD Fp2MovRep smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'Fp2Estado') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD Fp2Estado smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'Fp2Tipo') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD Fp2Tipo smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'Fp2Ins') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD Fp2Ins decimal(10,0) NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'Fp2CajasO') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD Fp2CajasO smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'FP2CajasRep') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD FP2CajasRep smallint NULL;');
  IF COL_LENGTH(N'dbo.FOLIOSPROC1', N'CuarCod') IS NULL EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD CuarCod int NULL;');

  /* Crear PK únicamente si falta. SQL dinámico evita compilación anticipada. */
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND is_primary_key=1)
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name IN(N'EmpCod',N'TempCod',N'FPFolio') AND is_nullable=1)
      THROW 50203, 'La clave de FOLIOSPROC permite NULL. Debe homologarse antes de crear la PK.', 1;
    EXEC(N'ALTER TABLE dbo.FOLIOSPROC ADD CONSTRAINT PK_FOLIOSPROC PRIMARY KEY CLUSTERED (EmpCod,TempCod,FPFolio);');
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC1') AND is_primary_key=1)
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC1') AND name IN(N'EmpCod',N'TempCod',N'FPFolio',N'FP2NProc',N'FP2Cor') AND is_nullable=1)
      THROW 50204, 'La clave de FOLIOSPROC1 permite NULL. Debe homologarse antes de crear la PK.', 1;
    EXEC(N'ALTER TABLE dbo.FOLIOSPROC1 ADD CONSTRAINT PK_FOLIOSPROC1 PRIMARY KEY CLUSTERED (EmpCod,TempCod,FPFolio,FP2NProc,FP2Cor);');
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC1')
    EXEC(N'CREATE INDEX IFOLIOSPROC1 ON dbo.FOLIOSPROC (EmpCod,FPEspe);');
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC2')
    EXEC(N'CREATE INDEX IFOLIOSPROC2 ON dbo.FOLIOSPROC (EmpCod,ExpCod);');
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC4')
    EXEC(N'CREATE INDEX IFOLIOSPROC4 ON dbo.FOLIOSPROC (EmpCod,TBPCod);');
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC5')
    EXEC(N'CREATE INDEX IFOLIOSPROC5 ON dbo.FOLIOSPROC (EmpCod,TAlCod);');
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC') AND name=N'IFOLIOSPROC6')
    EXEC(N'CREATE INDEX IFOLIOSPROC6 ON dbo.FOLIOSPROC (EmpCod,TEtCod);');

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC1') AND name=N'IND_CORFOL')
    EXEC(N'CREATE INDEX IND_CORFOL ON dbo.FOLIOSPROC1 (EmpCod,TempCod,FPFolio,FP2NProc,FP2Cor);');
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC1') AND name=N'IND_VERIFOLIO')
    EXEC(N'CREATE INDEX IND_VERIFOLIO ON dbo.FOLIOSPROC1 (EmpCod,TempCod,FPFolio,FP2Fecha,fp2especod,fp2varcod,ProdCod,EnvCod,Catcod,Calibre);');

  COMMIT TRANSACTION;

  SELECT N'FOLIOSPROC' Tabla,COUNT_BIG(*) Registros FROM dbo.FOLIOSPROC
  UNION ALL
  SELECT N'FOLIOSPROC1',COUNT_BIG(*) FROM dbo.FOLIOSPROC1;

  SELECT
    OBJECT_NAME(c.object_id) Tabla,c.column_id Posicion,c.name Columna,
    TYPE_NAME(c.user_type_id) Tipo,c.max_length LargoBytes,
    c.precision Precision,c.scale Escala,c.is_nullable PermiteNulo,c.collation_name Collation
  FROM sys.columns c
  WHERE c.object_id IN (OBJECT_ID(N'dbo.FOLIOSPROC'),OBJECT_ID(N'dbo.FOLIOSPROC1'))
  ORDER BY Tabla,Posicion;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

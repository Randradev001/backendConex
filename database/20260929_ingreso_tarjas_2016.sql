SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.FOLIOSPROC', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.FOLIOSPROC', N'TempCod') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.FOLIOSPROC)
    THROW 50070, 'FOLIOSPROC tiene datos en una estructura incompleta; se requiere homologacion manual.', 1;
  DROP TABLE dbo.FOLIOSPROC;
END;

IF OBJECT_ID(N'dbo.FOLIOSPROC', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.FOLIOSPROC (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    FPFolio char(10) NOT NULL,
    FPOrdProc decimal(10,0) NULL,
    ExpCod smallint NULL,
    FPEspe smallint NULL,
    FPEstado smallint NULL,
    FPFechaIng datetime NULL,
    FPIns decimal(10,0) NULL,
    FPDesOri decimal(10,0) NULL,
    FPDesOT decimal(10,0) NULL,
    FPDesUsda decimal(10,0) NULL,
    FPDisponible smallint NULL,
    TEtCod smallint NULL,
    TAlCod smallint NULL,
    TBPCod smallint NULL,
    FPOrigen smallint NULL,
    DestCod smallint NULL,
    FPNCaja decimal(10,0) NULL,
    FPServicio varchar(30) NULL,
    CONSTRAINT PK_FOLIOSPROC PRIMARY KEY (EmpCod,TempCod,FPFolio)
  );
END;

IF OBJECT_ID(N'dbo.FOLIOSPROC1', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.FOLIOSPROC1 (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    FPFolio char(10) NOT NULL,
    FP2NProc decimal(10,0) NOT NULL,
    FP2Cor smallint NOT NULL,
    FP2Fecha datetime NULL,
    ProdCod char(6) NULL,
    fp2especod smallint NULL,
    fp2varcod int NULL,
    EnvCod smallint NULL,
    Catcod smallint NULL,
    Calibre char(10) NULL,
    FP2Cajas smallint NULL,
    FP2Kilos money NULL,
    fp2expcod smallint NULL,
    Fp2MovRep smallint NULL,
    Fp2Estado smallint NULL,
    Fp2Tipo smallint NULL,
    Fp2Ins decimal(10,0) NULL,
    Fp2CajasO smallint NULL,
    FP2CajasRep smallint NULL,
    CuarCod int NULL,
    CONSTRAINT PK_FOLIOSPROC1 PRIMARY KEY (EmpCod,TempCod,FPFolio,FP2NProc,FP2Cor)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC1') AND name=N'IND_CORFOL')
  CREATE INDEX IND_CORFOL ON dbo.FOLIOSPROC1 (EmpCod,TempCod,FPFolio,FP2NProc,FP2Cor);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FOLIOSPROC1') AND name=N'IND_VERIFOLIO')
  CREATE INDEX IND_VERIFOLIO ON dbo.FOLIOSPROC1
    (EmpCod,TempCod,FPFolio,FP2Fecha,fp2especod,fp2varcod,ProdCod,EnvCod,Catcod,Calibre);

IF NOT EXISTS (SELECT 1 FROM dbo.MODULOS WHERE SistCod=100 AND Modcod=20)
  THROW 50071, 'No existe el modulo 100/20 Procesos S.A.G.', 1;

IF EXISTS (
  SELECT 1 FROM dbo.PROGRAM
  WHERE SistCod=100 AND Modcod=20 AND ProgCod=5
    AND LOWER(LTRIM(RTRIM(COALESCE(ProgNomGX,'')))) NOT IN (N'wingresotarjas',N'wfoliosprocesados')
)
  THROW 50072, 'El programa 100/20/5 ya esta ocupado por otra opcion.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=20 AND ProgCod=5)
  INSERT dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea,ProgIDmenu,ProgTarget)
  VALUES (100,20,5,'Folios Procesados','wfoliosprocesados',1,CAST(GETDATE() AS date),'sag_folios',NULL);
ELSE
  UPDATE dbo.PROGRAM
  SET ProgDes='Folios Procesados',ProgNomGX='wfoliosprocesados',ProgTipo=1,ProgIDmenu='sag_folios',ProgTarget=NULL
  WHERE SistCod=100 AND Modcod=20 AND ProgCod=5;

COMMIT TRANSACTION;

SELECT SistCod,Modcod,ProgCod,RTRIM(ProgDes) ProgDes,RTRIM(ProgNomGX) ProgNomGX
FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=20 AND ProgCod=5;

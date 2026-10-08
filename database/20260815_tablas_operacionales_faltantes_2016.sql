/*
  Tablas operacionales faltantes para una base CONEX ya creada.

  Usar este script si ya se ejecuto el instalador inicial y solo faltan las
  tablas operativas. No crea la base, no inserta seguridad y no migra datos.
  Es idempotente: si una tabla ya existe, la omite.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_ID(N'CONEX') IS NULL
BEGIN
  RAISERROR('No existe la base CONEX. Ejecute primero el instalador base.', 16, 1);
  RETURN;
END;
GO

USE CONEX;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.COMUNAS', N'U') IS NULL
  CREATE TABLE dbo.COMUNAS (
    ComCod smallint NOT NULL,
    Comdesc varchar(35) NOT NULL,
    CONSTRAINT PK_COMUNAS PRIMARY KEY (ComCod)
  );

IF OBJECT_ID(N'dbo.TEMP01', N'U') IS NULL
  CREATE TABLE dbo.TEMP01 (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    TempDes varchar(20) NOT NULL,
    TempFecAbre datetime NULL,
    TempLogA char(10) NULL,
    TempFecCierra datetime NULL,
    TempLogC char(10) NULL,
    TempActiva smallint NULL,
    CONSTRAINT PK_TEMP01 PRIMARY KEY (EmpCod, TempCod)
  );

IF OBJECT_ID(N'dbo.ESPECIES', N'U') IS NULL
  CREATE TABLE dbo.ESPECIES (
    EmpCod smallint NOT NULL,
    Especod smallint NOT NULL,
    EspeNom varchar(20) NOT NULL,
    EspeDiaV smallint NULL,
    EspeSag varchar(10) NULL,
    EspeNomC varchar(10) NULL,
    EspePLU varchar(10) NULL,
    EspeCMP smallint NULL,
    EspeNomExt varchar(40) NULL,
    EspeSECod varchar(10) NULL,
    CONSTRAINT PK_ESPECIES PRIMARY KEY (EmpCod, Especod)
  );

IF OBJECT_ID(N'dbo.ESPECIES1', N'U') IS NULL
  CREATE TABLE dbo.ESPECIES1 (
    EmpCod smallint NOT NULL,
    Especod smallint NOT NULL,
    VarCod int NOT NULL,
    VarNom varchar(20) NOT NULL,
    varnomC varchar(10) NULL,
    VarPLU varchar(10) NULL,
    VarSECod varchar(10) NULL,
    CONSTRAINT PK_ESPECIES1 PRIMARY KEY (EmpCod, Especod, VarCod)
  );

IF OBJECT_ID(N'dbo.CALIBRES', N'U') IS NULL
  CREATE TABLE dbo.CALIBRES (
    EmpCod smallint NOT NULL,
    Especod smallint NOT NULL,
    Calibre char(10) NOT NULL,
    CalCod smallint NULL,
    CalOrden smallint NOT NULL CONSTRAINT DF_CALIBRES_CalOrden DEFAULT (32767),
    calRecepcion bit NOT NULL CONSTRAINT DF_CALIBRES_calRecepcion DEFAULT (0),
    CONSTRAINT CK_CALIBRES_CalOrden CHECK (CalOrden BETWEEN 1 AND 32767),
    CONSTRAINT PK_CALIBRES PRIMARY KEY (EmpCod, Especod, Calibre)
  );

IF OBJECT_ID(N'dbo.ENVCAT', N'U') IS NULL
  CREATE TABLE dbo.ENVCAT (
    EmpCod smallint NOT NULL,
    EnvCod smallint NOT NULL,
    EnvNom varchar(20) NOT NULL,
    EnvPeso decimal(10,4) NULL,
    EnvPesoSag decimal(10,4) NULL,
    EnvDestare decimal(10,4) NULL,
    EnvPesoB decimal(10,4) NULL,
    EnvUso smallint NULL,
    EnvnomC varchar(10) NULL,
    EnvCMP smallint NULL,
    EnvNomExt varchar(40) NULL,
    EnvSECod varchar(10) NULL,
    CONSTRAINT PK_ENVCAT PRIMARY KEY (EmpCod, EnvCod)
  );

IF OBJECT_ID(N'dbo.ENVCAT1', N'U') IS NULL
  CREATE TABLE dbo.ENVCAT1 (
    EmpCod smallint NOT NULL,
    EnvCod smallint NOT NULL,
    Catcod smallint NOT NULL,
    CatNom varchar(20) NOT NULL,
    CatNomC varchar(10) NULL,
    CatnomExt varchar(40) NULL,
    CatSECod varchar(10) NULL,
    CONSTRAINT PK_ENVCAT1 PRIMARY KEY (EmpCod, EnvCod, Catcod)
  );

IF OBJECT_ID(N'dbo.PRODUCTORES', N'U') IS NULL
  CREATE TABLE dbo.PRODUCTORES (
    EmpCod smallint NOT NULL,
    ProdCod char(6) NOT NULL,
    ProdNom varchar(35) NOT NULL,
    ProdRut decimal(9,0) NULL,
    ProdDv char(1) NULL,
    ProdComuna smallint NULL,
    ProdProvincia varchar(30) NULL,
    ProdPack varchar(35) NULL,
    ProdPackCom smallint NULL,
    ProdPackProv varchar(30) NULL,
    ProdCodExt varchar(20) NULL,
    Prodnom2 varchar(35) NULL,
    ProdCodSAG varchar(20) NULL,
    ProdSECod varchar(10) NULL,
    CONSTRAINT PK_PRODUCTORES PRIMARY KEY (EmpCod, ProdCod)
  );

IF OBJECT_ID(N'dbo.PRODUCTORES1', N'U') IS NULL
  CREATE TABLE dbo.PRODUCTORES1 (
    EmpCod smallint NOT NULL,
    ProdCod char(6) NOT NULL,
    CuarCod int NOT NULL,
    CuarNom varchar(35) NOT NULL,
    CuarnomC varchar(10) NULL,
    CONSTRAINT PK_PRODUCTORES1 PRIMARY KEY (EmpCod, ProdCod, CuarCod)
  );

IF OBJECT_ID(N'dbo.CLIENTES', N'U') IS NULL
  CREATE TABLE dbo.CLIENTES (
    EmpCod smallint NOT NULL,
    CliCod int NOT NULL,
    Clirut decimal(9,0) NULL,
    CliDv char(1) NULL,
    CliNom varchar(40) NOT NULL,
    Clidirec varchar(40) NULL,
    CliGiro varchar(40) NULL,
    Cliciu varchar(30) NULL,
    CliCom varchar(30) NULL,
    CliFono varchar(30) NULL,
    CliRegion varchar(20) NULL,
    CONSTRAINT PK_CLIENTES PRIMARY KEY (EmpCod, CliCod)
  );

IF OBJECT_ID(N'dbo.EXPORT1', N'U') IS NULL
  CREATE TABLE dbo.EXPORT1 (
    EmpCod smallint NOT NULL,
    ExpCod int NOT NULL,
    ExpNom varchar(40) NOT NULL,
    ExpRut decimal(9,0) NOT NULL,
    ExpDv char(1) NOT NULL,
    EXPCodMP int NULL,
    EXPSECod varchar(10) NULL,
    CONSTRAINT PK_EXPORT1 PRIMARY KEY (EmpCod, ExpCod)
  );

IF OBJECT_ID(N'dbo.EXPPROD', N'U') IS NULL
  CREATE TABLE dbo.EXPPROD (
    EmpCod smallint NOT NULL,
    ExpCod int NOT NULL,
    ProdCod char(6) NOT NULL,
    CONSTRAINT PK_EXPPROD PRIMARY KEY (EmpCod, ExpCod, ProdCod)
  );

IF OBJECT_ID(N'dbo.CONSIG', N'U') IS NULL
  CREATE TABLE dbo.CONSIG (
    EmpCod smallint NOT NULL,
    ConsCod smallint NOT NULL,
    ConsRut decimal(9,0) NULL,
    ConsDV char(1) NULL,
    ConsNom varchar(30) NOT NULL,
    CONSTRAINT PK_CONSIG PRIMARY KEY (EmpCod, ConsCod)
  );

IF OBJECT_ID(N'dbo.AGENTES', N'U') IS NULL
  CREATE TABLE dbo.AGENTES (
    EmpCod smallint NOT NULL,
    AgeCod smallint NOT NULL,
    Agerut decimal(9,0) NOT NULL,
    AgeDv char(1) NOT NULL,
    AgeNom varchar(30) NOT NULL,
    AgecodMP int NULL,
    CONSTRAINT PK_AGENTES PRIMARY KEY (EmpCod, AgeCod)
  );

IF OBJECT_ID(N'dbo.CONDICION', N'U') IS NULL
  CREATE TABLE dbo.CONDICION (
    ConCod smallint NOT NULL,
    ConNom varchar(15) NULL,
    ConEst smallint NULL,
    ConNomC varchar(4) NULL,
    CONSTRAINT PK_CONDICION PRIMARY KEY (ConCod)
  );

IF OBJECT_ID(N'dbo.ORIGEN', N'U') IS NULL
  CREATE TABLE dbo.ORIGEN (
    EmpCod smallint NOT NULL,
    OriCod smallint NOT NULL,
    Orinom varchar(35) NULL,
    OriEst smallint NULL,
    CONSTRAINT PK_ORIGEN PRIMARY KEY (EmpCod, OriCod)
  );

IF OBJECT_ID(N'dbo.DESTINOS', N'U') IS NULL
  CREATE TABLE dbo.DESTINOS (
    DestCod smallint NOT NULL,
    DestNom varchar(20) NOT NULL,
    DestCMP int NULL,
    DestNMP varchar(30) NULL,
    CONSTRAINT PK_DESTINOS PRIMARY KEY (DestCod)
  );

IF OBJECT_ID(N'dbo.TIPDOC', N'U') IS NULL
  CREATE TABLE dbo.TIPDOC (
    TdCod smallint NOT NULL,
    TdNom varchar(20) NOT NULL,
    TdInter smallint NULL,
    TdBloq smallint NULL,
    CONSTRAINT PK_TIPDOC PRIMARY KEY (TdCod)
  );

IF OBJECT_ID(N'dbo.TIPMOV', N'U') IS NULL
  CREATE TABLE dbo.TIPMOV (
    EmpCod smallint NOT NULL,
    TMcod smallint NOT NULL,
    TMNom varchar(20) NULL,
    CONSTRAINT PK_TIPMOV PRIMARY KEY (EmpCod, TMcod)
  );

IF OBJECT_ID(N'dbo.TIPMOV1', N'U') IS NULL
  CREATE TABLE dbo.TIPMOV1 (
    EmpCod smallint NOT NULL,
    TMcod smallint NOT NULL,
    TMSCod smallint NOT NULL,
    TMSNom varchar(20) NULL,
    CONSTRAINT PK_TIPMOV1 PRIMARY KEY (EmpCod, TMcod, TMSCod)
  );

IF OBJECT_ID(N'dbo.PARAMGEN', N'U') IS NULL
  CREATE TABLE dbo.PARAMGEN (
    EmpCod smallint NOT NULL,
    PARCod int NOT NULL,
    PARDes varchar(30) NULL,
    PARValor1 decimal(13,3) NULL,
    PARValor2 decimal(13,3) NULL,
    PARValor3 decimal(13,3) NULL,
    CONSTRAINT PK_PARAMGEN PRIMARY KEY (EmpCod, PARCod)
  );

IF OBJECT_ID(N'dbo.PARAMGE1', N'U') IS NULL
  CREATE TABLE dbo.PARAMGE1 (
    EmpCod smallint NOT NULL,
    PARCod int NOT NULL,
    PAR1Cod smallint NOT NULL,
    PAR1Des varchar(30) NULL,
    PAR1Valor1 decimal(13,3) NULL,
    PAR1Valor2 decimal(13,3) NULL,
    PAR1Valor3 decimal(13,3) NULL,
    Par1Texto varchar(250) NULL,
    CONSTRAINT PK_PARAMGE1 PRIMARY KEY (EmpCod, PARCod, PAR1Cod)
  );

IF OBJECT_ID(N'dbo.MONEDAS', N'U') IS NULL
  CREATE TABLE dbo.MONEDAS (
    MonCod smallint NOT NULL,
    MonDes varchar(20) NOT NULL,
    MonLogC char(10) NULL,
    CONSTRAINT PK_MONEDAS PRIMARY KEY (MonCod)
  );

IF OBJECT_ID(N'dbo.VALMEXT', N'U') IS NULL
  CREATE TABLE dbo.VALMEXT (
    MonCod smallint NOT NULL,
    VMEFec date NOT NULL,
    VMEVal decimal(8,2) NOT NULL,
    CONSTRAINT PK_VALMEXT PRIMARY KEY (MonCod, VMEFec)
  );

IF OBJECT_ID(N'dbo.PUERTOS', N'U') IS NULL
  CREATE TABLE dbo.PUERTOS (
    PuCod smallint NOT NULL,
    PuNombre varchar(25) NOT NULL,
    PuNac smallint NULL,
    PuCodHomo smallint NULL,
    CONSTRAINT PK_PUERTOS PRIMARY KEY (PuCod)
  );

IF OBJECT_ID(N'dbo.CAUSAANUL', N'U') IS NULL
  CREATE TABLE dbo.CAUSAANUL (
    CAnCod smallint NOT NULL,
    CanNom varchar(20) NULL,
    CanPE smallint NULL,
    CanLoginC char(10) NULL,
    CanFecC date NULL,
    CONSTRAINT PK_CAUSAANUL PRIMARY KEY (CAnCod)
  );

IF OBJECT_ID(N'dbo.DESPAAUTO', N'U') IS NULL
  CREATE TABLE dbo.DESPAAUTO (
    EmpCod smallint NOT NULL,
    DACod smallint NOT NULL,
    DANombre varchar(30) NOT NULL,
    DAVig smallint NULL,
    CONSTRAINT PK_DESPAAUTO PRIMARY KEY (EmpCod, DACod)
  );

IF OBJECT_ID(N'dbo.PROCEDENCIA', N'U') IS NULL
  CREATE TABLE dbo.PROCEDENCIA (
    EmpCod smallint NOT NULL,
    ProcCod smallint NOT NULL,
    ProcNom varchar(35) NULL,
    ProcEst smallint NULL,
    CONSTRAINT PK_PROCEDENCIA PRIMARY KEY (EmpCod, ProcCod)
  );

IF OBJECT_ID(N'dbo.SECCIONES', N'U') IS NULL
  CREATE TABLE dbo.SECCIONES (
    EmpCod smallint NOT NULL,
    Seccod smallint NOT NULL,
    SecNom varchar(20) NOT NULL,
    CONSTRAINT PK_SECCIONES PRIMARY KEY (EmpCod, Seccod)
  );

IF OBJECT_ID(N'dbo.TIPETI', N'U') IS NULL
  CREATE TABLE dbo.TIPETI (
    EmpCod smallint NOT NULL,
    TEtCod int NOT NULL,
    TEtDesc varchar(20) NOT NULL,
    CONSTRAINT PK_TIPETI PRIMARY KEY (EmpCod, TEtCod)
  );

IF OBJECT_ID(N'dbo.TIPBPA', N'U') IS NULL
  CREATE TABLE dbo.TIPBPA (
    EmpCod smallint NOT NULL,
    TBPCod int NOT NULL,
    TBPDesc varchar(20) NOT NULL,
    TBPBase smallint NULL,
    TBPDiv smallint NULL,
    CONSTRAINT PK_TIPBPA PRIMARY KEY (EmpCod, TBPCod)
  );

IF OBJECT_ID(N'dbo.TIPALT', N'U') IS NULL
  CREATE TABLE dbo.TIPALT (
    EmpCod smallint NOT NULL,
    TAlCod int NOT NULL,
    TAlDesc varchar(20) NOT NULL,
    CONSTRAINT PK_TIPALT PRIMARY KEY (EmpCod, TAlCod)
  );

IF OBJECT_ID(N'dbo.GenCor', N'U') IS NULL
  CREATE TABLE dbo.GenCor (
    EmpCod smallint NOT NULL,
    GenCod varchar(8) NOT NULL,
    GenCor10 decimal(10,0) NOT NULL CONSTRAINT DF_GenCor_GenCor10 DEFAULT (0),
    GenCor5 decimal(5,0) NOT NULL CONSTRAINT DF_GenCor_GenCor5 DEFAULT (0),
    CONSTRAINT PK_GenCor PRIMARY KEY (EmpCod, GenCod)
  );

IF OBJECT_ID(N'dbo.MOVFRUT', N'U') IS NULL
  CREATE TABLE dbo.MOVFRUT (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    OriCod smallint NOT NULL,
    MovTDoc smallint NOT NULL,
    MovNGuia decimal(10,0) NOT NULL,
    MovProd char(6) NOT NULL,
    MovFecha datetime NOT NULL,
    MovObs char(250) NULL,
    TMcod smallint NULL,
    TMSCod smallint NULL,
    MovTotE int NULL,
    MovTotKilN money NULL,
    MovTotKilB money NULL,
    MovGrados smallmoney NULL,
    MovGBrik smallmoney NULL,
    MovLoginC char(10) NULL,
    MovFecC datetime NULL,
    MovLoginUPD char(10) NULL,
    MovFecUPD datetime NULL,
    Movauto smallint NULL,
    CONSTRAINT PK_MOVFRUT PRIMARY KEY (EmpCod, TempCod, OriCod, MovTDoc, MovNGuia, MovProd)
  );

IF OBJECT_ID(N'dbo.MOVFRUT1', N'U') IS NULL
  CREATE TABLE dbo.MOVFRUT1 (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    OriCod smallint NOT NULL,
    MovTDoc smallint NOT NULL,
    MovNGuia decimal(10,0) NOT NULL,
    MovProd char(6) NOT NULL,
    Mov1Nlote decimal(10,0) NOT NULL,
    Mov1Cuar int NULL,
    Mov1Espe smallint NULL,
    Mov1Var int NULL,
    Mov1TEnv smallint NULL,
    Mov1Condi smallint NULL,
    Mov1Destare smallmoney NULL,
    Mov1NumE int NULL,
    Mov1Peso smallmoney NULL,
    Mov1KilB money NULL,
    Mov1KilN money NULL,
    Mov1TM smallint NULL,
    Mov1STM smallint NULL,
    Mov1Fecha datetime NULL,
    Mov1AA smallint NULL,
    Mov1MM smallint NULL,
    Mov1EnvPROC int NULL,
    CONSTRAINT PK_MOVFRUT1 PRIMARY KEY (EmpCod, TempCod, OriCod, MovTDoc, MovNGuia, MovProd, Mov1Nlote)
  );

IF OBJECT_ID(N'dbo.MAdanos', N'U') IS NULL
  CREATE TABLE dbo.MAdanos (
    EmpCod smallint NOT NULL,
    Especod smallint NOT NULL,
    MADanCod smallint NOT NULL,
    MADanDes varchar(60) NOT NULL,
    MADanOrden smallint NOT NULL,
    MADanActivo bit NOT NULL CONSTRAINT DF_MAdanos_Activo DEFAULT (1),
    MADanLoginC char(10) NULL,
    MADanFecC datetime NOT NULL CONSTRAINT DF_MAdanos_FecC DEFAULT (GETDATE()),
    MADanLoginUPD char(10) NULL,
    MADanFecUPD datetime NULL,
    CONSTRAINT PK_MAdanos PRIMARY KEY (EmpCod, Especod, MADanCod),
    CONSTRAINT UQ_MAdanos_Orden UNIQUE (EmpCod, Especod, MADanOrden)
  );

IF OBJECT_ID(N'dbo.MAPlagas', N'U') IS NULL
  CREATE TABLE dbo.MAPlagas (
    EmpCod smallint NOT NULL,
    Especod smallint NOT NULL,
    MAPlaCod int NOT NULL,
    MAPlaTipo varchar(10) NOT NULL,
    MAPlaDes varchar(60) NOT NULL,
    MAPlaOrden int NOT NULL,
    MAPlaActivo int NOT NULL CONSTRAINT DF_MAPlagas_Activo DEFAULT (1),
    CONSTRAINT PK_MAPlagas PRIMARY KEY (EmpCod, Especod, MAPlaCod),
    CONSTRAINT UQ_MAPlagas_Descripcion UNIQUE (EmpCod, Especod, MAPlaTipo, MAPlaDes),
    CONSTRAINT CK_MAPlagas_Tipo CHECK (MAPlaTipo IN ('PLAGA','VIRUS','DIPTERO')),
    CONSTRAINT CK_MAPlagas_Activo CHECK (MAPlaActivo IN (0,1))
  );

IF OBJECT_ID(N'dbo.MAColores', N'U') IS NULL
  CREATE TABLE dbo.MAColores (
    EmpCod smallint NOT NULL,
    Especod smallint NOT NULL,
    MAColCod char(2) NOT NULL,
    MAColDes varchar(40) NOT NULL,
    MAColOrden smallint NOT NULL,
    MAColPremium int NOT NULL CONSTRAINT DF_MAColores_Premium DEFAULT (1),
    MAColActivo int NOT NULL CONSTRAINT DF_MAColores_Activo DEFAULT (1),
    CONSTRAINT PK_MAColores PRIMARY KEY (EmpCod, Especod, MAColCod),
    CONSTRAINT UQ_MAColores_Descripcion UNIQUE (EmpCod, Especod, MAColDes),
    CONSTRAINT CK_MAColores_Premium CHECK (MAColPremium IN (0,1)),
    CONSTRAINT CK_MAColores_Activo CHECK (MAColActivo IN (0,1))
  );

IF OBJECT_ID(N'dbo.CALRECEP', N'U') IS NULL
  CREATE TABLE dbo.CALRECEP (
    EmpCod smallint NOT NULL,
    CalRecId bigint IDENTITY(1,1) NOT NULL,
    TempCod char(9) NOT NULL,
    OriCod smallint NOT NULL,
    MovTDoc smallint NOT NULL,
    MovNGuia decimal(10,0) NOT NULL,
    MovProd char(6) NOT NULL,
    Mov1Nlote decimal(10,0) NOT NULL,
    Especod smallint NOT NULL,
    CalRecFecha date NOT NULL,
    CalRecHora time(0) NOT NULL,
    CalRecTempPulpa decimal(7,2) NULL,
    CalRecTamMuestra int NOT NULL,
    CalRecDuroFrutos int NULL,
    CalRecDuroAV decimal(10,3) NULL,
    CalRecDuroSTD decimal(10,3) NULL,
    CalRecPorExport decimal(7,2) NULL,
    CalRecPorComercial decimal(7,2) NULL,
    CalRecPorCalidad decimal(7,2) NULL,
    CalRecObservacion varchar(1000) NULL,
    CalRecEstado char(1) NOT NULL CONSTRAINT DF_CALRECEP_Estado DEFAULT ('D'),
    CalRecLoginC char(10) NOT NULL,
    CalRecFecC datetime NOT NULL CONSTRAINT DF_CALRECEP_FecC DEFAULT (GETDATE()),
    CalRecLoginUPD char(10) NULL,
    CalRecFecUPD datetime NULL,
    CONSTRAINT PK_CALRECEP PRIMARY KEY (EmpCod, CalRecId),
    CONSTRAINT CK_CALRECEP_Muestra CHECK (CalRecTamMuestra > 0),
    CONSTRAINT CK_CALRECEP_Estado CHECK (CalRecEstado IN ('D','F','A'))
  );

IF OBJECT_ID(N'dbo.CALRECEPDANO', N'U') IS NULL
  CREATE TABLE dbo.CALRECEPDANO (
    EmpCod smallint NOT NULL,
    CalRecId bigint NOT NULL,
    Especod smallint NOT NULL,
    MADanCod smallint NOT NULL,
    CalDanFrutos int NOT NULL,
    CONSTRAINT PK_CALRECEPDANO PRIMARY KEY (EmpCod, CalRecId, MADanCod),
    CONSTRAINT FK_CALRECEPDANO_Control FOREIGN KEY (EmpCod, CalRecId)
      REFERENCES dbo.CALRECEP (EmpCod, CalRecId) ON DELETE CASCADE
  );

IF OBJECT_ID(N'dbo.CALRECEPCALIBRE', N'U') IS NULL
  CREATE TABLE dbo.CALRECEPCALIBRE (
    EmpCod smallint NOT NULL,
    CalRecId bigint NOT NULL,
    Especod smallint NOT NULL,
    Calibre char(10) NOT NULL,
    CalPorcentaje decimal(7,2) NULL,
    CalPreCalibre decimal(7,2) NULL,
    CONSTRAINT PK_CALRECEPCALIBRE PRIMARY KEY (EmpCod, CalRecId, Calibre),
    CONSTRAINT FK_CALRECEPCALIBRE_Control FOREIGN KEY (EmpCod, CalRecId)
      REFERENCES dbo.CALRECEP (EmpCod, CalRecId) ON DELETE CASCADE
  );

IF OBJECT_ID(N'dbo.CALRECEPCOLOR', N'U') IS NULL
  CREATE TABLE dbo.CALRECEPCOLOR (
    EmpCod smallint NOT NULL,
    CalRecId bigint NOT NULL,
    Especod smallint NOT NULL,
    CalColor char(2) NOT NULL,
    CalRojoClaro decimal(7,2) NULL,
    CalRojoOscuro decimal(7,2) NULL,
    CONSTRAINT PK_CALRECEPCOLOR PRIMARY KEY (EmpCod, CalRecId, CalColor),
    CONSTRAINT FK_CALRECEPCOLOR_Control FOREIGN KEY (EmpCod, CalRecId)
      REFERENCES dbo.CALRECEP (EmpCod, CalRecId) ON DELETE CASCADE
  );

IF OBJECT_ID(N'dbo.CALRECEPCOLORCALIBRE', N'U') IS NULL
  CREATE TABLE dbo.CALRECEPCOLORCALIBRE (
    EmpCod smallint NOT NULL,
    CalRecId bigint NOT NULL,
    Especod smallint NOT NULL,
    Calibre char(10) NOT NULL,
    CalRojoClaro decimal(7,2) NULL,
    CalRojoOscuro decimal(7,2) NULL,
    CONSTRAINT PK_CALRECEPCOLORCALIBRE PRIMARY KEY (EmpCod, CalRecId, Calibre),
    CONSTRAINT FK_CALRECEPCOLORCALIBRE_Control FOREIGN KEY (EmpCod, CalRecId)
      REFERENCES dbo.CALRECEP (EmpCod, CalRecId) ON DELETE CASCADE
  );

IF OBJECT_ID(N'dbo.CALRECEPPLAGA', N'U') IS NULL
  CREATE TABLE dbo.CALRECEPPLAGA (
    EmpCod smallint NOT NULL,
    CalRecId bigint NOT NULL,
    Especod smallint NOT NULL,
    MAPlaCod int NOT NULL,
    CONSTRAINT PK_CALRECEPPLAGA PRIMARY KEY (EmpCod, CalRecId, MAPlaCod),
    CONSTRAINT FK_CALRECEPPLAGA_Control FOREIGN KEY (EmpCod, CalRecId)
      REFERENCES dbo.CALRECEP (EmpCod, CalRecId) ON DELETE CASCADE
  );

IF OBJECT_ID(N'dbo.CALRECEPFOTO', N'U') IS NULL
  CREATE TABLE dbo.CALRECEPFOTO (
    EmpCod smallint NOT NULL,
    CalRecId bigint NOT NULL,
    CalFotoId bigint IDENTITY(1,1) NOT NULL,
    CalFotoNombre varchar(255) NOT NULL,
    CalFotoMime varchar(50) NOT NULL,
    CalFotoTamano int NOT NULL,
    CalFotoContenido varbinary(max) NOT NULL,
    CalFotoOrden smallint NOT NULL,
    CalFotoLoginC char(10) NOT NULL,
    CalFotoFecC datetime NOT NULL CONSTRAINT DF_CALRECEPFOTO_FecC DEFAULT (GETDATE()),
    CONSTRAINT PK_CALRECEPFOTO PRIMARY KEY (EmpCod, CalRecId, CalFotoId),
    CONSTRAINT FK_CALRECEPFOTO_Control FOREIGN KEY (EmpCod, CalRecId)
      REFERENCES dbo.CALRECEP (EmpCod, CalRecId) ON DELETE CASCADE
  );

IF OBJECT_ID(N'dbo.CAP001', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAP001
  (
    EmpCod smallint NULL,
    TempCod char(9) NULL,
    CAPCOD decimal(10,0) NULL,
    CAPNproc decimal(10,0) NULL,
    CAPFecLog datetime NULL,
    CliCod int NULL,
    ExpCod int NULL
  );
  CREATE INDEX IND_CAPORDPROC ON dbo.CAP001 (EmpCod, TempCod, CAPNproc);
END;
IF OBJECT_ID(N'dbo.DESCLI_FP', N'U') IS NULL CREATE TABLE dbo.DESCLI_FP (EmpCod smallint NULL, CliCod int NULL);
IF OBJECT_ID(N'dbo.DESPCAJS', N'U') IS NULL CREATE TABLE dbo.DESPCAJS (EmpCod smallint NULL, CliCod int NULL, TdCod smallint NULL);
IF OBJECT_ID(N'dbo.FACTURA', N'U') IS NULL CREATE TABLE dbo.FACTURA (EmpCod smallint NULL, CliCod int NULL);
IF OBJECT_ID(N'dbo.GUIASD', N'U') IS NULL CREATE TABLE dbo.GUIASD (EmpCod smallint NULL, CliCod int NULL);
IF OBJECT_ID(N'dbo.GUIASD_Back', N'U') IS NULL CREATE TABLE dbo.GUIASD_Back (EmpCod smallint NULL, CliCod int NULL);
IF OBJECT_ID(N'dbo.LISTPRECIOS', N'U') IS NULL CREATE TABLE dbo.LISTPRECIOS (EmpCod smallint NULL, CliCod int NULL, MonCod smallint NULL);
IF OBJECT_ID(N'dbo.PACKLIST', N'U') IS NULL CREATE TABLE dbo.PACKLIST (EmpCod smallint NULL, CliCod int NULL, ExpCod int NULL, ConsCod smallint NULL, AgeCod smallint NULL, DestCod smallint NULL, DACod smallint NULL);
IF OBJECT_ID(N'dbo.DESORIGEN', N'U') IS NULL CREATE TABLE dbo.DESORIGEN (EmpCod smallint NULL, ExpCod int NULL, ConsCod smallint NULL, AgeCod smallint NULL, DestCod smallint NULL, DACod smallint NULL);
IF OBJECT_ID(N'dbo.CNTFOLIOS', N'U') IS NULL CREATE TABLE dbo.CNTFOLIOS (EmpCod smallint NULL, ExpCod int NULL);
IF OBJECT_ID(N'dbo.FOLIOSPROC', N'U') IS NULL CREATE TABLE dbo.FOLIOSPROC (EmpCod smallint NOT NULL, TempCod char(9) NOT NULL, FPFolio char(10) NOT NULL, FPOrdProc decimal(10,0) NULL, ExpCod smallint NULL, FPEspe smallint NULL, FPEstado smallint NULL, FPFechaIng datetime NULL, FPIns decimal(10,0) NULL, FPDesOri decimal(10,0) NULL, FPDesOT decimal(10,0) NULL, FPDesUsda decimal(10,0) NULL, FPDisponible smallint NULL, TEtCod smallint NULL, TAlCod smallint NULL, TBPCod smallint NULL, FPOrigen smallint NULL, DestCod smallint NULL, FPNCaja decimal(10,0) NULL, FPServicio varchar(30) NULL, CONSTRAINT PK_FOLIOSPROC PRIMARY KEY (EmpCod,TempCod,FPFolio));
IF OBJECT_ID(N'dbo.FOLIOSPROC1', N'U') IS NULL CREATE TABLE dbo.FOLIOSPROC1 (EmpCod smallint NOT NULL, TempCod char(9) NOT NULL, FPFolio char(10) NOT NULL, FP2NProc decimal(10,0) NOT NULL, FP2Cor smallint NOT NULL, FP2Fecha datetime NULL, ProdCod char(6) NULL, fp2especod smallint NULL, fp2varcod int NULL, EnvCod smallint NULL, Catcod smallint NULL, Calibre char(10) NULL, FP2Cajas smallint NULL, FP2Kilos money NULL, fp2expcod smallint NULL, Fp2MovRep smallint NULL, Fp2Estado smallint NULL, Fp2Tipo smallint NULL, Fp2Ins decimal(10,0) NULL, Fp2CajasO smallint NULL, FP2CajasRep smallint NULL, CuarCod int NULL, CONSTRAINT PK_FOLIOSPROC1 PRIMARY KEY (EmpCod,TempCod,FPFolio,FP2NProc,FP2Cor));
IF OBJECT_ID(N'dbo.ORDPROC', N'U') IS NULL CREATE TABLE dbo.ORDPROC (EmpCod smallint NULL, ExpCod int NULL);
IF OBJECT_ID(N'dbo.PALETIZA01', N'U') IS NULL CREATE TABLE dbo.PALETIZA01 (EmpCod smallint NULL, ExpCod int NULL);
IF OBJECT_ID(N'dbo.ANUINS', N'U') IS NULL CREATE TABLE dbo.ANUINS (CAnCod smallint NULL);
IF OBJECT_ID(N'dbo.FCOMERCIAL', N'U') IS NULL CREATE TABLE dbo.FCOMERCIAL (EmpCod smallint NULL, TMcod smallint NULL, TMSCod smallint NULL);
IF OBJECT_ID(N'dbo.ORDPROC1', N'U') IS NULL CREATE TABLE dbo.ORDPROC1 (EmpCod smallint NOT NULL, TempCod char(9) NOT NULL, Ordp1Nlote decimal(10,0) NOT NULL);
IF OBJECT_ID(N'dbo.PROCUSDA1', N'U') IS NULL CREATE TABLE dbo.PROCUSDA1 (EmpCod smallint NULL, TEtCod int NULL, TBPCod int NULL, TAlCod int NULL);
IF OBJECT_ID(N'dbo.FOLDIAGRAMA1', N'U') IS NULL CREATE TABLE dbo.FOLDIAGRAMA1 (EmpCod smallint NULL, TBPCod int NULL);
IF OBJECT_ID(N'dbo.REPALETIZAJE', N'U') IS NULL CREATE TABLE dbo.REPALETIZAJE (EmpCod smallint NULL, DACod smallint NULL);

IF OBJECT_ID(N'dbo.MOVFRUT', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.MOVFRUT') AND name = N'IX_MOVFRUT_Fecha')
  CREATE INDEX IX_MOVFRUT_Fecha ON dbo.MOVFRUT (EmpCod, TempCod, TMcod, TMSCod, MovFecha);

IF OBJECT_ID(N'dbo.MOVFRUT1', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.MOVFRUT1') AND name = N'IX_MOVFRUT1_Lote')
  CREATE INDEX IX_MOVFRUT1_Lote ON dbo.MOVFRUT1 (EmpCod, TempCod, Mov1Nlote);

IF OBJECT_ID(N'dbo.CALIBRES', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.CALIBRES') AND name = N'IX_CALIBRES_OrdenMuestra')
  CREATE INDEX IX_CALIBRES_OrdenMuestra ON dbo.CALIBRES (EmpCod, Especod, CalOrden, CalCod) INCLUDE (Calibre, calRecepcion);

IF OBJECT_ID(N'dbo.CALRECEP', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.CALRECEP') AND name = N'IX_CALRECEP_Lote')
  CREATE INDEX IX_CALRECEP_Lote ON dbo.CALRECEP (EmpCod, TempCod, OriCod, MovTDoc, MovNGuia, MovProd, Mov1Nlote, CalRecFecha DESC);

IF OBJECT_ID(N'dbo.CALRECEPFOTO', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.CALRECEPFOTO') AND name = N'IX_CALRECEPFOTO_Control')
  CREATE INDEX IX_CALRECEPFOTO_Control ON dbo.CALRECEPFOTO (EmpCod, CalRecId, CalFotoOrden, CalFotoId);

COMMIT TRANSACTION;

SELECT
  DB_NAME() AS BaseDatos,
  COUNT(*) AS TablasUsuario
FROM sys.tables
WHERE is_ms_shipped = 0;

PRINT 'Script de tablas operacionales faltantes finalizado.';

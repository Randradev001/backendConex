/*
  Instalador CONEX vacio para SQL Server 2016.

  Objetivo:
  - Crear la base CONEX sin usar BACKUP/RESTORE.
  - Dejar compatibility level 130.
  - Crear la estructura de Seguridad usada por el backend actual.
  - Crear las tablas operacionales vacias usadas por la migracion actual.
  - Insertar empresa, usuario administrador, rol ADMINFULL, menu y permisos.

  Alcance:
  Es una base vacia: no migra datos historicos GX8 ni genera/restaura backups.
  Las tablas operacionales incluidas cubren los maestros, recepciones y control
  de calidad implementados actualmente en el backend.
*/

USE master;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SqlMajorVersion int;
SET @SqlMajorVersion = CONVERT(int, PARSENAME(CONVERT(varchar(128), SERVERPROPERTY(N'ProductVersion')), 4));

IF @SqlMajorVersion < 13
BEGIN
  RAISERROR('Este instalador requiere SQL Server 2016 o superior.', 16, 1);
  RETURN;
END;

IF DB_ID(N'CONEX') IS NOT NULL
BEGIN
  RAISERROR('La base CONEX ya existe. Revise antes de ejecutar el instalador.', 16, 1);
  RETURN;
END;

CREATE DATABASE CONEX;
GO

ALTER DATABASE CONEX SET COMPATIBILITY_LEVEL = 130;
GO

USE CONEX;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

CREATE TABLE dbo.DEFEMP (
  EmpCod smallint NOT NULL,
  EmpNom varchar(50) NOT NULL,
  EmpGiro varchar(35) NOT NULL CONSTRAINT DF_DEFEMP_EmpGiro DEFAULT (' '),
  Empdir varchar(30) NOT NULL CONSTRAINT DF_DEFEMP_Empdir DEFAULT (' '),
  EmpRut decimal(9,0) NULL,
  EmpDV char(1) NULL,
  EmpSw smallint NULL,
  empreg varchar(20) NULL,
  Empcom varchar(30) NULL,
  CONSTRAINT PK_DEFEMP PRIMARY KEY (EmpCod)
);

CREATE TABLE dbo.USUARIOS (
  UsuLogin char(10) NOT NULL,
  Usunom varchar(35) NOT NULL,
  UsuClave varchar(8) NULL,
  UsuRut decimal(9,0) NULL,
  UsuDV char(1) NULL,
  UsuCorreo varchar(30) NULL,
  UsuCargo varchar(30) NULL,
  UsuNseg decimal(3,0) NULL,
  UsuExpira datetime2(0) NULL,
  usucrea char(10) NULL,
  CONSTRAINT PK_USUARIOS PRIMARY KEY (UsuLogin)
);

CREATE TABLE dbo.SISTEMAS (
  SistCod smallint NOT NULL,
  SistNombre varchar(40) NOT NULL,
  SistFecCrea date NULL,
  SistFAIcons varchar(30) NULL,
  CONSTRAINT PK_SISTEMAS PRIMARY KEY (SistCod)
);

CREATE TABLE dbo.MODULOS (
  SistCod smallint NOT NULL,
  Modcod smallint NOT NULL,
  ModTipo smallint NULL,
  Modprg varchar(15) NULL,
  ModDes varchar(30) NOT NULL,
  ModFcrea date NULL,
  ModFAIcons varchar(30) NULL,
  CONSTRAINT PK_MODULOS PRIMARY KEY (SistCod, Modcod),
  CONSTRAINT FK_MODULOS_SISTEMAS FOREIGN KEY (SistCod)
    REFERENCES dbo.SISTEMAS (SistCod)
);

CREATE TABLE dbo.PROGRAM (
  SistCod smallint NOT NULL,
  Modcod smallint NOT NULL,
  ProgCod smallint NOT NULL,
  ProgDes varchar(35) NOT NULL,
  ProgNomGX varchar(20) NULL,
  ProgTipo smallint NULL,
  ProgFcrea date NULL,
  ProgIDmenu varchar(20) NULL,
  ProgTarget varchar(120) NULL,
  CONSTRAINT PK_PROGRAM PRIMARY KEY (SistCod, Modcod, ProgCod),
  CONSTRAINT FK_PROGRAM_MODULOS FOREIGN KEY (SistCod, Modcod)
    REFERENCES dbo.MODULOS (SistCod, Modcod)
);

CREATE TABLE dbo.PROGRAM1 (
  SistCod smallint NOT NULL,
  Modcod smallint NOT NULL,
  ProgCod smallint NOT NULL,
  ProgOPCod smallint NOT NULL,
  ProgOPDes varchar(35) NOT NULL,
  CONSTRAINT PK_PROGRAM1 PRIMARY KEY (SistCod, Modcod, ProgCod, ProgOPCod),
  CONSTRAINT FK_PROGRAM1_PROGRAM FOREIGN KEY (SistCod, Modcod, ProgCod)
    REFERENCES dbo.PROGRAM (SistCod, Modcod, ProgCod)
);

CREATE TABLE dbo.NIVSEG (
  NSegMod smallint NOT NULL,
  NSegDMod varchar(30) NULL,
  NSegProg smallint NOT NULL,
  NsegDes varchar(35) NULL,
  NsegIns smallint NULL,
  NsegUPD smallint NULL,
  NsegDel smallint NULL,
  NsegPRC smallint NULL,
  NsegLogA char(10) NULL,
  CONSTRAINT PK_NIVSEG PRIMARY KEY (NSegMod, NSegProg)
);

CREATE TABLE dbo.ASIGSIST (
  GECODEMP smallint NOT NULL,
  AsgSisLogin char(10) NOT NULL,
  SistCod smallint NOT NULL,
  CONSTRAINT PK_ASIGSIST PRIMARY KEY (GECODEMP, AsgSisLogin, SistCod)
);

CREATE TABLE dbo.ASIG (
  GECODEMP smallint NOT NULL,
  AsigUsu char(10) NOT NULL,
  SistCod smallint NOT NULL,
  AsigMod smallint NOT NULL,
  AsigDes varchar(30) NULL,
  AsigAsig char(10) NULL,
  CONSTRAINT PK_ASIG PRIMARY KEY (GECODEMP, AsigUsu, SistCod, AsigMod)
);

CREATE TABLE dbo.ASIGPROG (
  GECODEMP smallint NOT NULL,
  UsuLogin char(10) NOT NULL,
  SistCod smallint NOT NULL,
  Modcod smallint NOT NULL,
  ProgCod smallint NOT NULL,
  ProgUsuC char(10) NULL,
  CONSTRAINT PK_ASIGPROG PRIMARY KEY (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod)
);

CREATE TABLE dbo.ASIGPROG1 (
  GECODEMP smallint NOT NULL,
  UsuLogin char(10) NOT NULL,
  SistCod smallint NOT NULL,
  Modcod smallint NOT NULL,
  ProgCod smallint NOT NULL,
  ProgOPCod smallint NOT NULL,
  CONSTRAINT PK_ASIGPROG1 PRIMARY KEY (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgOPCod)
);

CREATE TABLE dbo.UROLES (
  ROLCod char(10) NOT NULL,
  ROLNombre varchar(30) NOT NULL,
  ROLFCrea datetime2(0) NOT NULL CONSTRAINT DF_UROLES_ROLFCrea DEFAULT (SYSUTCDATETIME()),
  ROLUCrea char(10) NULL,
  CONSTRAINT PK_UROLES PRIMARY KEY (ROLCod)
);

CREATE TABLE dbo.SEGUSUEMP (
  GECODEMP smallint NOT NULL,
  UsuLogin char(10) NOT NULL,
  UsuEstado smallint NOT NULL CONSTRAINT DF_SEGUSUEMP_Estado DEFAULT (1),
  UsuPerfil char(10) NULL,
  UsuTipo smallint NOT NULL CONSTRAINT DF_SEGUSUEMP_Tipo DEFAULT (0),
  EsPrincipal bit NOT NULL CONSTRAINT DF_SEGUSUEMP_Principal DEFAULT (0),
  FechaCrea datetime2(0) NOT NULL CONSTRAINT DF_SEGUSUEMP_Fecha DEFAULT (SYSUTCDATETIME()),
  UsuCrea char(10) NULL,
  CONSTRAINT PK_SEGUSUEMP PRIMARY KEY (GECODEMP, UsuLogin),
  CONSTRAINT FK_SEGUSUEMP_DEFEMP FOREIGN KEY (GECODEMP)
    REFERENCES dbo.DEFEMP (EmpCod),
  CONSTRAINT FK_SEGUSUEMP_USUARIOS FOREIGN KEY (UsuLogin)
    REFERENCES dbo.USUARIOS (UsuLogin)
);

CREATE TABLE dbo.URolesPorUser (
  GECODEMP smallint NOT NULL,
  UsuLogin char(10) NOT NULL,
  ROLCod char(10) NOT NULL,
  RXUFecCrea datetime2(0) NOT NULL CONSTRAINT DF_URolesPorUser_Fecha DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT PK_URolesPorUser PRIMARY KEY (GECODEMP, UsuLogin, ROLCod),
  CONSTRAINT FK_URolesPorUser_SEGUSUEMP FOREIGN KEY (GECODEMP, UsuLogin)
    REFERENCES dbo.SEGUSUEMP (GECODEMP, UsuLogin),
  CONSTRAINT FK_URolesPorUser_UROLES FOREIGN KEY (ROLCod)
    REFERENCES dbo.UROLES (ROLCod)
);

CREATE TABLE dbo.SEGUSUCRED (
  UsuLogin char(10) NOT NULL,
  PasswordSalt varchar(64) NOT NULL,
  PasswordHash varchar(256) NOT NULL,
  MigradoDesdeGX bit NOT NULL CONSTRAINT DF_SEGUSUCRED_Migrado DEFAULT (0),
  FechaCambio datetime2(0) NOT NULL CONSTRAINT DF_SEGUSUCRED_Fecha DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT PK_SEGUSUCRED PRIMARY KEY (UsuLogin),
  CONSTRAINT FK_SEGUSUCRED_USUARIOS FOREIGN KEY (UsuLogin)
    REFERENCES dbo.USUARIOS (UsuLogin)
);

CREATE TABLE dbo.SEGSESION (
  TokenHash varchar(64) NOT NULL,
  UsuLogin char(10) NOT NULL,
  EmpCod smallint NOT NULL,
  FechaCreacion datetime2(0) NOT NULL,
  FechaExpiracion datetime2(0) NOT NULL,
  UltimoUso datetime2(0) NOT NULL,
  Revocada bit NOT NULL CONSTRAINT DF_SEGSESION_Revocada DEFAULT (0),
  CONSTRAINT PK_SEGSESION PRIMARY KEY (TokenHash),
  CONSTRAINT FK_SEGSESION_SEGUSUEMP FOREIGN KEY (EmpCod, UsuLogin)
    REFERENCES dbo.SEGUSUEMP (GECODEMP, UsuLogin)
);

CREATE INDEX IX_SEGSESION_Usuario
  ON dbo.SEGSESION (UsuLogin, Revocada, FechaExpiracion);

CREATE INDEX IX_USUARIOS_UsuRut
  ON dbo.USUARIOS (UsuRut);

/* =========================
   TABLAS OPERACIONALES VACIAS
   ========================= */

CREATE TABLE dbo.COMUNAS (
  ComCod smallint NOT NULL,
  Comdesc varchar(35) NOT NULL,
  CONSTRAINT PK_COMUNAS PRIMARY KEY (ComCod)
);

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

CREATE INDEX IX_CALIBRES_OrdenMuestra
  ON dbo.CALIBRES (EmpCod, Especod, CalOrden, CalCod)
  INCLUDE (Calibre, calRecepcion);

CREATE TABLE dbo.ENVCAT (
  EmpCod smallint NOT NULL,
  EnvCod smallint NOT NULL,
  EnvNom varchar(20) NOT NULL,
  EnvPeso decimal(10,4) NULL,
  EnvDestare decimal(10,4) NULL,
  EnvPesoB decimal(10,4) NULL,
  EnvUso smallint NULL,
  EnvnomC varchar(10) NULL,
  EnvCMP smallint NULL,
  EnvNomExt varchar(40) NULL,
  EnvSECod varchar(10) NULL,
  CONSTRAINT PK_ENVCAT PRIMARY KEY (EmpCod, EnvCod)
);

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

CREATE TABLE dbo.PRODUCTORES1 (
  EmpCod smallint NOT NULL,
  ProdCod char(6) NOT NULL,
  CuarCod int NOT NULL,
  CuarNom varchar(35) NOT NULL,
  CuarnomC varchar(10) NULL,
  CONSTRAINT PK_PRODUCTORES1 PRIMARY KEY (EmpCod, ProdCod, CuarCod)
);

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

CREATE TABLE dbo.EXPPROD (
  EmpCod smallint NOT NULL,
  ExpCod int NOT NULL,
  ProdCod char(6) NOT NULL,
  CONSTRAINT PK_EXPPROD PRIMARY KEY (EmpCod, ExpCod, ProdCod)
);

CREATE TABLE dbo.CONSIG (
  EmpCod smallint NOT NULL,
  ConsCod smallint NOT NULL,
  ConsRut decimal(9,0) NULL,
  ConsDV char(1) NULL,
  ConsNom varchar(30) NOT NULL,
  CONSTRAINT PK_CONSIG PRIMARY KEY (EmpCod, ConsCod)
);

CREATE TABLE dbo.AGENTES (
  EmpCod smallint NOT NULL,
  AgeCod smallint NOT NULL,
  Agerut decimal(9,0) NOT NULL,
  AgeDv char(1) NOT NULL,
  AgeNom varchar(30) NOT NULL,
  AgecodMP int NULL,
  CONSTRAINT PK_AGENTES PRIMARY KEY (EmpCod, AgeCod)
);

CREATE TABLE dbo.CONDICION (
  ConCod smallint NOT NULL,
  ConNom varchar(15) NULL,
  ConEst smallint NULL,
  ConNomC varchar(4) NULL,
  CONSTRAINT PK_CONDICION PRIMARY KEY (ConCod)
);

CREATE TABLE dbo.ORIGEN (
  EmpCod smallint NOT NULL,
  OriCod smallint NOT NULL,
  Orinom varchar(35) NULL,
  OriEst smallint NULL,
  CONSTRAINT PK_ORIGEN PRIMARY KEY (EmpCod, OriCod)
);

CREATE TABLE dbo.DESTINOS (
  DestCod smallint NOT NULL,
  DestNom varchar(20) NOT NULL,
  DestCMP int NULL,
  DestNMP varchar(30) NULL,
  CONSTRAINT PK_DESTINOS PRIMARY KEY (DestCod)
);

CREATE TABLE dbo.TIPDOC (
  TdCod smallint NOT NULL,
  TdNom varchar(20) NOT NULL,
  TdInter smallint NULL,
  TdBloq smallint NULL,
  CONSTRAINT PK_TIPDOC PRIMARY KEY (TdCod)
);

CREATE TABLE dbo.TIPMOV (
  EmpCod smallint NOT NULL,
  TMcod smallint NOT NULL,
  TMNom varchar(20) NULL,
  CONSTRAINT PK_TIPMOV PRIMARY KEY (EmpCod, TMcod)
);

CREATE TABLE dbo.TIPMOV1 (
  EmpCod smallint NOT NULL,
  TMcod smallint NOT NULL,
  TMSCod smallint NOT NULL,
  TMSNom varchar(20) NULL,
  CONSTRAINT PK_TIPMOV1 PRIMARY KEY (EmpCod, TMcod, TMSCod)
);

CREATE TABLE dbo.PARAMGEN (
  EmpCod smallint NOT NULL,
  PARCod int NOT NULL,
  PARDes varchar(30) NULL,
  PARValor1 decimal(13,3) NULL,
  PARValor2 decimal(13,3) NULL,
  PARValor3 decimal(13,3) NULL,
  CONSTRAINT PK_PARAMGEN PRIMARY KEY (EmpCod, PARCod)
);

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

CREATE TABLE dbo.MONEDAS (
  MonCod smallint NOT NULL,
  MonDes varchar(20) NOT NULL,
  MonLogC char(10) NULL,
  CONSTRAINT PK_MONEDAS PRIMARY KEY (MonCod)
);

CREATE TABLE dbo.VALMEXT (
  MonCod smallint NOT NULL,
  VMEFec date NOT NULL,
  VMEVal decimal(8,2) NOT NULL,
  CONSTRAINT PK_VALMEXT PRIMARY KEY (MonCod, VMEFec)
);

CREATE TABLE dbo.PUERTOS (
  PuCod smallint NOT NULL,
  PuNombre varchar(25) NOT NULL,
  PuNac smallint NULL,
  PuCodHomo smallint NULL,
  CONSTRAINT PK_PUERTOS PRIMARY KEY (PuCod)
);

CREATE TABLE dbo.CAUSAANUL (
  CAnCod smallint NOT NULL,
  CanNom varchar(20) NULL,
  CanPE smallint NULL,
  CanLoginC char(10) NULL,
  CanFecC date NULL,
  CONSTRAINT PK_CAUSAANUL PRIMARY KEY (CAnCod)
);

CREATE TABLE dbo.DESPAAUTO (
  EmpCod smallint NOT NULL,
  DACod smallint NOT NULL,
  DANombre varchar(30) NOT NULL,
  DAVig smallint NULL,
  CONSTRAINT PK_DESPAAUTO PRIMARY KEY (EmpCod, DACod)
);

CREATE TABLE dbo.PROCEDENCIA (
  EmpCod smallint NOT NULL,
  ProcCod smallint NOT NULL,
  ProcNom varchar(35) NULL,
  ProcEst smallint NULL,
  CONSTRAINT PK_PROCEDENCIA PRIMARY KEY (EmpCod, ProcCod)
);

CREATE TABLE dbo.SECCIONES (
  EmpCod smallint NOT NULL,
  Seccod smallint NOT NULL,
  SecNom varchar(20) NOT NULL,
  CONSTRAINT PK_SECCIONES PRIMARY KEY (EmpCod, Seccod)
);

CREATE TABLE dbo.TIPETI (
  EmpCod smallint NOT NULL,
  TEtCod int NOT NULL,
  TEtDesc varchar(20) NOT NULL,
  CONSTRAINT PK_TIPETI PRIMARY KEY (EmpCod, TEtCod)
);

CREATE TABLE dbo.TIPBPA (
  EmpCod smallint NOT NULL,
  TBPCod int NOT NULL,
  TBPDesc varchar(20) NOT NULL,
  TBPBase smallint NULL,
  TBPDiv smallint NULL,
  CONSTRAINT PK_TIPBPA PRIMARY KEY (EmpCod, TBPCod)
);

CREATE TABLE dbo.TIPALT (
  EmpCod smallint NOT NULL,
  TAlCod int NOT NULL,
  TAlDesc varchar(20) NOT NULL,
  CONSTRAINT PK_TIPALT PRIMARY KEY (EmpCod, TAlCod)
);

CREATE TABLE dbo.GenCor (
  EmpCod smallint NOT NULL,
  GenCod varchar(8) NOT NULL,
  GenCor10 decimal(10,0) NOT NULL CONSTRAINT DF_GenCor_GenCor10 DEFAULT (0),
  GenCor5 decimal(5,0) NOT NULL CONSTRAINT DF_GenCor_GenCor5 DEFAULT (0),
  CONSTRAINT PK_GenCor PRIMARY KEY (EmpCod, GenCod)
);

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

CREATE INDEX IX_MOVFRUT_Fecha
  ON dbo.MOVFRUT (EmpCod, TempCod, TMcod, TMSCod, MovFecha);

CREATE INDEX IX_MOVFRUT1_Lote
  ON dbo.MOVFRUT1 (EmpCod, TempCod, Mov1Nlote);

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

CREATE INDEX IX_CALRECEP_Lote
  ON dbo.CALRECEP (EmpCod, TempCod, OriCod, MovTDoc, MovNGuia, MovProd, Mov1Nlote, CalRecFecha DESC);

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

CREATE TABLE dbo.CALRECEPPLAGA (
  EmpCod smallint NOT NULL,
  CalRecId bigint NOT NULL,
  Especod smallint NOT NULL,
  MAPlaCod int NOT NULL,
  CONSTRAINT PK_CALRECEPPLAGA PRIMARY KEY (EmpCod, CalRecId, MAPlaCod),
  CONSTRAINT FK_CALRECEPPLAGA_Control FOREIGN KEY (EmpCod, CalRecId)
    REFERENCES dbo.CALRECEP (EmpCod, CalRecId) ON DELETE CASCADE
);

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

CREATE INDEX IX_CALRECEPFOTO_Control
  ON dbo.CALRECEPFOTO (EmpCod, CalRecId, CalFotoOrden, CalFotoId);

/* Tablas vacias usadas por validaciones de dependencias GX8. */
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
CREATE TABLE dbo.DESCLI_FP (EmpCod smallint NULL, CliCod int NULL);
CREATE TABLE dbo.DESPCAJS (EmpCod smallint NULL, CliCod int NULL, TdCod smallint NULL);
CREATE TABLE dbo.FACTURA (EmpCod smallint NULL, CliCod int NULL);
CREATE TABLE dbo.GUIASD (EmpCod smallint NULL, CliCod int NULL);
CREATE TABLE dbo.GUIASD_Back (EmpCod smallint NULL, CliCod int NULL);
CREATE TABLE dbo.LISTPRECIOS (EmpCod smallint NULL, CliCod int NULL, MonCod smallint NULL);
CREATE TABLE dbo.PACKLIST (EmpCod smallint NULL, CliCod int NULL, ExpCod int NULL, ConsCod smallint NULL, AgeCod smallint NULL, DestCod smallint NULL, DACod smallint NULL);
CREATE TABLE dbo.DESORIGEN (EmpCod smallint NULL, ExpCod int NULL, ConsCod smallint NULL, AgeCod smallint NULL, DestCod smallint NULL, DACod smallint NULL);
CREATE TABLE dbo.CNTFOLIOS (EmpCod smallint NULL, ExpCod int NULL);
CREATE TABLE dbo.FOLIOSPROC (EmpCod smallint NULL, ExpCod int NULL, TEtCod int NULL, TBPCod int NULL, TAlCod int NULL);
CREATE TABLE dbo.ORDPROC (EmpCod smallint NULL, ExpCod int NULL);
CREATE TABLE dbo.PALETIZA01 (EmpCod smallint NULL, ExpCod int NULL);
CREATE TABLE dbo.ANUINS (CAnCod smallint NULL);
CREATE TABLE dbo.FCOMERCIAL (EmpCod smallint NULL, TMcod smallint NULL, TMSCod smallint NULL);
CREATE TABLE dbo.ORDPROC1 (EmpCod smallint NOT NULL, TempCod char(9) NOT NULL, Ordp1Nlote decimal(10,0) NOT NULL);
CREATE TABLE dbo.PROCUSDA1 (EmpCod smallint NULL, TEtCod int NULL, TBPCod int NULL, TAlCod int NULL);
CREATE TABLE dbo.FOLDIAGRAMA1 (EmpCod smallint NULL, TBPCod int NULL);
CREATE TABLE dbo.REPALETIZAJE (EmpCod smallint NULL, DACod smallint NULL);

/* Datos iniciales editables. */
DECLARE @EmpCod smallint = 1;
DECLARE @EmpNom varchar(50) = 'CONEX';
DECLARE @AdminLogin char(10) = 'ADMIN';
DECLARE @AdminRut decimal(9,0) = 11111111;
DECLARE @AdminDV char(1) = '1';
DECLARE @AdminPasswordSalt varchar(64) = '837e9c61061c478a576ebe3b70960224';
DECLARE @AdminPasswordHash varchar(256) = '1e2f84686b025509610fd754caff40225652d5134e17ef27c7fb78216d95c684457cb02b7de37dc657b21c95499306625f0affa5ebe14b811d7bd2a5b583f870';

INSERT INTO dbo.DEFEMP (EmpCod, EmpNom, EmpGiro, Empdir, EmpRut, EmpDV, EmpSw, empreg, Empcom)
VALUES (@EmpCod, @EmpNom, 'Control de exportacion', ' ', 0, '0', 1, ' ', ' ');

INSERT INTO dbo.USUARIOS
  (UsuLogin, Usunom, UsuClave, UsuRut, UsuDV, UsuCorreo, UsuCargo, UsuNseg, UsuExpira, usucrea)
VALUES
  (@AdminLogin, 'Administrador CONEX', NULL, @AdminRut, @AdminDV, ' ', 'Administrador', 999, NULL, 'INSTALADOR');

INSERT INTO dbo.SEGUSUEMP
  (GECODEMP, UsuLogin, UsuEstado, UsuPerfil, UsuTipo, EsPrincipal, UsuCrea)
VALUES
  (@EmpCod, @AdminLogin, 1, 'ADMIN', 1, 1, 'INSTALADOR');

INSERT INTO dbo.SEGUSUCRED
  (UsuLogin, PasswordSalt, PasswordHash, MigradoDesdeGX, FechaCambio)
VALUES
  (@AdminLogin, @AdminPasswordSalt, @AdminPasswordHash, 0, SYSUTCDATETIME());

INSERT INTO dbo.UROLES (ROLCod, ROLNombre, ROLUCrea)
VALUES ('ADMINFULL', 'Administrador acceso completo', 'INSTALADOR');

INSERT INTO dbo.URolesPorUser (GECODEMP, UsuLogin, ROLCod)
VALUES (@EmpCod, @AdminLogin, 'ADMINFULL');

INSERT INTO dbo.SISTEMAS (SistCod, SistNombre, SistFecCrea, SistFAIcons)
VALUES
  (1, 'Seguridad', CAST(GETDATE() AS date), 'BranchesOutlined'),
  (100, 'CONEX-CO', CAST(GETDATE() AS date), 'AppstoreOutlined');

INSERT INTO dbo.MODULOS (SistCod, Modcod, ModTipo, Modprg, ModDes, ModFcrea, ModFAIcons)
VALUES
  (1, 1, 1, 'SEGURIDAD', 'Seguridad', CAST(GETDATE() AS date), 'BranchesOutlined'),
  (100, 1, 1, 'MAESTROS', 'Maestros', CAST(GETDATE() AS date), 'BranchesOutlined'),
  (100, 2, 1, 'PROCESOS', 'Procesos', CAST(GETDATE() AS date), 'BranchesOutlined'),
  (100, 15, 1, 'CONSULTAS', 'Consultas de Procesos', CAST(GETDATE() AS date), 'BranchesOutlined');

INSERT INTO dbo.PROGRAM (SistCod, Modcod, ProgCod, ProgDes, ProgNomGX, ProgTipo, ProgFcrea, ProgIDmenu, ProgTarget)
VALUES
  (1, 1, 1, 'Sistemas', 'tsistemas', 1, CAST(GETDATE() AS date), 'seg-sistemas', NULL),
  (1, 1, 2, 'Modulos', 'wmodulos', 1, CAST(GETDATE() AS date), 'seg-modulos', NULL),
  (1, 1, 3, 'Programas', 'wprogram', 1, CAST(GETDATE() AS date), 'seg-programas', NULL),
  (1, 1, 4, 'Usuarios', 'wusuarios', 1, CAST(GETDATE() AS date), 'seg-usuarios', NULL),
  (1, 1, 5, 'Niveles de seguridad', 'wnivseg', 1, CAST(GETDATE() AS date), 'seg-niveles', NULL),
  (1, 1, 6, 'Asignacion de accesos', 'wasigprog', 1, CAST(GETDATE() AS date), 'seg-asignaciones', NULL),
  (1, 1, 7, 'Roles', 'urolesww.aspx', 1, CAST(GETDATE() AS date), 'seg-roles', NULL),
  (100, 1, 1, 'Tipos de documento', 'ttipdoc', 1, CAST(GETDATE() AS date), 'mae-tipdoc', NULL),
  (100, 1, 2, 'Tipos de movimiento', 'ttipmov', 1, CAST(GETDATE() AS date), 'mae-tipmov', NULL),
  (100, 1, 3, 'Especies', 'wespecies', 1, CAST(GETDATE() AS date), 'mae-especies', NULL),
  (100, 1, 4, 'Calibres', 'wcalibres', 1, CAST(GETDATE() AS date), 'mae-calibres', NULL),
  (100, 1, 5, 'Productores', 'wproductores', 1, CAST(GETDATE() AS date), 'mae-productores', NULL),
  (100, 1, 6, 'Envases', 'wenvcat', 1, CAST(GETDATE() AS date), 'mae-envases', NULL),
  (100, 1, 7, 'Condiciones de fruta', 'tcondicion', 1, CAST(GETDATE() AS date), 'mae-condiciones', NULL),
  (100, 1, 8, 'Origenes de ingreso', 'torigen', 1, CAST(GETDATE() AS date), 'mae-origenes', NULL),
  (100, 1, 9, 'Procedencias', 'tprocedencia', 1, CAST(GETDATE() AS date), 'mae-procedencias', NULL),
  (100, 1, 10, 'Secciones', 'tsecciones', 1, CAST(GETDATE() AS date), 'mae-secciones', NULL),
  (100, 1, 11, 'Destinos de exportacion', 'tdestinos', 1, CAST(GETDATE() AS date), 'mae-destinos', NULL),
  (100, 1, 12, 'Clientes', 'wclientes', 1, CAST(GETDATE() AS date), 'mae-clientes', NULL),
  (100, 1, 13, 'Agentes', 'wagentes', 1, CAST(GETDATE() AS date), 'mae-agentes', NULL),
  (100, 1, 14, 'Consignatarios', 'wconsig', 1, CAST(GETDATE() AS date), 'mae-consignatarios', NULL),
  (100, 1, 15, 'Exportadoras', 'wexport', 1, CAST(GETDATE() AS date), 'mae-exportadoras', NULL),
  (100, 1, 16, 'Exportadora productores', 'wexporprod', 1, CAST(GETDATE() AS date), 'mae-exp-prod', NULL),
  (100, 1, 18, 'Temporadas', 'wtempo', 1, CAST(GETDATE() AS date), 'mae-temporadas', NULL),
  (100, 1, 19, 'Despachadores autorizados', 'tdespaauto', 1, CAST(GETDATE() AS date), 'mae-despaauto', NULL),
  (100, 1, 20, 'Puertos', 'wpuertos', 1, CAST(GETDATE() AS date), 'mae-puertos', NULL),
  (100, 1, 21, 'Causales de anulacion', 'tcausaanul', 1, CAST(GETDATE() AS date), 'mae-causaanul', NULL),
  (100, 1, 22, 'Tipos de etiqueta', 'wtipeti', 1, CAST(GETDATE() AS date), 'mae-tipeti', NULL),
  (100, 1, 23, 'Tipos base pallet', 'wtipbpal', 1, CAST(GETDATE() AS date), 'mae-tipbpal', NULL),
  (100, 1, 24, 'Tipos de altura', 'wtipalt', 1, CAST(GETDATE() AS date), 'mae-tipalt', NULL),
  (100, 1, 30, 'Parametros generales', 'wparamgen', 1, CAST(GETDATE() AS date), 'mae-paramgen', NULL),
  (100, 1, 31, 'Monedas', 'tmonedas', 1, CAST(GETDATE() AS date), 'mae-monedas', NULL),
  (100, 1, 32, 'Valores moneda', 'wvalmon', 1, CAST(GETDATE() AS date), 'mae-valmon', NULL),
  (100, 2, 1, 'Ingreso de recepciones', 'wrecepciones', 1, CAST(GETDATE() AS date), 'proc-recepciones', NULL),
  (100, 2, 31, 'Tablero de lotes', 'wtablerolotesrecep', 1, CAST(GETDATE() AS date), 'proc-tablero-lotes', NULL),
  (100, 2, 32, 'Mantenedor controles calidad', 'wctrlcalidadrecep', 1, CAST(GETDATE() AS date), 'proc-calidad', NULL),
  (100, 15, 1, 'Recepcion de fruta', 'wcrecepfrut', 1, CAST(GETDATE() AS date), 'con-recep-fruta', NULL),
  (100, 15, 15, 'Dashboard calidad recepcion', 'wdashcalidadrecep', 1, CAST(GETDATE() AS date), 'con-dash-calidad', NULL);

INSERT INTO dbo.PROGRAM1 (SistCod, Modcod, ProgCod, ProgOPCod, ProgOPDes)
SELECT P.SistCod, P.Modcod, P.ProgCod, A.ProgOPCod, A.ProgOPDes
FROM dbo.PROGRAM AS P
CROSS JOIN (
  VALUES
    (CAST(1 AS smallint), CAST('Crear' AS varchar(35))),
    (CAST(2 AS smallint), CAST('Modificar' AS varchar(35))),
    (CAST(3 AS smallint), CAST('Eliminar' AS varchar(35)))
) AS A(ProgOPCod, ProgOPDes)
WHERE P.ProgTipo = 1;

INSERT INTO dbo.ASIGSIST (GECODEMP, AsgSisLogin, SistCod)
VALUES
  (@EmpCod, @AdminLogin, 1),
  (@EmpCod, @AdminLogin, 100);

INSERT INTO dbo.ASIG (GECODEMP, AsigUsu, SistCod, AsigMod, AsigAsig)
SELECT @EmpCod, @AdminLogin, M.SistCod, M.Modcod, 'INSTALADOR'
FROM dbo.MODULOS AS M;

INSERT INTO dbo.ASIGPROG (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgUsuC)
SELECT @EmpCod, @AdminLogin, P.SistCod, P.Modcod, P.ProgCod, 'INSTALADOR'
FROM dbo.PROGRAM AS P;

INSERT INTO dbo.ASIGPROG1 (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgOPCod)
SELECT @EmpCod, @AdminLogin, P.SistCod, P.Modcod, P.ProgCod, P.ProgOPCod
FROM dbo.PROGRAM1 AS P;

INSERT INTO dbo.ASIG (GECODEMP, AsigUsu, SistCod, AsigMod, AsigAsig)
SELECT 0, 'ADMINFULL', M.SistCod, M.Modcod, 'INSTALADOR'
FROM dbo.MODULOS AS M;

INSERT INTO dbo.ASIGPROG (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgUsuC)
SELECT 0, 'ADMINFULL', P.SistCod, P.Modcod, P.ProgCod, 'INSTALADOR'
FROM dbo.PROGRAM AS P;

INSERT INTO dbo.ASIGPROG1 (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgOPCod)
SELECT 0, 'ADMINFULL', P.SistCod, P.Modcod, P.ProgCod, P.ProgOPCod
FROM dbo.PROGRAM1 AS P;

COMMIT TRANSACTION;

SELECT
  DB_NAME() AS BaseDatos,
  (SELECT COUNT(*) FROM dbo.SISTEMAS) AS Sistemas,
  (SELECT COUNT(*) FROM dbo.MODULOS) AS Modulos,
  (SELECT COUNT(*) FROM dbo.PROGRAM) AS Programas,
  (SELECT COUNT(*) FROM dbo.PROGRAM1) AS Acciones,
  (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) AS TablasCreadas,
  (SELECT COUNT(*) FROM dbo.USUARIOS) AS Usuarios,
  (SELECT COUNT(*) FROM dbo.SEGUSUEMP) AS UsuariosEmpresa,
  (SELECT COUNT(*) FROM dbo.UROLES) AS Roles;

PRINT 'Instalacion vacia completada. Usuario inicial: RUT 11111111-1, clave temporal: Cambiar.2026!';
PRINT 'Cambie la clave del usuario ADMIN despues del primer ingreso.';

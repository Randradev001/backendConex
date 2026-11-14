/* Recrea 14 tablas operacionales con el esquema efectivo local.
   Las columnas de texto heredan la configuracion de la base. */
USE [CONEX];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
PRINT 'Base: ' + DB_NAME();
PRINT 'Collation: ' + CONVERT(varchar(128),DATABASEPROPERTYEX(DB_NAME(),'Collation'));
GO
IF OBJECT_ID(N'dbo.FOLIOSPROC',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[FOLIOSPROC]) THROW 51000, 'FOLIOSPROC contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.FOLIOSPROC1',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[FOLIOSPROC1]) THROW 51000, 'FOLIOSPROC1 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.SOLICITUDES1',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[SOLICITUDES1]) THROW 51000, 'SOLICITUDES1 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.SOLICITUDES2',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[SOLICITUDES2]) THROW 51000, 'SOLICITUDES2 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.SOLICITUDES3',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[SOLICITUDES3]) THROW 51000, 'SOLICITUDES3 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.DESORIGEN',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[DESORIGEN]) THROW 51000, 'DESORIGEN contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.DESORIGEN1',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[DESORIGEN1]) THROW 51000, 'DESORIGEN1 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.DESORIGEN2',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[DESORIGEN2]) THROW 51000, 'DESORIGEN2 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.ANUINS',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[ANUINS]) THROW 51000, 'ANUINS contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.REPALETIZAJE',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[REPALETIZAJE]) THROW 51000, 'REPALETIZAJE contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.REPALETIZAJE1',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[REPALETIZAJE1]) THROW 51000, 'REPALETIZAJE1 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.REPALETIZAJE2',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[REPALETIZAJE2]) THROW 51000, 'REPALETIZAJE2 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.PS_SALREP01',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[PS_SALREP01]) THROW 51000, 'PS_SALREP01 contiene datos. No se realizo ningun cambio.', 1;
IF OBJECT_ID(N'dbo.PS_SALREP02',N'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.[PS_SALREP02]) THROW 51000, 'PS_SALREP02 contiene datos. No se realizo ningun cambio.', 1;

BEGIN TRY
  BEGIN TRANSACTION;
  IF OBJECT_ID(N'dbo.PS_SALREP02',N'U') IS NOT NULL DROP TABLE dbo.[PS_SALREP02];
  IF OBJECT_ID(N'dbo.PS_SALREP01',N'U') IS NOT NULL DROP TABLE dbo.[PS_SALREP01];
  IF OBJECT_ID(N'dbo.REPALETIZAJE2',N'U') IS NOT NULL DROP TABLE dbo.[REPALETIZAJE2];
  IF OBJECT_ID(N'dbo.REPALETIZAJE1',N'U') IS NOT NULL DROP TABLE dbo.[REPALETIZAJE1];
  IF OBJECT_ID(N'dbo.REPALETIZAJE',N'U') IS NOT NULL DROP TABLE dbo.[REPALETIZAJE];
  IF OBJECT_ID(N'dbo.DESORIGEN2',N'U') IS NOT NULL DROP TABLE dbo.[DESORIGEN2];
  IF OBJECT_ID(N'dbo.DESORIGEN1',N'U') IS NOT NULL DROP TABLE dbo.[DESORIGEN1];
  IF OBJECT_ID(N'dbo.DESORIGEN',N'U') IS NOT NULL DROP TABLE dbo.[DESORIGEN];
  IF OBJECT_ID(N'dbo.SOLICITUDES3',N'U') IS NOT NULL DROP TABLE dbo.[SOLICITUDES3];
  IF OBJECT_ID(N'dbo.SOLICITUDES2',N'U') IS NOT NULL DROP TABLE dbo.[SOLICITUDES2];
  IF OBJECT_ID(N'dbo.SOLICITUDES1',N'U') IS NOT NULL DROP TABLE dbo.[SOLICITUDES1];
  IF OBJECT_ID(N'dbo.ANUINS',N'U') IS NOT NULL DROP TABLE dbo.[ANUINS];
  IF OBJECT_ID(N'dbo.FOLIOSPROC1',N'U') IS NOT NULL DROP TABLE dbo.[FOLIOSPROC1];
  IF OBJECT_ID(N'dbo.FOLIOSPROC',N'U') IS NOT NULL DROP TABLE dbo.[FOLIOSPROC];

  CREATE TABLE dbo.[FOLIOSPROC]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [FPFolio] char(10) NOT NULL,
    [FPOrdProc] decimal(10,0) NULL,
    [ExpCod] smallint NULL,
    [FPEspe] smallint NULL,
    [FPEstado] smallint NULL,
    [FPFechaIng] datetime NULL,
    [FPIns] decimal(10,0) NULL,
    [FPDesOri] decimal(10,0) NULL,
    [FPDesOT] decimal(10,0) NULL,
    [FPDesUsda] decimal(10,0) NULL,
    [FPDisponible] smallint NULL,
    [TEtCod] smallint NULL,
    [TAlCod] smallint NULL,
    [TBPCod] smallint NULL,
    [FPOrigen] smallint NULL,
    [DestCod] smallint NULL,
    [FPNCaja] decimal(10,0) NULL,
    [FPServicio] varchar(30) NULL,
    CONSTRAINT [PK_FOLIOSPROC] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [FPFolio])
  );

  CREATE TABLE dbo.[FOLIOSPROC1]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [FPFolio] char(10) NOT NULL,
    [FP2NProc] decimal(10,0) NOT NULL,
    [FP2Cor] smallint NOT NULL,
    [FP2Fecha] datetime NULL,
    [ProdCod] char(6) NULL,
    [fp2especod] smallint NULL,
    [fp2varcod] int NULL,
    [EnvCod] smallint NULL,
    [Catcod] smallint NULL,
    [Calibre] char(10) NULL,
    [FP2Cajas] smallint NULL,
    [FP2Kilos] smallmoney NULL,
    [fp2expcod] smallint NULL,
    [Fp2MovRep] smallint NULL,
    [Fp2Estado] smallint NULL,
    [Fp2Tipo] smallint NULL,
    [Fp2Ins] decimal(10,0) NULL,
    [Fp2CajasO] smallint NULL,
    [FP2CajasRep] smallint NULL,
    [CuarCod] int NULL,
    CONSTRAINT [PK_FOLIOSPROC1] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [FPFolio], [FP2NProc], [FP2Cor])
  );

  CREATE TABLE dbo.[SOLICITUDES1]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [SolNum] decimal(10,0) NOT NULL,
    [SollogAP] char(10) NULL,
    [SolFecAP] datetime NULL,
    [SollogRE] char(10) NULL,
    [SolFecRE] datetime NULL,
    [Solfecha] datetime NULL,
    [SolSolicita] char(30) NULL,
    [SolDest] smallint NULL,
    [solespe] smallint NULL,
    [solDestinos] char(100) NULL,
    [SolEstado] smallint NULL,
    [sollogin] char(10) NULL,
    [soltotcajas] int NULL,
    [soltotkilos] money NULL,
    [soltotpal] int NULL,
    [solcajasRA] int NULL,
    [SolcajasRB] int NULL,
    [SolcajasRC] int NULL,
    [SolTipo] char(3) NULL,
    [SolnumI] decimal(10,0) NULL,
    CONSTRAINT [PK_SOLICITUDES1] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [SolNum])
  );

  CREATE TABLE dbo.[SOLICITUDES2]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [SolNum] decimal(10,0) NOT NULL,
    [Sol2Folio] char(10) NOT NULL,
    [Sol2Espe] smallint NULL,
    [Sol2Dispo] smallint NULL,
    [Sol2Cajas] smallint NULL,
    [Sol2Kilos] money NULL,
    [Sol2CajasREP] smallint NULL,
    [Sol2KilosRep] money NULL,
    [Sol2CajasDes] smallint NULL,
    [Sol2KilosDes] money NULL,
    [Sol2NumAnu] decimal(10,0) NULL,
    [Sol2CAlt] smallint NULL,
    [Sol2CBase] smallint NULL,
    [Sol2Ceti] smallint NULL,
    CONSTRAINT [PK_SOLICITUDES2] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [SolNum], [Sol2Folio])
  );

  CREATE TABLE dbo.[SOLICITUDES3]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [SolNum] decimal(10,0) NOT NULL,
    [Sol2Folio] char(10) NOT NULL,
    [Sol3Corr] smallint NOT NULL,
    [sol3fecha] datetime NULL,
    [Sol3espe] smallint NULL,
    [Sol3Var] int NULL,
    [Sol3prod] char(6) NULL,
    [Sol3Env] smallint NULL,
    [Sol3CaT] smallint NULL,
    [Sol3Cal] char(10) NULL,
    [sol3Tipo] smallint NULL,
    [Sol3Cajas] smallint NULL,
    [Sol3Kilos] money NULL,
    [Sol3CajasRep] smallint NULL,
    [Sol3KilosRep] money NULL,
    [Sol3CajasDes] smallint NULL,
    [Sol3KilosDes] money NULL,
    [Sol3Cuar] int NULL,
    CONSTRAINT [PK_SOLICITUDES3] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [SolNum], [Sol2Folio], [Sol3Corr])
  );

  CREATE TABLE dbo.[DESORIGEN]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [DorTipPlani] smallint NOT NULL,
    [DORNum] decimal(10,0) NOT NULL,
    [DORNumf] decimal(10,0) NULL,
    [DorFecha] datetime NULL,
    [DorPuertoE] smallint NULL,
    [DorNguia] decimal(10,0) NULL,
    [DorTipoTrans] char(30) NULL,
    [DorPatente] char(30) NULL,
    [DorNSellos] char(30) NULL,
    [DorUbicacion] char(30) NULL,
    [DorPuertoD] smallint NULL,
    [ConsCod] smallint NULL,
    [AgeCod] smallint NULL,
    [ExpCod] smallint NULL,
    [DorNave] char(30) NULL,
    [DorObs1] char(200) NULL,
    [DACod] smallint NULL,
    [DorTotCajas] int NULL,
    [DorTotKilos] money NULL,
    [DorTotFol] smallint NULL,
    [DorEstado] smallint NULL,
    [DestCod] smallint NULL,
    [DorLogcre] char(10) NULL,
    [DorFecCrea] datetime NULL,
    [DorLogAnula] char(10) NULL,
    [DorFecAnula] datetime NULL,
    [Dortrata] char(30) NULL,
    [DorContenedor] char(30) NULL,
    [DorPalBin] smallint NULL,
    [DorTipoD] smallint NULL,
    [DorTrata2] char(50) NULL,
    [DorTrata3] char(50) NULL,
    [DorCodTrata] char(209) NULL,
    [DorNPuertoE] char(25) NULL,
    [DorNpuertoD] char(25) NULL,
    [DestNom] char(20) NULL,
    [ConsNom] char(30) NULL,
    [AgeNom] char(30) NULL,
    [Agerut] decimal(9,0) NULL,
    [AgeDv] char(1) NULL,
    [ExpNom] char(40) NULL,
    [ExpRut] decimal(9,0) NULL,
    [ExpDv] char(1) NULL,
    [DANombre] char(30) NULL,
    CONSTRAINT [PK_DESORIGEN] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [DorTipPlani], [DORNum])
  );

  CREATE TABLE dbo.[DESORIGEN1]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [DorTipPlani] smallint NOT NULL,
    [DORNum] decimal(10,0) NOT NULL,
    [dor1Folio] char(10) NOT NULL,
    [dor1espe] smallint NULL,
    [Dor1Cajas] smallint NULL,
    [Dor1Kilos] money NULL,
    [Dor1Nsol] decimal(10,0) NULL,
    [Dor1Nespe] char(20) NULL,
    CONSTRAINT [PK_DESORIGEN1] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [DorTipPlani], [DORNum], [dor1Folio])
  );

  CREATE TABLE dbo.[DESORIGEN2]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [DorTipPlani] smallint NOT NULL,
    [DORNum] decimal(10,0) NOT NULL,
    [dor1Folio] char(10) NOT NULL,
    [Dor2Corr] smallint NOT NULL,
    [Dor2espe] smallint NULL,
    [Dor2var] int NULL,
    [Dor2fecproc] datetime NULL,
    [Dor2Prod] char(6) NULL,
    [Dor2env] smallint NULL,
    [Dor2cat] smallint NULL,
    [Dor2cal] char(10) NULL,
    [Dor2Cajas] smallint NULL,
    [Dor2Kilos] money NULL,
    [Dor2Nespe] char(20) NULL,
    [Dor2Nvar] char(20) NULL,
    [Dor2NProd] char(35) NULL,
    [Dor2ComP] char(20) NULL,
    [Dor2ProvP] char(20) NULL,
    [Dor2CSG] char(10) NULL,
    [Dor2NeNV] char(20) NULL,
    [dor2NenvC] char(10) NULL,
    [Dor2Ncat] char(20) NULL,
    CONSTRAINT [PK_DESORIGEN2] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [DorTipPlani], [DORNum], [dor1Folio], [Dor2Corr])
  );

  CREATE TABLE dbo.[ANUINS]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [ANUFolio] decimal(10,0) NOT NULL,
    [ANUFecha] datetime NULL,
    [CAnCod] smallint NULL,
    [ANUFecC] datetime NULL,
    [ANULoginC] char(10) NULL,
    [ANUEstado] smallint NULL,
    [ANUOBS] char(50) NULL,
    [AnuTotFol] int NULL,
    CONSTRAINT [PK_ANUINS] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [ANUFolio])
  );

  CREATE TABLE dbo.[REPALETIZAJE]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [REPNum] decimal(10,0) NOT NULL,
    [REPNumF] decimal(10,0) NULL,
    [REPFecha] datetime NULL,
    [REPLogCrea] char(10) NULL,
    [REPFecCrea] datetime NULL,
    [REPEstado] smallint NULL,
    [dacod] smallint NULL,
    CONSTRAINT [PK_REPALETIZAJE] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [REPNum])
  );

  CREATE TABLE dbo.[REPALETIZAJE1]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [REPNum] decimal(10,0) NOT NULL,
    [REP0Fol] char(10) NOT NULL,
    [REp0Espe] smallint NULL,
    [Rep0Cajas] smallint NULL,
    [REp0CajasR] smallint NULL,
    [REP0CajasDes] smallint NULL,
    [REP0Nsol] decimal(10,0) NULL,
    [REP0Calt] smallint NULL,
    [REP0CBase] smallint NULL,
    [REP0TipAct] smallint NULL,
    CONSTRAINT [PK_REPALETIZAJE1] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [REPNum], [REP0Fol])
  );

  CREATE TABLE dbo.[REPALETIZAJE2]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [REPNum] decimal(10,0) NOT NULL,
    [REP0Fol] char(10) NOT NULL,
    [Rep1Corr] smallint NOT NULL,
    [REP1Mov] smallint NOT NULL,
    [REP1FecPro] datetime NULL,
    [REP1Prod] char(6) NULL,
    [REP1Espe] smallint NULL,
    [Rep1Var] int NULL,
    [REP1Env] smallint NULL,
    [REP1Cat] smallint NULL,
    [REP1Cal] char(10) NULL,
    [REP1CajasINS] smallint NULL,
    [REP1KilosINS] money NULL,
    [REP1CajasRep] smallint NULL,
    [REP1KilosRep] money NULL,
    [REP1CajasDes] smallint NULL,
    [Rep1KilosDes] money NULL,
    CONSTRAINT [PK_REPALETIZAJE2] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [REPNum], [REP0Fol], [Rep1Corr], [REP1Mov])
  );

  CREATE TABLE dbo.[PS_SALREP01]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [PSR_Login] char(20) NOT NULL,
    [PSR_NREp] decimal(10,0) NOT NULL,
    [PSR_Espe] smallint NOT NULL,
    [PSR_Var] int NOT NULL,
    [PSR_Prod] char(6) NOT NULL,
    [PSR_Env] smallint NOT NULL,
    [PSR_Cat] smallint NOT NULL,
    [PSR_Cal] char(10) NOT NULL,
    [PSR_Cajas] smallint NULL,
    [PSR_CajasO] smallint NULL,
    CONSTRAINT [PK_PS_SALREP01] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [PSR_Login], [PSR_NREp], [PSR_Espe], [PSR_Var], [PSR_Prod], [PSR_Env], [PSR_Cat], [PSR_Cal])
  );

  CREATE TABLE dbo.[PS_SALREP02]
  (
    [EmpCod] smallint NOT NULL,
    [TempCod] char(9) NOT NULL,
    [PSRM_Login] char(20) NOT NULL,
    [PSRM_Repa] decimal(10,0) NOT NULL,
    [PSRM_Folio] char(10) NOT NULL,
    [PSRM_Corr] smallint NOT NULL,
    [PSRM_Cajas] smallint NULL,
    CONSTRAINT [PK_PS_SALREP02] PRIMARY KEY CLUSTERED ([EmpCod], [TempCod], [PSRM_Login], [PSRM_Repa], [PSRM_Folio], [PSRM_Corr])
  );
  CREATE NONCLUSTERED INDEX [IANUINS1] ON dbo.[ANUINS] ([CAnCod]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN2] ON dbo.[DESORIGEN] ([EmpCod], [ExpCod]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN3] ON dbo.[DESORIGEN] ([EmpCod], [AgeCod]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN4] ON dbo.[DESORIGEN] ([EmpCod], [ConsCod]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN5] ON dbo.[DESORIGEN] ([EmpCod], [DACod]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN6] ON dbo.[DESORIGEN] ([DorPuertoE]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN7] ON dbo.[DESORIGEN] ([DorPuertoD]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN8] ON dbo.[DESORIGEN] ([DestCod]);
  CREATE NONCLUSTERED INDEX [IND_DORNUMPLANI] ON dbo.[DESORIGEN] ([EmpCod], [TempCod], [DorTipPlani], [DORNumf]);
  CREATE NONCLUSTERED INDEX [IND_DESFEC] ON dbo.[DESORIGEN] ([EmpCod], [TempCod], [DorFecha]);
  CREATE NONCLUSTERED INDEX [IX_DESORIGEN_LISTADO] ON dbo.[DESORIGEN] ([EmpCod], [TempCod], [DorTipPlani], [DorFecha], [DorEstado]) INCLUDE ([DORNum], [DORNumf], [DorNguia], [DorTotCajas], [DorTotKilos], [DorTotFol]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN13] ON dbo.[DESORIGEN1] ([EmpCod], [dor1espe]);
  CREATE NONCLUSTERED INDEX [IX_DESORIGEN1_PLANILLA] ON dbo.[DESORIGEN1] ([EmpCod], [TempCod], [DorTipPlani], [DORNum], [dor1Folio]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN23] ON dbo.[DESORIGEN2] ([EmpCod], [Dor2env], [Dor2cat]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN24] ON dbo.[DESORIGEN2] ([EmpCod], [Dor2Prod]);
  CREATE NONCLUSTERED INDEX [IDESORIGEN25] ON dbo.[DESORIGEN2] ([EmpCod], [Dor2espe], [Dor2var]);
  CREATE NONCLUSTERED INDEX [IND_PLANISAG] ON dbo.[DESORIGEN2] ([EmpCod], [TempCod], [DorTipPlani], [DORNum], [Dor2espe], [Dor2var], [Dor2env]);
  CREATE NONCLUSTERED INDEX [IND_DPLANIPROD] ON dbo.[DESORIGEN2] ([EmpCod], [TempCod], [DorTipPlani], [DORNum], [Dor2espe], [Dor2var], [Dor2Prod]);
  CREATE NONCLUSTERED INDEX [IND_DESPACK] ON dbo.[DESORIGEN2] ([EmpCod], [TempCod], [DorTipPlani], [DORNum], [Dor2espe], [dor1Folio]);
  CREATE NONCLUSTERED INDEX [IND_DESCALIBRE] ON dbo.[DESORIGEN2] ([EmpCod], [TempCod], [DORNum], [Dor2espe], [Dor2var], [Dor2env], [Dor2cat], [Dor2cal]);
  CREATE NONCLUSTERED INDEX [IX_DESORIGEN2_PLANILLA] ON dbo.[DESORIGEN2] ([EmpCod], [TempCod], [DorTipPlani], [DORNum], [dor1Folio], [Dor2Corr]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC1] ON dbo.[FOLIOSPROC] ([EmpCod], [FPEspe]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC2] ON dbo.[FOLIOSPROC] ([EmpCod], [ExpCod]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC4] ON dbo.[FOLIOSPROC] ([EmpCod], [TBPCod]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC5] ON dbo.[FOLIOSPROC] ([EmpCod], [TAlCod]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC6] ON dbo.[FOLIOSPROC] ([EmpCod], [TEtCod]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC12] ON dbo.[FOLIOSPROC1] ([EmpCod], [fp2especod], [fp2varcod]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC13] ON dbo.[FOLIOSPROC1] ([EmpCod], [fp2especod], [Calibre]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC14] ON dbo.[FOLIOSPROC1] ([EmpCod], [EnvCod], [Catcod]);
  CREATE NONCLUSTERED INDEX [IND_VERIFOLIO] ON dbo.[FOLIOSPROC1] ([EmpCod], [TempCod], [FPFolio], [FP2Fecha], [fp2especod], [fp2varcod], [ProdCod], [EnvCod], [Catcod], [Calibre]);
  CREATE NONCLUSTERED INDEX [IND_CORFOL] ON dbo.[FOLIOSPROC1] ([EmpCod], [TempCod], [FPFolio], [FP2NProc], [FP2Cor] DESC);
  CREATE NONCLUSTERED INDEX [IND_FOLFECHA] ON dbo.[FOLIOSPROC1] ([EmpCod], [TempCod], [FP2Fecha], [fp2especod], [fp2varcod], [FPFolio]);
  CREATE NONCLUSTERED INDEX [IND_FOLPROC] ON dbo.[FOLIOSPROC1] ([EmpCod], [TempCod], [fp2especod], [fp2varcod], [FPFolio], [FP2Fecha]);
  CREATE NONCLUSTERED INDEX [IND_ESPEFOL] ON dbo.[FOLIOSPROC1] ([EmpCod], [TempCod], [fp2especod], [FPFolio], [FP2Fecha]);
  CREATE NONCLUSTERED INDEX [IND_INFCAL] ON dbo.[FOLIOSPROC1] ([EmpCod], [TempCod], [fp2expcod], [ProdCod], [fp2especod], [fp2varcod], [EnvCod], [Catcod], [Calibre]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC17] ON dbo.[FOLIOSPROC1] ([EmpCod], [fp2expcod], [ProdCod]);
  CREATE NONCLUSTERED INDEX [IFOLIOSPROC15] ON dbo.[FOLIOSPROC1] ([EmpCod], [ProdCod], [CuarCod]);
  CREATE NONCLUSTERED INDEX [IPS_SALREP011] ON dbo.[PS_SALREP01] ([EmpCod], [PSR_Env], [PSR_Cat]);
  CREATE NONCLUSTERED INDEX [IPS_SALREP012] ON dbo.[PS_SALREP01] ([EmpCod], [PSR_Prod]);
  CREATE NONCLUSTERED INDEX [IPS_SALREP013] ON dbo.[PS_SALREP01] ([EmpCod], [PSR_Espe], [PSR_Var]);
  CREATE NONCLUSTERED INDEX [IREPALETIZAJE12] ON dbo.[REPALETIZAJE1] ([EmpCod], [REp0Espe]);
  CREATE NONCLUSTERED INDEX [IREPALETIZAJE14] ON dbo.[REPALETIZAJE1] ([EmpCod], [REP0CBase]);
  CREATE NONCLUSTERED INDEX [IREPALETIZAJE15] ON dbo.[REPALETIZAJE1] ([EmpCod], [REP0Calt]);
  CREATE NONCLUSTERED INDEX [IREPALETIZAJE21] ON dbo.[REPALETIZAJE2] ([EmpCod], [REP1Env], [REP1Cat]);
  CREATE NONCLUSTERED INDEX [IREPALETIZAJE22] ON dbo.[REPALETIZAJE2] ([EmpCod], [REP1Espe], [Rep1Var]);
  CREATE NONCLUSTERED INDEX [IREPALETIZAJE23] ON dbo.[REPALETIZAJE2] ([EmpCod], [REP1Prod]);
  CREATE NONCLUSTERED INDEX [IND_DATOSCAJAS] ON dbo.[REPALETIZAJE2] ([EmpCod], [TempCod], [REP0Fol], [Rep1Var], [REP1Prod], [REP1Env], [REP1Cat], [REP1Cal]);
  CREATE NONCLUSTERED INDEX [ISOLICITUDES] ON dbo.[SOLICITUDES1] ([EmpCod], [solespe]);
  CREATE NONCLUSTERED INDEX [ISOLICITUDES1] ON dbo.[SOLICITUDES1] ([SolDest]);
  CREATE NONCLUSTERED INDEX [IND_SOLFEC] ON dbo.[SOLICITUDES1] ([EmpCod], [TempCod], [Solfecha], [solespe]);
  CREATE NONCLUSTERED INDEX [ITAB_SOLICITUD1] ON dbo.[SOLICITUDES2] ([EmpCod], [Sol2Espe]);
  CREATE NONCLUSTERED INDEX [IND_ESPE] ON dbo.[SOLICITUDES2] ([EmpCod], [TempCod], [Sol2Espe], [Sol2Folio]);
  CREATE NONCLUSTERED INDEX [IND_SOLFOLANU] ON dbo.[SOLICITUDES2] ([EmpCod], [TempCod], [Sol2NumAnu]);
  CREATE NONCLUSTERED INDEX [ISOLICITUDES2] ON dbo.[SOLICITUDES2] ([EmpCod], [Sol2Ceti]);
  CREATE NONCLUSTERED INDEX [ISOLICITUDES21] ON dbo.[SOLICITUDES2] ([EmpCod], [Sol2CBase]);
  CREATE NONCLUSTERED INDEX [ISOLICITUDES22] ON dbo.[SOLICITUDES2] ([EmpCod], [Sol2CAlt]);
  CREATE NONCLUSTERED INDEX [ISOLICITUDES32] ON dbo.[SOLICITUDES3] ([EmpCod], [Sol3Env], [Sol3CaT]);
  CREATE NONCLUSTERED INDEX [ISOLICITUDES33] ON dbo.[SOLICITUDES3] ([EmpCod], [Sol3prod]);
  CREATE NONCLUSTERED INDEX [ISOLICITUDES34] ON dbo.[SOLICITUDES3] ([EmpCod], [Sol3espe], [Sol3Var]);
  CREATE NONCLUSTERED INDEX [IND_SOLDATOSCAJ] ON dbo.[SOLICITUDES3] ([EmpCod], [TempCod], [Sol2Folio], [Sol3Var], [Sol3prod], [Sol3Env], [Sol3CaT], [Sol3Cal]);

  COMMIT TRANSACTION;
  PRINT 'Las 14 tablas fueron recreadas correctamente.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'No se realizaron cambios.';
  THROW;
END CATCH;
GO
SELECT t.name Tabla,SUM(p.rows) Registros FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN(0,1) WHERE t.name IN ('FOLIOSPROC','FOLIOSPROC1','SOLICITUDES1','SOLICITUDES2','SOLICITUDES3','DESORIGEN','DESORIGEN1','DESORIGEN2','ANUINS','REPALETIZAJE','REPALETIZAJE1','REPALETIZAJE2','PS_SALREP01','PS_SALREP02') GROUP BY t.name ORDER BY t.name;
GO
SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,COLLATION_NAME,IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME IN ('FOLIOSPROC','FOLIOSPROC1','SOLICITUDES1','SOLICITUDES2','SOLICITUDES3','DESORIGEN','DESORIGEN1','DESORIGEN2','ANUINS','REPALETIZAJE','REPALETIZAJE1','REPALETIZAJE2','PS_SALREP01','PS_SALREP02') ORDER BY TABLE_NAME,ORDINAL_POSITION;
GO



/*
  Script directo para crear las 42 tablas faltantes en CONEX.
  IMPORTANTE: ejecutar una sola vez sobre la base antigua.
  Este archivo no comprueba si los objetos ya existen.
*/

USE [CONEX];
GO

CREATE SCHEMA [integracion] AUTHORIZATION [dbo];
GO

-- Tablas
CREATE TABLE [dbo].[DESCLI_FP1]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[DesOTNumI] [decimal](10,0) NOT NULL,
[DesOT1Cor] [smallint] NOT NULL,
[DesOT1Folio] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[DesOT1Espe] [smallint] NULL,
[DesOT1Cajas] [smallint] NULL,
[DesOT1Ori] [smallint] NULL,
[DesOT1Kilos] [money] NULL,
[DesOT1TipF] [smallint] NULL
);
GO

CREATE TABLE [dbo].[DESORIGEN1]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[DorTipPlani] [smallint] NOT NULL,
[DORNum] [decimal](10,0) NOT NULL,
[dor1Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[dor1espe] [smallint] NULL,
[Dor1Cajas] [smallint] NULL,
[Dor1Kilos] [money] NULL,
[Dor1Nsol] [decimal](10,0) NULL,
[Dor1Nespe] [char](20) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[DESORIGEN2]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[DorTipPlani] [smallint] NOT NULL,
[DORNum] [decimal](10,0) NOT NULL,
[dor1Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[Dor2Corr] [smallint] NOT NULL,
[Dor2espe] [smallint] NULL,
[Dor2var] [int] NULL,
[Dor2fecproc] [datetime] NULL,
[Dor2Prod] [char](6) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2env] [smallint] NULL,
[Dor2cat] [smallint] NULL,
[Dor2cal] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2Cajas] [smallint] NULL,
[Dor2Kilos] [money] NULL,
[Dor2Nespe] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2Nvar] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2NProd] [char](35) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2ComP] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2ProvP] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2CSG] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2NeNV] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[dor2NenvC] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[Dor2Ncat] [char](20) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[DESTMP]
(
[DesMPCod] [smallint] NOT NULL,
[DesMPNom] [char](30) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[ENVMP]
(
[ENMTCod] [smallint] NOT NULL,
[ENMTDesc] [char](20) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[ETIQUETAPLANTILLA]
(
[EmpCod] [smallint] NOT NULL,
[ConfCod] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[EtiNombre] [nvarchar](100) COLLATE Modern_Spanish_CI_AS NOT NULL,
[EtiDescripcion] [nvarchar](250) COLLATE Modern_Spanish_CI_AS NULL,
[EtiAnchoMm] [decimal](9,3) NOT NULL,
[EtiAltoMm] [decimal](9,3) NOT NULL,
[EtiDpi] [smallint] NOT NULL,
[EtiAnchoDots] [int] NOT NULL,
[EtiAltoDots] [int] NOT NULL,
[EtiDesignJson] [nvarchar](MAX) COLLATE Modern_Spanish_CI_AS NOT NULL,
[EtiZpl] [nvarchar](MAX) COLLATE Modern_Spanish_CI_AS NOT NULL,
[EtiSchemaVersion] [int] CONSTRAINT [DF_ETIQUETAPLANTILLA_Schema] DEFAULT ((1)) NOT NULL,
[EtiParserVersion] [varchar](20) COLLATE Modern_Spanish_CI_AS CONSTRAINT [DF_ETIQUETAPLANTILLA_Parser] DEFAULT ('conex-1') NOT NULL,
[EtiGeneratorVersion] [varchar](20) COLLATE Modern_Spanish_CI_AS CONSTRAINT [DF_ETIQUETAPLANTILLA_Generator] DEFAULT ('conex-1') NOT NULL,
[EtiActiva] [bit] CONSTRAINT [DF_ETIQUETAPLANTILLA_Activa] DEFAULT ((1)) NOT NULL,
[EtiLoginC] [varchar](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[EtiFechaC] [datetime2](0) CONSTRAINT [DF_ETIQUETAPLANTILLA_FechaC] DEFAULT (sysdatetime()) NOT NULL,
[EtiLoginM] [varchar](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[EtiFechaM] [datetime2](0) CONSTRAINT [DF_ETIQUETAPLANTILLA_FechaM] DEFAULT (sysdatetime()) NOT NULL,
[EtiRowVersion] [timestamp] NOT NULL
);
GO

CREATE TABLE [dbo].[FACTURA1]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FacNum] [decimal](10,0) NOT NULL,
[Fac1Corr] [smallint] NOT NULL,
[Fac1Detalle1] [char](80) COLLATE Modern_Spanish_CI_AS NULL,
[Fac1Detalle2] [char](80) COLLATE Modern_Spanish_CI_AS NULL,
[Fac1Cant] [money] NULL,
[Fac1PUnit] [money] NULL,
[Fac1Total] [decimal](10,0) NULL,
[Fac1TotalUSD] [money] NULL,
[Fac1PunitUSD] [money] NULL,
[FacTipDoc1] [decimal](10,0) NULL
);
GO

CREATE TABLE [dbo].[FOLDIAGRAMA]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FolDNdoc] [decimal](10,0) NOT NULL,
[FolDFecha] [datetime] NULL,
[FolDSCajas] [decimal](10,0) NULL,
[FolDCFolios] [smallint] NULL,
[FolDTipDes] [char](2) COLLATE Modern_Spanish_CI_AS NULL,
[FolDTipSel] [char](2) COLLATE Modern_Spanish_CI_AS NULL,
[FolDTipM] [char](2) COLLATE Modern_Spanish_CI_AS NULL,
[Especod] [smallint] NULL,
[FolDGlosa] [char](40) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[FOLIOSPROC1]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FPFolio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FP2NProc] [decimal](10,0) NOT NULL,
[FP2Cor] [smallint] NOT NULL,
[FP2Fecha] [datetime] NULL,
[ProdCod] [char](6) COLLATE Modern_Spanish_CI_AS NULL,
[fp2especod] [smallint] NULL,
[fp2varcod] [int] NULL,
[EnvCod] [smallint] NULL,
[Catcod] [smallint] NULL,
[Calibre] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[FP2Cajas] [smallint] NULL,
[FP2Kilos] [smallmoney] NULL,
[fp2expcod] [smallint] NULL,
[Fp2MovRep] [smallint] NULL,
[Fp2Estado] [smallint] NULL,
[Fp2Tipo] [smallint] NULL,
[Fp2Ins] [decimal](10,0) NULL,
[Fp2CajasO] [smallint] NULL,
[FP2CajasRep] [smallint] NULL,
[CuarCod] [int] NULL
);
GO

CREATE TABLE [dbo].[GEN_ETIXCAL]
(
[EmpCod] [smallint] NOT NULL,
[GETxCCodigo] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[Especod] [smallint] NOT NULL
);
GO

CREATE TABLE [dbo].[GEN_ETIXCAL1]
(
[EmpCod] [smallint] NOT NULL,
[GETxCCodigo] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[Especod] [smallint] NOT NULL,
[Calibre] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[ConfCod] [char](10) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[GUIASD1]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[GuiNumInt] [decimal](10,0) NOT NULL,
[Gui1Corr] [smallint] NOT NULL,
[Gui1Detalle1] [char](80) COLLATE Modern_Spanish_CI_AS NULL,
[Gui1Detalle2] [char](80) COLLATE Modern_Spanish_CI_AS NULL,
[Gui1Cant] [money] NULL,
[Gui1PrecU] [decimal](10,0) NULL,
[Gui1Total] [decimal](10,0) NULL,
[Gui1Cajas] [smallint] NULL,
[Especod] [smallint] NULL,
[Gui1Calibre] [nchar](10) COLLATE Modern_Spanish_CI_AS NULL,
[EnvCod] [smallint] NULL
);
GO

CREATE TABLE [dbo].[HHSEMANAS]
(
[HHSEMP] [char](4) COLLATE Modern_Spanish_CI_AS NOT NULL,
[HHSCor] [smallint] NOT NULL,
[HHSTIPO] [char](4) COLLATE Modern_Spanish_CI_AS NOT NULL,
[HHSPHTD] [char](4) COLLATE Modern_Spanish_CI_AS NULL,
[HHSDIA] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[HHSIni] [char](5) COLLATE Modern_Spanish_CI_AS NULL,
[HHSFin] [char](5) COLLATE Modern_Spanish_CI_AS NULL,
[HHSPau] [char](5) COLLATE Modern_Spanish_CI_AS NULL,
[HHSPHTP] [char](4) COLLATE Modern_Spanish_CI_AS NULL,
[HHSLugar] [char](50) COLLATE Modern_Spanish_CI_AS NULL,
[HHSDESCRIP] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[HHSdescripL] [char](40) COLLATE Modern_Spanish_CI_AS NULL,
[HHSnumD] [smallint] NULL,
[HHSLV] [smallint] NULL,
[HHSSab] [smallint] NULL,
[HHSDom] [smallint] NULL
);
GO

CREATE TABLE [dbo].[HISIN]
(
[EmpCod] [smallint] NOT NULL,
[HisAAMM] [int] NOT NULL,
[HisTipo] [smallint] NOT NULL,
[HisOricod] [smallint] NOT NULL,
[HisCuar] [int] NOT NULL,
[HisProd] [char](6) COLLATE Modern_Spanish_CI_AS NOT NULL,
[Hisespe] [smallint] NOT NULL,
[HisVar] [int] NOT NULL,
[HisEnv] [smallint] NOT NULL,
[HisCondi] [smallint] NOT NULL,
[HisTMov] [smallint] NULL,
[HisStMov] [smallint] NULL,
[HisCant] [decimal](12,0) NULL,
[HisKilos] [money] NULL
);
GO

CREATE TABLE [dbo].[HORARIOS]
(
[HRini] [char](5) COLLATE Modern_Spanish_CI_AS NOT NULL,
[HRFin] [char](5) COLLATE Modern_Spanish_CI_AS NOT NULL,
[HRpausa] [char](5) COLLATE Modern_Spanish_CI_AS NOT NULL,
[HRCod] [char](4) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[MaeClauVenta]
(
[MaeClauCod] [decimal](10,0) NOT NULL,
[MaeClauDesc] [nchar](100) COLLATE Modern_Spanish_CI_AS NULL,
[MaeClauSigla] [nchar](10) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[MAEFORPAG]
(
[ForPaCod] [smallint] NOT NULL,
[ForPaDesc] [char](200) COLLATE Modern_Spanish_CI_AS NULL,
[ForPaSigla] [char](10) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[MaeModVenta]
(
[ModVenCod] [decimal](10,0) NOT NULL,
[ModVenDesc] [nchar](100) COLLATE Modern_Spanish_CI_AS NULL,
[ModVenSigla] [nchar](10) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[MaeViaTran]
(
[MaeViaCod] [decimal](10,0) NOT NULL,
[MaeViaDesc] [nchar](100) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[OrdenImpresion]
(
[OPLCID] [decimal](10,0) NOT NULL,
[OPLCIMP] [smallint] NULL,
[OPLCFecha] [datetime] NULL,
[OPLCProc] [smallint] NULL,
[OPLCFechaIns] [datetime] CONSTRAINT [DF_OrdenImpresion_FechaIns] DEFAULT (getdate()) NULL,
[OPLCTomadaEn] [datetime] NULL,
[OPLCWorker] [varchar](80) COLLATE Modern_Spanish_CI_AS NULL,
[OPLCIntentos] [int] CONSTRAINT [DF_OrdenImpresion_Intentos] DEFAULT ((0)) NOT NULL,
[OPLCError] [nvarchar](1000) COLLATE Modern_Spanish_CI_AS NULL,
[OPLCEtiCod] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[OPLCEtiVersion] [int] NULL,
[OPLCZpl] [nvarchar](MAX) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[PALETIZA011]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PALFolio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PAL2NCaja] [decimal](10,0) NOT NULL,
[PAL2Kilos] [money] NULL,
[Especod] [smallint] NULL,
[VarCod] [int] NULL,
[ProdCod] [char](6) COLLATE Modern_Spanish_CI_AS NULL,
[EnvCod] [smallint] NULL,
[Catcod] [smallint] NULL,
[Calibre] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[PAL2Fechap] [datetime] NULL,
[PAL2Nproc] [decimal](10,0) NULL
);
GO

CREATE TABLE [dbo].[PASOSOL]
(
[EmpCod] [smallint] NOT NULL,
[PSSoluser] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSSolprod] [char](6) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSSolCuar] [int] NOT NULL,
[PSSolCajas] [int] NULL,
[PSSolPallet] [int] NULL
);
GO

CREATE TABLE [dbo].[PAUSAS]
(
[PAUCod] [char](5) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PAUVal1] [smallmoney] NULL,
[PAUVal2] [smallmoney] NULL
);
GO

CREATE TABLE [dbo].[PROCUSDA]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PUSTipo] [smallint] NOT NULL,
[PUSNum] [decimal](10,0) NOT NULL,
[PUSFecha] [datetime] NULL,
[PUSEstado] [smallint] NULL,
[PUSEspe] [smallint] NULL,
[PUSNumI] [decimal](10,0) NULL,
[PUSLoginC] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[PUSFecC] [datetime] NULL,
[PUSTotCaj] [smallint] NULL,
[PUSTotKil] [money] NULL,
[PUSTotPal] [smallint] NULL
);
GO

CREATE TABLE [dbo].[PROCUSDA2]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PUSTipo] [smallint] NOT NULL,
[PUSNum] [decimal](10,0) NOT NULL,
[PUS1Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PUS2Cor] [smallint] NOT NULL,
[PUS2Fecha] [datetime] NULL,
[VarCod] [int] NULL,
[ProdCod] [char](6) COLLATE Modern_Spanish_CI_AS NULL,
[EnvCod] [smallint] NULL,
[Catcod] [smallint] NULL,
[Calibre] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[Especod] [smallint] NULL,
[PUS2Cajas] [smallint] NULL,
[PUS2Kilos] [money] NULL,
[PUS2CajREp] [smallint] NULL,
[PUS2KilRep] [money] NULL,
[PUS2CajDES] [smallint] NULL,
[PUS2KilDES] [money] NULL
);
GO

CREATE TABLE [dbo].[PRODGEN]
(
[PRGCod] [smallint] NOT NULL,
[PRGDesc] [char](100) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[PS_DIAGRAMAS]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSD_Login] [char](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSD_ID] [decimal](10,0) NOT NULL,
[PSD_Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSD_Corr] [smallint] NOT NULL,
[PSD_Campo1] [smallint] NULL,
[PSD_Campo2] [smallint] NULL,
[PSD_Campo4] [smallint] NULL,
[PSD_Campo5] [smallint] NULL,
[PSD_Campo6] [smallint] NULL,
[PSD_Campo7] [smallint] NULL,
[PSD_Campo8] [smallint] NULL,
[PSD_Campo9] [smallint] NULL,
[PSD_Campo10] [smallint] NULL,
[PSD_Corte] [smallint] NULL,
[PSD_Campo3] [smallint] NULL
);
GO

CREATE TABLE [dbo].[PS_INFCAL]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSC_login] [char](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSC_Expor] [smallint] NOT NULL,
[PSC_Dest] [smallint] NOT NULL,
[PSC_Prod] [char](6) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSC_Espe] [smallint] NOT NULL,
[PSC_Var] [int] NOT NULL,
[PSC_Env] [smallint] NOT NULL,
[PSC_Cor] [decimal](10,0) NOT NULL,
[PSC_Texto] [char](80) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Fecha] [datetime] NULL,
[PSC_Val01] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val02] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val03] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val04] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val05] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val06] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val07] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val08] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val09] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val10] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val11] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val12] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val13] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val14] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val15] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val16] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val17] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val18] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val19] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_Val20] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSC_ValN2] [money] NULL,
[PSC_ValN0] [decimal](12,0) NULL,
[PSC_ValN1] [decimal](12,0) NULL
);
GO

CREATE TABLE [dbo].[PS_INFG001]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSI_Login] [char](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSI_Fecha] [datetime] NOT NULL,
[PSI_Texto] [char](40) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSI_Num] [decimal](10,0) NOT NULL,
[PSI_ID] [decimal](10,0) NOT NULL,
[PSI_Val1] [decimal](13,0) NULL,
[PSI_Val2] [decimal](13,0) NULL,
[PSI_Val3] [decimal](13,0) NULL,
[PSI_Val4] [decimal](13,0) NULL,
[PSI_Val5] [decimal](13,0) NULL,
[PSI_Val6] [decimal](13,0) NULL,
[PSI_Val7] [money] NULL,
[PSI_Text01] [char](20) COLLATE Modern_Spanish_CI_AS NULL,
[PSI_Text02] [char](80) COLLATE Modern_Spanish_CI_AS NULL
);
GO

CREATE TABLE [dbo].[PS_SALREP01]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSR_Login] [char](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSR_NREp] [decimal](10,0) NOT NULL,
[PSR_Espe] [smallint] NOT NULL,
[PSR_Var] [int] NOT NULL,
[PSR_Prod] [char](6) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSR_Env] [smallint] NOT NULL,
[PSR_Cat] [smallint] NOT NULL,
[PSR_Cal] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSR_Cajas] [smallint] NULL,
[PSR_CajasO] [smallint] NULL
);
GO

CREATE TABLE [dbo].[PS_SALREP02]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSRM_Login] [char](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSRM_Repa] [decimal](10,0) NOT NULL,
[PSRM_Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PSRM_Corr] [smallint] NOT NULL,
[PSRM_Cajas] [smallint] NULL
);
GO

CREATE TABLE [dbo].[PS_STOCK]
(
[EmpCod] [smallint] NOT NULL,
[PLogin] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[POricod] [smallint] NOT NULL,
[PProd] [char](6) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PCuar] [int] NOT NULL,
[PEspe] [smallint] NOT NULL,
[PVar] [int] NOT NULL,
[PEnv] [smallint] NOT NULL,
[PCond] [smallint] NOT NULL,
[PCant] [decimal](12,0) NULL,
[PKilos] [money] NULL,
[PValor] [decimal](12,0) NULL
);
GO

CREATE TABLE [dbo].[REPALETIZAJE1]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[REPNum] [decimal](10,0) NOT NULL,
[REP0Fol] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[REp0Espe] [smallint] NULL,
[Rep0Cajas] [smallint] NULL,
[REp0CajasR] [smallint] NULL,
[REP0CajasDes] [smallint] NULL,
[REP0Nsol] [decimal](10,0) NULL,
[REP0Calt] [smallint] NULL,
[REP0CBase] [smallint] NULL,
[REP0TipAct] [smallint] NULL
);
GO

CREATE TABLE [dbo].[REPALETIZAJE2]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[REPNum] [decimal](10,0) NOT NULL,
[REP0Fol] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[Rep1Corr] [smallint] NOT NULL,
[REP1Mov] [smallint] NOT NULL,
[REP1FecPro] [datetime] NULL,
[REP1Prod] [char](6) COLLATE Modern_Spanish_CI_AS NULL,
[REP1Espe] [smallint] NULL,
[Rep1Var] [int] NULL,
[REP1Env] [smallint] NULL,
[REP1Cat] [smallint] NULL,
[REP1Cal] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[REP1CajasINS] [smallint] NULL,
[REP1KilosINS] [money] NULL,
[REP1CajasRep] [smallint] NULL,
[REP1KilosRep] [money] NULL,
[REP1CajasDes] [smallint] NULL,
[Rep1KilosDes] [money] NULL
);
GO

CREATE TABLE [dbo].[REPFOLPROC]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FR0NumI] [decimal](10,0) NOT NULL,
[FR0Fecha] [datetime] NULL,
[FR0LoginC] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[FR0FecC] [datetime] NULL,
[FR0Estado] [smallint] NULL
);
GO

CREATE TABLE [dbo].[REPFOLPROC1]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FR0NumI] [decimal](10,0) NOT NULL,
[FR1Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FR1Espe] [smallint] NULL,
[FR1Cajas] [smallint] NULL,
[FR1CajasR] [smallint] NULL,
[FR1CajasF] [smallint] NULL,
[FR1Calt] [smallint] NULL,
[FR1CBase] [smallint] NULL,
[FR1CET] [smallint] NULL,
[FR1Exp] [smallint] NULL
);
GO

CREATE TABLE [dbo].[REPFOLPROC2]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FR0NumI] [decimal](10,0) NOT NULL,
[FR1Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[FR2Corr] [smallint] NOT NULL,
[FR2FecProc] [datetime] NULL,
[FR2PRod] [char](6) COLLATE Modern_Spanish_CI_AS NULL,
[FR2Espe] [smallint] NULL,
[FR2Var] [int] NULL,
[FR2Env] [smallint] NULL,
[FR2Cat] [smallint] NULL,
[FR2Cal] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[FR2Cajas] [smallint] NULL,
[FR2CajasR] [smallint] NULL,
[FR2CajasF] [smallint] NULL
);
GO

CREATE TABLE [dbo].[SOLICITUDES1]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[SolNum] [decimal](10,0) NOT NULL,
[SollogAP] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[SolFecAP] [datetime] NULL,
[SollogRE] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[SolFecRE] [datetime] NULL,
[Solfecha] [datetime] NULL,
[SolSolicita] [char](30) COLLATE Modern_Spanish_CI_AS NULL,
[SolDest] [smallint] NULL,
[solespe] [smallint] NULL,
[solDestinos] [char](100) COLLATE Modern_Spanish_CI_AS NULL,
[SolEstado] [smallint] NULL,
[sollogin] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[soltotcajas] [int] NULL,
[soltotkilos] [money] NULL,
[soltotpal] [int] NULL,
[solcajasRA] [int] NULL,
[SolcajasRB] [int] NULL,
[SolcajasRC] [int] NULL,
[SolTipo] [char](3) COLLATE Modern_Spanish_CI_AS NULL,
[SolnumI] [decimal](10,0) NULL
);
GO

CREATE TABLE [dbo].[SOLICITUDES2]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[SolNum] [decimal](10,0) NOT NULL,
[Sol2Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[Sol2Espe] [smallint] NULL,
[Sol2Dispo] [smallint] NULL,
[Sol2Cajas] [smallint] NULL,
[Sol2Kilos] [money] NULL,
[Sol2CajasREP] [smallint] NULL,
[Sol2KilosRep] [money] NULL,
[Sol2CajasDes] [smallint] NULL,
[Sol2KilosDes] [money] NULL,
[Sol2NumAnu] [decimal](10,0) NULL,
[Sol2CAlt] [smallint] NULL,
[Sol2CBase] [smallint] NULL,
[Sol2Ceti] [smallint] NULL
);
GO

CREATE TABLE [dbo].[SOLICITUDES3]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[SolNum] [decimal](10,0) NOT NULL,
[Sol2Folio] [char](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
[Sol3Corr] [smallint] NOT NULL,
[sol3fecha] [datetime] NULL,
[Sol3espe] [smallint] NULL,
[Sol3Var] [int] NULL,
[Sol3prod] [char](6) COLLATE Modern_Spanish_CI_AS NULL,
[Sol3Env] [smallint] NULL,
[Sol3CaT] [smallint] NULL,
[Sol3Cal] [char](10) COLLATE Modern_Spanish_CI_AS NULL,
[sol3Tipo] [smallint] NULL,
[Sol3Cajas] [smallint] NULL,
[Sol3Kilos] [money] NULL,
[Sol3CajasRep] [smallint] NULL,
[Sol3KilosRep] [money] NULL,
[Sol3CajasDes] [smallint] NULL,
[Sol3KilosDes] [money] NULL,
[Sol3Cuar] [int] NULL
);
GO

CREATE TABLE [integracion].[GuiaAcceso]
(
[TokenHash] [char](64) COLLATE Modern_Spanish_CI_AS NOT NULL,
[EmpCod] [int] NOT NULL,
[UsuLogin] [varchar](40) COLLATE Modern_Spanish_CI_AS NOT NULL,
[CreadoEn] [datetime2](0) CONSTRAINT [DF_GuiaAcceso_Creado] DEFAULT (sysutcdatetime()) NOT NULL,
[ExpiraEn] [datetime2](0) NOT NULL,
[ConsumidoEn] [datetime2](0) NULL
);
GO

CREATE TABLE [integracion].[PackingGuiaDatos]
(
[EmpCod] [smallint] NOT NULL,
[TempCod] [char](9) COLLATE Modern_Spanish_CI_AS NOT NULL,
[PackNumI] [decimal](10,0) NOT NULL,
[TransportistaNombre] [nvarchar](150) COLLATE Modern_Spanish_CI_AS NULL,
[TransportistaRut] [nvarchar](20) COLLATE Modern_Spanish_CI_AS NULL,
[PatenteCarro] [nvarchar](20) COLLATE Modern_Spanish_CI_AS NULL,
[FechaLlegada] [date] NULL,
[OrigenDireccion] [nvarchar](200) COLLATE Modern_Spanish_CI_AS NULL,
[OrigenComuna] [nvarchar](100) COLLATE Modern_Spanish_CI_AS NULL,
[DestinoDireccion] [nvarchar](200) COLLATE Modern_Spanish_CI_AS NULL,
[DestinoComuna] [nvarchar](100) COLLATE Modern_Spanish_CI_AS NULL,
[ActualizadoEn] [datetime2](0) CONSTRAINT [DF_PackingGuiaDatos_Actualizado] DEFAULT (sysutcdatetime()) NOT NULL
);
GO

-- Claves y restricciones
ALTER TABLE [dbo].[DESORIGEN1] ADD CONSTRAINT [PK__DESORIGEN1__5441852A] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [DorTipPlani] ASC, [DORNum] ASC, [dor1Folio] ASC);
GO
ALTER TABLE [dbo].[DESORIGEN2] ADD CONSTRAINT [PK__DESORIGEN2__5535A963] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [DorTipPlani] ASC, [DORNum] ASC, [dor1Folio] ASC, [Dor2Corr] ASC);
GO
ALTER TABLE [dbo].[DESTMP] ADD CONSTRAINT [PK__DESTMP__59063A47] PRIMARY KEY CLUSTERED ([DesMPCod] ASC);
GO
ALTER TABLE [dbo].[ENVMP] ADD CONSTRAINT [PK__ENVMP__5BE2A6F2] PRIMARY KEY CLUSTERED ([ENMTCod] ASC);
GO
ALTER TABLE [dbo].[FOLIOSPROC1] ADD CONSTRAINT [PK__FOLIOSPROC1__619B8048] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [FPFolio] ASC, [FP2NProc] ASC, [FP2Cor] ASC);
GO
ALTER TABLE [dbo].[HHSEMANAS] ADD CONSTRAINT [PK__HHSEMANAS__6383C8BA] PRIMARY KEY CLUSTERED ([HHSEMP] ASC, [HHSCor] ASC, [HHSTIPO] ASC);
GO
ALTER TABLE [dbo].[HISIN] ADD CONSTRAINT [PK__HISIN__6477ECF3] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [HisAAMM] ASC, [HisTipo] ASC, [HisOricod] ASC, [HisCuar] ASC, [HisProd] ASC, [Hisespe] ASC, [HisVar] ASC, [HisEnv] ASC, [HisCondi] ASC);
GO
ALTER TABLE [dbo].[HORARIOS] ADD CONSTRAINT [PK__HORARIOS__656C112C] PRIMARY KEY CLUSTERED ([HRini] ASC, [HRFin] ASC, [HRpausa] ASC);
GO
ALTER TABLE [dbo].[PAUSAS] ADD CONSTRAINT [PK__PAUSAS__6EF57B66] PRIMARY KEY CLUSTERED ([PAUCod] ASC);
GO
ALTER TABLE [dbo].[PROCUSDA] ADD CONSTRAINT [PK__PROCUSDA__70DDC3D8] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PUSTipo] ASC, [PUSNum] ASC);
GO
ALTER TABLE [dbo].[PROCUSDA2] ADD CONSTRAINT [PK__PROCUSDA2__72C60C4A] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PUSTipo] ASC, [PUSNum] ASC, [PUS1Folio] ASC, [PUS2Cor] ASC);
GO
ALTER TABLE [dbo].[PRODGEN] ADD CONSTRAINT [PK__PRODGEN__73BA3083] PRIMARY KEY CLUSTERED ([PRGCod] ASC);
GO
ALTER TABLE [dbo].[PS_INFCAL] ADD CONSTRAINT [PK__PS_INFCAL__787EE5A0] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PSC_login] ASC, [PSC_Expor] ASC, [PSC_Dest] ASC, [PSC_Prod] ASC, [PSC_Espe] ASC, [PSC_Var] ASC, [PSC_Env] ASC, [PSC_Cor] ASC);
GO
ALTER TABLE [dbo].[ETIQUETAPLANTILLA] ADD CONSTRAINT [PK_ETIQUETAPLANTILLA] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [ConfCod] ASC);
GO
ALTER TABLE [dbo].[PS_SALREP01] ADD CONSTRAINT [PK__PS_SALREP01__7A672E12] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PSR_Login] ASC, [PSR_NREp] ASC, [PSR_Espe] ASC, [PSR_Var] ASC, [PSR_Prod] ASC, [PSR_Env] ASC, [PSR_Cat] ASC, [PSR_Cal] ASC);
GO
ALTER TABLE [dbo].[PS_SALREP02] ADD CONSTRAINT [PK__PS_SALREP02__7B5B524B] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PSRM_Login] ASC, [PSRM_Repa] ASC, [PSRM_Folio] ASC, [PSRM_Corr] ASC);
GO
ALTER TABLE [dbo].[PS_STOCK] ADD CONSTRAINT [PK__PS_STOCK__7C4F7684] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [PLogin] ASC, [POricod] ASC, [PProd] ASC, [PCuar] ASC, [PEspe] ASC, [PVar] ASC, [PEnv] ASC, [PCond] ASC);
GO
ALTER TABLE [integracion].[GuiaAcceso] ADD CONSTRAINT [PK_GuiaAcceso] PRIMARY KEY CLUSTERED ([TokenHash] ASC);
GO
ALTER TABLE [dbo].[REPALETIZAJE1] ADD CONSTRAINT [PK__REPALETIZAJE1__7F2BE32F] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [REPNum] ASC, [REP0Fol] ASC);
GO
ALTER TABLE [dbo].[REPALETIZAJE2] ADD CONSTRAINT [PK__REPALETIZAJE2__00200768] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [REPNum] ASC, [REP0Fol] ASC, [Rep1Corr] ASC, [REP1Mov] ASC);
GO
ALTER TABLE [dbo].[REPFOLPROC] ADD CONSTRAINT [PK__REPFOLPROC__01142BA1] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [FR0NumI] ASC);
GO
ALTER TABLE [dbo].[REPFOLPROC1] ADD CONSTRAINT [PK__REPFOLPROC1__02084FDA] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [FR0NumI] ASC, [FR1Folio] ASC);
GO
ALTER TABLE [dbo].[PASOSOL] ADD CONSTRAINT [PK__PASOSOL__37703C52] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [PSSoluser] ASC, [PSSolprod] ASC, [PSSolCuar] ASC);
GO
ALTER TABLE [dbo].[REPFOLPROC2] ADD CONSTRAINT [PK__REPFOLPROC2__02FC7413] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [FR0NumI] ASC, [FR1Folio] ASC, [FR2Corr] ASC);
GO
ALTER TABLE [dbo].[SOLICITUDES2] ADD CONSTRAINT [PK__SOLICITUDES2__06CD04F7] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [SolNum] ASC, [Sol2Folio] ASC);
GO
ALTER TABLE [dbo].[SOLICITUDES3] ADD CONSTRAINT [PK__SOLICITUDES3__07C12930] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [SolNum] ASC, [Sol2Folio] ASC, [Sol3Corr] ASC);
GO
ALTER TABLE [dbo].[PALETIZA011] ADD CONSTRAINT [PK__PALETIZA011__3F115E1A] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PALFolio] ASC, [PAL2NCaja] ASC);
GO
ALTER TABLE [integracion].[PackingGuiaDatos] ADD CONSTRAINT [PK_PackingGuiaDatos] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PackNumI] ASC);
GO
ALTER TABLE [dbo].[GUIASD1] ADD CONSTRAINT [PK__GUIASD1__4E53A1AA] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [GuiNumInt] ASC, [Gui1Corr] ASC);
GO
ALTER TABLE [dbo].[DESCLI_FP1] ADD CONSTRAINT [PK__DESCLI_FP1__5AB9788F] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [DesOTNumI] ASC, [DesOT1Cor] ASC);
GO
ALTER TABLE [dbo].[GEN_ETIXCAL] ADD CONSTRAINT [PK__GEN_ETIXCAL__625A9A57] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [GETxCCodigo] ASC, [Especod] ASC);
GO
ALTER TABLE [dbo].[GEN_ETIXCAL1] ADD CONSTRAINT [PK__GEN_ETIXCAL1__6442E2C9] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [GETxCCodigo] ASC, [Especod] ASC, [Calibre] ASC);
GO
ALTER TABLE [dbo].[PS_INFG001] ADD CONSTRAINT [PK__PS_INFG001__55009F39] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PSI_Login] ASC, [PSI_Fecha] ASC, [PSI_Texto] ASC, [PSI_Num] ASC, [PSI_ID] ASC);
GO
ALTER TABLE [dbo].[FACTURA1] ADD CONSTRAINT [PK__FACTURA1__607251E5] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [FacNum] ASC, [Fac1Corr] ASC);
GO
ALTER TABLE [dbo].[SOLICITUDES1] ADD CONSTRAINT [PK__SOLICITUDES1__05D8E0BE] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [SolNum] ASC);
GO
ALTER TABLE [dbo].[FOLDIAGRAMA] ADD CONSTRAINT [PK__FOLDIAGRAMA__73852659] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [FolDNdoc] ASC);
GO
ALTER TABLE [dbo].[PS_DIAGRAMAS] ADD CONSTRAINT [PK__PS_DIAGRAMAS__7755B73D] PRIMARY KEY CLUSTERED ([EmpCod] ASC, [TempCod] ASC, [PSD_Login] ASC, [PSD_ID] ASC, [PSD_Folio] ASC, [PSD_Corr] ASC);
GO
ALTER TABLE [dbo].[ETIQUETAPLANTILLA] WITH CHECK ADD CONSTRAINT [CK_ETIQUETAPLANTILLA_Dpi] CHECK ([EtiDpi]=(600) OR [EtiDpi]=(300) OR [EtiDpi]=(203) OR [EtiDpi]=(152));
GO
ALTER TABLE [dbo].[ETIQUETAPLANTILLA] CHECK CONSTRAINT [CK_ETIQUETAPLANTILLA_Dpi];
GO
ALTER TABLE [dbo].[ETIQUETAPLANTILLA] WITH CHECK ADD CONSTRAINT [CK_ETIQUETAPLANTILLA_Json] CHECK (isjson([EtiDesignJson])=(1));
GO
ALTER TABLE [dbo].[ETIQUETAPLANTILLA] CHECK CONSTRAINT [CK_ETIQUETAPLANTILLA_Json];
GO
ALTER TABLE [dbo].[ETIQUETAPLANTILLA] WITH CHECK ADD CONSTRAINT [CK_ETIQUETAPLANTILLA_Medidas] CHECK ([EtiAnchoMm]>(0) AND [EtiAltoMm]>(0) AND [EtiAnchoDots]>(0) AND [EtiAltoDots]>(0));
GO
ALTER TABLE [dbo].[ETIQUETAPLANTILLA] CHECK CONSTRAINT [CK_ETIQUETAPLANTILLA_Medidas];
GO
ALTER TABLE [integracion].[PackingGuiaDatos] WITH CHECK ADD CONSTRAINT [FK_PackingGuiaDatos_Packing] FOREIGN KEY ([EmpCod], [TempCod], [PackNumI]) REFERENCES [dbo].[PACKLIST] ([EmpCod], [TempCod], [PackNumI]);
GO
ALTER TABLE [integracion].[PackingGuiaDatos] CHECK CONSTRAINT [FK_PackingGuiaDatos_Packing];
GO

-- Indices
CREATE NONCLUSTERED INDEX [IDESORIGEN13] ON [dbo].[DESORIGEN1] ([EmpCod] ASC, [dor1espe] ASC);
GO
CREATE NONCLUSTERED INDEX [IX_DESORIGEN1_PLANILLA] ON [dbo].[DESORIGEN1] ([EmpCod] ASC, [TempCod] ASC, [DorTipPlani] ASC, [DORNum] ASC, [dor1Folio] ASC);
GO
CREATE NONCLUSTERED INDEX [IDESORIGEN23] ON [dbo].[DESORIGEN2] ([EmpCod] ASC, [Dor2env] ASC, [Dor2cat] ASC);
GO
CREATE NONCLUSTERED INDEX [IDESORIGEN24] ON [dbo].[DESORIGEN2] ([EmpCod] ASC, [Dor2Prod] ASC);
GO
CREATE NONCLUSTERED INDEX [IDESORIGEN25] ON [dbo].[DESORIGEN2] ([EmpCod] ASC, [Dor2espe] ASC, [Dor2var] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_PLANISAG] ON [dbo].[DESORIGEN2] ([EmpCod] ASC, [TempCod] ASC, [DorTipPlani] ASC, [DORNum] ASC, [Dor2espe] ASC, [Dor2var] ASC, [Dor2env] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_DPLANIPROD] ON [dbo].[DESORIGEN2] ([EmpCod] ASC, [TempCod] ASC, [DorTipPlani] ASC, [DORNum] ASC, [Dor2espe] ASC, [Dor2var] ASC, [Dor2Prod] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_DESPACK] ON [dbo].[DESORIGEN2] ([EmpCod] ASC, [TempCod] ASC, [DorTipPlani] ASC, [DORNum] ASC, [Dor2espe] ASC, [dor1Folio] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_DESCALIBRE] ON [dbo].[DESORIGEN2] ([EmpCod] ASC, [TempCod] ASC, [DORNum] ASC, [Dor2espe] ASC, [Dor2var] ASC, [Dor2env] ASC, [Dor2cat] ASC, [Dor2cal] ASC);
GO
CREATE NONCLUSTERED INDEX [IX_DESORIGEN2_PLANILLA] ON [dbo].[DESORIGEN2] ([EmpCod] ASC, [TempCod] ASC, [DorTipPlani] ASC, [DORNum] ASC, [dor1Folio] ASC, [Dor2Corr] ASC);
GO
CREATE UNIQUE NONCLUSTERED INDEX [PK_OrdenImpresion] ON [dbo].[OrdenImpresion] ([OPLCID] ASC);
GO
CREATE NONCLUSTERED INDEX [IX_OrdenImpresion_Pendientes] ON [dbo].[OrdenImpresion] ([OPLCProc] ASC, [OPLCFechaIns] ASC, [OPLCID] ASC) INCLUDE ([OPLCIMP]);
GO
CREATE NONCLUSTERED INDEX [IFOLIOSPROC12] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [fp2especod] ASC, [fp2varcod] ASC);
GO
CREATE NONCLUSTERED INDEX [IFOLIOSPROC13] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [fp2especod] ASC, [Calibre] ASC);
GO
CREATE NONCLUSTERED INDEX [IFOLIOSPROC14] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [EnvCod] ASC, [Catcod] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_VERIFOLIO] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [TempCod] ASC, [FPFolio] ASC, [FP2Fecha] ASC, [fp2especod] ASC, [fp2varcod] ASC, [ProdCod] ASC, [EnvCod] ASC, [Catcod] ASC, [Calibre] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_CORFOL] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [TempCod] ASC, [FPFolio] ASC, [FP2NProc] ASC, [FP2Cor] DESC);
GO
CREATE NONCLUSTERED INDEX [IND_FOLFECHA] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [TempCod] ASC, [FP2Fecha] ASC, [fp2especod] ASC, [fp2varcod] ASC, [FPFolio] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_FOLPROC] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [TempCod] ASC, [fp2especod] ASC, [fp2varcod] ASC, [FPFolio] ASC, [FP2Fecha] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_ESPEFOL] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [TempCod] ASC, [fp2especod] ASC, [FPFolio] ASC, [FP2Fecha] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_INFCAL] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [TempCod] ASC, [fp2expcod] ASC, [ProdCod] ASC, [fp2especod] ASC, [fp2varcod] ASC, [EnvCod] ASC, [Catcod] ASC, [Calibre] ASC);
GO
CREATE NONCLUSTERED INDEX [IFOLIOSPROC17] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [fp2expcod] ASC, [ProdCod] ASC);
GO
CREATE NONCLUSTERED INDEX [IFOLIOSPROC15] ON [dbo].[FOLIOSPROC1] ([EmpCod] ASC, [ProdCod] ASC, [CuarCod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPROCUSDA1] ON [dbo].[PROCUSDA] ([EmpCod] ASC, [PUSEspe] ASC);
GO
CREATE NONCLUSTERED INDEX [IPROCUSDA22] ON [dbo].[PROCUSDA2] ([EmpCod] ASC, [Especod] ASC, [Calibre] ASC);
GO
CREATE NONCLUSTERED INDEX [IPROCUSDA23] ON [dbo].[PROCUSDA2] ([EmpCod] ASC, [Especod] ASC, [VarCod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPROCUSDA24] ON [dbo].[PROCUSDA2] ([EmpCod] ASC, [EnvCod] ASC, [Catcod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPROCUSDA25] ON [dbo].[PROCUSDA2] ([EmpCod] ASC, [ProdCod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPS_INFCAL1] ON [dbo].[PS_INFCAL] ([EmpCod] ASC, [PSC_Env] ASC);
GO
CREATE NONCLUSTERED INDEX [IPS_INFCAL2] ON [dbo].[PS_INFCAL] ([EmpCod] ASC, [PSC_Espe] ASC, [PSC_Var] ASC);
GO
CREATE NONCLUSTERED INDEX [IPS_INFCAL3] ON [dbo].[PS_INFCAL] ([EmpCod] ASC, [PSC_Prod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPS_INFCAL4] ON [dbo].[PS_INFCAL] ([PSC_Dest] ASC);
GO
CREATE NONCLUSTERED INDEX [IPS_INFCAL5] ON [dbo].[PS_INFCAL] ([EmpCod] ASC, [PSC_Expor] ASC);
GO
CREATE NONCLUSTERED INDEX [IX_ETIQUETAPLANTILLA_Activa] ON [dbo].[ETIQUETAPLANTILLA] ([EmpCod] ASC, [EtiActiva] ASC, [ConfCod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPS_SALREP011] ON [dbo].[PS_SALREP01] ([EmpCod] ASC, [PSR_Env] ASC, [PSR_Cat] ASC);
GO
CREATE NONCLUSTERED INDEX [IPS_SALREP012] ON [dbo].[PS_SALREP01] ([EmpCod] ASC, [PSR_Prod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPS_SALREP013] ON [dbo].[PS_SALREP01] ([EmpCod] ASC, [PSR_Espe] ASC, [PSR_Var] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPALETIZAJE12] ON [dbo].[REPALETIZAJE1] ([EmpCod] ASC, [REp0Espe] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPALETIZAJE14] ON [dbo].[REPALETIZAJE1] ([EmpCod] ASC, [REP0CBase] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPALETIZAJE15] ON [dbo].[REPALETIZAJE1] ([EmpCod] ASC, [REP0Calt] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPALETIZAJE21] ON [dbo].[REPALETIZAJE2] ([EmpCod] ASC, [REP1Env] ASC, [REP1Cat] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPALETIZAJE22] ON [dbo].[REPALETIZAJE2] ([EmpCod] ASC, [REP1Espe] ASC, [Rep1Var] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPALETIZAJE23] ON [dbo].[REPALETIZAJE2] ([EmpCod] ASC, [REP1Prod] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_DATOSCAJAS] ON [dbo].[REPALETIZAJE2] ([EmpCod] ASC, [TempCod] ASC, [REP0Fol] ASC, [Rep1Var] ASC, [REP1Prod] ASC, [REP1Env] ASC, [REP1Cat] ASC, [REP1Cal] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPFOLPROC13] ON [dbo].[REPFOLPROC1] ([EmpCod] ASC, [FR1CBase] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPFOLPROC14] ON [dbo].[REPFOLPROC1] ([EmpCod] ASC, [FR1Calt] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPFOLPROC15] ON [dbo].[REPFOLPROC1] ([EmpCod] ASC, [FR1Espe] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPFOLPROC22] ON [dbo].[REPFOLPROC2] ([EmpCod] ASC, [FR2Env] ASC, [FR2Cat] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPFOLPROC23] ON [dbo].[REPFOLPROC2] ([EmpCod] ASC, [FR2Espe] ASC, [FR2Var] ASC);
GO
CREATE NONCLUSTERED INDEX [IREPFOLPROC24] ON [dbo].[REPFOLPROC2] ([EmpCod] ASC, [FR2PRod] ASC);
GO
CREATE NONCLUSTERED INDEX [ITAB_SOLICITUD1] ON [dbo].[SOLICITUDES2] ([EmpCod] ASC, [Sol2Espe] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_ESPE] ON [dbo].[SOLICITUDES2] ([EmpCod] ASC, [TempCod] ASC, [Sol2Espe] ASC, [Sol2Folio] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_SOLFOLANU] ON [dbo].[SOLICITUDES2] ([EmpCod] ASC, [TempCod] ASC, [Sol2NumAnu] ASC);
GO
CREATE NONCLUSTERED INDEX [ISOLICITUDES2] ON [dbo].[SOLICITUDES2] ([EmpCod] ASC, [Sol2Ceti] ASC);
GO
CREATE NONCLUSTERED INDEX [ISOLICITUDES21] ON [dbo].[SOLICITUDES2] ([EmpCod] ASC, [Sol2CBase] ASC);
GO
CREATE NONCLUSTERED INDEX [ISOLICITUDES22] ON [dbo].[SOLICITUDES2] ([EmpCod] ASC, [Sol2CAlt] ASC);
GO
CREATE NONCLUSTERED INDEX [ISOLICITUDES32] ON [dbo].[SOLICITUDES3] ([EmpCod] ASC, [Sol3Env] ASC, [Sol3CaT] ASC);
GO
CREATE NONCLUSTERED INDEX [ISOLICITUDES33] ON [dbo].[SOLICITUDES3] ([EmpCod] ASC, [Sol3prod] ASC);
GO
CREATE NONCLUSTERED INDEX [ISOLICITUDES34] ON [dbo].[SOLICITUDES3] ([EmpCod] ASC, [Sol3espe] ASC, [Sol3Var] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_SOLDATOSCAJ] ON [dbo].[SOLICITUDES3] ([EmpCod] ASC, [TempCod] ASC, [Sol2Folio] ASC, [Sol3Var] ASC, [Sol3prod] ASC, [Sol3Env] ASC, [Sol3CaT] ASC, [Sol3Cal] ASC);
GO
CREATE NONCLUSTERED INDEX [IPALETIZA0113] ON [dbo].[PALETIZA011] ([EmpCod] ASC, [Especod] ASC, [Calibre] ASC);
GO
CREATE NONCLUSTERED INDEX [IPALETIZA0114] ON [dbo].[PALETIZA011] ([EmpCod] ASC, [EnvCod] ASC, [Catcod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPALETIZA0115] ON [dbo].[PALETIZA011] ([EmpCod] ASC, [ProdCod] ASC);
GO
CREATE NONCLUSTERED INDEX [IPALETIZA0116] ON [dbo].[PALETIZA011] ([EmpCod] ASC, [Especod] ASC, [VarCod] ASC);
GO
CREATE NONCLUSTERED INDEX [ISOLICITUDES] ON [dbo].[SOLICITUDES1] ([EmpCod] ASC, [solespe] ASC);
GO
CREATE NONCLUSTERED INDEX [ISOLICITUDES1] ON [dbo].[SOLICITUDES1] ([SolDest] ASC);
GO
CREATE NONCLUSTERED INDEX [IND_SOLFEC] ON [dbo].[SOLICITUDES1] ([EmpCod] ASC, [TempCod] ASC, [Solfecha] ASC, [solespe] ASC);
GO

-- Trigger legado: se crea igual que en la base de referencia y queda deshabilitado.
-- =============================================
-- Author:		MAV
-- Create date: 07/08/2018
-- Description:	Imprime Etiquetaa
-- =============================================
CREATE TRIGGER [Imprime]
   ON  [dbo].[OrdenImpresion] 
   AFTER INSERT
AS 
BEGIN
	DECLARE @parametro1 char(2)
	declare @llamado char(100)

	SET NOCOUNT ON;

	--@parametro1 = '1' --convert(char(2), OPLCImp , 103)
    -- Insert statements for trigger here
	set @llamado = '"E:\Viña AT\CONEX\FuentesSQL\AIMPRIMEETBD.EXE" 1"'
	Exec xp_cmdshell @llamado --- "'--+@parametro1+'"'
 
END
GO
DISABLE TRIGGER [Imprime] ON [dbo].[OrdenImpresion];
GO

/*
  Persiste los datos de la transaccion DATMP del objeto MultiPuerto.xpz.
  La llave replica el nivel de la transaccion GeneXus: empresa, temporada y
  numero de planilla interna del despacho.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.DATMP', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DATMP
  (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    DMPPlani decimal(10,0) NOT NULL,
    TRACod int NULL,
    TRANom char(30) NULL,
    INACCod int NULL,
    INACNom char(50) NULL,
    DMPFecTra datetime NULL,
    DMPConTra char(50) NULL,
    DMPDuraTra char(50) NULL,
    TTMPCod int NULL,
    TTMPNom char(30) NULL,
    DMPNSello1 char(30) NULL,
    DMPNSello2 char(30) NULL,
    DMPNSello3 char(30) NULL,
    DMPNSello4 char(30) NULL,
    DMPUbi1 int NULL,
    DMPUbi2 int NULL,
    DMPUbi3 int NULL,
    DMPUbi4 int NULL,
    CONSTRAINT PK_DATMP PRIMARY KEY (EmpCod,TempCod,DMPPlani)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.DATMP') AND name=N'IX_DATMP_TTMPCod')
  CREATE INDEX IX_DATMP_TTMPCod ON dbo.DATMP (TTMPCod);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.DATMP') AND name=N'IX_DATMP_INACCod')
  CREATE INDEX IX_DATMP_INACCod ON dbo.DATMP (INACCod);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.DATMP') AND name=N'IX_DATMP_TRACod')
  CREATE INDEX IX_DATMP_TRACod ON dbo.DATMP (TRACod);

IF OBJECT_ID(N'dbo.TipoTransMP', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TipoTransMP
  (
    TTMPCod int NOT NULL,
    TTMPNom char(30) NULL,
    CONSTRAINT PK_TipoTransMP PRIMARY KEY (TTMPCod)
  );
END;

COMMIT TRANSACTION;

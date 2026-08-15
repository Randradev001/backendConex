/* Modelo operacional normalizado para controles de calidad por lote. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.CALRECEP', 'U') IS NULL
BEGIN
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
    CalRecObservacion varchar(1000) NULL,
    CalRecEstado char(1) NOT NULL CONSTRAINT DF_CALRECEP_Estado DEFAULT ('D'),
    CalRecLoginC char(10) NOT NULL,
    CalRecFecC datetime NOT NULL CONSTRAINT DF_CALRECEP_FecC DEFAULT (GETDATE()),
    CalRecLoginUPD char(10) NULL,
    CalRecFecUPD datetime NULL,
    CONSTRAINT PK_CALRECEP PRIMARY KEY (EmpCod,CalRecId),
    CONSTRAINT FK_CALRECEP_MOVFRUT1 FOREIGN KEY (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,Mov1Nlote)
      REFERENCES dbo.MOVFRUT1 (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,Mov1Nlote),
    CONSTRAINT CK_CALRECEP_Muestra CHECK (CalRecTamMuestra > 0),
    CONSTRAINT CK_CALRECEP_Estado CHECK (CalRecEstado IN ('D','F','A'))
  );
  CREATE INDEX IX_CALRECEP_Lote ON dbo.CALRECEP (EmpCod,TempCod,OriCod,MovTDoc,MovNGuia,MovProd,Mov1Nlote,CalRecFecha DESC);
END;

IF OBJECT_ID('dbo.CALRECEPDANO', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CALRECEPDANO (
    EmpCod smallint NOT NULL,CalRecId bigint NOT NULL,Especod smallint NOT NULL,
    MADanCod smallint NOT NULL,CalDanFrutos int NOT NULL,
    CONSTRAINT PK_CALRECEPDANO PRIMARY KEY (EmpCod,CalRecId,MADanCod),
    CONSTRAINT FK_CALRECEPDANO_Control FOREIGN KEY (EmpCod,CalRecId) REFERENCES dbo.CALRECEP(EmpCod,CalRecId) ON DELETE CASCADE,
    CONSTRAINT FK_CALRECEPDANO_Maestro FOREIGN KEY (EmpCod,Especod,MADanCod) REFERENCES dbo.MAdanos(EmpCod,Especod,MADanCod),
    CONSTRAINT CK_CALRECEPDANO_Frutos CHECK (CalDanFrutos >= 0)
  );
END;

IF OBJECT_ID('dbo.CALRECEPCALIBRE', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CALRECEPCALIBRE (
    EmpCod smallint NOT NULL,CalRecId bigint NOT NULL,Especod smallint NOT NULL,
    Calibre char(10) NOT NULL,CalPorcentaje decimal(7,2) NULL,CalPreCalibre decimal(7,2) NULL,
    CONSTRAINT PK_CALRECEPCALIBRE PRIMARY KEY (EmpCod,CalRecId,Calibre),
    CONSTRAINT FK_CALRECEPCALIBRE_Control FOREIGN KEY (EmpCod,CalRecId) REFERENCES dbo.CALRECEP(EmpCod,CalRecId) ON DELETE CASCADE,
    CONSTRAINT FK_CALRECEPCALIBRE_Maestro FOREIGN KEY (EmpCod,Especod,Calibre) REFERENCES dbo.CALIBRES(EmpCod,Especod,Calibre)
  );
END;

IF OBJECT_ID('dbo.CALRECEPCOLOR', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CALRECEPCOLOR (
    EmpCod smallint NOT NULL,CalRecId bigint NOT NULL,CalColor char(2) NOT NULL,
    CalRojoClaro decimal(7,2) NULL,CalRojoOscuro decimal(7,2) NULL,
    CONSTRAINT PK_CALRECEPCOLOR PRIMARY KEY (EmpCod,CalRecId,CalColor),
    CONSTRAINT FK_CALRECEPCOLOR_Control FOREIGN KEY (EmpCod,CalRecId) REFERENCES dbo.CALRECEP(EmpCod,CalRecId) ON DELETE CASCADE,
    CONSTRAINT CK_CALRECEPCOLOR_Color CHECK (CalColor IN ('G','M','CH','SS'))
  );
END;

IF OBJECT_ID('dbo.CALRECEPPLAGA', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CALRECEPPLAGA (
    EmpCod smallint NOT NULL,CalRecId bigint NOT NULL,Especod smallint NOT NULL,MAPlaCod int NOT NULL,
    CONSTRAINT PK_CALRECEPPLAGA PRIMARY KEY (EmpCod,CalRecId,MAPlaCod),
    CONSTRAINT FK_CALRECEPPLAGA_Control FOREIGN KEY (EmpCod,CalRecId) REFERENCES dbo.CALRECEP(EmpCod,CalRecId) ON DELETE CASCADE,
    CONSTRAINT FK_CALRECEPPLAGA_Maestro FOREIGN KEY (EmpCod,Especod,MAPlaCod) REFERENCES dbo.MAPlagas(EmpCod,Especod,MAPlaCod)
  );
END;

COMMIT TRANSACTION;

SELECT name FROM sys.tables WHERE name IN ('CALRECEP','CALRECEPDANO','CALRECEPCALIBRE','CALRECEPCOLOR','CALRECEPPLAGA') ORDER BY name;

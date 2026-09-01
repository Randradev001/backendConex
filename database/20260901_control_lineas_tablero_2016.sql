/*
  Soporte aditivo y repetible para el tablero Control de lineas.
  Compatible con SQL Server 2016. Conserva nombres y tipos fisicos GX8.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.LINEAS', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.LINEAS
  (
    EmpCod smallint NOT NULL,
    LinMaquina smallint NOT NULL,
    LinID smallint NOT NULL,
    LinDesc char(20) NULL,
    LinPerCod int NULL,
    LinUbica char(20) NULL,
    LinPC char(20) NULL,
    LinEstado smallint NULL,
    LinEstConf smallint NULL,
    CONSTRAINT PK_LINEAS PRIMARY KEY (EmpCod, LinMaquina, LinID)
  );
END;

IF OBJECT_ID(N'dbo.LINCONFIG', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.LINCONFIG
  (
    EmpCod smallint NOT NULL,
    LinMaquina smallint NOT NULL,
    LinID smallint NOT NULL,
    ConfID smallint NOT NULL,
    Especod smallint NULL,
    Calibre char(10) NULL,
    EnvCod smallint NULL,
    Catcod smallint NULL,
    ConfEstado smallint NULL,
    LConfFecLog datetime NULL,
    LConfLogin char(10) NULL,
    LConfCodPer smallint NULL,
    CONSTRAINT PK_LINCONFIG PRIMARY KEY (EmpCod, LinMaquina, LinID, ConfID)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.LINEAS') AND name=N'IX_LINEAS_EMPRESA_PC')
  CREATE INDEX IX_LINEAS_EMPRESA_PC ON dbo.LINEAS (EmpCod, LinPC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.LINCONFIG') AND name=N'IX_LINCONFIG_ENVASE_CATEGORIA')
  CREATE INDEX IX_LINCONFIG_ENVASE_CATEGORIA ON dbo.LINCONFIG (EmpCod, EnvCod, Catcod);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.LINCONFIG') AND name=N'IX_LINCONFIG_ESPECIE_CALIBRE')
  CREATE INDEX IX_LINCONFIG_ESPECIE_CALIBRE ON dbo.LINCONFIG (EmpCod, Especod, Calibre);

IF OBJECT_ID(N'dbo.SISTEMAS', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.SISTEMAS WHERE SistCod=100)
BEGIN
  INSERT INTO dbo.SISTEMAS (SistCod, SistNombre, SistFecCrea)
  VALUES (100, 'Control de Produccion Fruticola', GETDATE());
END;

IF OBJECT_ID(N'dbo.MODULOS', N'U') IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.SISTEMAS WHERE SistCod=100)
  AND NOT EXISTS (SELECT 1 FROM dbo.MODULOS WHERE SistCod=100 AND Modcod=6)
BEGIN
  INSERT INTO dbo.MODULOS (SistCod, Modcod, ModTipo, Modprg, ModDes, ModFcrea)
  VALUES (100, 6, 1, 'uGETI10006', 'Etiquetado de Cajas', GETDATE());
END;

IF OBJECT_ID(N'dbo.PROGRAM', N'U') IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.MODULOS WHERE SistCod=100 AND Modcod=6)
  AND NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=6 AND ProgCod=11)
BEGIN
  INSERT INTO dbo.PROGRAM
    (SistCod, Modcod, ProgCod, ProgDes, ProgFcrea, ProgTipo, ProgNomGX, ProgIDmenu, ProgTarget)
  VALUES
    (100, 6, 11, 'Configuracion de Lineas de Proceso', GETDATE(), 1, 'wlinconfig', NULL, NULL);
END;

IF OBJECT_ID(N'dbo.PROGRAM1', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM1 WHERE SistCod=100 AND Modcod=6 AND ProgCod=11 AND ProgOPCod=1)
    INSERT INTO dbo.PROGRAM1 (SistCod, Modcod, ProgCod, ProgOPCod, ProgOPDes) VALUES (100, 6, 11, 1, 'crea');
  IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM1 WHERE SistCod=100 AND Modcod=6 AND ProgCod=11 AND ProgOPCod=2)
    INSERT INTO dbo.PROGRAM1 (SistCod, Modcod, ProgCod, ProgOPCod, ProgOPDes) VALUES (100, 6, 11, 2, 'modifica');
  IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM1 WHERE SistCod=100 AND Modcod=6 AND ProgCod=11 AND ProgOPCod=3)
    INSERT INTO dbo.PROGRAM1 (SistCod, Modcod, ProgCod, ProgOPCod, ProgOPDes) VALUES (100, 6, 11, 3, 'elimina');
END;

SELECT
  OBJECT_ID(N'dbo.LINEAS', N'U') AS LineasObjectId,
  OBJECT_ID(N'dbo.LINCONFIG', N'U') AS LinConfigObjectId,
  CASE WHEN EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=6 AND ProgCod=11) THEN 1 ELSE 0 END AS ProgramaRegistrado;

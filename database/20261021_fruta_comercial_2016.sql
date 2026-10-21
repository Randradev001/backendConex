/*
  FComercial / Fruta Comercial
  Fuente: FComercial.xpz (GX8) y esquema productivo CONEX.
  El script es aditivo e idempotente: no elimina columnas ni registros.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.FCOMERCIAL', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.FCOMERCIAL
  (
    EmpCod smallint NOT NULL,
    TempCod char(9) NOT NULL,
    FCOProceso decimal(10,0) NOT NULL,
    FCONumI decimal(10,0) NOT NULL,
    FCOFecha datetime NULL,
    FCOLoginI char(10) NULL,
    FCOFecC datetime NULL,
    TMcod smallint NULL,
    TMSCod smallint NULL,
    FCONEnv smallint NULL,
    FCOKilos money NULL,
    Especod smallint NULL,
    VarCod int NULL,
    FCOOBS char(50) NULL,
    FCOOrigen smallint NULL,
    CONSTRAINT PK_FCOMERCIAL PRIMARY KEY (EmpCod,TempCod,FCOProceso,FCONumI)
  );
END;

/* Instalaciones antiguas dejaron una tabla mínima. Completarla sin tocar datos. */
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'TempCod') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD TempCod char(9) NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCOProceso') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCOProceso decimal(10,0) NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCONumI') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCONumI decimal(10,0) NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCOFecha') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCOFecha datetime NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCOLoginI') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCOLoginI char(10) NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCOFecC') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCOFecC datetime NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'TMSCod') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD TMSCod smallint NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCONEnv') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCONEnv smallint NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCOKilos') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCOKilos money NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'Especod') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD Especod smallint NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'VarCod') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD VarCod int NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCOOBS') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCOOBS char(50) NULL;
IF COL_LENGTH(N'dbo.FCOMERCIAL', N'FCOOrigen') IS NULL ALTER TABLE dbo.FCOMERCIAL ADD FCOOrigen smallint NULL;

/* La tabla mínima original declaraba EmpCod nullable. Solo endurecer la clave si no hay filas incompletas. */
IF NOT EXISTS (
  SELECT 1 FROM dbo.FCOMERCIAL
  WHERE EmpCod IS NULL OR TempCod IS NULL OR FCOProceso IS NULL OR FCONumI IS NULL
)
BEGIN
  ALTER TABLE dbo.FCOMERCIAL ALTER COLUMN EmpCod smallint NOT NULL;
  ALTER TABLE dbo.FCOMERCIAL ALTER COLUMN TempCod char(9) NOT NULL;
  ALTER TABLE dbo.FCOMERCIAL ALTER COLUMN FCOProceso decimal(10,0) NOT NULL;
  ALTER TABLE dbo.FCOMERCIAL ALTER COLUMN FCONumI decimal(10,0) NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FCOMERCIAL') AND name=N'PK_FCOMERCIAL')
   AND NOT EXISTS (
     SELECT 1 FROM dbo.FCOMERCIAL
     WHERE EmpCod IS NULL OR TempCod IS NULL OR FCOProceso IS NULL OR FCONumI IS NULL
   )
   AND NOT EXISTS (
     SELECT EmpCod,TempCod,FCOProceso,FCONumI FROM dbo.FCOMERCIAL
     GROUP BY EmpCod,TempCod,FCOProceso,FCONumI HAVING COUNT(*)>1
   )
BEGIN
  ALTER TABLE dbo.FCOMERCIAL ADD CONSTRAINT PK_FCOMERCIAL PRIMARY KEY (EmpCod,TempCod,FCOProceso,FCONumI);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FCOMERCIAL') AND name=N'IFComercial2')
  CREATE INDEX IFComercial2 ON dbo.FCOMERCIAL (EmpCod,TMcod,TMSCod);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FCOMERCIAL') AND name=N'IFComercial3')
  CREATE INDEX IFComercial3 ON dbo.FCOMERCIAL (EmpCod,TempCod);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FCOMERCIAL') AND name=N'ind_FCOfecha')
  CREATE INDEX ind_FCOfecha ON dbo.FCOMERCIAL (EmpCod,TempCod,FCOFecha,FCOProceso,Especod);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FCOMERCIAL') AND name=N'IFComercial4')
  CREATE INDEX IFComercial4 ON dbo.FCOMERCIAL (EmpCod,Especod);

/* Programa y acciones requeridas por el backend: 100/2/6. */
IF OBJECT_ID(N'dbo.PROGRAM', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM dbo.MODULOS WHERE SistCod=100 AND Modcod=2)
   AND NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=2 AND ProgCod=6)
BEGIN
  INSERT INTO dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea)
  VALUES (100,2,6,'Control Fruta Comercial','wFCOMERCIAL',1,CAST(GETDATE() AS date));
END;

IF OBJECT_ID(N'dbo.PROGRAM1', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=2 AND ProgCod=6)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM1 WHERE SistCod=100 AND Modcod=2 AND ProgCod=6 AND ProgOPCod=1)
    INSERT INTO dbo.PROGRAM1 (SistCod,Modcod,ProgCod,ProgOPCod,ProgOPDes) VALUES (100,2,6,1,'crea');
  IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM1 WHERE SistCod=100 AND Modcod=2 AND ProgCod=6 AND ProgOPCod=2)
    INSERT INTO dbo.PROGRAM1 (SistCod,Modcod,ProgCod,ProgOPCod,ProgOPDes) VALUES (100,2,6,2,'modifica');
  IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM1 WHERE SistCod=100 AND Modcod=2 AND ProgCod=6 AND ProgOPCod=3)
    INSERT INTO dbo.PROGRAM1 (SistCod,Modcod,ProgCod,ProgOPCod,ProgOPDes) VALUES (100,2,6,3,'anula');
END;

COMMIT TRANSACTION;

SELECT OBJECT_ID(N'dbo.FCOMERCIAL', N'U') AS FComercialObjectId,
  CASE WHEN EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=2 AND ProgCod=6) THEN 1 ELSE 0 END AS ProgramaRegistrado,
  (SELECT COUNT(*) FROM dbo.PROGRAM1 WHERE SistCod=100 AND Modcod=2 AND ProgCod=6) AS AccionesRegistradas;

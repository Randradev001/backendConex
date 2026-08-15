/* Maestro por especie para hallazgos seleccionables en control de recepcion. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.MAPlagas', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MAPlagas (
    EmpCod smallint NOT NULL,
    Especod smallint NOT NULL,
    MAPlaCod int NOT NULL,
    MAPlaTipo varchar(10) NOT NULL,
    MAPlaDes varchar(60) NOT NULL,
    MAPlaOrden int NOT NULL,
    MAPlaActivo int NOT NULL CONSTRAINT DF_MAPlagas_Activo DEFAULT (1),
    CONSTRAINT PK_MAPlagas PRIMARY KEY (EmpCod,Especod,MAPlaCod),
    CONSTRAINT UQ_MAPlagas_Descripcion UNIQUE (EmpCod,Especod,MAPlaTipo,MAPlaDes),
    CONSTRAINT FK_MAPlagas_Especies FOREIGN KEY (EmpCod,Especod)
      REFERENCES dbo.ESPECIES (EmpCod,Especod),
    CONSTRAINT CK_MAPlagas_Tipo CHECK (MAPlaTipo IN ('PLAGA','VIRUS','DIPTERO')),
    CONSTRAINT CK_MAPlagas_Activo CHECK (MAPlaActivo IN (0,1)),
    CONSTRAINT CK_MAPlagas_Codigo CHECK (MAPlaCod > 0),
    CONSTRAINT CK_MAPlagas_Orden CHECK (MAPlaOrden > 0)
  );
END;

IF EXISTS (SELECT 1 FROM dbo.ESPECIES WHERE EmpCod=1 AND Especod=1)
BEGIN
  DECLARE @Ejemplos TABLE (MAPlaCod int,MAPlaTipo varchar(10),MAPlaDes varchar(60),MAPlaOrden int);
  INSERT @Ejemplos VALUES
    (1,'PLAGA','Chanchito blanco',1),
    (2,'PLAGA','Arañita roja',2),
    (3,'PLAGA','Escama de San José',3),
    (4,'VIRUS','Virus PNRSV',4),
    (5,'VIRUS','Virus PDV',5),
    (6,'DIPTERO','Drosophila suzukii',6),
    (7,'DIPTERO','Rhagoletis cerasi',7),
    (8,'DIPTERO','Ceratitis capitata',8);

  INSERT dbo.MAPlagas (EmpCod,Especod,MAPlaCod,MAPlaTipo,MAPlaDes,MAPlaOrden,MAPlaActivo)
  SELECT 1,1,e.MAPlaCod,e.MAPlaTipo,e.MAPlaDes,e.MAPlaOrden,1
  FROM @Ejemplos e
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.MAPlagas m WHERE m.EmpCod=1 AND m.Especod=1 AND m.MAPlaCod=e.MAPlaCod
  );
END;

COMMIT TRANSACTION;

SELECT EmpCod,Especod,MAPlaCod,MAPlaTipo,MAPlaDes,MAPlaOrden,MAPlaActivo
FROM dbo.MAPlagas WHERE EmpCod=1 AND Especod=1 ORDER BY MAPlaOrden,MAPlaCod;

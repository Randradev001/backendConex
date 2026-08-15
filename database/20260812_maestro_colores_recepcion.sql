SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.MAColores', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MAColores (
    EmpCod smallint NOT NULL,
    Especod smallint NOT NULL,
    MAColCod char(2) NOT NULL,
    MAColDes varchar(40) NOT NULL,
    MAColOrden smallint NOT NULL,
    MAColPremium int NOT NULL CONSTRAINT DF_MAColores_Premium DEFAULT (1),
    MAColActivo int NOT NULL CONSTRAINT DF_MAColores_Activo DEFAULT (1),
    CONSTRAINT PK_MAColores PRIMARY KEY (EmpCod,Especod,MAColCod),
    CONSTRAINT UQ_MAColores_Descripcion UNIQUE (EmpCod,Especod,MAColDes),
    CONSTRAINT FK_MAColores_Especies FOREIGN KEY (EmpCod,Especod) REFERENCES dbo.ESPECIES(EmpCod,Especod),
    CONSTRAINT CK_MAColores_Orden CHECK (MAColOrden > 0),
    CONSTRAINT CK_MAColores_Premium CHECK (MAColPremium IN (0,1)),
    CONSTRAINT CK_MAColores_Activo CHECK (MAColActivo IN (0,1))
  );
END;

;WITH SpeciesUsed AS (
  SELECT EmpCod,Especod FROM dbo.ESPECIES
), Defaults AS (
  SELECT 'G' code,'G' description,1 sortOrder,0 premium UNION ALL
  SELECT 'M','M',2,1 UNION ALL SELECT 'CH','CH',3,1 UNION ALL SELECT 'SS','SS',4,1
)
INSERT dbo.MAColores(EmpCod,Especod,MAColCod,MAColDes,MAColOrden,MAColPremium,MAColActivo)
SELECT s.EmpCod,s.Especod,d.code,d.description,d.sortOrder,d.premium,1
FROM SpeciesUsed s CROSS JOIN Defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.MAColores m
  WHERE m.EmpCod=s.EmpCod AND m.Especod=s.Especod AND m.MAColCod=d.code
);

IF COL_LENGTH('dbo.CALRECEPCOLOR', 'Especod') IS NULL
BEGIN
  EXEC('ALTER TABLE dbo.CALRECEPCOLOR ADD Especod smallint NULL');
  EXEC('UPDATE detail SET Especod=control.Especod
    FROM dbo.CALRECEPCOLOR detail
    JOIN dbo.CALRECEP control ON control.EmpCod=detail.EmpCod AND control.CalRecId=detail.CalRecId');
  EXEC('ALTER TABLE dbo.CALRECEPCOLOR ALTER COLUMN Especod smallint NOT NULL');
END;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_CALRECEPCOLOR_Color')
  ALTER TABLE dbo.CALRECEPCOLOR DROP CONSTRAINT CK_CALRECEPCOLOR_Color;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_CALRECEPCOLOR_Maestro')
  EXEC('ALTER TABLE dbo.CALRECEPCOLOR ADD CONSTRAINT FK_CALRECEPCOLOR_Maestro
    FOREIGN KEY (EmpCod,Especod,CalColor)
    REFERENCES dbo.MAColores(EmpCod,Especod,MAColCod)');

COMMIT TRANSACTION;

SELECT EmpCod,Especod,RTRIM(MAColCod) MAColCod,RTRIM(MAColDes) MAColDes,MAColOrden,MAColPremium,MAColActivo
FROM dbo.MAColores ORDER BY EmpCod,Especod,MAColOrden,MAColCod;

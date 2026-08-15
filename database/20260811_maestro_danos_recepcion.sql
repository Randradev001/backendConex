/* Maestro parametrizable de danos y defectos para control de calidad por especie. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.MAdanos', 'U') IS NULL
BEGIN
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
    CONSTRAINT UQ_MAdanos_Orden UNIQUE (EmpCod, Especod, MADanOrden),
    CONSTRAINT FK_MAdanos_Especies FOREIGN KEY (EmpCod, Especod)
      REFERENCES dbo.ESPECIES (EmpCod, Especod),
    CONSTRAINT CK_MAdanos_Codigo CHECK (MADanCod > 0),
    CONSTRAINT CK_MAdanos_Orden CHECK (MADanOrden > 0)
  );
END;

DECLARE @Danos TABLE (MADanCod smallint, MADanDes varchar(60), MADanOrden smallint);
INSERT INTO @Danos VALUES
  (1, 'Machucón', 1),
  (2, 'Pitting / Hijuelo', 2),
  (3, 'Roce', 3),
  (4, 'Russet', 4),
  (5, 'Mancha dorada', 5),
  (6, 'Punteadura', 6),
  (7, 'Blandas', 7),
  (8, 'Sobremadura', 8),
  (9, 'Herida abierta', 9),
  (10, 'Herida cicatrizada', 10),
  (11, 'Partidura', 11),
  (12, 'Deshidratación peduncular', 12),
  (13, 'Sin pedúnculo', 13),
  (14, 'Deforme / fruto doble', 14),
  (15, 'Pudrición', 15),
  (16, 'Falta de color', 16);

IF EXISTS (SELECT 1 FROM dbo.ESPECIES WHERE EmpCod=1 AND Especod=1)
BEGIN
  INSERT INTO dbo.MAdanos (EmpCod, Especod, MADanCod, MADanDes, MADanOrden)
  SELECT 1, 1, d.MADanCod, d.MADanDes, d.MADanOrden
  FROM @Danos d
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.MAdanos m
    WHERE m.EmpCod=1 AND m.Especod=1 AND m.MADanCod=d.MADanCod
  );
END;

COMMIT TRANSACTION;

SELECT EmpCod,Especod,MADanCod,MADanDes,MADanOrden,MADanActivo
FROM dbo.MAdanos
WHERE EmpCod=1 AND Especod=1
ORDER BY MADanOrden;

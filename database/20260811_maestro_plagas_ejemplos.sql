/* Reemplaza las categorias genericas por ejemplos concretos para cerezas. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

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

UPDATE m
SET m.MAPlaTipo=e.MAPlaTipo,m.MAPlaDes=e.MAPlaDes,m.MAPlaOrden=e.MAPlaOrden,m.MAPlaActivo=1
FROM dbo.MAPlagas m
JOIN @Ejemplos e ON e.MAPlaCod=m.MAPlaCod
WHERE m.EmpCod=1 AND m.Especod=1;

INSERT dbo.MAPlagas (EmpCod,Especod,MAPlaCod,MAPlaTipo,MAPlaDes,MAPlaOrden,MAPlaActivo)
SELECT 1,1,e.MAPlaCod,e.MAPlaTipo,e.MAPlaDes,e.MAPlaOrden,1
FROM @Ejemplos e
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.MAPlagas m WHERE m.EmpCod=1 AND m.Especod=1 AND m.MAPlaCod=e.MAPlaCod
);

COMMIT TRANSACTION;

SELECT EmpCod,Especod,MAPlaCod,MAPlaTipo,MAPlaDes,MAPlaOrden,MAPlaActivo
FROM dbo.MAPlagas WHERE EmpCod=1 AND Especod=1 ORDER BY MAPlaOrden,MAPlaCod;

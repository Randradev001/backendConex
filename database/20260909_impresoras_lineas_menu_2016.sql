SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.PROGRAM', N'U') IS NULL OR OBJECT_ID(N'dbo.MODULOS', N'U') IS NULL
  THROW 50060, 'Faltan las tablas de seguridad PROGRAM o MODULOS.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.MODULOS WHERE SistCod=100 AND Modcod=6)
  THROW 50061, 'No existe el módulo 100/6 Etiquetado de Cajas.', 1;

IF EXISTS (
  SELECT 1 FROM dbo.PROGRAM
  WHERE SistCod=100 AND Modcod=6 AND ProgCod=12
    AND LOWER(LTRIM(RTRIM(ProgNomGX)))<>'wconfimpresoras'
)
  THROW 50062, 'El programa 100/6/12 ya está utilizado por otra opción.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=6 AND ProgCod=12)
BEGIN
  INSERT dbo.PROGRAM
    (SistCod,Modcod,ProgCod,ProgDes,ProgFcrea,ProgTipo,ProgNomGX,ProgIDmenu,ProgTarget)
  VALUES
    (100,6,12,'Impresoras por linea',GETDATE(),1,'wconfimpresoras','eti-impresoras',NULL);
END
ELSE
BEGIN
  UPDATE dbo.PROGRAM
  SET ProgDes='Impresoras por linea',ProgNomGX='wconfimpresoras',
      ProgTipo=1,ProgIDmenu='eti-impresoras',ProgTarget=NULL
  WHERE SistCod=100 AND Modcod=6 AND ProgCod=12;
END;

IF OBJECT_ID(N'dbo.PROGRAM1', N'U') IS NOT NULL
BEGIN
  INSERT dbo.PROGRAM1(SistCod,Modcod,ProgCod,ProgOPCod,ProgOPDes)
  SELECT 100,6,12,V.ProgOPCod,V.ProgOPDes
  FROM (VALUES
    (CAST(1 AS smallint),CAST('Crear' AS varchar(35))),
    (CAST(2 AS smallint),CAST('Modificar' AS varchar(35))),
    (CAST(3 AS smallint),CAST('Eliminar' AS varchar(35)))
  ) V(ProgOPCod,ProgOPDes)
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.PROGRAM1 P
    WHERE P.SistCod=100 AND P.Modcod=6 AND P.ProgCod=12 AND P.ProgOPCod=V.ProgOPCod
  );
END;

COMMIT TRANSACTION;

SELECT SistCod,Modcod,ProgCod,RTRIM(ProgDes) ProgDes,RTRIM(ProgNomGX) ProgNomGX
FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=6 AND ProgCod=12;

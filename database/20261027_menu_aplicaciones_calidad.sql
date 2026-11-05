/* Renombra el programa existente de calidad sin alterar su clave ni permisos. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
  SELECT 1 FROM dbo.PROGRAM
  WHERE SistCod=100 AND Modcod=2 AND ProgCod=32
    AND RTRIM(ProgNomGX)='wctrlcalidadrecep'
)
  THROW 50001, 'No existe el programa 100/2/32 wctrlcalidadrecep.', 1;

UPDATE dbo.PROGRAM
SET ProgDes='Aplicaciones de calidad'
WHERE SistCod=100 AND Modcod=2 AND ProgCod=32
  AND RTRIM(ProgNomGX)='wctrlcalidadrecep';

UPDATE dbo.PROGRAM1
SET ProgOPDes='modifica y revisa'
WHERE SistCod=100 AND Modcod=2 AND ProgCod=32 AND ProgOPCod=2;

COMMIT TRANSACTION;

SELECT SistCod,Modcod,ProgCod,RTRIM(ProgDes) ProgDes,RTRIM(ProgNomGX) ProgNomGX
FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=2 AND ProgCod=32;
SELECT ProgOPCod,RTRIM(ProgOPDes) ProgOPDes
FROM dbo.PROGRAM1 WHERE SistCod=100 AND Modcod=2 AND ProgCod=32 ORDER BY ProgOPCod;

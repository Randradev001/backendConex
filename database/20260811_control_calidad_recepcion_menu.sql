/* Registra el mantenedor de controles de calidad como opcion independiente. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @SistCod smallint = 100;
DECLARE @Modcod smallint = 2;
DECLARE @ProgCod smallint = 32;
DECLARE @ProgNomGX varchar(20) = 'wctrlcalidadrecep';

-- Compatibilidad con la primera ejecucion, truncada por ProgNomGX varchar(20).
UPDATE dbo.PROGRAM
SET ProgNomGX=@ProgNomGX
WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod
  AND RTRIM(ProgNomGX)='wcontrolescalidadrec';

IF EXISTS (
  SELECT 1 FROM dbo.PROGRAM
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod
    AND RTRIM(ProgNomGX)<>@ProgNomGX
)
  THROW 50001, 'El programa 100/2/32 ya esta ocupado por otra opcion.', 1;

IF NOT EXISTS (
  SELECT 1 FROM dbo.PROGRAM
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND RTRIM(ProgNomGX)=@ProgNomGX
)
BEGIN
  INSERT INTO dbo.PROGRAM
    (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea)
  VALUES
    (@SistCod,@Modcod,@ProgCod,'Mantenedor controles calidad',@ProgNomGX,1,CAST(GETDATE() AS date));
END
ELSE
BEGIN
  UPDATE dbo.PROGRAM
  SET ProgDes='Mantenedor controles calidad'
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND RTRIM(ProgNomGX)=@ProgNomGX;
END;

UPDATE dbo.PROGRAM
SET ProgNomGX=@ProgNomGX
WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

DECLARE @Acciones TABLE (ProgOPCod smallint, ProgOPDes char(35));
INSERT INTO @Acciones VALUES (1,'crea'),(2,'modifica'),(3,'anula');

INSERT INTO dbo.PROGRAM1 (SistCod,Modcod,ProgCod,ProgOPCod,ProgOPDes)
SELECT @SistCod,@Modcod,@ProgCod,A.ProgOPCod,A.ProgOPDes
FROM @Acciones A
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.PROGRAM1 P
  WHERE P.SistCod=@SistCod AND P.Modcod=@Modcod
    AND P.ProgCod=@ProgCod AND P.ProgOPCod=A.ProgOPCod
);

COMMIT TRANSACTION;

SELECT SistCod,Modcod,ProgCod,RTRIM(ProgDes) AS ProgDes,RTRIM(ProgNomGX) AS ProgNomGX
FROM dbo.PROGRAM
WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod IN (31,32)
ORDER BY ProgCod;

/*
  Registra la opcion React "Tablero de lotes" en el menu dinamico.
  No crea acciones PROGRAM1 porque la primera fase es de solo consulta.
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @SistCod numeric(4,0) = 100;
DECLARE @Modcod numeric(3,0) = 2;
DECLARE @ProgNomGX varchar(20) = 'wtablerolotesrecep';
DECLARE @ProgCod numeric(3,0);

IF NOT EXISTS (
  SELECT 1
  FROM dbo.PROGRAM
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND RTRIM(ProgNomGX)=@ProgNomGX
)
BEGIN
  SELECT @ProgCod = COALESCE(MAX(ProgCod), 0) + 1
  FROM dbo.PROGRAM WITH (UPDLOCK, HOLDLOCK)
  WHERE SistCod=@SistCod AND Modcod=@Modcod;

  INSERT INTO dbo.PROGRAM (SistCod, Modcod, ProgCod, ProgDes, ProgNomGX, ProgTipo, ProgFcrea)
  VALUES (@SistCod, @Modcod, @ProgCod, 'Tablero de lotes', @ProgNomGX, 1, CAST(GETDATE() AS date));
END;

COMMIT TRANSACTION;

SELECT SistCod, Modcod, ProgCod, ProgDes, ProgNomGX, ProgTipo
FROM dbo.PROGRAM
WHERE SistCod=@SistCod AND Modcod=@Modcod AND RTRIM(ProgNomGX)=@ProgNomGX;

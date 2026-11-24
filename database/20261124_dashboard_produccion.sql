/* Publica el dashboard de producción bajo el programa histórico 100/15/20. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @SistCod smallint=100,
        @Modcod smallint=15,
        @ProgCod smallint=20,
        @ProgNomGX varchar(20)='wdashproduccion';

IF NOT EXISTS(SELECT 1 FROM SISTEMAS WHERE SistCod=@SistCod)
  THROW 50001,'No existe el sistema 100.',1;

IF NOT EXISTS(SELECT 1 FROM MODULOS WHERE SistCod=@SistCod AND Modcod=@Modcod)
  THROW 50002,'No existe el modulo 100/15 Consultas de Procesos.',1;

IF EXISTS(
  SELECT 1 FROM PROGRAM
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod
    AND NULLIF(RTRIM(ProgNomGX),'') IS NOT NULL
    AND RTRIM(ProgNomGX)<>@ProgNomGX
)
  THROW 50003,'El programa 100/15/20 esta asociado a otro objeto.',1;

IF NOT EXISTS(SELECT 1 FROM PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
  INSERT PROGRAM(SistCod,Modcod,ProgCod,ProgDes,ProgFcrea,ProgTipo,ProgNomGX,ProgIDmenu,ProgTarget)
  VALUES(@SistCod,@Modcod,@ProgCod,N'Dashboard de producción',CONVERT(date,GETDATE()),1,@ProgNomGX,N'con-dash-produccion',NULL);
ELSE
  UPDATE PROGRAM
  SET ProgDes=N'Dashboard de producción',ProgTipo=1,ProgNomGX=@ProgNomGX,
      ProgIDmenu=N'con-dash-produccion',ProgTarget=NULL
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

COMMIT;

SELECT SistCod,Modcod,ProgCod,RTRIM(ProgDes) Programa,RTRIM(ProgNomGX) ProgNomGX,RTRIM(ProgIDmenu) ProgIDmenu
FROM PROGRAM
WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

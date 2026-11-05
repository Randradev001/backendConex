/*
  Agrega el acceso directo a Ingreso de Tarjas en Procesos SAG.
  La pantalla ya existe en React y conserva Folios Procesados como opcion separada.
  Ejecutar en CONEX. Script idempotente para SQL Server 2016.
*/
IF DB_NAME() NOT IN (N'CONEX', N'CONEX_MIGRACION')
  THROW 51027, N'Este script debe ejecutarse en una base CONEX autorizada.', 1;

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SistCod smallint=120, @ModCod smallint=1, @ProgCod smallint=4;
DECLARE @Ruta varchar(20)='sagtarjas';

BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.SISTEMAS WHERE SistCod=@SistCod)
  THROW 51028, N'No existe el sistema 120 Procesos SAG. Ejecute primero 20261015_procesos_sag_menu.sql.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.MODULOS WHERE SistCod=@SistCod AND Modcod=@ModCod)
  THROW 51029, N'No existe el modulo 120/1 Operacional.', 1;

IF EXISTS (
  SELECT 1 FROM dbo.PROGRAM
  WHERE SistCod=@SistCod AND Modcod=@ModCod AND ProgCod=@ProgCod
    AND NULLIF(LTRIM(RTRIM(COALESCE(ProgNomGX,''))),'') IS NOT NULL
    AND LTRIM(RTRIM(ProgNomGX))<>@Ruta
)
  THROW 51030, N'El programa 120/1/4 ya esta ocupado por otra opcion.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=@SistCod AND Modcod=@ModCod AND ProgCod=@ProgCod)
  INSERT dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea,ProgIDmenu,ProgTarget)
  VALUES (@SistCod,@ModCod,@ProgCod,'Ingreso de Tarjas',@Ruta,1,CAST(GETDATE() AS date),'procesos_sag',NULL);
ELSE
  UPDATE dbo.PROGRAM
  SET ProgDes='Ingreso de Tarjas',ProgNomGX=@Ruta,ProgTipo=1,ProgIDmenu='procesos_sag',ProgTarget=NULL
  WHERE SistCod=@SistCod AND Modcod=@ModCod AND ProgCod=@ProgCod;

/* Reciben el acceso directo quienes ya pueden operar Folios Procesados,
   ya sea por el menu nuevo 120/1/1 o por los programas historicos. */
DECLARE @Sujetos TABLE (
  GECODEMP decimal(10,0) NOT NULL,
  Login varchar(30) NOT NULL,
  PRIMARY KEY (GECODEMP,Login)
);

INSERT @Sujetos (GECODEMP,Login)
SELECT DISTINCT A.GECODEMP,RTRIM(A.UsuLogin)
FROM dbo.ASIGPROG A
WHERE (A.SistCod=120 AND A.Modcod=1 AND A.ProgCod=1)
   OR (A.SistCod=100 AND ((A.Modcod=20 AND A.ProgCod=5) OR (A.Modcod=2 AND A.ProgCod=10)));

IF NOT EXISTS (SELECT 1 FROM @Sujetos WHERE GECODEMP=0 AND Login='ADMINFULL')
  INSERT @Sujetos VALUES (0,'ADMINFULL');

INSERT dbo.ASIGSIST (GECODEMP,AsgSisLogin,SistCod)
SELECT S.GECODEMP,S.Login,@SistCod
FROM @Sujetos S
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.ASIGSIST A
  WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.AsgSisLogin)=S.Login AND A.SistCod=@SistCod
);

INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
SELECT S.GECODEMP,S.Login,@SistCod,@ModCod,'MIGRACION'
FROM @Sujetos S
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.ASIG A
  WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.AsigUsu)=S.Login
    AND A.SistCod=@SistCod AND A.AsigMod=@ModCod
);

INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
SELECT S.GECODEMP,S.Login,@SistCod,@ModCod,@ProgCod,'MIGRACION'
FROM @Sujetos S
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.ASIGPROG A
  WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.UsuLogin)=S.Login
    AND A.SistCod=@SistCod AND A.Modcod=@ModCod AND A.ProgCod=@ProgCod
);

COMMIT TRANSACTION;

SELECT P.SistCod,P.Modcod,P.ProgCod,RTRIM(P.ProgDes) Programa,RTRIM(P.ProgNomGX) Ruta
FROM dbo.PROGRAM P
WHERE P.SistCod=@SistCod AND P.Modcod=@ModCod AND P.ProgCod=@ProgCod;

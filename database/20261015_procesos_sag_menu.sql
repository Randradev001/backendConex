/* Consolida las tres operaciones SAG bajo un sistema propio, conservando los permisos GeneXus anteriores. */
USE [CONEX];
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SistCod smallint=120, @Modcod smallint=1;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.SISTEMAS WHERE SistCod=@SistCod)
  INSERT dbo.SISTEMAS (SistCod,SistNombre,SistFecCrea,SistFAIcons)
  VALUES (@SistCod,'Procesos SAG',CAST(GETDATE() AS date),'SafetyCertificateOutlined');
ELSE UPDATE dbo.SISTEMAS SET SistNombre='Procesos SAG',SistFAIcons='SafetyCertificateOutlined' WHERE SistCod=@SistCod;

IF NOT EXISTS (SELECT 1 FROM dbo.MODULOS WHERE SistCod=@SistCod AND Modcod=@Modcod)
  INSERT dbo.MODULOS (SistCod,Modcod,ModTipo,Modprg,ModDes,ModFcrea,ModFAIcons)
  VALUES (@SistCod,@Modcod,1,'PROCESOS_SAG','Operacional',CAST(GETDATE() AS date),'DeploymentUnitOutlined');
ELSE UPDATE dbo.MODULOS SET ModDes='Operacional',Modprg='PROCESOS_SAG',ModFAIcons='DeploymentUnitOutlined'
  WHERE SistCod=@SistCod AND Modcod=@Modcod;

DECLARE @Programas TABLE (ProgCod smallint PRIMARY KEY, Nombre varchar(40), Ruta varchar(100), LegadoProg smallint);
INSERT @Programas VALUES
 (1,'Folios Procesados','sagfolios',5),
 (2,'Inspecciones','saginspecciones',1),
 (3,'Despachos SAG','sagdespachos',3);

IF EXISTS (SELECT 1 FROM @Programas X JOIN dbo.PROGRAM P ON P.SistCod=@SistCod AND P.Modcod=@Modcod AND P.ProgCod=X.ProgCod
  WHERE NULLIF(LTRIM(RTRIM(P.ProgNomGX)),'') IS NOT NULL AND LTRIM(RTRIM(P.ProgNomGX))<>X.Ruta)
  THROW 50120,'Un codigo del menu Procesos SAG ya esta ocupado.',1;

INSERT dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea,ProgIDmenu,ProgTarget)
SELECT @SistCod,@Modcod,X.ProgCod,X.Nombre,X.Ruta,1,CAST(GETDATE() AS date),'procesos_sag',NULL
FROM @Programas X WHERE NOT EXISTS (SELECT 1 FROM dbo.PROGRAM P WHERE P.SistCod=@SistCod AND P.Modcod=@Modcod AND P.ProgCod=X.ProgCod);

UPDATE P SET ProgDes=X.Nombre,ProgNomGX=X.Ruta,ProgTipo=1,ProgIDmenu='procesos_sag',ProgTarget=NULL
FROM dbo.PROGRAM P JOIN @Programas X ON X.ProgCod=P.ProgCod WHERE P.SistCod=@SistCod AND P.Modcod=@Modcod;

/* ADMINFULL y cada usuario/rol con el permiso equivalente anterior reciben la nueva agrupacion. */
DECLARE @Sujetos TABLE (GECODEMP decimal(10,0), Login varchar(30), PRIMARY KEY(GECODEMP,Login));
INSERT @Sujetos VALUES (0,'ADMINFULL');
INSERT @Sujetos
SELECT DISTINCT A.GECODEMP,RTRIM(A.UsuLogin) FROM dbo.ASIGPROG A
WHERE A.SistCod=100 AND ((A.Modcod=20 AND A.ProgCod IN (1,3,5)) OR (A.Modcod=2 AND A.ProgCod=10))
AND NOT EXISTS (SELECT 1 FROM @Sujetos S WHERE S.GECODEMP=A.GECODEMP AND RTRIM(S.Login)=RTRIM(A.UsuLogin));

INSERT dbo.ASIGSIST (GECODEMP,AsgSisLogin,SistCod)
SELECT S.GECODEMP,S.Login,@SistCod FROM @Sujetos S WHERE NOT EXISTS
 (SELECT 1 FROM dbo.ASIGSIST A WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.AsgSisLogin)=RTRIM(S.Login) AND A.SistCod=@SistCod);
INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
SELECT S.GECODEMP,S.Login,@SistCod,@Modcod,'MIGRACION' FROM @Sujetos S WHERE NOT EXISTS
 (SELECT 1 FROM dbo.ASIG A WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.AsigUsu)=RTRIM(S.Login) AND A.SistCod=@SistCod AND A.AsigMod=@Modcod);

INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
SELECT S.GECODEMP,S.Login,@SistCod,@Modcod,X.ProgCod,'MIGRACION'
FROM @Sujetos S CROSS JOIN @Programas X
WHERE (S.Login='ADMINFULL' OR EXISTS (SELECT 1 FROM dbo.ASIGPROG A WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.UsuLogin)=RTRIM(S.Login)
 AND A.SistCod=100 AND ((X.ProgCod=1 AND ((A.Modcod=20 AND A.ProgCod=5) OR (A.Modcod=2 AND A.ProgCod=10)))
 OR (X.ProgCod=2 AND A.Modcod=20 AND A.ProgCod=1) OR (X.ProgCod=3 AND A.Modcod=20 AND A.ProgCod=3))))
AND NOT EXISTS (SELECT 1 FROM dbo.ASIGPROG T WHERE T.GECODEMP=S.GECODEMP AND RTRIM(T.UsuLogin)=RTRIM(S.Login)
 AND T.SistCod=@SistCod AND T.Modcod=@Modcod AND T.ProgCod=X.ProgCod);

COMMIT TRANSACTION;
SELECT P.SistCod,P.Modcod,P.ProgCod,RTRIM(P.ProgDes) Programa,RTRIM(P.ProgNomGX) Ruta
FROM dbo.PROGRAM P WHERE P.SistCod=@SistCod ORDER BY P.ProgCod;

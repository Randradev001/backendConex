/* Agrupa la operación de guías en Conex sin mover el módulo ni sus datos de APERP. */
USE [CONEX];
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SistCod smallint=130, @Modcod smallint=1, @ProgCod smallint=1;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.SISTEMAS WHERE SistCod=@SistCod)
  INSERT dbo.SISTEMAS (SistCod,SistNombre,SistFecCrea,SistFAIcons)
  VALUES (@SistCod,'Guias electronicas',CAST(GETDATE() AS date),'FileTextOutlined');
ELSE UPDATE dbo.SISTEMAS SET SistNombre='Guias electronicas',SistFAIcons='FileTextOutlined' WHERE SistCod=@SistCod;

IF NOT EXISTS (SELECT 1 FROM dbo.MODULOS WHERE SistCod=@SistCod AND Modcod=@Modcod)
  INSERT dbo.MODULOS (SistCod,Modcod,ModTipo,Modprg,ModDes,ModFcrea,ModFAIcons)
  VALUES (@SistCod,@Modcod,1,'GUIAS','Operacional',CAST(GETDATE() AS date),'DeploymentUnitOutlined');
ELSE UPDATE dbo.MODULOS SET ModDes='Operacional',Modprg='GUIAS',ModFAIcons='DeploymentUnitOutlined'
  WHERE SistCod=@SistCod AND Modcod=@Modcod;

IF EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod
  AND NULLIF(LTRIM(RTRIM(ProgNomGX)),'') IS NOT NULL AND LTRIM(RTRIM(ProgNomGX))<>'/guias/electronicas')
  THROW 50130,'El programa de Guias electronicas ya esta ocupado.',1;
IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
  INSERT dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea,ProgIDmenu,ProgTarget)
  VALUES (@SistCod,@Modcod,@ProgCod,'Listado de guias','/guias/electronicas',1,CAST(GETDATE() AS date),'guias',NULL);
ELSE UPDATE dbo.PROGRAM SET ProgDes='Listado de guias',ProgNomGX='/guias/electronicas',ProgTipo=1,
  ProgIDmenu='guias',ProgTarget=NULL WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

/* Solo se copia el permiso de los programas de guías que el sujeto ya tenía. */
DECLARE @Sujetos TABLE (GECODEMP decimal(10,0), Login varchar(30), PRIMARY KEY(GECODEMP,Login));
INSERT @Sujetos
SELECT DISTINCT A.GECODEMP,RTRIM(A.UsuLogin) FROM dbo.ASIGPROG A
WHERE (A.SistCod=100 AND A.Modcod=2 AND A.ProgCod=20)
   OR (A.SistCod=70 AND A.Modcod=6 AND A.ProgCod=3);

INSERT dbo.ASIGSIST (GECODEMP,AsgSisLogin,SistCod)
SELECT S.GECODEMP,S.Login,@SistCod FROM @Sujetos S WHERE NOT EXISTS
 (SELECT 1 FROM dbo.ASIGSIST A WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.AsgSisLogin)=RTRIM(S.Login) AND A.SistCod=@SistCod);
INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
SELECT S.GECODEMP,S.Login,@SistCod,@Modcod,'MIGRACION' FROM @Sujetos S WHERE NOT EXISTS
 (SELECT 1 FROM dbo.ASIG A WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.AsigUsu)=RTRIM(S.Login)
  AND A.SistCod=@SistCod AND A.AsigMod=@Modcod);
INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
SELECT S.GECODEMP,S.Login,@SistCod,@Modcod,@ProgCod,'MIGRACION' FROM @Sujetos S WHERE NOT EXISTS
 (SELECT 1 FROM dbo.ASIGPROG A WHERE A.GECODEMP=S.GECODEMP AND RTRIM(A.UsuLogin)=RTRIM(S.Login)
  AND A.SistCod=@SistCod AND A.Modcod=@Modcod AND A.ProgCod=@ProgCod);

COMMIT TRANSACTION;

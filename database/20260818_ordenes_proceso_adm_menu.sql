DECLARE @SistCod smallint = 110;
DECLARE @Modcod smallint = 2;
DECLARE @ProgCod smallint = 2;

IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
  INSERT dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea,ProgIDmenu,ProgTarget)
  VALUES (@SistCod,@Modcod,@ProgCod,'ADM Ordenes de Proceso','wadmordproc',1,CAST(GETDATE() AS date),'op_operacional',NULL);
ELSE
  UPDATE dbo.PROGRAM SET ProgDes='ADM Ordenes de Proceso',ProgNomGX='wadmordproc',ProgIDmenu='op_operacional',ProgTarget=NULL
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

IF NOT EXISTS (SELECT 1 FROM dbo.ASIG WHERE GECODEMP=0 AND RTRIM(AsigUsu)='ADMINFULL' AND SistCod=@SistCod AND AsigMod=@Modcod)
  INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig) VALUES (0,'ADMINFULL',@SistCod,@Modcod,'MANDRADE');

IF NOT EXISTS (SELECT 1 FROM dbo.ASIGPROG WHERE GECODEMP=0 AND RTRIM(UsuLogin)='ADMINFULL' AND SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
  INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC) VALUES (0,'ADMINFULL',@SistCod,'2',@ProgCod,'MANDRADE');

SELECT SistCod,Modcod,ProgCod,RTRIM(ProgDes) ProgDes,RTRIM(ProgNomGX) ProgNomGX,ProgIDmenu,ProgTarget
FROM dbo.PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

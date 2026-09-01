/* Garantiza el permiso del mantenedor CONFIGETI para el administrador. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @SistCod smallint = 110;
DECLARE @Modcod smallint = 1;
DECLARE @ProgCod smallint = 1;
DECLARE @Usuario varchar(10) = '14332241-6';

IF NOT EXISTS (
  SELECT 1 FROM dbo.ASIG
  WHERE GECODEMP=0 AND RTRIM(AsigUsu)='ADMINFULL'
    AND SistCod=@SistCod AND AsigMod=@Modcod
)
  INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
  VALUES (0,'ADMINFULL',@SistCod,@Modcod,'MIGRACION');

IF NOT EXISTS (
  SELECT 1 FROM dbo.ASIGPROG
  WHERE GECODEMP=0 AND RTRIM(UsuLogin)='ADMINFULL'
    AND SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod
)
  INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
  VALUES (0,'ADMINFULL',@SistCod,@Modcod,@ProgCod,'MIGRACION');

IF EXISTS (SELECT 1 FROM dbo.URolesPorUser WHERE GECODEMP=1 AND RTRIM(UsuLogin)=@Usuario)
AND NOT EXISTS (
  SELECT 1 FROM dbo.URolesPorUser
  WHERE GECODEMP=1 AND RTRIM(UsuLogin)=@Usuario AND RTRIM(ROLCod)='ADMINFULL'
)
  INSERT dbo.URolesPorUser (GECODEMP,UsuLogin,ROLCod,RXUFecCrea)
  VALUES (1,@Usuario,'ADMINFULL',GETDATE());

COMMIT TRANSACTION;

SELECT SistCod,Modcod,ProgCod,RTRIM(UsuLogin) AS UsuLogin
FROM dbo.ASIGPROG
WHERE GECODEMP=0 AND SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

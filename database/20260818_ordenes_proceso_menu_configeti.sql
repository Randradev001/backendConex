/* Registra el modulo inicial de Ordenes de Proceso y su primer mantenedor. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @SistCod smallint = 110;
DECLARE @Modcod smallint = 1;
DECLARE @ProgCod smallint = 1;
DECLARE @ProgNomGX varchar(20) = 'wconfigeti';

DELETE FROM dbo.ASIGPROG WHERE SistCod=100 AND Modcod=21;
DELETE FROM dbo.ASIG WHERE SistCod=100 AND AsigMod=21;
DELETE FROM dbo.PROGRAM WHERE SistCod=100 AND Modcod=21;
DELETE FROM dbo.MODULOS WHERE SistCod=100 AND Modcod=21;

IF NOT EXISTS (SELECT 1 FROM dbo.SISTEMAS WHERE SistCod=@SistCod)
  INSERT dbo.SISTEMAS (SistCod,SistNombre,SistFecCrea,SistFAIcons)
  VALUES (@SistCod,'Ordenes de Proceso',CAST(GETDATE() AS date),'AccountTreeOutlined');
ELSE
  UPDATE dbo.SISTEMAS SET SistNombre='Ordenes de Proceso',SistFAIcons='AccountTreeOutlined' WHERE SistCod=@SistCod;

DECLARE @Modulos TABLE (Modcod smallint, ModDes varchar(50), Modprg varchar(20), ModFAIcons varchar(30));
INSERT @Modulos VALUES (1,'Mantenedores','ORDENES_PROCESO','BuildOutlined'),(2,'Operacional','ORDENES_PROCESO','SettingsOutlined'),(3,'Consultas','ORDENES_PROCESO','SearchOutlined');
INSERT dbo.MODULOS (SistCod,Modcod,ModTipo,Modprg,ModDes,ModFcrea,ModFAIcons)
SELECT @SistCod,Modcod,1,Modprg,ModDes,CAST(GETDATE() AS date),ModFAIcons FROM @Modulos M
WHERE NOT EXISTS (SELECT 1 FROM dbo.MODULOS X WHERE X.SistCod=@SistCod AND X.Modcod=M.Modcod);
UPDATE X SET ModDes=M.ModDes,Modprg=M.Modprg,ModFAIcons=M.ModFAIcons
FROM dbo.MODULOS X JOIN @Modulos M ON M.Modcod=X.Modcod WHERE X.SistCod=@SistCod;


IF NOT EXISTS (
  SELECT 1 FROM dbo.MODULOS
  WHERE SistCod=@SistCod AND Modcod=@Modcod
)
BEGIN
  INSERT dbo.MODULOS
    (SistCod,Modcod,ModTipo,Modprg,ModDes,ModFcrea,ModFAIcons)
  VALUES
    (@SistCod,@Modcod,1,'ORDENES_PROCESO','Mantenedores',CAST(GETDATE() AS date),'BuildOutlined');
END
ELSE
BEGIN
  UPDATE dbo.MODULOS
  SET ModDes='Mantenedores', ModFAIcons='BuildOutlined'
  WHERE SistCod=@SistCod AND Modcod=@Modcod;
END;

IF EXISTS (
  SELECT 1 FROM dbo.PROGRAM
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod
    AND RTRIM(ProgNomGX)<>@ProgNomGX
)
  THROW 50021, 'El programa 110/1/1 ya esta ocupado.', 1;

IF NOT EXISTS (
  SELECT 1 FROM dbo.PROGRAM
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod
)
BEGIN
  INSERT dbo.PROGRAM
    (SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea,ProgIDmenu,ProgTarget)
  VALUES
    (@SistCod,@Modcod,@ProgCod,'Configuraciones de Etiquetas',@ProgNomGX,1,CAST(GETDATE() AS date),'op_mantenedores',NULL);
END
ELSE
BEGIN
  UPDATE dbo.PROGRAM
  SET ProgDes='Configuraciones de Etiquetas', ProgNomGX=@ProgNomGX,
      ProgIDmenu='op_mantenedores', ProgTarget=NULL
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ASIG WHERE GECODEMP=0 AND RTRIM(AsigUsu)='ADMINFULL' AND SistCod=@SistCod AND AsigMod=@Modcod)
  INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
  VALUES (0,'ADMINFULL',@SistCod,@Modcod,'MANDRADE');

IF NOT EXISTS (SELECT 1 FROM dbo.ASIGPROG WHERE GECODEMP=0 AND RTRIM(UsuLogin)='ADMINFULL' AND SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
  INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
  VALUES (0,'ADMINFULL',@SistCod,@Modcod,@ProgCod,'MANDRADE');

COMMIT TRANSACTION;

SELECT SistCod,Modcod,ProgCod,RTRIM(ProgDes) ProgDes,RTRIM(ProgNomGX) ProgNomGX,ProgIDmenu,ProgTarget
FROM dbo.PROGRAM
WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

/* Programa CONEX para cambiar solamente ORDPROC.OrdpEstado. */
SET NOCOUNT ON;

DECLARE @SistCod smallint = 110;
DECLARE @Modcod smallint = 2;
DECLARE @ProgCod smallint = 3;

IF NOT EXISTS (SELECT 1 FROM dbo.PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
BEGIN
  INSERT dbo.PROGRAM (SistCod,Modcod,ProgCod,ProgDes,ProgFcrea,ProgTipo,ProgNomGX,ProgIDmenu,ProgTarget)
  VALUES (@SistCod,@Modcod,@ProgCod,N'Cambio de estado de orden',CAST(GETDATE() AS date),1,N'wcestadoproc',N'op_operacional',NULL);
END
ELSE
BEGIN
  UPDATE dbo.PROGRAM
  SET ProgDes=N'Cambio de estado de orden',ProgTipo=1,ProgNomGX=N'wcestadoproc',ProgIDmenu=N'op_operacional',ProgTarget=NULL
  WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ASIG WHERE GECODEMP=0 AND RTRIM(AsigUsu)=N'ADMINFULL' AND SistCod=@SistCod AND AsigMod=@Modcod)
  INSERT dbo.ASIG (GECODEMP,AsigUsu,SistCod,AsigMod,AsigAsig)
  VALUES (0,N'ADMINFULL',@SistCod,@Modcod,N'MANDRADE');

IF NOT EXISTS (SELECT 1 FROM dbo.ASIGPROG WHERE GECODEMP=0 AND RTRIM(UsuLogin)=N'ADMINFULL' AND SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
  INSERT dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgUsuC)
  VALUES (0,N'ADMINFULL',@SistCod,@Modcod,@ProgCod,N'MANDRADE');

SELECT SistCod,Modcod,ProgCod,RTRIM(ProgDes) ProgDes,RTRIM(ProgNomGX) ProgNomGX FROM dbo.PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

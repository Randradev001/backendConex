/* Dashboard de calidad en Consultas de Procesos, asignado a MANDRADE. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @EmpCod smallint=1,@Login char(10)='MANDRADE',@SistCod smallint=100,@Modcod smallint=15,@ProgCod smallint=15,@ProgNomGX varchar(20)='wdashcalidadrecep';

IF NOT EXISTS(SELECT 1 FROM USUARIOS U JOIN SEGUSUEMP E ON E.UsuLogin=U.UsuLogin WHERE U.UsuRut=14332241 AND RTRIM(U.UsuDV)='6' AND E.GECODEMP=@EmpCod AND RTRIM(U.UsuLogin)=RTRIM(@Login))
 THROW 50010,'MANDRADE no corresponde al RUT esperado.',1;
IF EXISTS(SELECT 1 FROM PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod AND RTRIM(ProgNomGX)<>@ProgNomGX)
 THROW 50011,'El programa 100/15/15 ya esta ocupado.',1;
IF NOT EXISTS(SELECT 1 FROM PROGRAM WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
 INSERT PROGRAM(SistCod,Modcod,ProgCod,ProgDes,ProgNomGX,ProgTipo,ProgFcrea) VALUES(@SistCod,@Modcod,@ProgCod,'Dashboard calidad recepcion',@ProgNomGX,1,CAST(GETDATE() AS date));
ELSE UPDATE PROGRAM SET ProgDes='Dashboard calidad recepcion',ProgNomGX=@ProgNomGX,ProgTipo=1 WHERE SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod;

IF NOT EXISTS(SELECT 1 FROM ASIGPROG WHERE GECODEMP=@EmpCod AND RTRIM(UsuLogin)=RTRIM(@Login) AND SistCod=@SistCod AND Modcod=@Modcod AND ProgCod=@ProgCod)
 INSERT ASIGPROG(GECODEMP,UsuLogin,SistCod,Modcod,ProgCod) VALUES(@EmpCod,@Login,@SistCod,@Modcod,@ProgCod);
COMMIT;
SELECT A.GECODEMP,RTRIM(A.UsuLogin) UsuLogin,A.SistCod,A.Modcod,A.ProgCod,RTRIM(P.ProgDes) Programa,RTRIM(P.ProgNomGX) ProgNomGX FROM ASIGPROG A JOIN PROGRAM P ON P.SistCod=A.SistCod AND P.Modcod=A.Modcod AND P.ProgCod=A.ProgCod WHERE A.GECODEMP=@EmpCod AND RTRIM(A.UsuLogin)=RTRIM(@Login) AND A.SistCod=@SistCod AND A.Modcod=@Modcod AND A.ProgCod=@ProgCod;

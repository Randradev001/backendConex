/* Asignacion solicitada para el usuario asociado al RUT 14.332.241-6. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @EmpCod smallint=1,@Login char(10)='MANDRADE';

IF NOT EXISTS (
  SELECT 1 FROM dbo.USUARIOS U JOIN dbo.SEGUSUEMP UE ON UE.UsuLogin=U.UsuLogin
  WHERE U.UsuRut=14332241 AND RTRIM(U.UsuDV)='6'
    AND UE.GECODEMP=@EmpCod AND RTRIM(U.UsuLogin)=RTRIM(@Login) AND UE.UsuEstado=1
)
  THROW 50002,'El usuario MANDRADE activo no corresponde al RUT esperado.',1;

INSERT INTO dbo.ASIGPROG (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod)
SELECT @EmpCod,@Login,100,2,V.ProgCod
FROM (VALUES (CAST(31 AS smallint)),(CAST(32 AS smallint))) V(ProgCod)
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.ASIGPROG A
  WHERE A.GECODEMP=@EmpCod AND RTRIM(A.UsuLogin)=RTRIM(@Login)
    AND A.SistCod=100 AND A.Modcod=2 AND A.ProgCod=V.ProgCod
);

INSERT INTO dbo.ASIGPROG1 (GECODEMP,UsuLogin,SistCod,Modcod,ProgCod,ProgOPCod)
SELECT @EmpCod,@Login,100,2,32,V.ProgOPCod
FROM (VALUES (CAST(1 AS smallint)),(CAST(2 AS smallint)),(CAST(3 AS smallint))) V(ProgOPCod)
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.ASIGPROG1 A
  WHERE A.GECODEMP=@EmpCod AND RTRIM(A.UsuLogin)=RTRIM(@Login)
    AND A.SistCod=100 AND A.Modcod=2 AND A.ProgCod=32 AND A.ProgOPCod=V.ProgOPCod
);

COMMIT TRANSACTION;

SELECT A.GECODEMP,RTRIM(A.UsuLogin) AS UsuLogin,A.SistCod,A.Modcod,A.ProgCod,
       RTRIM(P.ProgDes) AS Programa
FROM dbo.ASIGPROG A JOIN dbo.PROGRAM P
 ON P.SistCod=A.SistCod AND P.Modcod=A.Modcod AND P.ProgCod=A.ProgCod
WHERE A.GECODEMP=@EmpCod AND RTRIM(A.UsuLogin)=RTRIM(@Login)
 AND A.SistCod=100 AND A.Modcod=2 AND A.ProgCod IN (31,32)
ORDER BY A.ProgCod;

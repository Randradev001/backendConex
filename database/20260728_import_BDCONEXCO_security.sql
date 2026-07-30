/*
  Importacion opcional desde BDCONEXCO hacia la base CONEX homologada.

  Solamente conserva definiciones de roles, asignaciones de usuarios que
  existen en CONEX y credenciales modernas. Las sesiones y las plantillas de
  permisos no se copian porque sus catalogos de programas no son equivalentes.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_ID(N'BDCONEXCO') IS NULL
BEGIN
  RAISERROR('BDCONEXCO no esta disponible para importar Seguridad.', 16, 1);
  RETURN;
END;

IF OBJECT_ID(N'dbo.SEGUSUEMP', N'U') IS NULL
   OR OBJECT_ID(N'dbo.SEGUSUCRED', N'U') IS NULL
   OR OBJECT_ID(N'dbo.UROLES', N'U') IS NULL
BEGIN
  RAISERROR('Primero debe ejecutar 20260728_CONEX_original_homologacion.sql.', 16, 1);
  RETURN;
END;

BEGIN TRANSACTION;

EXEC sys.sp_executesql N'
  INSERT INTO dbo.UROLES (ROLCod, ROLNombre, ROLFCrea, ROLUCrea)
  SELECT S.ROLCod, RTRIM(S.ROLNombre), ISNULL(S.ROLFCrea, SYSUTCDATETIME()), S.ROLUCrea
  FROM BDCONEXCO.dbo.UROLES S
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.UROLES T WHERE RTRIM(T.ROLCod)=RTRIM(S.ROLCod)
  );

  /* BDCONEXCO 100 y CONEX 1 corresponden a LA VINA. */
  INSERT INTO dbo.URolesPorUser (GECODEMP, UsuLogin, ROLCod, RXUFecCrea)
  SELECT 1, T.UsuLogin, R.ROLCod, ISNULL(S.RXUFecCrea, SYSUTCDATETIME())
  FROM BDCONEXCO.dbo.URolesPorUser S
  INNER JOIN dbo.SEGUSUEMP T
    ON T.GECODEMP=1 AND RTRIM(T.UsuLogin)=RTRIM(S.UsuLogin)
  INNER JOIN dbo.UROLES R ON RTRIM(R.ROLCod)=RTRIM(S.ROLCod)
  WHERE S.GECODEMP=100
    AND NOT EXISTS (
      SELECT 1 FROM dbo.URolesPorUser D
      WHERE D.GECODEMP=1 AND D.UsuLogin=T.UsuLogin AND D.ROLCod=R.ROLCod
    );

  ;WITH Credenciales AS (
    SELECT C.UsuLogin, C.PasswordSalt, C.PasswordHash, C.MigradoDesdeGX, C.FechaCambio,
      ROW_NUMBER() OVER (PARTITION BY RTRIM(C.UsuLogin) ORDER BY C.FechaCambio DESC) AS Orden
    FROM BDCONEXCO.dbo.SEGUSUCRED C
    INNER JOIN dbo.USUARIOS U ON RTRIM(U.UsuLogin)=RTRIM(C.UsuLogin)
  )
  INSERT INTO dbo.SEGUSUCRED (UsuLogin, PasswordSalt, PasswordHash, MigradoDesdeGX, FechaCambio)
  SELECT UsuLogin, PasswordSalt, PasswordHash, MigradoDesdeGX, FechaCambio
  FROM Credenciales C
  WHERE C.Orden=1
    AND NOT EXISTS (SELECT 1 FROM dbo.SEGUSUCRED T WHERE T.UsuLogin=C.UsuLogin);
';

COMMIT TRANSACTION;

SELECT
  (SELECT COUNT(*) FROM dbo.UROLES) AS Roles,
  (SELECT COUNT(*) FROM dbo.URolesPorUser) AS RolesPorUsuario,
  (SELECT COUNT(*) FROM dbo.SEGUSUCRED) AS CredencialesModernas;

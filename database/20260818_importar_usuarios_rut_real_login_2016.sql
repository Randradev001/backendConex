/*
  Importa usuarios con RUT real para login en CONEX.

  Ejecutar en la instancia donde existen:
  - Base origen:  CONEX_MIGRACION
  - Base destino: CONEX

  El script:
  - No crea bases.
  - No borra usuarios.
  - Importa solo usuarios con UsuRut/UsuDV informados y digito verificador
    valido por modulo 11.
  - Excluye RUT de prueba repetidos por defecto, incluido 11111111-1.
  - Copia empresas asociadas, relacion usuario-empresa, credenciales modernas
    si existen, y permisos/roles asociados a esos usuarios.

  Si un usuario no tiene SEGUSUCRED en origen, conserva UsuClave para que el
  backend pueda migrar la clave legada en el primer inicio de sesion.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_ID(N'CONEX') IS NULL
BEGIN
  RAISERROR('No existe la base destino CONEX.', 16, 1);
  RETURN;
END;
GO

USE CONEX;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SourceDatabase sysname = N'CONEX_MIGRACION';
DECLARE @ExcludeDummyRut bit = 1;
DECLARE @Sql nvarchar(max);
DECLARE @SourcePrefix nvarchar(300);

IF DB_ID(@SourceDatabase) IS NULL
BEGIN
  RAISERROR('No existe la base origen configurada en @SourceDatabase.', 16, 1);
  RETURN;
END;

SET @SourcePrefix = QUOTENAME(@SourceDatabase) + N'.dbo.';

IF OBJECT_ID(@SourcePrefix + N'USUARIOS', N'U') IS NULL
   OR OBJECT_ID(@SourcePrefix + N'DEFEMP', N'U') IS NULL
   OR OBJECT_ID(@SourcePrefix + N'SEGUSUEMP', N'U') IS NULL
BEGIN
  RAISERROR('La base origen debe tener USUARIOS, DEFEMP y SEGUSUEMP.', 16, 1);
  RETURN;
END;

IF OBJECT_ID(N'dbo.USUARIOS', N'U') IS NULL
   OR OBJECT_ID(N'dbo.DEFEMP', N'U') IS NULL
   OR OBJECT_ID(N'dbo.SEGUSUEMP', N'U') IS NULL
   OR OBJECT_ID(N'dbo.SEGUSUCRED', N'U') IS NULL
BEGIN
  RAISERROR('La base destino debe tener USUARIOS, DEFEMP, SEGUSUEMP y SEGUSUCRED.', 16, 1);
  RETURN;
END;

IF OBJECT_ID(N'tempdb..#UsuariosRutReal', N'U') IS NOT NULL DROP TABLE #UsuariosRutReal;
IF OBJECT_ID(N'tempdb..#RolesRutReal', N'U') IS NOT NULL DROP TABLE #RolesRutReal;

CREATE TABLE #UsuariosRutReal (
  UsuLogin char(10) NOT NULL PRIMARY KEY,
  UsuRut decimal(9,0) NOT NULL,
  UsuDV char(1) NOT NULL
);

CREATE TABLE #RolesRutReal (
  ROLCod char(10) NOT NULL PRIMARY KEY
);

SET @Sql = N'
;WITH Base AS (
  SELECT
    CAST(U.UsuLogin AS char(10)) AS UsuLogin,
    CONVERT(decimal(9,0), U.UsuRut) AS UsuRut,
    UPPER(LTRIM(RTRIM(U.UsuDV))) AS UsuDV,
    REVERSE(CONVERT(varchar(9), CONVERT(int, U.UsuRut))) AS RutReves
  FROM ' + @SourcePrefix + N'USUARIOS AS U
  WHERE U.UsuLogin IS NOT NULL
    AND LEN(LTRIM(RTRIM(U.UsuLogin))) > 0
    AND TRY_CONVERT(int, U.UsuRut) BETWEEN 1000000 AND 99999999
    AND U.UsuDV IS NOT NULL
    AND UPPER(LTRIM(RTRIM(U.UsuDV))) LIKE ''[0-9K]''
    AND (
      @ExcludeDummyRut = 0
      OR CONVERT(int, U.UsuRut) NOT IN (
        11111111, 22222222, 33333333, 44444444, 55555555,
        66666666, 77777777, 88888888, 99999999
      )
    )
), RutCalculado AS (
  SELECT
    B.UsuLogin,
    B.UsuRut,
    B.UsuDV,
    SUM(CONVERT(int, SUBSTRING(B.RutReves, V.Pos, 1)) * V.Multiplicador) AS SumaRut
  FROM Base AS B
  CROSS JOIN (
    VALUES
      (1,2),(2,3),(3,4),(4,5),(5,6),(6,7),(7,2),(8,3),(9,4)
  ) AS V(Pos, Multiplicador)
  WHERE V.Pos <= LEN(B.RutReves)
  GROUP BY B.UsuLogin, B.UsuRut, B.UsuDV
), Validados AS (
  SELECT
    R.UsuLogin,
    R.UsuRut,
    R.UsuDV,
    CASE 11 - (R.SumaRut % 11)
      WHEN 11 THEN ''0''
      WHEN 10 THEN ''K''
      ELSE CONVERT(char(1), 11 - (R.SumaRut % 11))
    END AS DvEsperado
  FROM RutCalculado AS R
)
INSERT INTO #UsuariosRutReal (UsuLogin, UsuRut, UsuDV)
SELECT V.UsuLogin, V.UsuRut, V.UsuDV
FROM Validados AS V
WHERE V.UsuDV = V.DvEsperado
  AND EXISTS (
    SELECT 1
    FROM ' + @SourcePrefix + N'SEGUSUEMP AS UE
    WHERE RTRIM(UE.UsuLogin) = RTRIM(V.UsuLogin)
      AND COALESCE(UE.UsuEstado, 1) = 1
  );';

EXEC sys.sp_executesql
  @Sql,
  N'@ExcludeDummyRut bit',
  @ExcludeDummyRut = @ExcludeDummyRut;

IF NOT EXISTS (SELECT 1 FROM #UsuariosRutReal)
BEGIN
  RAISERROR('No se encontraron usuarios activos con RUT real y empresa asignada.', 16, 1);
  RETURN;
END;

BEGIN TRANSACTION;

/* Empresas necesarias para los usuarios importados. */
SET @Sql = N'
INSERT INTO dbo.DEFEMP (EmpCod, EmpNom, EmpGiro, Empdir, EmpRut, EmpDV, EmpSw, empreg, Empcom)
SELECT DISTINCT
  S.EmpCod,
  LEFT(COALESCE(S.EmpNom, ''Empresa '' + CONVERT(varchar(10), S.EmpCod)), 50),
  LEFT(COALESCE(S.EmpGiro, '' ''), 35),
  LEFT(COALESCE(S.Empdir, '' ''), 30),
  S.EmpRut,
  LEFT(COALESCE(S.EmpDV, '' ''), 1),
  S.EmpSw,
  LEFT(COALESCE(S.empreg, '' ''), 20),
  LEFT(COALESCE(S.Empcom, '' ''), 30)
FROM ' + @SourcePrefix + N'DEFEMP AS S
WHERE EXISTS (
    SELECT 1
    FROM ' + @SourcePrefix + N'SEGUSUEMP AS UE
    INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(UE.UsuLogin)
    WHERE UE.GECODEMP = S.EmpCod
  )
  AND NOT EXISTS (
    SELECT 1 FROM dbo.DEFEMP AS T WHERE T.EmpCod = S.EmpCod
  );';
EXEC sys.sp_executesql @Sql;

/* Identidad global: se conserva UsuClave para convivencia si no hay SEGUSUCRED. */
SET @Sql = N'
INSERT INTO dbo.USUARIOS
  (UsuLogin, Usunom, UsuClave, UsuRut, UsuDV, UsuCorreo, UsuCargo, UsuNseg, UsuExpira, usucrea)
SELECT
  CAST(S.UsuLogin AS char(10)),
  LEFT(COALESCE(NULLIF(RTRIM(S.Usunom), ''''), RTRIM(S.UsuLogin)), 35),
  LEFT(S.UsuClave, 8),
  S.UsuRut,
  LEFT(UPPER(LTRIM(RTRIM(S.UsuDV))), 1),
  LEFT(COALESCE(S.UsuCorreo, '' ''), 30),
  LEFT(COALESCE(S.UsuCargo, '' ''), 30),
  S.UsuNseg,
  S.UsuExpira,
  LEFT(COALESCE(S.usucrea, ''MIGRACION''), 10)
FROM ' + @SourcePrefix + N'USUARIOS AS S
INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(S.UsuLogin)
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.USUARIOS AS T WHERE RTRIM(T.UsuLogin) = RTRIM(S.UsuLogin)
);';
EXEC sys.sp_executesql @Sql;

/* Empresas activas donde el usuario puede iniciar sesion. */
SET @Sql = N'
INSERT INTO dbo.SEGUSUEMP
  (GECODEMP, UsuLogin, UsuEstado, UsuPerfil, UsuTipo, EsPrincipal, FechaCrea, UsuCrea)
SELECT DISTINCT
  UE.GECODEMP,
  U.UsuLogin,
  COALESCE(NULLIF(UE.UsuEstado, 0), 1),
  LEFT(COALESCE(UE.UsuPerfil, '' ''), 10),
  COALESCE(UE.UsuTipo, 0),
  COALESCE(UE.EsPrincipal, 0),
  COALESCE(UE.FechaCrea, SYSUTCDATETIME()),
  LEFT(COALESCE(UE.UsuCrea, ''MIGRACION''), 10)
FROM ' + @SourcePrefix + N'SEGUSUEMP AS UE
INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(UE.UsuLogin)
INNER JOIN dbo.DEFEMP AS E ON E.EmpCod = UE.GECODEMP
INNER JOIN dbo.USUARIOS AS TU ON RTRIM(TU.UsuLogin) = RTRIM(U.UsuLogin)
WHERE COALESCE(UE.UsuEstado, 1) = 1
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.SEGUSUEMP AS T
    WHERE T.GECODEMP = UE.GECODEMP
      AND RTRIM(T.UsuLogin) = RTRIM(U.UsuLogin)
  );';
EXEC sys.sp_executesql @Sql;

/* Asegura una empresa principal por usuario cuando el origen no la trae marcada. */
;WITH Principales AS (
  SELECT
    UE.GECODEMP,
    UE.UsuLogin,
    ROW_NUMBER() OVER (PARTITION BY UE.UsuLogin ORDER BY UE.EsPrincipal DESC, UE.GECODEMP) AS Orden
  FROM dbo.SEGUSUEMP AS UE
  INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(UE.UsuLogin)
  WHERE UE.UsuEstado = 1
)
UPDATE UE
SET EsPrincipal = CASE WHEN P.Orden = 1 THEN 1 ELSE 0 END
FROM dbo.SEGUSUEMP AS UE
INNER JOIN Principales AS P
  ON P.GECODEMP = UE.GECODEMP
 AND P.UsuLogin = UE.UsuLogin;

/* Credenciales modernas, si existen en el origen. */
SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'SEGUSUCRED'', N''U'') IS NOT NULL
BEGIN
  ;WITH Credenciales AS (
    SELECT
      CAST(C.UsuLogin AS char(10)) AS UsuLogin,
      C.PasswordSalt,
      C.PasswordHash,
      C.MigradoDesdeGX,
      C.FechaCambio,
      ROW_NUMBER() OVER (
        PARTITION BY RTRIM(C.UsuLogin)
        ORDER BY C.FechaCambio DESC
      ) AS Orden
    FROM ' + @SourcePrefix + N'SEGUSUCRED AS C
    INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(C.UsuLogin)
  )
  INSERT INTO dbo.SEGUSUCRED
    (UsuLogin, PasswordSalt, PasswordHash, MigradoDesdeGX, FechaCambio)
  SELECT
    C.UsuLogin,
    C.PasswordSalt,
    C.PasswordHash,
    COALESCE(C.MigradoDesdeGX, 0),
    COALESCE(C.FechaCambio, SYSUTCDATETIME())
  FROM Credenciales AS C
  WHERE C.Orden = 1
    AND NOT EXISTS (
      SELECT 1 FROM dbo.SEGUSUCRED AS T WHERE RTRIM(T.UsuLogin) = RTRIM(C.UsuLogin)
    );
END;';
EXEC sys.sp_executesql @Sql;

/* Permisos directos necesarios para menu y autorizacion. */
SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'ASIGSIST'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.ASIGSIST (GECODEMP, AsgSisLogin, SistCod)
  SELECT DISTINCT A.GECODEMP, U.UsuLogin, A.SistCod
  FROM ' + @SourcePrefix + N'ASIGSIST AS A
  INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(A.AsgSisLogin)
  INNER JOIN dbo.SEGUSUEMP AS UE ON UE.GECODEMP = A.GECODEMP AND RTRIM(UE.UsuLogin) = RTRIM(U.UsuLogin)
  INNER JOIN dbo.SISTEMAS AS S ON S.SistCod = A.SistCod
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ASIGSIST AS T
    WHERE T.GECODEMP = A.GECODEMP AND RTRIM(T.AsgSisLogin) = RTRIM(U.UsuLogin) AND T.SistCod = A.SistCod
  );
END;';
EXEC sys.sp_executesql @Sql;

SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'ASIG'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.ASIG (GECODEMP, AsigUsu, SistCod, AsigMod, AsigDes, AsigAsig)
  SELECT DISTINCT A.GECODEMP, U.UsuLogin, A.SistCod, A.AsigMod, LEFT(A.AsigDes, 30), LEFT(A.AsigAsig, 10)
  FROM ' + @SourcePrefix + N'ASIG AS A
  INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(REPLACE(A.AsigUsu, CHAR(160), '' ''))
  INNER JOIN dbo.SEGUSUEMP AS UE ON UE.GECODEMP = A.GECODEMP AND RTRIM(UE.UsuLogin) = RTRIM(U.UsuLogin)
  INNER JOIN dbo.MODULOS AS M ON M.SistCod = A.SistCod AND M.Modcod = A.AsigMod
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ASIG AS T
    WHERE T.GECODEMP = A.GECODEMP AND RTRIM(T.AsigUsu) = RTRIM(U.UsuLogin)
      AND T.SistCod = A.SistCod AND T.AsigMod = A.AsigMod
  );
END;';
EXEC sys.sp_executesql @Sql;

SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'ASIGPROG'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.ASIGPROG (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgUsuC)
  SELECT DISTINCT A.GECODEMP, U.UsuLogin, A.SistCod, A.Modcod, A.ProgCod, LEFT(A.ProgUsuC, 10)
  FROM ' + @SourcePrefix + N'ASIGPROG AS A
  INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(A.UsuLogin)
  INNER JOIN dbo.SEGUSUEMP AS UE ON UE.GECODEMP = A.GECODEMP AND RTRIM(UE.UsuLogin) = RTRIM(U.UsuLogin)
  INNER JOIN dbo.PROGRAM AS P ON P.SistCod = A.SistCod AND P.Modcod = A.Modcod AND P.ProgCod = A.ProgCod
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ASIGPROG AS T
    WHERE T.GECODEMP = A.GECODEMP AND RTRIM(T.UsuLogin) = RTRIM(U.UsuLogin)
      AND T.SistCod = A.SistCod AND T.Modcod = A.Modcod AND T.ProgCod = A.ProgCod
  );
END;';
EXEC sys.sp_executesql @Sql;

SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'ASIGPROG1'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.ASIGPROG1 (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgOPCod)
  SELECT DISTINCT A.GECODEMP, U.UsuLogin, A.SistCod, A.Modcod, A.ProgCod, A.ProgOPCod
  FROM ' + @SourcePrefix + N'ASIGPROG1 AS A
  INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(A.UsuLogin)
  INNER JOIN dbo.SEGUSUEMP AS UE ON UE.GECODEMP = A.GECODEMP AND RTRIM(UE.UsuLogin) = RTRIM(U.UsuLogin)
  INNER JOIN dbo.PROGRAM1 AS P ON P.SistCod = A.SistCod AND P.Modcod = A.Modcod AND P.ProgCod = A.ProgCod AND P.ProgOPCod = A.ProgOPCod
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ASIGPROG1 AS T
    WHERE T.GECODEMP = A.GECODEMP AND RTRIM(T.UsuLogin) = RTRIM(U.UsuLogin)
      AND T.SistCod = A.SistCod AND T.Modcod = A.Modcod AND T.ProgCod = A.ProgCod AND T.ProgOPCod = A.ProgOPCod
  );
END;';
EXEC sys.sp_executesql @Sql;

/* Roles asociados a los usuarios importados y sus plantillas. */
SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'URolesPorUser'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO #RolesRutReal (ROLCod)
  SELECT DISTINCT CAST(RXU.ROLCod AS char(10))
  FROM ' + @SourcePrefix + N'URolesPorUser AS RXU
  INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(RXU.UsuLogin)
  WHERE NOT EXISTS (
    SELECT 1 FROM #RolesRutReal AS R WHERE RTRIM(R.ROLCod) = RTRIM(RXU.ROLCod)
  );
END;';
EXEC sys.sp_executesql @Sql;

SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'UROLES'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.UROLES (ROLCod, ROLNombre, ROLFCrea, ROLUCrea)
  SELECT R.ROLCod, LEFT(COALESCE(S.ROLNombre, RTRIM(R.ROLCod)), 30), COALESCE(S.ROLFCrea, SYSUTCDATETIME()), LEFT(S.ROLUCrea, 10)
  FROM #RolesRutReal AS R
  INNER JOIN ' + @SourcePrefix + N'UROLES AS S ON RTRIM(S.ROLCod) = RTRIM(R.ROLCod)
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.UROLES AS T WHERE RTRIM(T.ROLCod) = RTRIM(R.ROLCod)
  );
END;';
EXEC sys.sp_executesql @Sql;

SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'URolesPorUser'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.URolesPorUser (GECODEMP, UsuLogin, ROLCod, RXUFecCrea)
  SELECT DISTINCT RXU.GECODEMP, U.UsuLogin, R.ROLCod, COALESCE(RXU.RXUFecCrea, SYSUTCDATETIME())
  FROM ' + @SourcePrefix + N'URolesPorUser AS RXU
  INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(RXU.UsuLogin)
  INNER JOIN dbo.UROLES AS R ON RTRIM(R.ROLCod) = RTRIM(RXU.ROLCod)
  INNER JOIN dbo.SEGUSUEMP AS UE ON UE.GECODEMP = RXU.GECODEMP AND RTRIM(UE.UsuLogin) = RTRIM(U.UsuLogin)
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.URolesPorUser AS T
    WHERE T.GECODEMP = RXU.GECODEMP AND RTRIM(T.UsuLogin) = RTRIM(U.UsuLogin) AND RTRIM(T.ROLCod) = RTRIM(R.ROLCod)
  );
END;';
EXEC sys.sp_executesql @Sql;

SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'ASIG'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.ASIG (GECODEMP, AsigUsu, SistCod, AsigMod, AsigDes, AsigAsig)
  SELECT DISTINCT 0, R.ROLCod, A.SistCod, A.AsigMod, LEFT(A.AsigDes, 30), LEFT(A.AsigAsig, 10)
  FROM ' + @SourcePrefix + N'ASIG AS A
  INNER JOIN #RolesRutReal AS R ON RTRIM(R.ROLCod) = RTRIM(REPLACE(A.AsigUsu, CHAR(160), '' ''))
  INNER JOIN dbo.MODULOS AS M ON M.SistCod = A.SistCod AND M.Modcod = A.AsigMod
  WHERE A.GECODEMP = 0
    AND NOT EXISTS (
      SELECT 1 FROM dbo.ASIG AS T
      WHERE T.GECODEMP = 0 AND RTRIM(T.AsigUsu) = RTRIM(R.ROLCod)
        AND T.SistCod = A.SistCod AND T.AsigMod = A.AsigMod
    );
END;';
EXEC sys.sp_executesql @Sql;

SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'ASIGPROG'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.ASIGPROG (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgUsuC)
  SELECT DISTINCT 0, R.ROLCod, A.SistCod, A.Modcod, A.ProgCod, LEFT(A.ProgUsuC, 10)
  FROM ' + @SourcePrefix + N'ASIGPROG AS A
  INNER JOIN #RolesRutReal AS R ON RTRIM(R.ROLCod) = RTRIM(A.UsuLogin)
  INNER JOIN dbo.PROGRAM AS P ON P.SistCod = A.SistCod AND P.Modcod = A.Modcod AND P.ProgCod = A.ProgCod
  WHERE A.GECODEMP = 0
    AND NOT EXISTS (
      SELECT 1 FROM dbo.ASIGPROG AS T
      WHERE T.GECODEMP = 0 AND RTRIM(T.UsuLogin) = RTRIM(R.ROLCod)
        AND T.SistCod = A.SistCod AND T.Modcod = A.Modcod AND T.ProgCod = A.ProgCod
    );
END;';
EXEC sys.sp_executesql @Sql;

SET @Sql = N'
IF OBJECT_ID(N''' + @SourcePrefix + N'ASIGPROG1'', N''U'') IS NOT NULL
BEGIN
  INSERT INTO dbo.ASIGPROG1 (GECODEMP, UsuLogin, SistCod, Modcod, ProgCod, ProgOPCod)
  SELECT DISTINCT 0, R.ROLCod, A.SistCod, A.Modcod, A.ProgCod, A.ProgOPCod
  FROM ' + @SourcePrefix + N'ASIGPROG1 AS A
  INNER JOIN #RolesRutReal AS R ON RTRIM(R.ROLCod) = RTRIM(A.UsuLogin)
  INNER JOIN dbo.PROGRAM1 AS P ON P.SistCod = A.SistCod AND P.Modcod = A.Modcod AND P.ProgCod = A.ProgCod AND P.ProgOPCod = A.ProgOPCod
  WHERE A.GECODEMP = 0
    AND NOT EXISTS (
      SELECT 1 FROM dbo.ASIGPROG1 AS T
      WHERE T.GECODEMP = 0 AND RTRIM(T.UsuLogin) = RTRIM(R.ROLCod)
        AND T.SistCod = A.SistCod AND T.Modcod = A.Modcod AND T.ProgCod = A.ProgCod AND T.ProgOPCod = A.ProgOPCod
    );
END;';
EXEC sys.sp_executesql @Sql;

COMMIT TRANSACTION;

SELECT
  (SELECT COUNT(*) FROM #UsuariosRutReal) AS UsuariosRutRealOrigen,
  (SELECT COUNT(*)
   FROM dbo.USUARIOS AS U
   INNER JOIN #UsuariosRutReal AS R ON RTRIM(R.UsuLogin) = RTRIM(U.UsuLogin)) AS UsuariosEnDestino,
  (SELECT COUNT(*)
   FROM dbo.SEGUSUEMP AS UE
   INNER JOIN #UsuariosRutReal AS R ON RTRIM(R.UsuLogin) = RTRIM(UE.UsuLogin)) AS UsuariosEmpresaEnDestino,
  (SELECT COUNT(*)
   FROM dbo.SEGUSUCRED AS C
   INNER JOIN #UsuariosRutReal AS R ON RTRIM(R.UsuLogin) = RTRIM(C.UsuLogin)) AS CredencialesModernas,
  (SELECT COUNT(*)
   FROM dbo.USUARIOS AS U
   INNER JOIN #UsuariosRutReal AS R ON RTRIM(R.UsuLogin) = RTRIM(U.UsuLogin)
   LEFT JOIN dbo.SEGUSUCRED AS C ON RTRIM(C.UsuLogin) = RTRIM(U.UsuLogin)
   WHERE C.UsuLogin IS NULL AND NULLIF(RTRIM(U.UsuClave), '') IS NULL) AS UsuariosSinClaveDisponible,
  (SELECT COUNT(*) FROM #RolesRutReal) AS RolesRelacionados;

SELECT
  RTRIM(U.UsuLogin) AS UsuLogin,
  U.UsuRut,
  RTRIM(U.UsuDV) AS UsuDV,
  RTRIM(U.Usunom) AS Usunom,
  COUNT(UE.GECODEMP) AS Empresas,
  CASE WHEN C.UsuLogin IS NULL THEN 'LEGADA_USUCLAVE' ELSE 'SEGUSUCRED' END AS TipoClave
FROM dbo.USUARIOS AS U
INNER JOIN #UsuariosRutReal AS R ON RTRIM(R.UsuLogin) = RTRIM(U.UsuLogin)
INNER JOIN dbo.SEGUSUEMP AS UE ON RTRIM(UE.UsuLogin) = RTRIM(U.UsuLogin)
LEFT JOIN dbo.SEGUSUCRED AS C ON RTRIM(C.UsuLogin) = RTRIM(U.UsuLogin)
GROUP BY U.UsuLogin, U.UsuRut, U.UsuDV, U.Usunom, C.UsuLogin
ORDER BY U.UsuRut, U.UsuLogin;

PRINT 'Importacion de usuarios con RUT real finalizada.';


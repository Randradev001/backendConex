/*
  Genera SOLO inserts literales para login de usuarios con RUT real.

  Ejecutar en el servidor donde exista CONEX_MIGRACION.
  No modifica datos. El resultado de la consulta es una columna SqlLine con
  INSERT INTO ... VALUES (...).

  Copiar el resultado y ejecutarlo en la base CONEX, donde las tablas ya deben
  existir.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'tempdb..#UsuariosRutReal', N'U') IS NOT NULL DROP TABLE #UsuariosRutReal;
IF OBJECT_ID(N'tempdb..#InsertLines', N'U') IS NOT NULL DROP TABLE #InsertLines;

CREATE TABLE #UsuariosRutReal (
  UsuLogin char(10) NOT NULL PRIMARY KEY,
  UsuRut decimal(9,0) NOT NULL,
  UsuDV char(1) NOT NULL
);

CREATE TABLE #InsertLines (
  LineOrder int IDENTITY(1,1) NOT NULL,
  SqlLine nvarchar(max) NOT NULL
);

;WITH Base AS (
  SELECT
    CAST(U.UsuLogin AS char(10)) AS UsuLogin,
    CONVERT(decimal(9,0), U.UsuRut) AS UsuRut,
    UPPER(LTRIM(RTRIM(U.UsuDV))) AS UsuDV,
    REVERSE(CONVERT(varchar(9), CONVERT(int, U.UsuRut))) AS RutReves
  FROM CONEX_MIGRACION.dbo.USUARIOS AS U
  WHERE U.UsuLogin IS NOT NULL
    AND LEN(LTRIM(RTRIM(U.UsuLogin))) > 0
    AND TRY_CONVERT(int, U.UsuRut) BETWEEN 1000000 AND 99999999
    AND U.UsuDV IS NOT NULL
    AND UPPER(LTRIM(RTRIM(U.UsuDV))) LIKE '[0-9K]'
    AND CONVERT(int, U.UsuRut) NOT IN (
      11111111, 22222222, 33333333, 44444444, 55555555,
      66666666, 77777777, 88888888, 99999999
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
      WHEN 11 THEN '0'
      WHEN 10 THEN 'K'
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
    FROM CONEX_MIGRACION.dbo.SEGUSUEMP AS UE
    WHERE RTRIM(UE.UsuLogin) = RTRIM(V.UsuLogin)
      AND COALESCE(UE.UsuEstado, 1) = 1
  );

INSERT INTO #InsertLines (SqlLine)
SELECT DISTINCT
  N'INSERT INTO dbo.DEFEMP (EmpCod, EmpNom, EmpGiro, Empdir, EmpRut, EmpDV, EmpSw, empreg, Empcom) VALUES ('
  + CONVERT(nvarchar(20), E.EmpCod) + N', '
  + N'''' + REPLACE(LEFT(COALESCE(E.EmpNom, ''), 50), '''', '''''') + N''', '
  + N'''' + REPLACE(LEFT(COALESCE(E.EmpGiro, ''), 35), '''', '''''') + N''', '
  + N'''' + REPLACE(LEFT(COALESCE(E.Empdir, ''), 30), '''', '''''') + N''', '
  + COALESCE(CONVERT(nvarchar(30), E.EmpRut), N'NULL') + N', '
  + CASE WHEN E.EmpDV IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(E.EmpDV, 1), '''', '''''') + N'''' END + N', '
  + COALESCE(CONVERT(nvarchar(20), E.EmpSw), N'NULL') + N', '
  + CASE WHEN E.empreg IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(E.empreg, 20), '''', '''''') + N'''' END + N', '
  + CASE WHEN E.Empcom IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(E.Empcom, 30), '''', '''''') + N'''' END
  + N');'
FROM CONEX_MIGRACION.dbo.DEFEMP AS E
WHERE EXISTS (
  SELECT 1
  FROM CONEX_MIGRACION.dbo.SEGUSUEMP AS UE
  INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(UE.UsuLogin)
  WHERE UE.GECODEMP = E.EmpCod
)
ORDER BY 1;

INSERT INTO #InsertLines (SqlLine)
SELECT
  N'INSERT INTO dbo.USUARIOS (UsuLogin, Usunom, UsuClave, UsuRut, UsuDV, UsuCorreo, UsuCargo, UsuNseg, UsuExpira, usucrea) VALUES ('
  + N'''' + REPLACE(LEFT(COALESCE(U.UsuLogin, ''), 10), '''', '''''') + N''', '
  + N'''' + REPLACE(LEFT(COALESCE(U.Usunom, ''), 35), '''', '''''') + N''', '
  + CASE WHEN U.UsuClave IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(U.UsuClave, 8), '''', '''''') + N'''' END + N', '
  + COALESCE(CONVERT(nvarchar(30), U.UsuRut), N'NULL') + N', '
  + CASE WHEN U.UsuDV IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(UPPER(LTRIM(RTRIM(U.UsuDV))), 1), '''', '''''') + N'''' END + N', '
  + CASE WHEN U.UsuCorreo IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(U.UsuCorreo, 30), '''', '''''') + N'''' END + N', '
  + CASE WHEN U.UsuCargo IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(U.UsuCargo, 30), '''', '''''') + N'''' END + N', '
  + COALESCE(CONVERT(nvarchar(20), U.UsuNseg), N'NULL') + N', '
  + CASE WHEN U.UsuExpira IS NULL THEN N'NULL' ELSE N'CONVERT(datetime2(0), ''' + CONVERT(nvarchar(19), U.UsuExpira, 120) + N''', 120)' END + N', '
  + CASE WHEN U.usucrea IS NULL THEN N'''MIGRACION''' ELSE N'''' + REPLACE(LEFT(U.usucrea, 10), '''', '''''') + N'''' END
  + N');'
FROM CONEX_MIGRACION.dbo.USUARIOS AS U
INNER JOIN #UsuariosRutReal AS R ON RTRIM(R.UsuLogin) = RTRIM(U.UsuLogin)
ORDER BY U.UsuRut, U.UsuLogin;

INSERT INTO #InsertLines (SqlLine)
SELECT
  N'INSERT INTO dbo.SEGUSUEMP (GECODEMP, UsuLogin, UsuEstado, UsuPerfil, UsuTipo, EsPrincipal, FechaCrea, UsuCrea) VALUES ('
  + CONVERT(nvarchar(20), UE.GECODEMP) + N', '
  + N'''' + REPLACE(LEFT(UE.UsuLogin, 10), '''', '''''') + N''', '
  + CONVERT(nvarchar(20), COALESCE(NULLIF(UE.UsuEstado, 0), 1)) + N', '
  + CASE WHEN UE.UsuPerfil IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(UE.UsuPerfil, 10), '''', '''''') + N'''' END + N', '
  + CONVERT(nvarchar(20), COALESCE(UE.UsuTipo, 0)) + N', '
  + CONVERT(nvarchar(1), COALESCE(CONVERT(int, UE.EsPrincipal), 0)) + N', '
  + CASE WHEN UE.FechaCrea IS NULL THEN N'SYSUTCDATETIME()' ELSE N'CONVERT(datetime2(0), ''' + CONVERT(nvarchar(19), UE.FechaCrea, 120) + N''', 120)' END + N', '
  + CASE WHEN UE.UsuCrea IS NULL THEN N'''MIGRACION''' ELSE N'''' + REPLACE(LEFT(UE.UsuCrea, 10), '''', '''''') + N'''' END
  + N');'
FROM CONEX_MIGRACION.dbo.SEGUSUEMP AS UE
INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(UE.UsuLogin)
WHERE COALESCE(UE.UsuEstado, 1) = 1
ORDER BY UE.GECODEMP, UE.UsuLogin;

IF OBJECT_ID(N'CONEX_MIGRACION.dbo.SEGUSUCRED', N'U') IS NOT NULL
BEGIN
  ;WITH Credenciales AS (
    SELECT
      C.UsuLogin,
      C.PasswordSalt,
      C.PasswordHash,
      C.MigradoDesdeGX,
      C.FechaCambio,
      ROW_NUMBER() OVER (
        PARTITION BY RTRIM(C.UsuLogin)
        ORDER BY C.FechaCambio DESC
      ) AS Orden
    FROM CONEX_MIGRACION.dbo.SEGUSUCRED AS C
    INNER JOIN #UsuariosRutReal AS U ON RTRIM(U.UsuLogin) = RTRIM(C.UsuLogin)
  )
  INSERT INTO #InsertLines (SqlLine)
  SELECT
    N'INSERT INTO dbo.SEGUSUCRED (UsuLogin, PasswordSalt, PasswordHash, MigradoDesdeGX, FechaCambio) VALUES ('
    + N'''' + REPLACE(LEFT(C.UsuLogin, 10), '''', '''''') + N''', '
    + N'''' + REPLACE(C.PasswordSalt, '''', '''''') + N''', '
    + N'''' + REPLACE(C.PasswordHash, '''', '''''') + N''', '
    + CONVERT(nvarchar(1), COALESCE(CONVERT(int, C.MigradoDesdeGX), 0)) + N', '
    + CASE WHEN C.FechaCambio IS NULL THEN N'SYSUTCDATETIME()' ELSE N'CONVERT(datetime2(0), ''' + CONVERT(nvarchar(19), C.FechaCambio, 120) + N''', 120)' END
    + N');'
  FROM Credenciales AS C
  WHERE C.Orden = 1
  ORDER BY C.UsuLogin;
END;

SELECT SqlLine
FROM #InsertLines
ORDER BY LineOrder;


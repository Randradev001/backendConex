/*
  Genera SOLO inserts para la tabla USUARIOS.

  Ejecutar en el servidor donde exista CONEX_MIGRACION.
  El resultado es una columna SqlLine con INSERT INTO dbo.USUARIOS ... VALUES ...
*/

SET NOCOUNT ON;

;WITH Base AS (
  SELECT
    CAST(U.UsuLogin AS char(10)) AS UsuLogin,
    U.Usunom,
    U.UsuClave,
    CONVERT(decimal(9,0), U.UsuRut) AS UsuRut,
    UPPER(LTRIM(RTRIM(U.UsuDV))) AS UsuDV,
    U.UsuCorreo,
    U.UsuCargo,
    U.UsuNseg,
    U.UsuExpira,
    U.usucrea,
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
    B.*,
    SUM(CONVERT(int, SUBSTRING(B.RutReves, V.Pos, 1)) * V.Multiplicador) AS SumaRut
  FROM Base AS B
  CROSS JOIN (
    VALUES
      (1,2),(2,3),(3,4),(4,5),(5,6),(6,7),(7,2),(8,3),(9,4)
  ) AS V(Pos, Multiplicador)
  WHERE V.Pos <= LEN(B.RutReves)
  GROUP BY
    B.UsuLogin,
    B.Usunom,
    B.UsuClave,
    B.UsuRut,
    B.UsuDV,
    B.UsuCorreo,
    B.UsuCargo,
    B.UsuNseg,
    B.UsuExpira,
    B.usucrea,
    B.RutReves
), UsuariosValidos AS (
  SELECT
    R.*,
    CASE 11 - (R.SumaRut % 11)
      WHEN 11 THEN '0'
      WHEN 10 THEN 'K'
      ELSE CONVERT(char(1), 11 - (R.SumaRut % 11))
    END AS DvEsperado
  FROM RutCalculado AS R
)
SELECT
  N'INSERT INTO dbo.USUARIOS (UsuLogin, Usunom, UsuClave, UsuRut, UsuDV, UsuCorreo, UsuCargo, UsuNseg, UsuExpira, usucrea) VALUES ('
  + N'''' + REPLACE(LEFT(COALESCE(UsuLogin, ''), 10), '''', '''''') + N''', '
  + N'''' + REPLACE(LEFT(COALESCE(Usunom, ''), 35), '''', '''''') + N''', '
  + CASE WHEN UsuClave IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(UsuClave, 8), '''', '''''') + N'''' END + N', '
  + COALESCE(CONVERT(nvarchar(30), UsuRut), N'NULL') + N', '
  + N'''' + REPLACE(LEFT(UsuDV, 1), '''', '''''') + N''', '
  + CASE WHEN UsuCorreo IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(UsuCorreo, 30), '''', '''''') + N'''' END + N', '
  + CASE WHEN UsuCargo IS NULL THEN N'NULL' ELSE N'''' + REPLACE(LEFT(UsuCargo, 30), '''', '''''') + N'''' END + N', '
  + COALESCE(CONVERT(nvarchar(20), UsuNseg), N'NULL') + N', '
  + CASE WHEN UsuExpira IS NULL THEN N'NULL' ELSE N'CONVERT(datetime2(0), ''' + CONVERT(nvarchar(19), UsuExpira, 120) + N''', 120)' END + N', '
  + CASE WHEN usucrea IS NULL THEN N'''MIGRACION''' ELSE N'''' + REPLACE(LEFT(usucrea, 10), '''', '''''') + N'''' END
  + N');' AS SqlLine
FROM UsuariosValidos
WHERE UsuDV = DvEsperado
ORDER BY UsuRut, UsuLogin;


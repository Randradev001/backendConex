#!/usr/bin/env bash
set -euo pipefail

if command -v sqlcmd >/dev/null 2>&1; then
  SQLCMD="$(command -v sqlcmd)"
elif [[ -x /opt/mssql-tools18/bin/sqlcmd ]]; then
  SQLCMD=/opt/mssql-tools18/bin/sqlcmd
elif [[ -x /opt/mssql-tools/bin/sqlcmd ]]; then
  SQLCMD=/opt/mssql-tools/bin/sqlcmd
else
  echo "No se encontro sqlcmd en la imagen de SQL Server." >&2
  exit 1
fi

SQLCMD_ARGS=(-S sqlserver -U sa -P "${MSSQL_SA_PASSWORD}" -C -b -r1)

database_exists="$(${SQLCMD} "${SQLCMD_ARGS[@]}" -h -1 -W -Q \
  "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'CONEX') IS NULL THEN 0 ELSE 1 END;" | tr -d '\r[:space:]')"

if [[ "${database_exists}" == "1" ]]; then
  echo "La base CONEX ya existe; no se vuelve a inicializar."
  exit 0
fi

if [[ -s /docker/backup/CONEX.bak ]]; then
  echo "Restaurando /docker/backup/CONEX.bak como base CONEX..."
  "${SQLCMD}" "${SQLCMD_ARGS[@]}" -i /docker/restore-backup.sql
else
  echo "No hay respaldo CONEX.bak; se creara una base vacia con el instalador versionado."
  "${SQLCMD}" "${SQLCMD_ARGS[@]}" -i /installer.sql
fi

"${SQLCMD}" "${SQLCMD_ARGS[@]}" -d CONEX -Q \
  "SET NOCOUNT ON; SELECT DB_NAME() AS BaseDatos, COUNT(*) AS Tablas FROM sys.tables WHERE is_ms_shipped = 0;"

echo "Inicializacion de CONEX completada."

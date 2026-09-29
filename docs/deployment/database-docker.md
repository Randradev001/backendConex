# Base de datos CONEX en Docker

## Que contiene

`compose.database.yml` levanta SQL Server 2022 Developer y conserva sus
archivos en el volumen `conex_sql_data`. La base mantiene nivel de
compatibilidad 130, equivalente a SQL Server 2016, porque el backend y sus
consultas deben seguir siendo compatibles con el servidor objetivo.

Al iniciar por primera vez, el servicio `initialize` elige una sola fuente:

1. si existe `database/docker/backup/CONEX.bak`, restaura esa copia con sus
   datos y la publica con el nombre `CONEX`;
2. si no existe, ejecuta `database/20260815_instalador_conex_2016.sql` y crea
   una base vacia, con estructura y seguridad inicial, pero sin historicos GX8.

Los reinicios posteriores no borran ni reinstalan la base. El volumen es la
copia de trabajo; el archivo `.bak` es el medio portable de respaldo.

## Crear el respaldo de la base real

Con el SQL Server local encendido y el `.env` actual del backend configurado:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-docker-database.ps1
```

El script crea un backup `COPY_ONLY`, valida su integridad y lo copia a
`database/docker/backup/CONEX.bak`. Ese archivo esta ignorado por Git porque
puede contener datos personales, usuarios y credenciales.

## Levantar SQL Server

```powershell
Copy-Item .env.database.example .env.database
# Edite .env.database y asigne una clave SA nueva y robusta.
docker compose --env-file .env.database -f compose.database.yml up -d
docker compose --env-file .env.database -f compose.database.yml logs initialize
```

Cuando `initialize` termine con codigo 0, el backend ejecutado en Windows debe
usar:

```dotenv
DB_SERVER=127.0.0.1
DB_PORT=14330
DB_DATABASE=CONEX
DB_USER=sa
DB_PASSWORD=<la misma MSSQL_SA_PASSWORD de .env.database>
DB_INSTANCE=
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

Compruebe la conexion con `npm run db:check`. El puerto se publica solamente
en `127.0.0.1`; no queda expuesto a otros equipos de la red.

## Traspasar a otro computador

1. Instale Docker Desktop y habilite contenedores Linux.
2. Copie o clone el proyecto. Git lleva Compose, scripts e instalador, pero no
   lleva el respaldo.
3. Copie por un canal seguro `database/docker/backup/CONEX.bak` al mismo lugar
   del proyecto nuevo.
4. Cree `.env.database` desde el ejemplo. La clave SA puede ser distinta de la
   del computador de origen: protege la nueva instancia, no cifra el `.bak`.
5. Ejecute el comando `docker compose ... up -d` anterior.
6. Configure el `.env` del backend para `localhost:14330`, base `CONEX`, y
   pruebe `npm run db:check`, login y las operaciones criticas.

No hace falta copiar el volumen Docker. Copiar el `.bak` es mas portable y
verificable. Para entregar el archivo use un disco cifrado o un canal seguro y
no lo envie por Git ni por correo sin cifrar.

## Operacion y recuperacion

```powershell
# Estado
docker compose --env-file .env.database -f compose.database.yml ps

# Detener sin perder datos
docker compose --env-file .env.database -f compose.database.yml down

# Ver logs del servidor
docker compose --env-file .env.database -f compose.database.yml logs sqlserver
```

`docker compose down -v` elimina el volumen y, por tanto, la copia de trabajo
del contenedor. Solo debe usarse si existe un respaldo verificado y realmente
se quiere reconstruir la instancia. Para volver a restaurar un `.bak`, detenga
el Compose, elimine deliberadamente el volumen y levante de nuevo.

Antes de una entrega o corte definitivo, cree un respaldo reciente, ejecute
`DBCC CHECKDB`, valide `npm run verify:conex` y haga una prueba de restauracion.

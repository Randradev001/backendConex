# Consolidacion en una base CONEX

> Estado al 2026-07-31: `CONEX_MIGRACION` es la base unica de trabajo y el
> cambio de nombre final a `CONEX` continua pendiente. Este documento describe
> el corte futuro; no ejecutarlo como si ya hubiera ocurrido. Consultar
> [CURRENT-STATE.md](CURRENT-STATE.md) antes de modificar la conexion.

## Objetivo

La aplicacion React/Node debe usar una sola base que conserve el modelo y los datos
originales de GeneXus 8. Las estructuras nuevas de autenticacion y roles se agregan
de forma aditiva; no se reemplazan los maestros ni se renombran las tablas GX8.

## Estado actual

- `CONEX_MIGRACION` es una copia operativa de la base original CONEX.
- `20260728_CONEX_original_homologacion.sql` agrega las estructuras necesarias para
  seguridad, asociaciones usuario-empresa y metadatos de navegacion.
- `20260728_import_BDCONEXCO_security.sql` importo solamente la seguridad compatible
  desde `BDCONEXCO`.
- El backend apunta a `CONEX_MIGRACION` durante la validacion.
- `BDCONEXCO` y `CONEX_GX8_ANALISIS` no son consultadas por la aplicacion.

## Criterios antes del corte

1. Iniciar sesion con al menos un usuario real y comprobar que el RUT selecciona su
   empresa activa en `SEGUSUEMP`.
2. Revisar menu, permisos directos GX8 y permisos heredados por rol.
3. Probar altas, cambios, consultas, filtros y exportaciones de los maestros migrados.
4. Ejecutar `node scripts/verify-conex-migration.js` y `DBCC CHECKDB` sin errores.

## Corte final

1. Detener backend y frontend para evitar conexiones durante el cambio.
2. Comprobar que no exista otra base llamada `CONEX` o retirar esa base antigua.
3. Renombrar `CONEX_MIGRACION` a `CONEX` en SQL Server.
4. Cambiar `SQLSERVER_DATABASE=CONEX` en `.env`.
5. Iniciar el backend y repetir login, menu, un maestro y una exportacion.
6. Retirar `BDCONEXCO` y `CONEX_GX8_ANALISIS` solo despues de aceptar la prueba final.

No es necesario volver a adjuntar el MDF original: `CONEX_MIGRACION` ya contiene sus
tablas y datos, mas la homologacion. Los dos scripts de 2026-07-28 son repetibles y
deben conservarse en Git como definicion de los cambios aplicados.

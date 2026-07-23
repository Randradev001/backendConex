# ADR-001: Modelo de autorizacion

## Estado

Aceptado para la migracion inicial.

## Decision

Conservar los nombres y niveles fisicos de GeneXus: `ASIGSIST`, `ASIG`, `ASIGPROG` y `ASIGPROG1`. `ASIGPROG1` no se aplana porque representa el segundo nivel de `AsigProg`. `NIVSEG` permanece disponible hasta terminar el estudio, pero no reemplaza las asignaciones explicitas.

La autorizacion se ejecuta en Node.js. React solo presenta menus permitidos y consulta al backend; ocultar un menu nunca se considera una medida de seguridad.

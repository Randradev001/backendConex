# Estado de migracion de Seguridad

> Estado detallado de Seguridad. La fotografia consolidada y el orden para
> continuar se mantienen en [CURRENT-STATE.md](CURRENT-STATE.md).

## Base evaluada

La implementacion esta alineada con la base CONEX original. `USUARIOS` conserva
su llave global, `DEFEMP` es la raiz de empresa, `SEGUSUEMP` agrega el alcance
multiempresa y las tablas `ASIG*` mantienen los permisos historicos. Para
preparar otra copia se ejecuta
`database/20260728_CONEX_original_homologacion.sql`.

| Objeto GX | Destino | Estado | Descripcion de negocio |
| --- | --- | --- | --- |
| VeriUsu | Servicio de autenticacion | Implementado para prueba | Valida identidad y crea la sesion de trabajo. |
| CamClave | Endpoint de cambio de clave | Implementado para prueba | Permite renovar la clave del usuario autenticado. |
| VA2 | Middleware de permisos | Identificado, pendiente de aplicar por pantalla | Autoriza una accion dentro de empresa, sistema, modulo y programa. |
| TraeNSeg | Contexto de usuario | Conservado | Recupera el nivel historico del usuario sin conceder permisos por si solo. |
| Encripta | Sin reemplazo | No requerido | Rutina antigua sin llamadas detectadas; no sirve para almacenar nuevas claves. |
| VeriLicencia | Backend de parametros/licencia | Pendiente de estudio | Habilita un indicador de licencia en parametros generales. |
| VA | Retirado | Retirado | Objeto sin logica util confirmada. |

## Transacciones

| Objeto GX | Destino | Estado |
| --- | --- | --- |
| Usuarios | CRUD React + Node | Implementado para prueba |
| UROLES | CRUD React + Node | Implementado para prueba |
| URolesPorUser | CRUD React + Node + permisos dinamicos | Verificado en CONEX_MIGRACION |
| Sistemas | CRUD React + Node | Implementado para prueba |
| Modulos | CRUD React + Node | Implementado para prueba |
| Program nivel 1 | CRUD React + Node | Implementado para prueba |
| Program nivel 2 | Pestaña Acciones + `PROGRAM1` | Implementado para prueba |
| NivSeg | CRUD compatible | Implementado para prueba |
| AsigSist | Resumen y editor jerarquico por sistema | Implementado para prueba |
| Asig | Selector de modulos dentro del sistema | Implementado para prueba |
| AsigProg nivel 1 | Selector de programas por modulo | Implementado para prueba |
| AsigProg nivel 2 | Acceso avanzado de acciones + `ASIGPROG1` | Implementado para prueba |

Los selectores de los CRUD de Seguridad respetan las claves compuestas
confirmadas en la exportacion GX8: `MODULOS` depende de `SistCod + Modcod`,
`PROGRAM` de `SistCod + Modcod + ProgCod` y `PROGRAM1` agrega `ProgOPCod`.
Sistema, modulo, programa y accion se presentan en cascada tanto en filtros
como en formularios. Cambiar un nivel limpia sus descendientes para impedir
que una seleccion perteneciente a otro sistema quede combinada con la nueva
cabecera. Esto permite conservar codigos locales repetidos, como el modulo 8
de los sistemas 70 y 100, sin ambiguedad visual ni alteracion de datos.

El editor de asignaciones muestra contadores por sistema y guarda cada rama en
una sola transaccion. Las reglas de sincronizacion tienen pruebas unitarias y
las consultas de resumen/detalle fueron verificadas contra la base CONEX; falta
una prueba funcional controlada del `PUT` con un usuario de ensayo antes de
marcar el flujo como validado.

La consulta consolidada de Roles por usuario fue verificada contra
`URolesPorUser`: muestra los roles ya asignados, la fecha y los totales de
accesos directos sin convertirlos en roles.

`DefEmp` e `IngDefEmp` no se duplican en Seguridad: ambos operan sobre `DEFEMP`, ya migrada en Maestros del Sistema. `CamClav` queda cubierto por el endpoint de cambio de clave; falta una pantalla de autoservicio si se decide exponerla fuera del perfil.

No se debe marcar Seguridad como terminada hasta asociar cada ruta de negocio con los codigos `SistCod`, `Modcod`, `ProgCod` y `ProgOPCod` equivalentes a `VA2`.

## Exportacion APERP

`APERPSeguridad.xpz` corresponde a una evolucion GeneXus 18 que coincide con el
esquema de `BDCONEXCO`. Se adopta como fuente para roles y permisos actuales,
sin reemplazar el inventario GX8 del negocio original.

| Procedimiento APERP | Implementacion Node | Estado |
| --- | --- | --- |
| `NewRol` | Insercion de `rolesUsuarios` | Implementado para prueba |
| `RMAsingarRoles` | Asignacion transaccional en `URolesPorUser` | Verificado |
| `RMAsignaRol` | Union dinamica con plantillas `GECODEMP=0` | Verificado |
| `RMQuitarRol` | `removeRoleAssignment` sin borrar permisos GX8 | Verificado |
| `EliRolporUser` | Eliminacion de `URolesPorUser` | Implementado para prueba |
| `permisosRol16` | Editor jerarquico de programas del rol | Implementado y verificado |
| `ActuRol16` | Verificacion dinamica de usuarios alcanzados por el rol | Adaptado y verificado |
| `CopiaUser16` | Copia de usuario entre empresas/comunas | Pendiente de decision |
| `MenuOptionsDataAP` | Menu dinamico por sistema, modulo y programa | Implementado para prueba |

# Estado de migracion de Seguridad

| Objeto GX | Destino | Estado | Descripcion de negocio |
| --- | --- | --- | --- |
| VeriUsu | Servicio de autenticacion | Implementado para prueba | Valida identidad y crea la sesion de trabajo. |
| CamClave | Endpoint de cambio de clave | Implementado para prueba | Permite renovar la clave del usuario autenticado. |
| VA2 | Middleware de permisos | Identificado, pendiente de aplicar por pantalla | Autoriza una accion dentro de empresa, sistema, modulo y programa. |
| TraeNSeg | Contexto de usuario | Conservado | Recupera el nivel historico del usuario sin conceder permisos por si solo. |
| Encripta | Sin reemplazo | No requerido | Rutina antigua sin llamadas detectadas; no sirve para almacenar nuevas claves. |
| VeriLicencia | Backend de parametros/licencia | Pendiente de estudio | Habilita un indicador de licencia en parametros generales. |
| VA | Retirado | Retirado | Objeto sin logica util confirmada. |

No se debe marcar Seguridad como terminada hasta asociar cada ruta de negocio con los codigos `SistCod`, `Modcod`, `ProgCod` y `ProgOPCod` equivalentes a `VA2`.

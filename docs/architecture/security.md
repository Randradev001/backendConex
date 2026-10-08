# Seguridad

> Estado operativo: login por RUT, seleccion de empresa, sesion en cookie,
> menu autorizado, roles y asignaciones directas estan implementados. La
> cobertura de middleware por programa todavia debe completarse en los primeros
> maestros migrados. El estado canonico y los pendientes estan en
> [CURRENT-STATE.md](../migration/CURRENT-STATE.md).

## Mapa de implementacion

- `src/controllers/seguridadController.js`: autenticacion y sesion.
- `src/services/seguridad.service.js`: identidad, empresas y permisos efectivos.
- `src/services/seguridadAsignaciones.service.js`: accesos directos.
- `src/services/seguridadRoles.service.js`: roles y sus plantillas.
- `src/middleware/authContext.js`: contexto autenticado obligatorio.
- `src/middleware/securityAuthorization.js`: autorizacion backend por programa.
- `src/Router/seguridad.routes.js`: contrato HTTP del modulo.

El menu oculto en React mejora la experiencia, pero no constituye una barrera
de seguridad. Cada operacion sensible debe estar protegida tambien por
middleware en el backend.

## Modelo de negocio

La autorizacion sigue la jerarquia original de CONEX:

`Empresa -> Usuario -> Sistema -> Modulo -> Programa -> Accion`

- `USUARIOS` identifica globalmente a la persona mediante `UsuLogin`, como en
  la base CONEX original.
- `SEGUSUEMP` relaciona el usuario con una o mas empresas y conserva su estado,
  perfil, tipo y empresa principal.
- `DEFEMP.EmpCod` entrega los datos de empresa; en Seguridad corresponde a
  `GECODEMP` sin duplicar la columna fisica.
- `ASIGSIST` asigna empresas y sistemas al usuario.
- `ASIG` asigna modulos.
- `ASIGPROG` asigna programas.
- `ASIGPROG1` es el segundo nivel y asigna acciones (`ProgOPCod`).
- `UROLES` y `URolesPorUser` contienen los roles vigentes; `ADMINFULL` autoriza
  la administracion de Seguridad.
- `NIVSEG` y `USUARIOS.UsuNseg` se conservan desde la base GX8 original.

## Autenticacion

El endpoint `POST /backendDocker/seguridad/login` recibe y valida el RUT completo de la persona. Busca la identidad en `USUARIOS`, obtiene sus empresas habilitadas desde `SEGUSUEMP` y presenta el nombre de `DEFEMP`. El `UsuLogin` se conserva como identidad interna para credenciales, auditoria, roles y permisos. Si todavia no existe una credencial moderna, compara una sola vez con `UsuClave`, tal como hacia `VeriUsu`, y crea un hash `scrypt` global en `SEGUSUCRED`.

La sesion es un token aleatorio en cookie `HttpOnly`. SQL Server guarda solamente su SHA-256 en `SEGSESION`. La empresa de trabajo queda dentro de la sesion y el middleware la publica como `req.context.empCod`; las pantallas no deben pedirla ni enviarla.

Si el usuario tiene una sola empresa, el login la selecciona automaticamente. Si tiene varias, el backend devuelve las empresas permitidas para que el formulario solicite una seleccion antes de crear la sesion.

## Procedimientos GX identificados

- `VeriUsu`: validacion de usuario y clave; migrado al servicio de autenticacion.
- `CamClave`: cambio de clave; migrado a `PUT /backendDocker/seguridad/password` con hash moderno.
- `VA2`: comprueba empresa, usuario, sistema, modulo, programa y accion; debe convertirse en middleware backend al proteger cada modulo.
- `TraeNSeg`: lee `UsuNseg`; se conserva en la sesion como dato compatible, no como concesion automatica de permisos.
- `Encripta`: usa `Encrypt64` y no tiene referencias detectadas; no se usa para nuevas claves.
- `VeriLicencia`: modifica parametros generales y debe estudiarse con el modulo de licenciamiento, no con el login.
- `VA`: retirado por decision de migracion porque no contiene logica util.

## Corte futuro

Cuando GeneXus deje de operar, se debe impedir el acceso por `UsuClave`, forzar cambio de claves migradas y limpiar el dato legado. Esa etapa requiere una decision explicita y no forma parte de la convivencia actual.

## Configuracion

En desarrollo, el backend admite por defecto React en `localhost` o `127.0.0.1`, puertos `3001` y `5173`. Para otros ambientes se configura una lista separada por comas:

```env
CORS_ORIGINS=https://conex.midominio.cl
SESSION_HOURS=12
SESSION_REMEMBER_HOURS=720
SESSION_COOKIE_NAME=conex_session
SECURITY_ADMIN_ROLES=ADMINFULL
# Compatibilidad opcional con el modelo antiguo:
SECURITY_ADMIN_MIN_LEVEL=900
# Alternativa explicita: SECURITY_ADMIN_LOGINS=ADMIN,MIGRACION
```

El frontend puede cambiar la direccion del backend con `VITE_API_URL`. En produccion ambos sitios deben publicarse con HTTPS; Node agrega `Secure` a la cookie cuando `NODE_ENV=production`.

## Administracion del modulo

Los CRUD de Seguridad se publican bajo `/backendDocker/seguridad/catalogos`. Para evitar que cualquier usuario autenticado pueda cambiar permisos, requieren el rol `ADMINFULL`, un usuario incluido en `SECURITY_ADMIN_LOGINS` o, por compatibilidad, un nivel igual o superior a `SECURITY_ADMIN_MIN_LEVEL`. Este control protege la administracion; no reemplaza `VA2`.

Las asignaciones directas por usuario se administran desde un editor jerarquico
en `/seguridad/asignaciones`. La lista inicial muestra todos los sistemas y los
contadores de modulos y programas asignados. El detalle de cada sistema presenta
los modulos a la izquierda y los programas del modulo seleccionado a la derecha.
Sirve tanto para una asignacion inicial como para modificar o quitar accesos.

El frontend consume tres endpoints especializados:

- `GET /catalogos/usuarios/:login/asignaciones` entrega el resumen por sistema;
- `GET /catalogos/usuarios/:login/asignaciones/:sistema` entrega el arbol editable;
- `PUT /catalogos/usuarios/:login/asignaciones/:sistema` sincroniza la rama en
  una transaccion SQL.

El `PUT` no acepta empresa: usa exclusivamente `req.context.empCod`. Al quitar
un programa elimina tambien su nivel `ASIGPROG1`; las acciones de los programas
retenidos no se modifican. La pantalla avanzada de acciones sigue disponible
desde el editor. Los permisos provenientes de roles se muestran y administran
por separado para no confundirlos con estas asignaciones directas.

Las tablas `SecRole`, `SecUserRole` y `SecFunctionalityRole` estan vacias en la
base evaluada y no se usan como fuente de autorizacion. Las asignaciones
funcionales continuan en `ASIGSIST`, `ASIG`, `ASIGPROG` y `ASIGPROG1`.

## Roles APERP

La exportacion `APERPSeguridad.xpz` confirma un segundo nivel de administracion:

- `UROLES` define roles globales.
- `URolesPorUser` asigna roles a un usuario dentro de `GECODEMP`.
- Los programas del rol se guardan en `ASIGPROG` con `GECODEMP=0` y el codigo
  de rol como usuario plantilla. `ASIG` se deriva automaticamente para conservar
  la jerarquia de modulos.
- `ASIGPROG1` se conserva para compatibilidad GX8, pero los niveles crear,
  modificar y eliminar no forman parte de los roles en esta etapa.
- El backend une dinamicamente los permisos directos del usuario con sus
  plantillas de rol; no copia ni elimina permisos historicos GX8.

`seguridadRoles.service.js` conserva el resultado de negocio de
`RMAsingarRoles`, `RMAsignaRol`, `RMQuitarRol` y `EliRolporUser`, usando
`URolesPorUser` y plantillas con empresa 0. Al quitar un rol desaparece su
aporte dinamico, pero los permisos directos originales permanecen intactos.

La administracion de roles por usuario usa
`GET /catalogos/usuarios/:login/roles`. El endpoint devuelve todos los roles con
su indicador `assigned`, la fecha de asignacion y un resumen separado de los
sistemas, modulos y programas directos del usuario. De esta forma React muestra
las asignaciones existentes desde una sola lectura y no confunde permisos GX8
directos con permisos aportados por un rol. La lista de roles tambien informa
cuantos usuarios de la empresa actual y cuantos programas plantilla tiene cada
rol.

El mismo servicio implementa `permisosRol16` y la finalidad de `ActuRol16`. En
React se navega por sistema y modulo, pero el rol se arma seleccionando programas.
Su efecto es inmediato, por lo que actualizar solamente confirma los usuarios
alcanzados y no reconstruye tablas.

## Menu autorizado

El menu se construye en el backend con la jerarquia fisica
`SISTEMAS -> MODULOS -> PROGRAM` y se filtra por la union de permisos directos
en `ASIGPROG` y plantillas de los roles vigentes. Un sistema o modulo sin
programas autorizados no se envia al frontend.

Cada programa conserva `ProgNomGX`, `ProgIDmenu` y `ProgTarget`. React traduce
`ProgNomGX` a una ruta mediante `menu-items/authorizedMenu.jsx`; también acepta
rutas internas directas que comienzan con `/`. Solo se muestra
un llamado cuando ya existe su pantalla React; los llamados `.aspx` pendientes
permanecen fuera del menu hasta completar su migracion.

El endpoint `GET /backendDocker/seguridad/menu` permite consultar el mismo arbol
que se incluye en las respuestas de login y sesion.

Despues de una mutacion de asignaciones o roles, la administracion React vuelve
a consultar `GET /backendDocker/seguridad/session`. Esto evita conservar en el
cliente un menu anterior cuando cambia el acceso del usuario autenticado.

`POST /backendDocker/seguridad/verificar-acceso` implementa la consulta equivalente a `VA2` sobre los permisos cargados en la sesion. El middleware `requirePermission` queda disponible para proteger cada futura ruta de negocio con `SistCod`, `Modcod`, `ProgCod` y, cuando corresponda, `ProgOPCod`.

Las pantallas migradas mantienen esta correspondencia:

| Pantalla React | Objeto GX | Tabla fisica |
| --- | --- | --- |
| Usuarios | `Usuarios` | `USUARIOS` |
| Roles | `UROLES` | `UROLES` |
| Roles por usuario | `URolesPorUser` | `URolesPorUser` |
| Sistemas | `Sistemas` | `SISTEMAS` |
| Modulos | `Modulos` | `MODULOS` |
| Programas | `Program` nivel 1 | `PROGRAM` |
| Acciones | `Program` nivel 2 | `PROGRAM1` |
| Niveles de seguridad | `NivSeg` | `NIVSEG` |
| Sistemas por usuario | `AsigSist` | `ASIGSIST` |
| Modulos por usuario | `Asig` | `ASIG` |
| Programas por usuario | `AsigProg` nivel 1 | `ASIGPROG` |
| Acciones por usuario | `AsigProg` nivel 2 | `ASIGPROG1` |

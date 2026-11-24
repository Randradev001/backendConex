# Correspondencia APERPSeguridad

## Alcance evaluado

La exportacion contiene 148 objetos. Los objetos generados por WorkWithPlus se
consideran presentacion y soporte; la migracion toma como fuente las
transacciones y procedimientos con logica de negocio.

## Modelo confirmado

`Empresa -> Usuario -> Rol -> Sistema -> Modulo -> Programa`

Los roles no reemplazan las tablas `ASIG*`. Funcionan como plantillas:

1. El rol se define en `UROLES`.
2. Sus permisos usan `GECODEMP=0` y el codigo del rol como usuario.
3. `URolesPorUser` relaciona empresa, usuario y rol.
4. `Actualizar rol` reemplaza las asignaciones físicas de sus usuarios con los
   programas guardados en la plantilla del rol.
5. `VA0` y `PVAProg` se conservan como referencia de autorizacion por programa.

## Decisiones de migracion

- La logica de roles vive en servicios Node; React solo administra y consume.
- La empresa siempre proviene de la sesion y no se recibe desde el formulario.
- La asignacion y eliminacion del rol son transaccionales.
- Guardar la plantilla y aplicar el rol son operaciones separadas.
- Al actualizar el rol, se eliminan todos los permisos de cada usuario
  asignado y se reconstruyen `ASIGSIST`, `ASIG`, `ASIGPROG` y las acciones
  históricas de `ASIGPROG1` exclusivamente desde ese rol.
- Asignar o quitar la relación del rol conserva los permisos físicos actuales;
  su reemplazo se realiza explícitamente mediante `Actualizar rol`.
- `AsigDes` es una descripcion extendida de `Modulos`, no una columna fisica.
- `NIVSEG` se conserva como compatibilidad GX8, pero no gobierna esta capa.
- Las tablas `SecRole*` vacias no se usan como fuente de permisos.
- El menu se obtiene de `ASIGPROG` y solo expone programas autorizados para la
  empresa activa.
- `ProgNomGX` se traduce a rutas React mediante un registro explicito; un
  llamado pendiente de migracion no se publica como enlace.

## Editor de permisos del rol

`permisosRol16` se migra como un editor jerarquico de sistema, modulo y programa.
Sistema y modulo permiten ubicar los programas; solamente los programas marcados
arman el rol. Opera sobre `GECODEMP=0` y usa el codigo del rol como usuario
plantilla en `ASIGPROG`. El backend deriva `ASIG` para conservar los modulos.

Los endpoints administrativos son:

- `GET /backendDocker/seguridad/catalogos/roles/:rol/permisos`;
- `PUT /backendDocker/seguridad/catalogos/roles/:rol/permisos`;
- `POST /backendDocker/seguridad/catalogos/roles/:rol/reaplicar`.

Guardar los programas modifica la plantilla. La acción separada `Actualizar
rol` implementa `ActuRol16`: busca todos los usuarios asignados en
`URolesPorUser` y sus empresas (`GECODEMP>0`), elimina todos sus permisos y
carga únicamente los programas del rol, con sistemas y módulos derivados.
Los accesos adicionales y los de otros roles también se reemplazan. Una
plantilla vacía deja sin permisos. El proceso es serializable y un fallo
revierte todos los cambios. El menú y la autorización leen los permisos
físicos resultantes del usuario, sin unir roles dinámicamente.

Los niveles de programa de `PROGRAM1`, como crear, modificar y eliminar, quedan
fuera del armado de roles. La tabla se conserva para compatibilidad y para un
estudio posterior de autorizaciones mas finas.

## Administracion de roles por usuario

La pantalla `URolesPorUser` administra una relacion, no una Transaction con
campos editables. La accion de administrar roles muestra, para un usuario de la
empresa activa, los roles disponibles y los roles ya asignados:

- agregar y quitar modifican la relación del rol de forma transaccional y
  conservan los permisos físicos actuales;
- reaplicar el rol desde la ficha del usuario reemplaza todos sus permisos en
  la empresa autenticada con la plantilla del rol elegido;
- la empresa siempre proviene de la sesion;
- cambiar una asignacion se representa como quitar y agregar, no como modificar
  la clave de `URolesPorUser`.

Esta administracion no reemplaza `ActuRol16`. El recalculo masivo permanece
como una accion separada, exige confirmacion y se ejecuta en una transaccion
controlada. La auditoria persistente de esta operacion continua pendiente.

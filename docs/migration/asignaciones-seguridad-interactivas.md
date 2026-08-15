# Asignaciones de seguridad interactivas

> Estado al 2026-07-31: implementado y operativo para permisos directos y
> plantillas de rol nuevas. La homologacion automatica de plantillas historicas
> de `BDCONEXCO` sigue pendiente porque sus catalogos `MODULOS` y `PROGRAM` no
> coinciden completamente con CONEX. Consultar primero
> [CURRENT-STATE.md](CURRENT-STATE.md).

## Mapa de implementacion

Backend:

- `src/services/seguridadAsignaciones.service.js`: lectura y sincronizacion de
  permisos directos por usuario.
- `src/services/seguridadRoles.service.js`: roles del usuario y plantillas de
  programas por rol.
- `src/Router/seguridad.routes.js`: endpoints protegidos de administracion.
- `src/middleware/authContext.js`: publica la empresa y el usuario de la sesion.

Frontend:

- `src/pages/seguridad/UserAssignmentsPage.jsx`: seleccion de usuario,
  administracion compacta de roles y navegacion entre accesos directos y roles.
- `src/pages/seguridad/UserSystemAssignmentsDialog.jsx`: editor de accesos
  directos del usuario por sistema.
- `src/pages/seguridad/RolePermissionsDialog.jsx`: editor de la plantilla del
  rol por sistema, modulo y programa.
- `src/pages/seguridad/RoleAssignmentDialog.jsx`: asignacion y retiro de roles.
- `src/api/seguridadCatalogosApi.js`: contrato HTTP de estas pantallas.

La ruta activa del frontend es
`C:\Proyectos2025\Conex\Frontend\conex-frontend`. No aplicar estos cambios a
copias experimentales ni a `C:\Proyectos2025\AS`.

## Fuente GeneXus

El flujo se contrasto con `GXW.xpz` y con
`Inventario_GX8_Conex.xlsx` antes de cambiar el comportamiento:

- `Asignar` crea la fila de `ASIGSIST` y la fila de `ASIG` del modulo.
- `AsigProg` crea `ASIGPROG` y, cuando corresponde, copia las acciones de
  `PROGRAM1` a `ASIGPROG1`.
- `AsigProg2` crea un programa y una accion puntual.
- `DesAsig` quita el programa; si el modulo queda sin programas quita `ASIG`, y
  si el sistema queda sin modulos quita `ASIGSIST`. Tambien permite quitar una
  accion puntual.
- `AsigProg` es ademas el WorkPanel GX8 "Asignacion de Modulos/Programas".

Las transacciones fisicas conservan sus niveles originales:

`ASIGSIST -> ASIG -> ASIGPROG -> ASIGPROG1`

## Decision de migracion

La pantalla React reemplaza las cuatro pestanas CRUD de asignaciones por un
editor jerarquico centrado en el usuario:

1. se selecciona una sola vez el usuario;
2. la pestana `Directos` muestra sus asignaciones particulares;
3. cada rol asignado aparece como una pestana navegable;
4. los roles disponibles se pueden agregar en la misma pantalla;
5. el rol activo se puede quitar con confirmacion;
6. todas las vistas conservan la grilla de sistemas y el boton `Administrar`.

### Pestana Directos

1. lista todos los sistemas y muestra cuantos modulos y programas directos
   tiene asignados el usuario;
2. abre el detalle de un sistema con todos sus modulos;
3. muestra al lado los programas del modulo seleccionado;
4. permite asignar, quitar o reasignar en el mismo formulario;
5. guarda el sistema completo en una sola transaccion SQL.

Este modo administra excepciones directas en la empresa autenticada. Los
permisos aportados por `URolesPorUser` no se copian ni se eliminan al editar al
usuario.

### Pestanas de roles

1. permite seleccionar uno de los roles asignados al usuario;
2. muestra los sistemas, modulos y programas configurados para su plantilla;
3. permite administrar la seleccion completa de programas del rol;
4. deriva los sistemas y modulos desde los programas, igual que
   `permisosRol16` de GeneXus;
5. informa cuantos usuarios reciben actualmente el rol.

La plantilla se guarda con `GECODEMP = 0` y el codigo del rol en las columnas
de usuario de `ASIG` y `ASIGPROG`. No modifica las asignaciones directas de los
usuarios. Todos los integrantes registrados en `URolesPorUser` reciben los
cambios dinamicamente al calcular sus permisos efectivos.

## Estado de las plantillas historicas

La importacion `20260728_import_BDCONEXCO_security.sql` conservo `UROLES` y
`URolesPorUser`, pero excluyo deliberadamente las plantillas porque los
catalogos de programas no son equivalentes.

La verificacion del 30 de julio de 2026 encontro 60 programas de rol en
`BDCONEXCO` y ninguna plantilla cargada en `CONEX_MIGRACION`. Solo 9 de los 60
programas coinciden por clave completa; la unica coincidencia adicional por
descripcion (`Parametros Generales`) tiene dos destinos posibles. Por esta
razon no se realiza una copia automatica.

Cuando un rol no tiene plantilla homologada, React lo informa expresamente. Los
permisos existentes del usuario siguen visibles en `Directos` y no se atribuyen
automaticamente a uno de sus roles. La plantilla del rol se debe construir con
el catalogo `PROGRAM` vigente de CONEX.

La misma revision encontro asignaciones directas historicas cuyos codigos ya no
existen en `MODULOS` o `PROGRAM`. Por ejemplo, `MANDRADE` conserva 196 programas
directos y el sistema 1 informa mas asignaciones que elementos vigentes en el
catalogo. Estas filas no se eliminan ni se trasladan desde React; quedan
pendientes de una homologacion de codigos de Seguridad.

## Reglas del guardado

- La empresa siempre proviene de `req.context.empCod`.
- El usuario debe pertenecer a la empresa autenticada en `SEGUSUEMP`.
- Solo se aceptan sistemas, modulos y programas existentes en sus tablas
  maestras.
- Seleccionar un programa implica conservar seleccionado su modulo y sistema.
- Un sistema o modulo puede quedar asignado aunque todavia no tenga hijos.
- Quitar un programa elimina sus filas de `ASIGPROG1`; las acciones de un
  programa que permanece seleccionado se conservan.
- Quitar un modulo elimina sus programas y acciones.
- Quitar el sistema elimina toda su rama de asignaciones directas.
- Guardar un rol no crea ni elimina filas directas de sus usuarios.

## API

- `GET /backendDocker/seguridad/catalogos/usuarios/:login/asignaciones`
- `GET /backendDocker/seguridad/catalogos/usuarios/:login/asignaciones/:sistema`
- `PUT /backendDocker/seguridad/catalogos/usuarios/:login/asignaciones/:sistema`
- `GET /backendDocker/seguridad/catalogos/roles/:role/permisos`
- `PUT /backendDocker/seguridad/catalogos/roles/:role/permisos`

El `PUT` de usuario recibe `assigned` y una lista `modules`. El `PUT` de rol
recibe la lista `programs`. Ninguno recibe `GECODEMP` desde React.

## Verificacion

Las reglas puras de normalizacion y sincronizacion se cubren con
`test/seguridadAsignaciones.rules.test.js`. La compilacion de React verifica la
integracion de la pantalla con las rutas y el cliente HTTP.

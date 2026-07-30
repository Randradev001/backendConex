# Asignaciones de seguridad interactivas

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

La pantalla React reemplaza las cuatro pestañas CRUD de asignaciones por un
editor jerarquico por usuario:

1. lista todos los sistemas y muestra cuantos modulos y programas directos
   tiene asignados el usuario;
2. abre el detalle de un sistema con todos sus modulos;
3. muestra al lado los programas del modulo seleccionado;
4. permite asignar, quitar o reasignar en el mismo formulario;
5. guarda el sistema completo en una sola transaccion SQL.

El editor administra permisos directos. Los permisos aportados por
`URolesPorUser` siguen siendo dinamicos y se editan desde Roles; no se copian ni
se eliminan desde esta pantalla.

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

## API

- `GET /backendDocker/seguridad/catalogos/usuarios/:login/asignaciones`
- `GET /backendDocker/seguridad/catalogos/usuarios/:login/asignaciones/:sistema`
- `PUT /backendDocker/seguridad/catalogos/usuarios/:login/asignaciones/:sistema`

El `PUT` recibe `assigned` y una lista `modules`; no recibe `GECODEMP`.

## Verificacion

Las reglas puras de normalizacion y sincronizacion se cubren con
`test/seguridadAsignaciones.rules.test.js`. La compilacion de React verifica la
integracion de la pantalla con las rutas y el cliente HTTP.

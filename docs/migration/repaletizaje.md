# Repaletizajes

## Objeto GeneXus y propósito

La pantalla corresponde al WorkPanel GX8 `Repaletizajes` (`wrepaletizajes`),
que consulta la cabecera de la transacción `Repaletizaje` y sus dos niveles
dependientes. El programa está registrado como `SistCod=100`, `ModCod=20`,
`ProgCod=2` y se protege con ese permiso.

La primera entrega incluye el listado y la pantalla de operación. La cabecera
se crea únicamente al presionar `Guardar`; seleccionar folios en el formulario
solo mantiene un borrador en memoria y no deja registros huérfanos.
Desde el listado, `Agregar` abre Nuevo Repaletizaje dentro de un `Dialog`; la
ruta directa `/procesos-sag/repaletizajes/nuevo` se conserva por compatibilidad.

## Estructura y reglas GX8

- `REPALETIZAJE` es la cabecera, con clave `EmpCod + TempCod + REPNum`.
- `REPALETIZAJE1` es el nivel 2 de folios, con clave adicional `REP0Fol`.
- `REPALETIZAJE2` es el nivel 3 de movimientos, con clave adicional
  `Rep1Corr + REP1Mov`.
- `EmpCod` se obtiene de `req.context.empCod`; la pantalla no puede enviarlo
  para cambiar la empresa.
- La consulta conserva el rango inicial del GX (`REPFecha` desde 30 días
  antes hasta hoy), pero permite modificar ambas fechas.
- En `Rep01` (alta inicial) el selector de folios de inspección excluye los
  folios que tienen una fila en `REPALETIZAJE1` asociada a una cabecera activa
  (`REPEstado` distinto de 5). Al anular un repaletizaje, sus niveles se
  conservan para consulta histórica, pero el folio vuelve a estar disponible;
  los folios seleccionados en un borrador también se ocultan del desplegable.
- En `RepAgregar`, que se ejecuta sobre una cabecera en proceso, el folio de
  salida se captura como un folio nuevo. El backend rechaza si ya existe en
  `SOLICITUDES2` o si está asociado a cualquier repaletizaje no anulado. Los
  detalles se toman de `PS_SALREP01` para la sesión y el repaletizaje actual;
  `PSR_CajasO` se incrementa de forma serializable, se registra el movimiento
  en `PS_SALREP02` y se crean `REPALETIZAJE1/2` con `REP0TipAct=1`, tal como
  `GRepAgrega1_1`/`GRepBaja2` del XPZ.
  La interfaz valida el folio al salir del campo mediante
  `GET /new-folio-check/:folio`, informando de inmediato si ya existe en una
  solicitud o está asociado a un repaletizaje activo.
- El estado de cabecera conserva los valores GX `0` (En proceso), `1`
  (Finalizado) y `5` (Anulado); el valor 9 se usa solo como filtro Todos.
- La cabecera muestra `REPNum`, `REPNumF`, `REPFecha`, `REPFecCrea`,
  `REPLogCrea`, `REPEstado` y el autorizador derivado de `DACod` cuando exista.
- El tab de folios muestra el detalle de `REPALETIZAJE1` de la cabecera
  seleccionada, resolviendo las descripciones de `TIPALT` y `TIPBPA` para
  mostrar los valores de Altura y Base en lugar de sus códigos. No se crea un
  menú independiente para ningún nivel 2.
- Los nombres de variedad, productor, envase y categoría del detalle de
  `SOLICITUDES3` se resuelven desde `ESPECIES1`, `PRODUCTORES`, `ENVCAT` y
  `ENVCAT1`. Aunque el inventario GX8 documenta atributos `Sol3N*`, esas
  columnas no existen en el esquema físico desplegado.

## Pantallas y acciones migradas

El backend expone consultas paginadas para cabeceras y folios, ambas bajo
`requirePermission({ sistema: 100, modulo: 20, programa: 2 })`. La respuesta
incluye la temporada activa de la empresa para que la interfaz preserve el
contexto GX. La interfaz React agrega el menú dinámico para `wrepaletizajes`,
dos tabs, filtros de fecha/estado/números y selección de cabecera.

Las mutaciones de Repaletizaje también quedan protegidas por el permiso base
`100/20/2`, sin exigir `ProgOPCod` en `ASIGPROG1`. La validación de acciones
`PVA` del WorkPanel GX8 no se migra en esta pantalla por decisión funcional;
las restricciones de estado y de negocio permanecen en el servicio Node.

La pantalla `Rep01` se expone como alta, visualización y modificación. Sus
operaciones se implementan con transacciones serializables y las mismas tablas
GX: `CreaRepa`/`GRepAgrega1_1` para guardar, `GRepBaja2`/`RepEliFol` para
quitar folios, `GRepSube1_1` para subir cajas, `GRepBaja2_2` para bajar cajas,
`FinRepa` para cerrar y `AnulaRepa` para anular. Guardar solo
reserva temporalmente las cajas en `PS_SALREP01/02`; `FinRepa` es la operación
que aplica los incrementos a las solicitudes de folios de inspección. Para
folios nuevos de `RepAgregar` (`REP0TipAct=1`), `FinRepa` crea las filas de
`SOLICITUDES2/3` con los atributos capturados y aplica el mismo movimiento que
para un folio existente. La anulación de un repaletizaje
en proceso libera esas reservas, conserva la cabecera con `REPEstado=5` y
mantiene `REPALETIZAJE1/2` para que la visualización histórica muestre los
folios y detalles, sin descontar cantidades que aún no habían sido aplicadas.
La acción `RepBajar` solo acepta folios inspeccionados aprobados y no
despachados que tengan cajas repaletizadas (`Sol3CajasRep > 0`), registra un
movimiento negativo y no permite bajar más cajas que el saldo `Sol3CajasDes`.
La acción queda disponible en la edición de un repaletizaje en proceso. Al cargar Bajar, el backend toma
los movimientos pendientes de `PS_SALREP02` del repaletizaje actual e invierte
  su signo para presentar la misma disponibilidad que el XPZ (`Sol3CajasRep =
  PSRM_Cajas * -1` y `Sol3CajasDes -= Sol3CajasRep`). `RepSubir` consulta las reservas
  temporales de `PS_SALREP01/02` del repaletizaje y el folio inspeccionado
  aprobado/no despachado (aunque aún no esté en `REPALETIZAJE1`), conserva como
  identidad de la grilla el detalle del folio seleccionado y superpone el
  saldo del pool solo cuando sus atributos coinciden. Si no hay detalle de
  origen, puede mostrar el pool como grilla editable aunque sus atributos aún
  no existan en el folio. Consolida las filas repetidas por
  especie/variedad/producto/envase/categoría/calibre y relaciona por esos atributos como `buscaCorr`, y permite
  aumentar las cajas por correlativo y actualiza o crea el movimiento positivo
de `REPALETIZAJE2` y el total de `REPALETIZAJE1`. Si no existe una fila
`PS_SALREP01` para la sesión, la grilla conserva como respaldo el saldo
`SOLICITUDES3.Sol3CajasDes` que muestra el selector, evitando presentar cero
por una ausencia de reserva temporal; un folio que tenga
movimientos negativos en el mismo repaletizaje no se puede subir.

Los botones del listado quedan así:

- `Agregar`: abre la pantalla de captura y crea cabecera solo en `Guardar`.
- `Visualizar`: lectura, sin cambios.
- `Modificar`: habilitado solo para estado `0` (En proceso).
- `Subir cajas`: permite aumentar cajas de folios ya agregados, respetando la
  reserva disponible por correlativo; replica `RepSubir`/`GRepSube1_1`.
- `Bajar cajas`: permite registrar movimientos negativos sobre cajas ya
  repaletizadas y queda habilitado solo para estado `0`.
- En los diálogos `Subir cajas` y `Bajar cajas`, cambiar el foco desde el
  selector de folio hacia una cantidad conserva el folio y sus filas cargadas;
  solo cambiar o limpiar explícitamente el folio reinicia el listado.
- `Eliminar`: ejecuta la anulación lógica histórica; no borra la cabecera.
- `Finalizar`: habilitado solo para estado `0`, actualiza solicitudes y asigna
  el correlativo `REPA`.
- `PDF`: genera `RepaV2` en carta vertical, conserva el formato blanco y negro
  del formulario, incorpora la imagen institucional SAG en la cabecera, incluye
  las casillas de Aprobado/Rechazado, ubica Cajas que pierden Condición dentro
  del bloque de observaciones, resuelve PAIS desde `DESTINOS.DestNom` mediante
  el código `SOLICITUDES1.SolDest` y
  fija las zonas de firma al pie de la página.
- `Archivo`: habilitado solo para estado `1`; genera `.REP` y permite escoger
  la carpeta de descarga mediante el selector del navegador.

La edición no permite modificar una cabecera finalizada o anulada. El backend
repite esta regla aunque el botón esté oculto o deshabilitado en React.

## Evidencia de base y verificación

La base configurada contiene 13 cabeceras, 39 filas de folios y 48
movimientos, sin huérfanos entre los tres niveles. Los datos históricos llegan
hasta 2017, por lo que el rango inicial de 30 días puede no mostrar filas en
una fecha de servidor posterior; el ajuste manual del rango es parte del
contrato de la pantalla.

La verificación cubre paginación, fechas inclusivas, estado 9/Todos, filtros
por número, selección del detalle, aislamiento por empresa, rechazo de usuarios
sin `100/20/2`, creación tardía de la cabecera, bloqueo por estado, transacción
de finalización/anulación y exportaciones. La suite backend y la compilación
Vite deben aprobarse antes de marcar el objeto como `READY`.

## Homologación del listado operacional (2026-10-21)

El listado usa el patrón operacional compartido: banner con temporada activa,
indicadores por estado, filtros reactivos con fechas abiertas, búsqueda general
en la tabla y exportaciones Excel/PDF del conjunto filtrado completo. Las
acciones históricas PDF y Archivo por fila se conservan sin cambios.

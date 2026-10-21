# Procesos USDA

## Alcance implementado

La pantalla React `/procesos-sag/procesos-usda` y la API
`/backendDocker/procesos-usda` migran el WorkPanel GX8 `ProcesosUSDA` con el
permiso histórico `100/20/10`. La empresa y el usuario se obtienen de la
sesión autenticada; no se aceptan desde el navegador.

La pantalla incluye el listado y la acción **Estado**, además del alta en un
`Dialog` que combina la cabecera con el detalle de folios. La ruta directa de
alta se conserva por compatibilidad.
Visualizar y Modificar abren el mismo editor en un `Dialog`; Anular utiliza un
diálogo de confirmación independiente. El listado incluye la acción PDF, que
abre el detalle USDA en una ventana del visor del navegador.
Cuando el proceso está Aprobado o Rechazado, las acciones Modificar y Cambiar
Estado quedan deshabilitadas en el listado. El diálogo Cambiar Estado ofrece
directamente las acciones Aprobar y Rechazar; En Proceso no es una opción de
transición.

## Evidencia del XPZ

`ProcesosUSDA.xpz` contiene los controles `PUSTipo`, `PUSNum`, `PUSFecha`,
`PUSTotCaj`, `PUSTotKil`, `PUSTotPal`, `PUSEstado`, `PUSLoginC`, `PUSFecC` y
`PUSEspe`. La condición exportada del WorkPanel es:

```text
EmpCod = &empcod
TempCod = &tempcod
PUSTipo = &PUSTipo .OR. &PUSTipo = 9
PUSNum >= &PUSNum
```

`PUSEspe` pertenece a la estructura de la cabecera y se utiliza para consulta,
pero no es un control editable de `ProcUSDA_Cab`; el alta muestra únicamente
Tipo de proceso, Número y Fecha, tal como el objeto original. Para este flujo
el combo de tipo de proceso ofrece `2 Fumigación` y `3 Muestreo`, igual que
`DetProcUS` y `EstadoUS`.

En la base migrada, `PUSEspenom` no existe como columna física aunque aparece
en la estructura del XPZ; por eso la API no intenta escribirla.

La pantalla web mantiene además funcionales los controles visibles de fecha,
estado y especie, porque de lo contrario esos filtros del WorkPanel no tendrían
efecto. La consulta sigue restringida a la empresa autenticada y a la
temporada activa.

La pantalla inicia con los últimos 60 días, tipo Todos, estado Todos, especie
Todas y número de proceso desde cero. Los filtros se muestran en una única
línea; en anchos menores se conserva la línea mediante desplazamiento
horizontal.

## Tablas y reglas

- `PROCUSDA` es la cabecera del proceso y contiene el estado, fecha, especie y
  totales que se muestran en el listado.
- `TEMP01.TempActiva=1` resuelve la temporada de la empresa autenticada.
- `ESPECIES` resuelve el nombre de la especie.
- La actualización de estado usa `PROCUSDA(EmpCod,TempCod,PUSTipo,PUSNum)` y
  solo acepta los estados `0 En Proceso`, `1 Aprobado` y `2 Rechazado`.
- `EstadoUS.xpz` confirma que, al cambiar a estado `2`, también se deben
  eliminar los detalles `PROCUSDA1` y `PROCUSDA2`, liberar el folio en
  `FOLIOSPROC` (`FPDisponible=1`, `FPIns=0`) y liberar sus detalles en
  `FOLIOSPROC1` (`Fp2Ins=0`). Todo se ejecuta en la misma transacción.
- El XPZ no actualiza `PUSLoginC` ni `PUSFecC` al cambiar de estado; esas
  asignaciones aparecen comentadas. Por eso la migración no inventa campos de
  auditoría adicionales.

La implementación de `EstadoUS.xpz` fue revisada además de `ProcesosUSDA.xpz`;
el procedimiento utiliza la empresa, temporada, tipo y número como clave del
proceso, exactamente como la API.

## Alta y detalle

- `ProcUSDA_Cab` crea la cabecera en `PROCUSDA` con estado inicial `0`, usuario
  autenticado, fecha de creación y totales en cero. Tipo y número forman parte
  de la clave y no se modifican después del alta. En la pantalla Nuevo proceso
  USDA, `Fecha Proceso` se inicializa por defecto con la fecha local de hoy.
- El selector reproduce `AgrFol_ProcUS`: solo ofrece `FOLIOSPROC` de la empresa
  y temporada activas con `FPEstado=10` y `FPDisponible=1`; folio y especie son
  filtros opcionales. En Agregar folios, Especie se puede escribir y filtra por
  código o nombre; al ingresar un código exacto se completa la especie del
  catálogo. El control Folio respeta el largo GX8 de 10 caracteres.
  El detalle aplica a los tipos 2 y 3, igual que `DetProcUS` y `EstadoUS`.
- `BajaFolios_USDA` se migra al agregar: reserva el folio, copia su cabecera a
  `PROCUSDA1`, copia sus líneas a `PROCUSDA2` y recalcula los totales.
- `EliFolUS` se migra al quitar: impide eliminar un folio despachado o con
  repaletizaje, libera `FOLIOSPROC` y recalcula los totales.

## Anulación

Por decisión funcional de esta migración, **Anulado es distinto de
Rechazado**. El botón Anular asigna `PUSEstado=3`; ese valor no está disponible
en el diálogo normal de cambio de estado. La anulación conserva la cabecera,
libera `FOLIOSPROC/FOLIOSPROC1` y elimina `PROCUSDA1/PROCUSDA2` en una sola
transacción. El listado y su filtro muestran `3 Anulado`.

## PDF DetalleUSDA

El reporte `PDFUSDA.xpz` define el objeto `DetalleUSDA` y recibe los parámetros
`Empcod`, `Tempcod`, `PUSTipo`, `Nomproc` y `PUSnum`. La acción PDF de la pantalla
usa los primeros, el tipo y el número del proceso seleccionado; `Nomproc` se
conserva como parámetro histórico aunque no aparece como control visible en el
layout.

El endpoint
`GET /backendDocker/procesos-usda/procesos/:processType/:processNumber/pdf`
consulta la empresa, la cabecera `PROCUSDA`, los folios `PROCUSDA1` y sus líneas
`PROCUSDA2`, enriqueciendo productor, packing, especie, variedad y código SAG
desde las tablas maestras. El PDF conserva el orden y los nombres visibles del
XPZ: `Numero Inspeccion:`, `Fecha:`, `Folio`, `Productor`, `Comuna`,
`Provincia`, `Packing`, `Comuna`, `Provincia`, `Especie`, `Variedad`, `Nro`,
`Cajas/Pallet`, `Fecha/Emb.`, `SDP/SAG`, `Total Cajas` y `Total Folios`.

La salida se genera en tamaño Carta vertical, con un diseño moderno de
tarjetas y tabla, pero mantiene los bloques funcionales del reporte original,
incluido el estado estático `A Inspeccion`. Si existen más líneas que las que
permite la página, el detalle se divide en páginas manteniendo el encabezado,
la tabla y el pie de totales.

## Pendientes

El Report `ProcesosUSDA` general no forma parte de esta entrega; el PDF
implementado corresponde al reporte `DetalleUSDA` entregado en `PDFUSDA.xpz`.
También queda pendiente la evidencia integrada de aceptación en navegador.

## Homologación del listado operacional (2026-10-21)

El listado incorporó banner compartido, indicadores por estado, filtros con
intervalos abiertos, búsqueda remota en número, especie y creador, toolbar de
columnas y exportaciones generales sobre todas las filas filtradas. El PDF
`DetalleUSDA` por fila conserva su alcance oficial.

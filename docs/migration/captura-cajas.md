# Captura de cajas

Estado: primera entrega implementada y verificada contra `CONEX_MIGRACION`.

La ruta React es `/captura-cajas` y el backend es `/backendDocker/captura-cajas`.
Reimplementa `CAPCajas02` con `INSCajasProc`: recibe solo un código de 23 dígitos,
obtiene empresa y usuario de sesión, valida `ORDPROC.OrdpEstado=1`, resuelve envase,
categoría y calibre por empresa, calcula `EnvPeso - EnvDestare` y crea `CAP001`.

La clave histórica `EmpCod + TempCod + CAPCOD` impide duplicados. La captura crea
`CAPEst=0`; el cierre cambia únicamente una orden activa de `1` a `4`, conforme a GX8.
Las consultas de cajas y resumen usan `EmpCod + TempCod + CAPNproc`, con paginación
en SQL Server. `CAPCajas03` permite reclasificar envase, categoría y calibre de una
caja disponible; conserva sus valores originales y recalcula el peso neto.
La selección inicial parte filtrada por la fecha local del día; React presenta
el filtro con el DatePicker de MUI en formato `DD/MM/YYYY` y Moment conserva el
valor `YYYY-MM-DD` que consume la API. La cabecera de esta grilla concentra los
filtros de fecha, productor, exportadora, orden y estado, además de un icono que
exporta las órdenes visibles con sus campos relevantes.
Debajo de la cabecera se presentan los totales de cajas, kilos, órdenes activas
y órdenes terminadas para la fecha y filtros seleccionados. Cada indicador abre
un diálogo con las órdenes que componen el total; la consulta de órdenes incorpora
los acumulados de `CAP001` sin perder la separación por empresa y temporada.
El área de escaneo valida localmente la orden activa y el largo de 23 dígitos
antes de enviar; los rechazos de orden, duplicado y catálogos configurados se
informan desde la API junto al campo de lectura.
La consulta de cajas se abre bloqueada a la orden seleccionada, muestra una
cabecera informativa y métricas visuales, y permite descargar desde un icono
los campos de todas sus páginas. La descarga actual usa el helper HTML
compatible con Excel y extensión `.xls`; no constituye todavía un exportador
XLSX de producción.
La información previa, la operación de captura, la reclasificación y la generación
por rango se presentan en diálogos normales y responsivos. Reclasificación lista a la izquierda las cajas
disponibles de la orden, permite filtrarlas y carga a la derecha los datos actuales
y el formulario de cambio de la caja seleccionada. Generación por rango muestra un
banner bloqueado con la orden y organiza rango, clasificación y origen técnico en
secciones separadas. Detalle se abre desde la grilla en pantalla completa y mantiene
la orden bloqueada, sus métricas y la descarga de todas las cajas de la orden.
`GenCajas` genera entre 1 y 1.000 cajas en una sola transacción para una orden
activa, rechazando todo el rango si alguna caja ya existe. Paletizado, despacho y
SAG quedan fuera de esta entrega.

Objetos GX: `CAP001`, `CAPCajas02`, `CAPCajas03`, `INSCajasProc`, `CajasxProc` y `CamEstProc`.

Validación controlada ejecutada el 2026-09-21: en la orden local de ensayo
`2017-2018 / 174` se registró la caja `999999`, se comprobó el rechazo por
duplicado, se consultaron detalle y totales, y se cerró la orden en estado `4`.

Validación de reclasificación ejecutada el 2026-09-21 sobre la misma caja de
ensayo: se cargaron 15 envases, 2 categorías y 24 calibres aplicables; la
actualización con su clasificación vigente conservó `CAPEnvO=1`, `CAPCatO=1` y
`CAPCaliO=0100`.

Validación automática visible ejecutada el 2026-09-28 en navegador sobre la
orden local `2016-2017 / 146`, sin modificar datos operacionales. Se comprobó
el filtro y los indicadores, el diálogo informativo, la pantalla de captura,
el rechazo de un código de 22 dígitos, el rechazo por duplicado de una caja
existente, el detalle paginado, la selección de una caja para reclasificación
y el formulario de generación por rango. Un rango de 1.002 cajas mostró el
total calculado y mantuvo deshabilitada la generación por superar el máximo de
1.000. La cuenta temporal y sus sesiones se eliminaron al terminar la prueba.

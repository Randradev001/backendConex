# Operacion de ordenes de proceso

Fecha de revision: 2026-10-21.

Estado: alta y modificacion implementadas.

## Alcance

La pantalla `/ordenes-proceso/operacion` migra el WorkPanel GX8
`OrdenProcINS`. Selecciona saldos disponibles de recepciones manuales y crea
`ORDPROC`, su detalle `ORDPROC1` y el movimiento de salida asociado en
`MOVFRUT/MOVFRUT1`, siempre dentro de una transaccion serializable.

La empresa y el usuario provienen de la sesion. La operacion reutiliza el
programa `110/2/2` y la accion de alta o modificacion correspondiente.

## Presentacion operacional

- El ADM `/maestros-gx/ordenes-proceso-adm` usa el patrón de listado
  operacional de CONEX: banner verde, temporada activa automática, rango inicial
  de los últimos 30 días, indicadores clicables, filtros en una línea y búsqueda
  con debounce integrada en la grilla. Excel, PDF y `Nueva orden` se ubican en
  el banner; se retiraron los botones manuales Buscar y Limpiar y el distintivo
  técnico de nivel GX.
- Los filtros de fecha permiten extremos abiertos y el backend aplica realmente
  fecha, especie, variedad, estado y búsqueda general sobre `ORDPROC`. La grilla
  presenta nombres de especie, variedad, productor y exportadora, además de los
  estados con sus etiquetas de negocio. Tarjetas, tabla y exportaciones se
  calculan desde el mismo conjunto filtrado.
- Cada lote destaca en verde la **Cantidad restante**, mostrando en tamaño
  principal envases y kilos disponibles antes de seleccionar.
- La cantidad ya utilizada permanece separada para no confundir saldo con
  consumo historico.
- Despues de confirmar un alta, React presenta un dialogo con el numero de
  orden generado como dato principal y resume temporada, fecha, productor,
  variedad, exportadora, etiqueta, lotes, envases y kilos persistidos.
- La respuesta usada por el dialogo es la devuelta por Node despues del
  `COMMIT`; React no calcula ni anticipa el correlativo `Ordpnum`.
- El mismo resumen se descarga como PDF individual desde el dialogo de alta y
  desde las acciones del ADM. Node lo genera desde `ORDPROC/ORDPROC1`, con el
  numero de orden destacado, datos registrados, totales y lotes seleccionados.
- El alta persiste `ExpCod`; anteriormente se solicitaba la exportadora pero el
  `INSERT` inicial no incluia esa columna. Los registros historicos sin valor
  se presentan como no informados.
- El ADM conserva `ProdCod` y `ExpCod` como claves de `ORDPROC`, pero presenta
  `PRODUCTORES.ProdNom` y `EXPORT1.ExpNom` en la grilla y en sus exportaciones.
  Las acciones de cada fila usan iconos de tamano medio, centrados verticalmente
  respecto de la fila.
- El ADM ofrece una accion explicita para iniciar o desactivar el proceso. La
  confirmacion reutiliza el detalle persistido de la orden. Al iniciar registra
  fecha, usuario y hora de apertura; impide iniciar estados distintos de
  `Ingresada` y rechaza una segunda orden activa en la misma empresa y
  temporada. Desactivar devuelve la orden a `Ingresada` y registra la hora de
  termino del proceso.
- La accion `Visualizar` abre un dialogo amplio de solo lectura. Presenta los
  25 campos persistidos de la cabecera en tarjetas de identificacion,
  configuracion, cantidades y auditoria; debajo conserva el `DataGrid` de
  detalle con lote, calidad, especie, variedad, productor, envases y kilos.
- La columna de acciones conserva siempre la posicion de operacion: estados 0
  y 1 muestran iniciar o desactivar proceso; los demas estados muestran
  `Ver lecturas CAPCAJAS`. Esta accion abre a pantalla completa la consulta
  paginada de `CAP001`, con resumen, exportacion y ciclo por caja.

## Regla de saldo

Node vuelve a consultar y bloquear el lote antes de guardar. Rechaza una
seleccion si envases o kilos superan el saldo disponible, aunque la pantalla
haya mostrado un valor anterior. El protagonismo visual del saldo no reemplaza
esta validacion transaccional.

## Verificacion 2026-10-21

- La consulta real del ADM en `CONEX_MIGRACION` devolvio para la orden 176
  `ProdNom=GUILLERMO DONOSO` y `ExpNom=RIO DUERO`, en lugar de los codigos 7 y
  6 mostrados anteriormente.
- El frontend compilo 6.033 modulos y el lint dirigido de
  `gxMaestroCrud.jsx` termino sin errores.
- La homologación del listado compiló el frontend completo y el conjunto de
  pruebas Node terminó correctamente. Se verificó además la sintaxis del
  controlador y el lint dirigido sin errores (persisten advertencias Prettier
  históricas en los archivos genéricos).

### Cierre de validación del listado (2026-10-21)

- Se eliminó el truncamiento de 500 filas del ADM; la temporada es obligatoria
  y el listado carga el conjunto filtrado completo para grilla, tarjetas y
  exportaciones. La paginación visual vuelve a la primera página al filtrar.
- Un rango invertido deja tabla y tarjetas vacías y bloquea exportación.
  Los reportes identifican explícitamente los límites de fecha abiertos.
- Verificación de solo lectura en la base configurada: 29 órdenes en temporada
  activa; hasta 31/08/2026: 27; desde 01/08/2026: 6; agosto: 4; estado 0: 5;
  búsqueda 175: 1. Se contrastaron los resultados con el conjunto completo.
- Safari: búsqueda automática 175, limpieza de ambas fechas, tarjeta Ingresadas
  y selector de columnas comprobados en la ruta real. No se alteraron órdenes.
- 174 pruebas Node aprobadas, incluyendo tres pruebas de regresión del listado;
  ESLint dirigido sin errores y build completo aprobado.
- Se conserva el exportador compartido: Excel es HTML con extensión .xls y PDF
  usa la impresión del navegador. Incluye todas las filas filtradas cargadas,
  pero no equivale a XLSX nativo ni reemplaza el comprobante PDF oficial.

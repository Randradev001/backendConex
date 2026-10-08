# Ingreso de Tarjas

## Alcance

La entrega migra la transaccion GeneXus `FoliosProc` y el listado
`FoliosProcesados`. El menu abre el listado y la pantalla `Ingreso de Tarjas`
se llama desde sus acciones Agregar, Visualizar y Modificar. Incluye eliminacion
controlada, exportacion Excel, carga masiva controlada por Excel y la pantalla
`Ventana de Impresión`, llamada desde `Folios Procesados`. No incluye busqueda
avanzada, ventas de pallet, anulacion ni los restantes botones GX.

El XPZ de referencia es `Pantallas y Procedimientos.xpz`, revisado el
2026-09-29. Incluye la transaccion `FoliosProc`, sus tablas `FoliosProc` y
`FoliosProc1`, y los procedimientos `AgrCeros`, `TraeCorFolio`,
`TraeDatosLote` y `VeriFolio`.

El XPZ adicional `Listado.xpz`, revisado en la misma fecha, contiene el work
panel `FoliosProcesados`, sus dos grillas, filtros y eventos.

Los XPZ `ImpVentana.xpz` y `Eti_VentanaP1.xpz` fueron contrastados el
2026-09-30. La pantalla nueva conserva sus filtros y la etiqueta ZPL historica;
la ruta React es `/procesos-sag/folios-procesados/impresion` y reutiliza el
permiso `100/20/5` del listado.

## Ubicacion y seguridad

- Sistema: `100`, Control de Produccion Fruticola.
- Modulo existente: `20`, Procesos S.A.G.
- Programa nuevo: `5`, Folios Procesados.
- Llamado GX para React: `wfoliosprocesados`.
- Ruta React de menu: `/procesos-sag/folios-procesados`.
- Rutas React del formulario: `/nuevo`, `/:folio/ver` y `/:folio/editar`
  bajo la ruta de menu.
- Ruta Node: `/backendDocker/ingreso-tarjas`.

El programa historico `100/2/10`, `wfoliosprocesado`, no se modifica. El nuevo
programa debe asignarse expresamente a usuarios o roles. Todas las rutas Node
usan `EmpCod` y login desde la sesion; la pantalla no puede reemplazar la
empresa autenticada.

## Modelo de datos

`FOLIOSPROC` es la cabecera y conserva la clave
`EmpCod + TempCod + FPFolio`. `FOLIOSPROC1` es el nivel dos y conserva la clave
`EmpCod + TempCod + FPFolio + FP2NProc + FP2Cor`.

La temporada proviene exclusivamente de `TEMP01.TempActiva=1` para la empresa
de sesion. El folio lo escribe el usuario y Node lo normaliza a diez digitos
con ceros a la izquierda. Si la clave ya existe, la API responde
`El Folio Ya Existe`.

Una tarja puede asociarse a una orden de proceso, guardada en
`FOLIOSPROC.FPOrdProc`, y admite varios lotes. La cabecera extendida conserva
además `DestCod`, `FPNCaja` y `FPServicio`; `TEtCod` se reutiliza como Etiqueta.
La pantalla no solicita la orden:
la resuelve al seleccionar un lote asociado y restringe los siguientes lotes a
esa misma orden. Si el lote no tiene orden asociada, la orden queda nula y los
datos del detalle se completan manualmente. Cada lote se conserva en el
historico `FOLIOSPROC1.FP2NProc`, cuyo titulo visual GX es `N° Lote`. La
asociacion usa `ORDPROC`, `ORDPROC1`, `MOVFRUT` y `MOVFRUT1`. La fecha oficial
del detalle es `MOVFRUT.MovFecha`.

El saldo de cajas es:

`ORDPROC1.Ordp1Env - SUM(FOLIOSPROC1.FP2Cajas)` cuando existe una orden.

para la misma empresa, temporada, orden de la cabecera y lote del detalle. El
backend vuelve a calcularlo dentro de una transaccion serializable antes de
insertar o modificar. Para lotes sin orden no se aplica ese limite porque no
existe una fuente de saldo asociada. Al modificar, descuenta temporalmente el
detalle propio para no reducir falsamente el saldo disponible.

## Reglas migradas

- Estados permitidos: `1`, En transito; `10`, Tarja completa.
- `FPDisponible` inicia en `1`. Inspeccion, despacho, repaletizaje y anulacion
  deberan cambiarlo a `0` en sus entregas respectivas.
- `FPFechaIng` usa la fecha seleccionada en la cabecera y se guarda con hora
  `00:00:00` (`12:00:00 AM`); cuando una integración no informa la fecha se
  usa la fecha del servidor. `FPOrigen` inicia en `0`.
- Tipo de etiqueta, tipo de altura y tipo de base de pallet permanecen siempre
  habilitados.
- Los envases con `EnvUso=2` no se ofrecen y tambien se rechazan en Node.
- Los kilos se calculan en Node como
  `FP2Cajas * (ENVCAT.EnvPeso - ENVCAT.EnvDestare)` y `FP2Kilos` se persiste
  como `money` para soportar el rango completo de kilos por detalle. La
  migración `database/20261001_ingreso_tarjas_fp2kilos_money_2016.sql` amplía
  la columna en bases existentes.
- Exportadora y especie de cada detalle deben coincidir con la cabecera.
- Los valores asociados a la orden o al lote se completan y bloquean en React;
  si la fuente no contiene un valor, el usuario debe seleccionarlo. Node
  siempre vuelve a consultar y validar la fuente. Un lote sin orden queda
  editable y se guarda con `FPOrdProc` nulo.
- Se conserva la deteccion GX de duplicados por folio, fecha, especie,
  variedad, productor, envase, categoria y calibre.
- `FP2Cor` se genera por folio y lote dentro de la misma transaccion.
- Un error revierte cabecera y todos los detalles.
- Modificar y eliminar se bloquean cuando el origen no es manual (`0` o `5`) o
  cuando el folio ya participa en inspeccion o despacho.

## Presentacion

La cabecera muestra la Central o empresa autenticada en modo solo lectura,
fecha, temporada, folio, estado (por descripción, sin exponer su código),
exportadora, especie y el bloque Configuración del pallet con envase, base de
pallet, destino y tipo de altura. Destino usa el catálogo global `DESTINOS`.
Las columnas históricas de número de caja, etiqueta y servicio se conservan en
la persistencia por compatibilidad, pero no se capturan en esta pantalla. La
orden no se expone como campo: se obtiene del lote cuando existe asociación y
puede quedar nula. Al guardar una tarja nueva, los valores de Configuración del
pallet se conservan para el siguiente ingreso. El detalle editable muestra el
lote como campo editable y digitable (inicia en `0` y puede guardarse con ese
valor), productor, variedad, categoría, calibre, cajas, kilos y fecha
(inicialmente la fecha local actual) en una sola línea. Especie y envase se
toman de la cabecera; variedad y categoría se seleccionan por cada detalle. Al
cambiar el envase, Categoría solo ofrece las opciones configuradas para ese
envase. Los
campos de catálogo aceptan el código digitado y, al salir del campo, seleccionan
automáticamente la opción coincidente. Los totales de cajas y kilos se
recalculan en pantalla. En modo nuevo, al salir del campo Folio se verifica la
existencia en la empresa y temporada activa; si ya existe, se muestra `El Folio Ya Existe`
y el campo queda marcado con error. Tras guardar correctamente,
el formulario se limpia para el siguiente ingreso.

En modo nuevo, el recorrido de Tab es: Folio, Fecha, Estado, Envase, Base de
pallet, Destino, Tipo de altura, Exportadora, Especie, Agregar detalle y, por
cada fila, Lote, Productor, Variedad, Categoría, Calibre, Cantidad y Fecha de
movimiento. Desde Fecha de movimiento el foco llega a Agregar detalle y luego
a Guardar tarja; desde Guardar tarja vuelve a Folio. Al crear una fila, el foco
se posiciona automáticamente en su campo Lote.

Los límites de captura conservan los largos físicos de GX8/SQL: folio y número
de caja admiten 10 dígitos; servicio, 30 caracteres; lote, 10 dígitos;
productor, 6 caracteres; calibre, 10 caracteres; y cantidad, hasta 5 dígitos
(máximo 32767). Los códigos `smallint` se limitan a 5 dígitos y variedad, que
usa `int`, a 10 dígitos; los catálogos de etiqueta, altura y base conservan
además el máximo funcional de 999 (3 dígitos). Las fechas se capturan con 10
caracteres en formato `DD/MM/YYYY`.

El listado conserva los filtros GX por fecha desde/hasta, especie, estado y
folio, con los ultimos 30 dias como rango inicial. Usa el `DataGrid` compacto
del frontend, con paginacion server-side, columnas densas y estado en chips.
El filtro de folio usa coincidencia parcial, por lo que una entrada como `73`
encuentra folios almacenados con ceros a la izquierda que contengan ese valor.
Muestra los campos de la grilla de cabecera y totales generales. Agregar,
Cargar Folios, Ventana de Impresión y Excel permanecen en la barra superior;
Visualizar, Modificar y Eliminar se repiten como iconos en la columna Acciones
de cada folio. Excel
genera un archivo `.xlsx` en Node con todas las filas filtradas, no solo la
pagina visible. Al seleccionar una fila de cabecera se despliega un segundo
`DataGrid` con sus detalles, consultados por `EmpCod` de sesion, `TempCod`
activo y `FPFolio` seleccionado. En escritorio ambos listados se presentan en
paralelo, con la cabecera ocupando aproximadamente 60% y el detalle 40%; en
pantallas pequenas se apilan. Ambos listados mantienen la misma altura visible
para conservar la alineacion entre paneles.

## Verificacion requerida

1. Empresa y temporada provienen de la sesion y de `TempActiva=1`.
2. Folio corto se guarda con diez posiciones.
3. Folio repetido devuelve el mensaje funcional acordado.
4. Se guardan varios detalles y sus correlativos.
5. Se rechaza un envase `EnvUso=2`.
6. Se rechaza una combinacion duplicada.
7. Se rechazan cajas que superan el saldo de la orden y lote.
8. Dos altas concurrentes no pueden consumir el mismo saldo.
9. Una falla de detalle no deja cabecera ni filas parciales.
10. El endpoint rechaza usuarios sin permiso `100/20/5`.
11. La carga acepta solo `.xlsx` y rechaza archivos que superen 1 GB.
12. Un folio repetido dentro del archivo conserva la primera fila y reporta el descarte de las siguientes.
13. Un error de un folio revierte solo ese folio y aparece en el reporte sin impedir la carga de los folios validos.
14. Destino inexistente se rechaza y Destino, N° de Caja y Servicio persisten al crear o modificar.

> En el listado de detalle, Productor, Especie, Variedad, Envase y Categoría se presentan por descripción de catálogo; sus códigos numéricos se conservan internamente y no se muestran.

## Ventana de Impresión

`Ventana de Impresión` reutiliza el listado de folios de la temporada activa,
con filtros por fechas, especie, estado y coincidencia parcial de folio. Permite
seleccionar uno o varios folios y generar la etiqueta de `Eti_VentanaP1`.
Admite detalles normales y con cuartel; el peso usado es el último detalle
ordenado por variedad/correlativo y se obtiene de `ENVCAT.EnvPesoSag` (con
`EnvPeso` como compatibilidad para datos antiguos). La migración
`database/20260930_ventana_impresion_2016.sql` crea el campo y lo inicializa
desde `EnvPeso` cuando está vacío. `EnvPesoSag decimal(10,4)` fue creado y
verificado sobre la base configurada el 2026-09-30: los 15 envases quedaron
con valor y no se registraron nulos.

La etiqueta física usa la Zebra GK420t a 203 dpi, con formato ZPL de 799 x 1558
puntos (10 cm x 19,5 cm). Las dimensiones siguen configurables por `PARAMGE1`
(`PARCod=10, PAR1Cod=2`) y las copias por `PARCod=10, PAR1Cod=1`, mediante el
mismo procedimiento `TraeParametro`. La pantalla realiza impresión directa por
TCP al puerto 9100 de la impresora seleccionada en `ConfImpresoras`; no usa el
worker ni la tabla `OrdenImpresionFolio`. Si falta la IP de la impresora o el
envío falla, responde un error funcional y no abre una ventana ni el diálogo de
impresión del navegador. Como el envío físico no es transaccional, si un lote de
folios falla después de enviar otros, el mensaje informa cuántas etiquetas ya
fueron entregadas para evitar duplicados.

Al componer la etiqueta, el calibre elimina únicamente los ceros iniciales
(por ejemplo, `0XLD` se imprime como `XLD`); los ceros internos se conservan.
La fuente se calcula por cada línea a partir del bloque reservado para tres
caracteres por calibre y los separadores. La tabla `CALIBRES` de la empresa 1
contiene valores de hasta cuatro caracteres; por ello, y para cualquier valor
más largo, la fuente se reduce proporcionalmente para mantenerlo dentro de su
bloque de impresión. De uno a tres calibres se imprimen apilados; desde cuatro
se distribuyen en dos columnas de hasta tres filas, sin separador visual.

## Carga de folios por Excel

El listado incorpora el boton `Cargar Folios`, que abre
`/procesos-sag/folios-procesados/cargar`. La pantalla acepta exclusivamente el
formato `.xlsx` de diez columnas generado por `Formato Carga Folios`: folio,
codigo de exportadora, fecha de proceso, codigo de productor, codigo de
especie, codigo de variedad, codigo de envase, codigo de categoria, calibre y
cajas. El limite de transferencia es 1 GB y el archivo se recibe en disco
temporal antes de procesarlo.

Los codigos del archivo usan los mismos codigos internos de `Ingreso de Tarjas`:
`ExpCod`, `ProdCod`, `Especod`, `VarCod`, `EnvCod` y `Catcod`. Se resuelven
contra los catalogos de la empresa autenticada. Cada folio se procesa en una transaccion
independiente: si falla un catalogo, el folio ya existe o una validacion de
saldo/regla aplicable falla, se revierte el folio completo y se continua con los demas.
Los folios repetidos dentro del archivo conservan solo la primera fila
encontrada. El alta importada conserva `FPOrigen=5`, estado `10`,
`FPDisponible=1`, fecha de ingreso a medianoche y detalle con `FP2NProc=0`,
compatible con `SubeFoliosExcel`.

La respuesta incluye folios cargados, rechazados y filas repetidas descartadas.
La pantalla presenta un reporte con linea, folio y descripcion del error, mas
un resumen de advertencias. El endpoint esta protegido por el permiso
`100/20/5` y toma empresa y temporada de la sesion.

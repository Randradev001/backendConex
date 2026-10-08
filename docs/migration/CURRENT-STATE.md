# Estado vigente de la migracion CONEX

Ultima actualizacion documental: 2026-10-08.

Este es el documento de entrada para continuar el proyecto. Describe el estado
observado en el codigo y en `CONEX_MIGRACION`. Antes de trabajar, ejecutar
`git status --short`: esta fotografia puede incluir cambios aun no confirmados
en Git.

## Objetivo y alcance

Se migra CONEX desde GeneXus 8 a:

- React 19 + Vite + Material UI en el frontend;
- Node.js + Express en el backend;
- SQL Server conservando el modelo fisico GX8;
- una sola base operativa durante la validacion.

Rutas activas:

- backend: `C:\Proyectos2025\Conex\backend\backendConex`;
- frontend: `C:\Proyectos2025\Conex\Frontend\conex-frontend`.

No continuar cambios en `C:\Proyectos2025\AS`; fue una copia temporal y quedo
fuera del alcance por decision del usuario.

## Fuentes de verdad

- Exportacion GX8: `C:\Users\andre\Downloads\GXW.xpz`.
- Inventario consolidado: `C:\Proyectos2025\Conex\DocumentacionIA\Inventario_GX8_Conex.xlsx`.
- Inventario versionado: `docs/gx8/inventory/`.
- Exportacion de Seguridad reciente: `C:\paso\APERPSeguridad.xpz`.
- Codigo backend y frontend de las rutas activas.
- Esquema y datos de la base configurada en `SQLSERVER_DATABASE`.

No interpretar el nombre del codigo generado como nombre funcional. Usar el
nombre del objeto GX y documentar su descripcion de negocio.

## Decisiones cerradas

1. Se conserva una sola base SQL Server. Durante la validacion se usa
   `CONEX_MIGRACION`; el renombre final a `CONEX` sigue pendiente.
2. Se conservan nombres fisicos GX8. Solo se agregan columnas o tablas de forma
   aditiva mediante scripts versionados.
3. En negocio se usa `EmpCod`; en tablas de Seguridad se conserva `GECODEMP`.
   Ambos representan la misma empresa de la sesion.
4. El login obtiene la empresa desde `SEGUSUEMP` y `DEFEMP`. React no permite
   cambiar `EmpCod` dentro de un maestro.
5. Los niveles 2 se mantienen dentro de la pantalla cabecera-detalle del padre;
   no son maestros independientes en el menu.
6. `NivSeg` se conserva por compatibilidad. La autorizacion vigente usa
   `ASIGSIST`, `ASIG`, `ASIGPROG`, `ASIGPROG1` y roles.
7. `VA` se retiro. La finalidad de `VA2` se implementa en middleware backend.
8. Las reglas de consulta, validacion, calculo, escritura y autorizacion se
   implementan en Node. React solo presenta y consume la API.
9. El menu se arma desde `SISTEMAS -> MODULOS -> PROGRAM` y permisos efectivos.
10. La marca visual es CONEX-CO, Control de exportacion, con paleta verde. No
    volver a textos, colores o documentacion de Mantis.

## Diseñador visual de etiquetas ZPL

Implementado como CRUD visual que reutiliza el programa de Seguridad de
`CONFIGETI`, sin crear un programa independiente:

- React abre `/etiquetas/disenos` desde `wconfigeti`. Presenta una card verde
  por etiqueta con acciones para visualizar, editar, crear una versión, editar
  datos o eliminar. La edición usa `/etiquetas/disenos/:etiCod/:version`.
- El canvas usa React-Konva; Zustand/zundo mantiene el documento JSON y el
  historial; bwip-js representa Code 128 y QR durante la edición.
- Node expone `/backendDocker/etiquetas`, aislado en
  `src/modules/etiquetas/`, y exige el mismo permiso `110/1/1` de
  `wconfigeti`. `EmpCod` y login provienen exclusivamente de la sesión.
- `ETIQUETA` es la cabecera y `ETIQUETAVERSION` guarda cada diseño completo,
  JSON, ZPL y `ROWVERSION`. Una versión por etiqueta puede ser vigente.
- `ETIQUETA.TEtCod` referencia `TIPETI` por `EmpCod + TEtCod`. Crear o editar
  usa un select del catálogo de la empresa; `EtiTipo=VINASA` queda separado
  como formato técnico histórico y no como tipo de negocio.
- El core propio importa el subconjunto inicial, conserva rangos y comandos no
  modelados, genera ZPL backend y escapa variables dinámicas.
- Preview Labelary es una ayuda no productiva. El worker físico quedó
  implementado y deshabilitado por defecto; su activación con una Zebra real y
  la validación completa de puesta en marcha siguen pendientes.
- La migración agrupó los ejemplos `LAVINA16` y `POLCURA16` como dos cabeceras.
  Sus 24 filas `CONFIGETI` no se muestran ni editan en el flujo nuevo; solo se
  usan para rescatar el primer diseño histórico.
- En ambos ejemplos, `Rescatar desde GX8` recompone el layout de
  `Eti_CV_VINA2016` como un diseño de 799 por 400 puntos, 22 elementos y
  variables editables al crear una versión. Preview y canvas aplican una orientación visual de 180
  grados para mostrarlo en posición de lectura sin modificar las coordenadas ni
  rotaciones ZPL. Canvas y preview sustituyen la muestra genérica `CALIBRE` por
  un código real corto del catálogo, como `00LL`, evitando un recorte falso sin
  alterar los demás campos ni la geometría guardada. Para los textos `^FT`, el
  canvas convierte la línea base Zebra a la esquina superior usada por Konva y
  revierte esa conversión al mover o transformar un elemento. Las líneas y
  rectángulos `^GB` compensan además el extremo de rotación Zebra según su ancho
  y alto. La acción no persiste hasta pulsar Guardar.
- Evidencia detallada: [etiquetas-editor-zpl.md](etiquetas-editor-zpl.md).

## Base de datos

Estado operativo:

- `compose.database.yml` permite levantar SQL Server 2022 Developer con nivel
  de compatibilidad 130. En el primer inicio restaura el respaldo portable
  `database/docker/backup/CONEX.bak` como `CONEX` o, si no existe, ejecuta el
  instalador vacio. El respaldo real queda fuera de Git; el procedimiento de
  exportacion y traslado esta en `docs/deployment/database-docker.md`.
- `CONEX_MIGRACION` contiene el modelo original CONEX y la homologacion de
  Seguridad.
- El backend no consulta `BDCONEXCO` ni `CONEX_GX8_ANALISIS` en ejecucion.
- `database/20260728_CONEX_original_homologacion.sql` define el soporte aditivo
  de Seguridad para una copia original.
- `database/20260728_import_BDCONEXCO_security.sql` contiene la importacion
  compatible que se uso durante la consolidacion.
- `database/20260730_maestros_condiciones_origenes_destinos.sql` fue ejecutado
  y confirmo `DESTINOS.DestNMP` con largo 30.
- `database/20260815_instalador_conex_2016.sql` prepara una base `CONEX` vacia
  compatible con SQL Server 2016, crea las tablas operacionales usadas por la
  migracion actual y siembra la capa de Seguridad con usuario, rol, menu y
  permisos iniciales; no migra datos historicos GX8.
- `database/20260815_tablas_operacionales_faltantes_2016.sql` es el parche
  complementario para bases donde ya se ejecuto el instalador inicial: crea
  solo las tablas operacionales faltantes y omite las existentes.
- `ORDPROC` y `ORDPROC1` conservan su estructura GX8 completa. El primer ADM de
  Ordenes de Proceso usa el CRUD generico con grilla, filtros y autorizacion
  `110/2/2`; sus eliminaciones validan dependencias en `ORDPROC1`.
- La operacion `OrdenProcesos/OrdenProcINS` se implemento en
  `/ordenes-proceso/operacion` como alta de ADM con permiso `110/2/2`: consulta lotes disponibles,
  permite seleccionar el lote completo o cantidades parciales y genera la
  cabecera/detalle en una transaccion serializable, evitando sobreconsumo. La
  generacion solicita variedad, exportadora, fecha y etiqueta, y persiste la
  salida de proceso en `MOVFRUT/MOVFRUT1` usando `OriCod=90`, `MovTDoc=90`,
  `MovNGuia=Ordpnum`, `TMcod=2` y `TMSCod=1`, alineado con `PCreaLOTE` y
  `PCrea_Detalle_LOTE`. La cabecera conserva `OrdploginC/OrdpFecC` como datos
  de creación y deja la orden en estado 0. El ADM permite visualizar cabecera
  y detalle; editar reutiliza la pantalla operacional y actualiza cabecera,
  detalle y movimiento de salida dentro de una transacción serializable,
  conservando el mismo `Ordpnum` y validando saldo sin contar la propia orden.
  Cada lote destaca la cantidad restante en envases y kilos. Tras crear, un
  dialogo resume lo persistido y da protagonismo al `Ordpnum` generado por el
  backend. Ese resumen puede descargarse como PDF real desde el dialogo o las
  acciones del ADM. El alta persiste la exportadora seleccionada en `ExpCod`;
  ver `docs/migration/ordenes-proceso-operacion.md`.
- El ADM de ordenes de proceso incorpora una accion confirmada para iniciar o
  desactivar una orden. El backend registra los datos de apertura y evita que
  dos ordenes queden activas simultaneamente para la misma empresa y temporada.
- `database/20260818_importar_usuarios_rut_real_login_2016.sql` importa desde
  `CONEX_MIGRACION` a `CONEX` solo usuarios activos con RUT/DV valido y empresa
  asignada; copia empresas, `SEGUSUEMP`, credenciales modernas si existen y
  permisos/roles relacionados para iniciar sesion.
- `database/20260818_generar_inserts_login_usuarios_rut_real.sql` genera lineas
  `INSERT ... VALUES (...)` literales para `DEFEMP`, `USUARIOS`, `SEGUSUEMP` y
  `SEGUSUCRED`, filtrando usuarios activos con RUT/DV real desde
  `CONEX_MIGRACION`.
- `database/20260818_generar_solo_inserts_login_usuarios_rut_real.sql` es la
  variante solicitada para servidor destino con tablas ya creadas: su resultado
  contiene solo sentencias `INSERT INTO ... VALUES (...)`.
- `database/20260901_control_lineas_tablero_2016.sql` agrega de forma repetible
  `LINEAS`, `LINCONFIG`, sus indices de consulta y el programa historico
  `100/6/11` cuando falten. Fue ejecutado sobre `CONEX_MIGRACION`.
- `database/20260907_control_lineas_cap001_compatibilidad.sql` corrige de forma
  aditiva instalaciones donde `CAP001` fue creada como tabla auxiliar parcial;
  agrega las columnas y el indice requeridos por el contador de cajas.

## Folios Procesados e Ingreso de Tarjas

Implementado en `/procesos-sag/folios-procesados` y
`/backendDocker/ingreso-tarjas` con permiso `100/20/5`. El menú abre el listado
`Folios Procesados`; Agregar, Visualizar y Modificar llaman a la pantalla
`Ingreso de Tarjas` en el modo correspondiente. El listado conserva los filtros
GX por fecha, especie, estado y folio, muestra los campos y totales de ambas
grillas y usa el `DataGrid` compacto con paginación server-side. Ofrece
únicamente Agregar, Cargar Folios, Ventana de Impresión y Excel en la barra superior, más Visualizar,
Modificar y Eliminar como iconos por cada folio en la columna Acciones al extremo
izquierdo.

El alta, la modificación y la carga masiva por Excel validan la temporada activa, orden opcional, lotes,
catálogos, duplicados y, cuando existe una fuente asociada, el saldo dentro de
una transacción serializable. La orden
no se muestra ni se solicita en `Ingreso de Tarjas`: React la obtiene del lote
seleccionado cuando existe asociación y deja editable el detalle cuando no la
hay. Envase se selecciona en la cabecera y variedad y categoría se capturan por
cada fila de detalle, filtradas por especie y envase respectivamente. El detalle
se presenta en una sola línea. La cabecera conserva Configuración del pallet
con Envase, Base de pallet, Destino y Tipo de altura; dichos valores permanecen
seleccionados para el siguiente ingreso después de guardar. Las columnas
aditivas `DestCod`, `FPNCaja`, `FPServicio` y `TEtCod` se mantienen por
compatibilidad, aunque N° de Caja, Servicio y Etiqueta ya no se capturan en la
pantalla. La migración es
`database/20260930_ingreso_tarjas_cabecera_pallet_2016.sql`. `FP2NProc` admite
el valor `0` en el ingreso manual y en la carga Excel;
en ese caso no se exige una fuente de lote ni se aplica saldo. La especie de cada detalle se toma exclusivamente de la especie de la
cabecera. El saldo se controla solo cuando existe una fuente asociada. En altas
manuales, `FPFechaIng` toma la Fecha de cabecera y se guarda con hora `00:00:00`;
las integraciones que no la informan usan la fecha del servidor. Eliminar y modificar
se bloquean para folios automáticos o usados por inspección/despacho. Excel se
genera en Node como `.xlsx` con todo el resultado filtrado. El script
`database/20260929_ingreso_tarjas_2016.sql` fue aplicado sobre `CONEX` el
2026-09-29 y registró `wfoliosprocesados`; su asignación a usuarios o roles
queda bajo Seguridad. Evidencia: [ingreso-tarjas.md](ingreso-tarjas.md).
El filtro de folio del listado usa coincidencia parcial y la exportación Excel
reutiliza ese mismo criterio.
El detalle de `FOLIOSPROC1.FP2Kilos` se persiste como `money` (en lugar de
`smallmoney`) para evitar que cantidades válidas de cajas desborden el rango
del peso calculado; el backend envía el parámetro con `sql.Money` y la
migración es `database/20261001_ingreso_tarjas_fp2kilos_money_2016.sql`.
El listado incorpora la pantalla `Cargar Folios`, que recibe el formato `.xlsx`
legado de diez columnas con los mismos codigos internos de Ingreso de Tarjas, aplica un limite de 1 GB y
procesa cada folio en una transaccion independiente. Folios existentes se
rechazan, los folios repetidos en el archivo conservan solo la primera fila y
la respuesta muestra un reporte de linea, folio y error para cada rechazo; los
folios validos continuan cargandose. La carga conserva `FPOrigen=5`,
`FP2NProc=0`, estado completo y fecha de ingreso a medianoche. Evidencia:
pruebas de `readImportRows`, resolucion de catalogos y origen de carga en
`test/ingresoTarjas.service.test.js`.
Al seleccionar una cabecera se muestra el detalle en un segundo `DataGrid`,
filtrado por la empresa de sesión, la temporada activa y el folio seleccionado.
En escritorio ambos listados se distribuyen en columnas 60/40 y en pantallas
pequeñas se apilan. `Ventana de Impresión` se abre desde el botón del listado,
mantiene los filtros parciales y permite seleccionar varios folios. La etiqueta
usa el ZPL histórico de `Eti_VentanaP1`, adaptado a la Zebra GK420t (10 x 19,5
cm; 799 x 1558 puntos a 203 dpi), y lo envía directamente por TCP al puerto
9100 de la impresora seleccionada en `ConfImpresoras`; no usa worker ni cola
SQL. Si falta la IP de red o el envío falla, la pantalla informa el error y no
abre una representación en el navegador.
`EnvPesoSag` se agrega a `ENVCAT` y
se inicializa desde `EnvPeso`; fue aplicado y verificado el 2026-09-30 sobre
los 15 envases de la base configurada, sin valores nulos. Los cuarteles se conservan en los detalles.
La migración correspondiente es `database/20260930_ventana_impresion_2016.sql`.

## Inspecciones

La primera fase del WorkPanel GX8 `Inspecciones` está disponible en
`/procesos-sag/inspecciones` y `/backendDocker/inspecciones`, protegida por el
permiso histórico `100/20/1`. Consulta la temporada activa y las solicitudes
`INS` de los últimos 60 días, ofrece los filtros GX y presenta sus totales de
solicitudes, cajas y pallets. Cinco cards de colores muestran el total y el
desglose por estado (En curso, Aprobadas, Rechazadas y Anuladas) según los
mismos filtros. Las cards son presionables con clic, Enter o Espacio y abren
un modal con el listado paginado del estado respectivo, conservando los demás
filtros activos. Agregar abre
`/procesos-sag/inspecciones/nueva`: crea una sola cabecera `SOLICITUDES1` en
estado En curso y vuelve al listado Inspecciones mostrando el mensaje de creación
exitosa. Los folios pueden
prepararse antes de guardar mediante casillas de selección múltiple y se
vinculan con la cabecera en una sola transacción; después de guardar también se
puede agregar uno o varios folios desde el selector del detalle. Cada alta copia sus detalles a `SOLICITUDES2/3`,
incluye las cantidades del folio en `Sol2CajasDes/Sol2KilosDes` y
`Sol3CajasDes/Sol3KilosDes` para mantenerlo disponible para Despachos, recalcula
los totales y reserva el folio dentro de una transacción serializable.
La cabecera de la solicitud expone además, en modo lectura, los datos de
aprobación/rechazo (`SollogAP`, `SolFecAP`, `SollogRE`, `SolFecRE`) y las cajas
totales por rango (`solcajasRA`, `SolcajasRB`, `SolcajasRC`) desde
`SOLICITUDES1`. Ambos bloques se muestran solo en modos Visualizar o Modificar;
se ocultan al crear o eliminar la solicitud.
Los selectores de folios usan `EmpCod`, `TempCod`, `FPEspe`, `FPEstado=10` y
`FPDisponible=1`; en Inspecciones excluyen además los folios ya presentes en
`SOLICITUDES2`, incluso si una marca histórica de disponibilidad quedó
inconsistente. No agregan filtros de correlativos duplicados ajenos al flujo.
Las claves duplicadas de `SOLICITUDES3` se traducen a un mensaje funcional con
el folio y correlativo de detalle involucrados, en lugar de mostrar el error
técnico de SQL Server.
En el detalle de una solicitud en curso se puede quitar el folio seleccionado
con confirmación; en modo Modificar, agregar y quitar solo quedan pendientes
hasta pulsar Guardar. En ese momento la API elimina o inserta las filas de
`SOLICITUDES3/2`, libera o reserva `FOLIOSPROC.FPDisponible`, ajusta
`FPIns/Fp2Ins` y recalcula los totales. Se rechaza la operación si el folio
tiene movimientos o marcas de despacho, repaletizaje o anulación.
Antes de guardar, el detalle del folio seleccionado se muestra en modo lectura
desde `FOLIOSPROC1` y no modifica su disponibilidad.
Los banners de Inspecciones, Nueva solicitud, Detalle de solicitud e Ingreso de
Tarjas muestran el nombre de la empresa autenticada consultando `DEFEMP.EmpNom`.
Cada fila aprobada del listado ofrece Archivo: genera el `.INS` histórico sin
modificar datos, usando `PARAMGE1 20/30`, `ESPECIES.EspeSag`, solo detalles con
cajas y el terminador `&&`; permite elegir una carpeta en Chrome/Edge y aplica
la descarga estándar como respaldo. Todas las filas ofrecen PDF: el botón
genera un único PDF carta vertical que combina los campos de `Solicit01` y
`Solicit02` en ese orden, presenta el campo como `N° SOLICITUD INSPECCIÓN`, y abre una ventana flotante del visor del
navegador, mantiene los ceros de la solicitud y ubica la página abajo a la
derecha. `Solicit01CU` y `SolicitCU` no se usan en este flujo. En la tabla de
`DETALLE DEL LOTE POR PALLET`, cada folio con más de una línea incluye una fila
adicional de subtotal inmediatamente debajo, con sus totales de Kilos y Cajas;
los folios de una sola línea no agregan una fila adicional. Las filas del listado
usan una altura vertical compacta y las filas de subtotal conservan espacio para
sus dos líneas.
La carátula compacta integra el bloque de campos reservados del SAG en la
primera página cuando el contenido lo permite y valida el espacio disponible
antes de dibujarlo, evitando páginas en blanco intermedias en el PDF. Dentro del bloque
  se muestran casillas para Aprobado, Rechazado y Objetado, además de líneas
  horizontales para completar certificados, inspector, firma, fecha y
  observaciones, manteniendo el layout de GeneXus. Observaciones conserva dos
  líneas de escritura: la primera junto a la etiqueta y la segunda desde el margen izquierdo. El resumen de totales se
  organiza en dos filas compactas, con las métricas principales separadas de los
  rangos y las reservas para mejorar la lectura. La tarjeta de datos de la
  solicitud reduce el espacio vertical entre sus dos filas sin cambiar los
  campos ni su orden.
La pantalla de alta y la antigua vista `Detalle Solicitudes` se unifican: la
ruta `/procesos-sag/inspecciones/nueva` crea solicitudes y
`/procesos-sag/inspecciones/:solNum` usa el mismo componente para visualizar o
modificar según el modo de navegación. El título cambia a **Nueva solicitud de
inspección**, **Visualizar solicitud de inspección** o **Modificar solicitud de
inspección**; ya no existe una pantalla de detalle independiente. La cabecera
se muestra como resumen en visualización y como formulario en modificación.
Visualizar es solo de consulta; Modificar habilita campos y acciones de folios
solo para solicitudes en curso.
Modificar queda habilitado para solicitudes en curso, actualiza la cabecera a
través de `PUT /solicitudes/:solNum` en una transacción serializable y no permite
cambiar la especie cuando ya tiene folios. El botón Eliminar solicita
confirmación y anula (estado 5) las solicitudes en curso; la misma transacción
elimina sus líneas de `SOLICITUDES3/2` y libera los folios asociados en
`FOLIOSPROC/FOLIOSPROC1`. Si un folio tiene movimientos o marcas de uso que
impiden liberarlo, la API rechaza la anulación para preservar la integridad de
los datos; las cantidades iniciales `Sol2CajasDes/Sol2KilosDes` no son una
marca de uso y no bloquean la liberación. La API no realiza borrado físico. El listado incorpora el botón visual
Cambiar Estado para solicitudes en curso; abre un modal pequeño basado en
`CambiaEstadoSol` y consume el endpoint `PATCH /solicitudes/:solNum/status`
con estado 1 o 2 al confirmar Aprobar o Rechazar, registra el usuario y la
fecha en `SollogAP/SolFecAP` o `SollogRE/SolFecRE`, actualiza los contadores y
rechaza transiciones desde estados cerrados. La misma pantalla conserva el
resumen por folio y las líneas de detalle, junto con las reglas de
agregar/quitar folios.
Evidencia y reglas en `docs/migration/inspecciones.md`.

## Despachos SAG

La primera fase del WorkPanel GX8 `DespachosSAG` está disponible en
`/procesos-sag/despachos-sag` y `/backendDocker/despachos-sag`, protegida por
el permiso histórico `100/20/3`. Consulta la temporada activa y conserva los
filtros GX: rango de fecha de los últimos 30 días, estado (En Proceso,
Finalizado, Nula o Todos), número de planilla y número de guía. El listado
usa `DESORIGEN` con `DorTipPlani=1`, muestra los campos visibles del SubFile y
pagina en el servidor.

Cada fila ofrece Agregar, Visualizar, Modificar, Finalizar, Anular, PDF,
Archivo y MultiPuerto. MultiPuerto se abre sobre el listado, reutiliza o crea
`DATMP`, permite escritura libre en los campos de texto y usa el Combo Box del
XPZ para las ubicaciones, y genera el archivo
histórico `MP<CodigoSAG><DORNumf>.txt` con el formato de `ArchiMP`; no agrega
la condición `DorEstado` que no existe en el XPZ.
El formulario limita en el navegador y valida nuevamente en backend los largos
del XPZ: códigos de 4 dígitos, ubicaciones mediante el Combo Box con valores 1
a 6, textos de 30 o 50 caracteres según el atributo y fecha de tratamiento
seleccionable mediante `DateCalendar`, visible en formato `DD/MM/YYYY`.
Finalizar solo está disponible para `DorEstado=0`; valida los campos obligatorios y
la existencia de folios, cambia a `DorEstado=1` y bloquea posteriores cambios de
cabecera y folios. PDF combina la cabecera y todos los detalles
de `DESORIGEN1/2` en el orden de los reportes GX `PlaniDSAG` y `DPlaniSAG`,
siempre en páginas verticales tamaño Carta. El anexo de detalle agrega una
fila verde de totales por folio solo cuando el folio se repite, con subtotales
de Kilos y Cajas.
Archivo está habilitado solo para despachos finalizados y conserva el formato
`.des` de `ArchiDES`: código de planta de `PARAMGE1 20/30`, destino normalizado,
fecha `YYYYMMDD`, total de folios, una línea por folio con cajas y código SAG
de especie, y terminador `&&`. La pantalla permite seleccionar carpeta en
Chrome/Edge y conserva una descarga estándar como respaldo.

La migración aditiva `database/20261006_despachos_sag_2016.sql` completa las
columnas descriptivas necesarias en `DESORIGEN/1/2` e incorpora índices de
consulta; fue aplicada sobre `CONEX` el 2026-10-06. La pantalla unificada
`Despacho` está disponible con títulos dinámicos por modo, bloques Accordion,
alta/modificación/visualización y anulación histórica a estado `Nula`.
Cuando Guardar completa la operación, tanto en alta como en modificación, la
pantalla vuelve al listado Despachos SAG con el mensaje de confirmación. Si una
asociación de folio falla después de crear la cabecera, permanece en el despacho
creado para permitir corregir el detalle.
El selector del detalle de folios conserva las condiciones de los WorkPanels
GX8 `BajaFolDespa` y `BajaFolDesUS`: para origen exige `Sol2CajasDes > 0`,
`Sol2Dispo=0` y `SolEstado=1`; para USDA exige `PUS1CajDes > 0`,
`PUS1Dispo=1` y `PUSEstado=1`, además de empresa, temporada, tipo y especie.
La asociación vuelve a validar esas mismas condiciones dentro de una
transacción antes de copiar los detalles;
los tipos 2 y 3 requieren que `PROCUSDA/PROCUSDA1/PROCUSDA2` estén instaladas
en la base operativa. Multipuerto sigue fuera de alcance.
Evidencia y reglas en `docs/migration/despachos-sag.md`.

## Captura de cajas

La primera entrega de `CAPCajas02` está implementada en
`/captura-cajas` y `/backendDocker/captura-cajas`. Conserva el código GX8 de 23
dígitos, valida la orden activa, calcula el peso neto por `ENVCAT`, inserta
`CAP001` en una transacción serializable, evita duplicados por la clave histórica
y cierra la orden en estado `4`. Incluye consulta paginada y resumen de cajas por
orden. La validación unitaria y la prueba funcional controlada se ejecutaron el
2026-09-21 sobre la orden local `2017-2018 / 174`: alta, rechazo de duplicado,
consulta, resumen y cierre en estado `4`.

`CAPCajas03` está incorporado como reclasificación transaccional de cajas
disponibles: preserva `CAPEnvO`, `CAPCatO` y `CAPCaliO`, valida los catálogos GX8
y recalcula los kilos netos. La caja de ensayo `999999` confirmó la carga de
catálogos y la preservación de sus valores originales el 2026-09-21.

`GenCajas` genera rangos de 1 a 1.000 cajas para órdenes activas en una sola
transacción; valida catálogos, origen técnico y duplicados antes de insertar
cualquier fila. La validación automática cubre el límite del rango.
El 2026-09-28 se ejecutó además una simulación automática visible en navegador
sobre `2016-2017 / 146`. Cubrió filtros e indicadores, apertura de todos los
flujos, rechazo por largo y duplicado, selección para reclasificar y bloqueo de
un rango de 1.002 cajas, sin modificar cajas ni órdenes reales.
- `database/20260908_ordenes_proceso_estructura_gx8_2016.sql` reconstruye las
  tablas auxiliares vacias `ORDPROC/ORDPROC1` con su estructura GX8 completa.
  Se detiene sin cambios si encuentra datos en una estructura incompleta.
- `database/20260901_etiquetas_cabecera_versiones_2016.sql` fue ejecutado sobre
  `CONEX_MIGRACION`; creó `ETIQUETA` y `ETIQUETAVERSION`, y agrupó las 24 líneas
  de `CONFIGETI` en dos cabeceras sin crear versiones ni alterar el respaldo GX8.
- `database/20260907_etiqueta_tipo_fk_2016.sql` fue ejecutado y relacionó
  `ETIQUETA` con `TIPETI`. No asignó tipos a las tres etiquetas ya existentes;
  deberán seleccionarse explícitamente desde el CRUD.
- `database/20260909_impresion_worker_2016.sql` agrega de forma aditiva el
  soporte de trazabilidad de `OrdenImpresion` para el worker silencioso. Fue
  ejecutado sobre `CONEX_MIGRACION` el 2026-09-09; las diez órdenes históricas
  continúan pendientes y no se enviaron a impresión.

## Impresión silenciosa de etiquetas

El proceso independiente está aislado en `src/impresion-worker/` y se inicia
con `npm run start:printer`. Conserva el contrato comprobado en
`Export_Coneximprime.xpz`: `OPLCIMP` se interpreta como `LinID`, la impresora
se resuelve en `ConfImpresoras`, la configuración proviene de
`LINCONFIG.ConfID=1` y la etiqueta específica de `ETIXCAL` prevalece sobre
`ORDPROC.OrdpCodEti`.

El worker genera el correlativo `ETILIN`, compone el código GX, carga la versión
vigente del diseñador, persiste el ZPL final y lo envía por TCP. Solo entonces
marca `OPLCProc=1` y actualiza `OPLCFecha`. Queda deshabilitado por defecto y no
debe habilitarse mientras permanezca activo el trigger SQL `Imprime`. Ver
[impresion-etiquetas-worker.md](impresion-etiquetas-worker.md).

El diseñador versionado incluye una impresión directa con valores de muestra e
impresora seleccionada. El modal de edición de Control de líneas incluye una
simulación que crea una fila pendiente igual al PLC y exige guardar primero
cualquier cambio de configuración. La pantalla también incorpora un CRUD de
`ConfImpresoras` para asignar nombre e IPv4 por línea, con soporte para
direcciones compartidas. Su menú dinámico se registra como `100/6/12`,
`ProgNomGX=wconfimpresoras`, mediante
`database/20260909_impresoras_lineas_menu_2016.sql`, aplicado en
`CONEX_MIGRACION` el 2026-09-09. La asignación a usuarios o roles queda
explícitamente bajo Seguridad.

Los scripts con `BDCONEXCO` en el nombre son antecedentes de la etapa previa.
No ejecutarlos sobre la base actual sin estudiar su objetivo y precondiciones.

El corte final se describe en `conex-single-database-cutover.md` y requiere
pruebas completas, `verify:conex` y `DBCC CHECKDB` antes del renombre.

## Seguridad implementada

`PROGRAM.ProgNomGX` admite 100 caracteres tanto en el catálogo React/Node como
en SQL Server. La ampliación repetible está en
`database/20260929_program_prognomgx_100_2016.sql` y fue aplicada sobre `CONEX`
el 2026-09-29.

| Area | Estado | Implementacion |
|---|---|---|
| Login por RUT y clave | Operativo | `seguridad.service.js`, cookie HttpOnly y `SEGSESION` |
| Empresa de sesion | Operativo | `SEGUSUEMP`, `DEFEMP`, `req.context.empCod` |
| Menu dinamico | Operativo | `seguridadMenu.service.js` y `authorizedMenu.jsx` |
| Usuarios y catalogos | Implementado | CRUD protegido por administrador de Seguridad |
| Roles por usuario | Operativo | `URolesPorUser`; agregar y quitar conserva permisos directos |
| Plantilla de rol | Implementado | programas en `ASIGPROG` con `GECODEMP=0` |
| Permisos directos | Implementado | editor por usuario, sistema, modulo y programa |
| Acciones directas | Conservadas | `ASIGPROG1`; pantalla avanzada disponible |
| Acciones dentro del rol | Pendiente | no se migran crear/modificar/eliminar en esta etapa |
| `NivSeg` | Compatible | se conserva, no reemplaza permisos explicitos |

La pantalla `Asignacion de accesos` selecciona una vez el usuario. Muestra una
pestana `Directos`, todas las pestanas de roles asignados y controles para
agregar o quitar roles. Administrar una pestana de rol modifica la plantilla y
afecta dinamicamente a todos sus usuarios; no modifica asignaciones directas.

La importacion historica no cargo automaticamente las plantillas de rol porque
los codigos de `PROGRAM` de las dos bases no son equivalentes. La homologacion
manual sigue pendiente. No atribuir permisos directos existentes a un rol sin
una tabla de correspondencia confirmada.

Ocultar una ruta en el menu no la protege. Las rutas asociadas a un programa
GX8, incluida la primera ola, ya comprueban ese programa en backend. Definicion
de Empresa conserva su tratamiento de raiz y Comunas es una consulta auxiliar
sin programa propio. La autorizacion por accion crear/modificar/eliminar sigue
fuera de esta etapa.

## Maestros implementados

### Cabeceras visibles

| Pantalla | Tabla GX8 | Detalle en la misma pantalla | Programa | Ruta backend |
|---|---|---|---:|---|
| Definicion de Empresa | `DEFEMP` | - | excepcion raiz | `/maestros/empresas` |
| Temporadas | `TEMP01` | - | 18 | `/maestros/temporadas` |
| Especies | `ESPECIES` | `ESPECIES1`, `CALIBRES` | 3 y 4 | `/maestros/especies` |
| Envases | `ENVCAT` | `ENVCAT1` | 6 | `/maestros/envases` |
| Productores | `PRODUCTORES` | `PRODUCTORES1` | 5 | `/maestros/productores` |
| Condiciones de fruta | `CONDICION` | - | 7 | `/maestros/condiciones` |
| Origenes de ingreso | `ORIGEN` | - | 8 | `/maestros/origenes` |
| Destinos de exportacion | `DESTINOS` | - | 11 | `/maestros/destinos` |
| Clientes | `CLIENTES` | - | 12 | `/maestros/clientes` |
| Agentes | `AGENTES` | - | 13 | `/maestros/agentes` |
| Consignatarios | `CONSIG` | - | 14 | `/maestros/consignatarios` |
| Tipos de documento | `TIPDOC` | - | 1 | `/maestros/tipos-documento` |
| Tipos de movimiento | `TIPMOV` | `TIPMOV1` | 2 | `/maestros/tipos-movimiento` |
| Procedencias | `PROCEDENCIA` | - | 9 | `/maestros/procedencias` |
| Secciones | `SECCIONES` | - | 10 | `/maestros/secciones` |
| Exportadoras | `EXPORT1` | `EXPPROD` | 15 y 16 | `/maestros/exportadoras` |
| Despachadores autorizados | `DESPAAUTO` | - | 19 | `/maestros/despachadores-autorizados` |
| Puertos | `PUERTOS` | - | 20 | `/maestros/puertos` |
| Causales de anulacion | `CAUSAANUL` | - | 21 | `/maestros/causales-anulacion` |
| Tipos de etiqueta | `TIPETI` | - | 22 | `/maestros/tipos-etiqueta` |
| Tipos de base de pallet | `TIPBPAL` | - | 23 | `/maestros/tipos-base-pallet` |
| Tipos de altura | `TIPALT` | - | 24 | `/maestros/tipos-altura` |
| Parametros generales | `PARAMGEN` | `PARAMGE1` | 30 | `/maestros/parametros-generales` |
| Monedas | `MONEDAS` | `VALMEXT` | 31 y 32 | `/maestros/monedas` |

Todos usan el CRUD reutilizable de React y el controller declarativo de Node.
Las pantallas ofrecen listar, visualizar, insertar, actualizar, eliminar,
busqueda general y botones de exportacion. Los filtros especificos se agregan
solo cuando existen en el WorkPanel GX8.

### Estado de autorizacion

- Cada ruta asociada a un programa GX8 usa `requirePermission` o
  `requireAnyPermission`, ademas de la sesion autenticada. Empresa y Comunas
  mantienen las excepciones descritas arriba.
- Los detalles comparten pantalla con su cabecera, pero conservan el programa
  historico cuando existe: Exportadora/Productores (15/16) y Monedas/Valores
  (31/32).
- La empresa efectiva siempre proviene de `req.context.empCod`; un `EmpCod`
  enviado por React no cambia el contexto multiempresa.

### Catalogos de consulta

- Comunas permanece como consulta/lupa. No tiene un programa propio en
  `PROGRAM`, por lo que no se publico como CRUD independiente.
- Los catalogos con programa GX8 confirmado ya tienen CRUD. Comunas continua
  siendo una consulta auxiliar sin entrada propia en el menu.

### Exportaciones actuales

Los botones se reutilizan mediante `ListExportButtons`, pero tienen limitaciones
que una IA no debe ocultar:

- Excel genera HTML con extension `.xls`, no un archivo XLSX real.
- PDF abre una vista HTML y el dialogo de impresion; no descarga un PDF desde
  el servidor.
- Ambos exportan solamente las filas cargadas en React.

Se consideran operativos para validacion visual, no listos para produccion.
La solucion final debe exportar el resultado completo filtrado y generar XLSX y
PDF reales.

## Maestros pendientes

La lista activa de `PROGRAM` para el modulo Maestros quedo cubierta. No publicar
los siguientes catalogos hasta confirmar su llamada y comportamiento de
negocio:

1. Multipuerto (`DESTMP`).
2. Envases multipuerto (`ENVMP`).
3. Productos generales (`PRODGEN`).
4. Lineas de embalaje (`MAELINEAEMBALAJE`), cuya tabla no existe en la base
   configurada.

`GenCor` permanece como servicio transaccional, no CRUD comun. La importacion
Excel de valores de moneda tambien es un proceso especializado y no una
importacion generica del maestro.

## Control de lineas implementado

El WorkPanel `linconfig` se rediseño en `/procesos/control-lineas` como tablero
de monitoreo y edicion. La API `/control-lineas` une `LINEAS` con la
configuracion `LINCONFIG.ConfID=1` y sus catalogos. Usa exclusivamente
`req.context.empCod`, exige el permiso `100/6/11` y devuelve resumen y filtros
por `LinMaquina`.

React presenta tarjetas responsivas verdes o rojas según `LinEstado`, reloj,
estado de conexion y actualizacion automatica cada diez segundos. Una linea
inactiva conserva visibles sus datos configurados porque `LinEstado`,
`LinEstConf` y `ConfEstado` no representan lo mismo.

El encabezado incluye las cajas procesadas de la orden activa de la temporada
activa. La API localiza `TEMP01.TempActiva=1`, selecciona
`ORDPROC.OrdpEstado=1` y cuenta las filas de `CAP001` por
`EmpCod + TempCod + CAPNproc`. No filtra `CAPEst`, porque el cambio posterior a
paletizada o despachada no deja de representar una caja procesada. Sin orden
activa devuelve cero y `Sin proceso activo`.

Las cerezas se animan solo cuando `LinEstado=1`. Al pulsar una tarjeta se abre
un modal con selects dependientes para especie, calibre, envase y
categoria, mas un switch para `LinEstado`. El guardado conserva el permiso de
programa `100/6/11`, valida los catalogos por empresa y actualiza `LINEAS` y
`LINCONFIG.ConfID=1` en una transaccion. Variedad no forma parte del formulario
ni del contrato porque la tabla GX8 original no la almacena.

El boton `+` del filtro abre el alta de linea. El modal solicita maquina,
descripcion, ubicacion, PC, persona opcional, especie, calibre, envase,
categoria y estado. El backend absorbe `Autonumber` y `CreaCabeza`: genera el
siguiente `LinID` por empresa dentro de una transaccion serializable y crea
`LINEAS` junto con `LINCONFIG.ConfID=1`. `EmpCod` y el identificador no se
aceptan desde React.

La eliminacion y la impresion ZPL continúan pendientes. Ver
[configuracion-lineas-tablero.md](configuracion-lineas-tablero.md).

## Consultas de recepcion implementadas

Las consultas `CRecepFrut` y `RRecepFrut` estan implementadas como una unica
pantalla React con reporte; `CRecepciones` se incorporo como vista de resumen y
no como ruta independiente.

El alcance es de solo lectura sobre `MOVFRUT` y su nivel 2 `MOVFRUT1`; no
incluye aun la captura operativa de `Recepciones`/`MovFrut`. La fecha oficial
es `MOVFRUT.MovFecha`, incluso para el detalle. La ruta backend exige permiso
`100/15/1`, toma `EmpCod` de sesion y genera XLSX/PDF completos. Transacciones,
tablas, hallazgos y evidencia se documentan en
[recepcion-fruta-evaluacion.md](recepcion-fruta-evaluacion.md).

El ingreso manual del WorkPanel operativo `Recepciones` esta implementado en
`/recepciones/ingreso`: usa el programa `100/2/1`, acciones 1/2/3, empresa de
sesion, correlativo transaccional, fecha de cabecera y proteccion de lotes
consumidos. Origen usa un `Autocomplete` escribible en el filtro y en la
cabecera. El formulario usa buscadores de catalogo para documento y movimiento
`1/1`; sus resultados presentan la seleccion como icono a la izquierda, y
organiza cada lote en tres filas. El listado inicia filtrado desde la misma
fecha del mes anterior hasta la fecha local de hoy. Por decision funcional,
Grados y Brix no forman parte del formulario; cada lote captura kilos brutos
totales y calcula el peso estimado por envase dividiendo por su cantidad. Los
totales permanecen en `Mov1KilB` y `Mov1KilN`, y el resultado unitario se guarda
en `Mov1Peso`. Por decision funcional, el pesaje automatico y COM1 no se
contemplan. Ver
[recepciones-ingreso-evaluacion.md](recepciones-ingreso-evaluacion.md).
Cada registro de la bandeja y la vista individual permiten descargar un PDF
real generado en Node. El documento corresponde al reporte GX8 `GuiaIng1` e
incluye empresa, cabecera, descripciones de catalogos, observacion, totales y
todos los lotes; no depende de las filas cargadas en React.

El tablero operacional `/recepciones/lotes-tablero` muestra seis fechas, desde
cinco dias atras hasta hoy, y deja `Hoy` seleccionado inicialmente. Al elegir
una fecha reemplaza el area de trabajo con sus productores y lotes de
`MOVFRUT1`, usando como fecha oficial `MOVFRUT.MovFecha`. En fase 1 es de
consulta y reutiliza el permiso del ingreso `100/2/1`. La opcion separada fue
registrada en `PROGRAM` como `100/2/31`, con
`ProgNomGX=wtablerolotesrecep`, mediante
`database/20260811_recepciones_tablero_lotes_menu.sql`.

El control de calidad se abre desde la tarjeta de un lote en un dialogo de
pantalla completa. La cabecera de recepcion es fija y el lote se modela como
`field array` con danos, calibre, color, firmeza y observaciones. El maestro
`MAdanos` fue creado por empresa y especie mediante
`database/20260811_maestro_danos_recepcion.sql`; para cereza (`Especod=1`) se
cargaron los 16 defectos iniciales. El guardado operacional usa `CALRECEP` y
los detalles normalizados `CALRECEPDANO`, `CALRECEPCALIBRE`,
`CALRECEPCOLOR` y `CALRECEPPLAGA`, creados por
`database/20260811_control_calidad_recepcion_operacional.sql`. La ruta
`/recepciones/calidad` lista los controles y reutiliza el mismo formulario en
modos Ver y Editar. El mantenedor se registra como opcion independiente
`100/2/32`, `ProgNomGX=wctrlcalidadrecep`, con acciones crear, modificar
y anular, mediante `database/20260811_control_calidad_recepcion_menu.sql`.
Los programas 31 y 32 deben asignarse expresamente desde Seguridad a los
usuarios o roles correspondientes. El rango por defecto del tablero calcula
`Hoy` con la fecha local del servidor para no adelantarse un dia al cambiar la
fecha UTC.
Las tarjetas del tablero consultan `CALRECEP` por la clave completa del lote:
un control vigente las marca como completadas en verde y la ausencia de control
las mantiene pendientes en rojo. Al seleccionar una tarjeta completada se abre
un modal exclusivo de lectura con el ultimo control vigente; una pendiente
continua abriendo el formulario de registro. El mantenedor incorpora filtro general,
fecha, estado y exportaciones Excel/PDF sobre las filas filtradas y cargadas.
El rango de fechas se inicializa desde un mes atras hasta la fecha local de hoy.
Las tarjetas completadas muestran porcentajes de Calidad, Exportacion y
Comercial. En el formulario, Comercial corresponde a la incidencia de danos
sobre la muestra y Exportacion al porcentaje restante; React los presenta como
solo lectura y Node los recalcula antes de persistir.
Calibre, pre calibre, color y firmeza representan cantidades de frutos. La suma
de calibre y pre calibre, y por separado la suma de los colores, debe coincidir
con el tamano de muestra; los porcentajes de distribucion son resultados
calculados y no valores capturados.
Las fotografias de danos se almacenan en `CALRECEPFOTO` como
`VARBINARY(MAX)`, fuera del JSON principal y vinculadas a `CALRECEP`. Se
admiten hasta 10 imagenes JPEG, PNG o WebP de 5 MB por control; el formulario
permite carga multiple y la vista de consulta presenta una galeria.
En dispositivos moviles, `Tomar foto` solicita la camara trasera mediante
`capture=environment`; `Elegir fotos` conserva el selector multiple de galeria.
Ambas alternativas se presentan desde un dialogo compacto de seleccion de
origen, independiente del formulario de pantalla completa.
El dashboard `/recepciones/calidad-dashboard` agrega por periodo y lote los
controles finalizados. Presenta indicadores preliminares normalizados,
segregacion premium, color, calibre, defectos, aprobacion, sanidad y porcentaje
de lotes con virus. Los graficos usan una paleta verde consistente; los
hallazgos de plagas, virus y dipteros se separan en tarjetas visuales y la
observacion general fue reemplazada por tarjetas de conclusiones rapidas.
Cada grafico presenta una conclusion contextual calculada y el cierre incluye
una conclusion general de negocio que combina rendimiento, condicion,
segregacion, defectos y riesgo sanitario.
El informe muestra además las observaciones de calidad por lote, con fecha,
productor, especie y variedad, y las conserva en la impresion/PDF.
El dashboard incluye evidencia fotografica agrupada por lote. Las imagenes se
descargan mediante la ruta autenticada, se esperan antes de abrir la impresion
y se incorporan al PDF del navegador con paginacion especifica para galerias.
Mantiene una conclusion deterministica e impresion optimizada mediante el
dialogo PDF del navegador.
Se publica en Consultas de Procesos como `100/15/15`,
`ProgNomGX=wdashcalidadrecep`; su endpoint usa el mismo permiso específico.
Los calibres del control se despliegan desde el detalle `CALIBRES` de la
especie del lote, filtrado por `EmpCod + Especod`, `calRecepcion=1` y ordenado
por el campo editable `CalOrden`, con `CalCod` como desempate interno. El CRUD
de calibres expone `CalOrden` como `Orden de muestra` y `calRecepcion` como el
selector `Indicador recepcion`. Las migraciones son
`database/20260811_calibres_indicador_recepcion.sql` y
`database/20260907_calibres_orden_muestra.sql`. El dashboard respeta
`CalOrden` en los graficos de distribucion de calibre y color por calibre.
`MAPlagas` parametriza por empresa y especie los hallazgos de tipo `PLAGA`,
`VIRUS` y `DIPTERO`, con orden y estado activo. Su CRUD se integra como detalle
de Especies y el formulario los despliega como seleccion multiple antes de
Observaciones. La migracion es
`database/20260811_maestro_plagas_recepcion.sql`. Para cereza se cargaron
ejemplos concretos mediante `database/20260811_maestro_plagas_ejemplos.sql`;
los nombres genericos de los tipos no se usan como hallazgos seleccionables.
`MAColores` parametriza por `EmpCod + Especod` los colores utilizados en el
control de recepcion, su orden, estado activo y si aportan a la clasificacion
premium. `CALRECEPCOLOR` conserva el codigo historico y agrega `Especod` para
referenciar el maestro. El formulario, la consulta y el dashboard consumen
esta configuracion dinamica. La migracion es
`database/20260812_maestro_colores_recepcion.sql` y el CRUD se presenta como
detalle de Especies.

## Archivos clave

### Backend

- `src/controllers/maestrosController.js`: contratos, campos, claves, filtros,
  busqueda y dependencias de eliminacion.
- `src/Router/maestros.routes.js`: endpoints y permisos por programa.
- `src/services/seguridad.service.js`: login, sesion y permisos efectivos.
- `src/services/seguridadMenu.service.js`: menu autorizado.
- `src/services/seguridadRoles.service.js`: roles y plantillas.
- `src/services/seguridadAsignaciones.service.js`: permisos directos.
- `src/middleware/securityAuthorization.js`: `requirePermission`.
- `database/`: migraciones SQL aditivas y repetibles.

### Frontend

- `src/pages/maestros/gxMaestrosConfig.js`: definicion visual de maestros.
- `src/pages/maestros/gxMaestroCrud.jsx`: CRUD generico y cabecera-detalle.
- `src/api/maestrosApi.js`: mapa de endpoints.
- `src/menu-items/authorizedMenu.jsx`: traduccion de `ProgNomGX` a rutas React.
- `src/routes/MainRoutes.jsx`: rutas protegidas por sesion.
- `src/contexts/AuthContext.jsx`: usuario, empresa y menu de sesion.
- `src/pages/seguridad/`: administracion de Seguridad.

`TEMP_SESSION_CONTEXT` aun existe como valor inicial de configuracion, pero
`gxMaestroCrud.jsx` reemplaza `EmpCod` en ejecucion con `company.empCod` desde
`AuthContext`. El backend sigue siendo la barrera definitiva y nunca acepta una
empresa de pantalla para un maestro multiempresa.

## Como migrar el siguiente maestro

1. Ejecutar `git status --short` en ambos repositorios y respetar cambios
   existentes.
2. Localizar Transaction, niveles, WorkPanel, Report y Procedures en el XPZ y
   el inventario.
3. Escribir la finalidad de negocio con nombre GX, no con nombre generado.
4. Confirmar claves, tipos, largos, reglas, filtros, columnas visibles y
   dependencias de eliminacion.
5. Clasificarlo como global, por empresa o raiz de empresa.
6. Consultar el esquema SQL real. Crear un script aditivo solo si falta una
   estructura confirmada por GX8.
7. Identificar `SistCod`, `Modcod`, `ProgCod` y ruta de `ProgNomGX`.
8. Documentar el objeto en `docs/migration/` antes del cambio funcional.
9. Completar contrato backend, rutas y `requirePermission`.
10. Completar configuracion React, API, ruta y menu dinamico.
11. Mantener nivel 2 dentro del modal de la cabecera.
12. Probar alta, listado, busqueda, actualizacion, eliminacion protegida,
    empresa de sesion y exportaciones. Limpiar datos temporales.
13. Ejecutar pruebas, lint dirigido y build.
14. Actualizar este archivo y `project-review-register.csv`.

## Evidencia verificada

En el tablero Control de lineas, 2026-09-01:

- La migracion SQL repetible se ejecuto sobre `CONEX_MIGRACION` y confirmo las
  dos tablas y el programa `100/6/11`.
- La consulta real devolvio 20 lineas, 15 activas y 5 inactivas, todas
  configuradas y distribuidas en 20 maquinas para `EmpCod=1`.
- La temporada activa real es `2017-2018`; no tiene una orden con
  `OrdpEstado=1`, por lo que el indicador devuelve cero y `Sin proceso activo`.
  El conteo se verifico por el indice existente
  `IND_CAPORDPROC (EmpCod, TempCod, CAPNproc)`.
- La extension de edicion usa cuatro catalogos filtrados, validacion relacional
  y escritura transaccional protegida por el programa.
- La suite backend aprobo 63 pruebas, el lint dirigido del frontend termino sin
  errores y Vite compilo 5.732 modulos.
- La revision visual automatizada quedo limitada por falta de una sesion
  autenticada en los navegadores disponibles; no se usaron credenciales.

En la estandarizacion de fechas del frontend, 2026-08-21:

- Los campos de fecha usan el DatePicker oficial de MUI X con adaptador Moment,
  calendario y formato visible `DD/MM/YYYY`; los formularios y la API conservan
  valores `YYYY-MM-DD`.
- Los filtros de recepciones mantienen el periodo inicial desde un mes atras
  hasta hoy, y una recepcion nueva toma la fecha local actual.
- Se verifico en navegador la apertura del calendario, el valor visible y el
  cambio de fecha; el build completo del frontend aprobo 5.716 modulos.

En los ajustes analiticos del dashboard de calidad, 2026-08-18:

- `Rendimiento proyectado` usa el historico ponderado de muestras del periodo
  y no cambia al seleccionar un lote. `Fruta exportacion` y `Fruta comercial`
  se calculan sobre la seleccion activa como muestra sin dano/con dano y su
  suma es siempre 100%.
- El selector buscable conserva todos los lotes finalizados del rango aunque
  exista un lote activo; seleccionar el lote 394 mantuvo disponibles 394, 395,
  397 y 404 para cambiar el filtro sin volver primero a "Todos".
- La segregacion de calidad se calcula sobre frutos de muestra: fruta con dano
  es la suma de danos y fruta sin dano es muestra menos dano, ambas expresadas
  como porcentaje. Para el lote 394 se verifico 79,4% sin dano y 20,6% con dano.
- Calibre y pre calibre se agregan como numero de frutos por calibre, sin
  normalizarlos nuevamente como porcentajes.
- La distribucion de color toma exclusivamente `CALRECEPCOLORCALIBRE` y presenta
  los frutos rojo claro y rojo oscuro bajo el calibre al que pertenecen.

En la compatibilidad productiva de Consulta recepcion de fruta, 2026-08-18:

- El resumen dejo de usar `STRING_AGG`, funcion no disponible en SQL Server
  2016. Los lotes y su estado de calidad se concatenan con `STUFF` y
  `FOR XML PATH`, conservando el mismo contrato para React.
- La consulta exacta del error productivo devolvio localmente seis recepciones
  y mantuvo `lotsText`, `lotQualityText` y el conteo de lotes pendientes.
- Se agrego una prueba que impide reintroducir funciones de agregacion JSON o
  `STRING_AGG` incompatibles con SQL Server 2016.

En la configuracion PWA, 2026-08-18:

- El manifiesto PWA usa la base configurada por ambiente: en produccion su
  `id`, `start_url` y `scope` son `/co/`, en lugar de la ruta legada `/free/`.
- La PWA queda en espanol, con identidad visual, actualizacion automatica del
  service worker, limpieza de caches antiguos y metadatos de instalacion iOS.
- Los recursos favicon y apple-touch-icon respetan la ruta base de Vite.

En las validaciones de control de calidad, 2026-08-15:

- Se aplico `database/20260815_color_recepcion_por_calibre.sql`; la captura
  nueva persiste color por calibre sin modificar `CALRECEPCOLOR` historica.
- Backend rechaza danos y firmeza sobre el tamano de muestra; calibre, pre
  calibre y las dos distribuciones de color deben sumar exactamente 100%.
  Exportacion/comercial no pueden superar 100%.
- React valida esas reglas en cada ingreso, marca campos/totales en rojo,
  informa la sección afectada y deshabilita Guardar mientras exista un error.
- La estructura historica `CALRECEPCOLOR` se conserva en base de datos por
  compatibilidad, pero no se presenta en ingreso, lectura ni dashboard porque
  no permite relacionar el color con un calibre. Esas vistas usan
  exclusivamente `CALRECEPCOLORCALIBRE`.
- Se aplico `database/20260815_control_calidad_porcentaje_calidad.sql`; el
  porcentaje de calidad se deriva de muestra menos incidencia de danos y queda
  persistido en `CALRECEP.CalRecPorCalidad`.
- El resumen y detalle de recepcion de fruta, y el listado de controles de
  calidad, presentan ese porcentaje dentro del chip de cada lote; los listados
  de fruta toman el ultimo control vigente y omiten el indicador cuando no hay
  control asociado.
- La suite backend aprobo 31 pruebas.

En la mejora de trazabilidad recepcion-calidad, 2026-08-14:

- El ingreso manual devuelve y presenta todos los lotes de cada cabecera sin
  consultas N+1.
- El detalle de Recepcion de fruta conserva una fila por `MOVFRUT1` y enlaza
  el ultimo `CALRECEP` no anulado usando la llave GX completa.
- El resumen agrupa visualmente sus lotes y muestra cuantos siguen pendientes;
  solo un control finalizado descuenta el lote del indicador.
- Una consulta real en SQL Server confirmo las guias `465465465` y `11124`
  con sus lotes, y los lotes `394` y `395` con controles finalizados.
- La suite backend aprobo 27 pruebas, ESLint dirigido termino sin errores y el
  frontend compilo correctamente con Vite.

En la ola de consultas de recepcion, 2026-08-04:

- `verify:recepcion-fruta` comprobo contra SQL Server resumen, detalle y
  exportaciones reales para la temporada activa.
- La fecha del detalle se obtuvo de `MOVFRUT.MovFecha`; la prueba automatizada
  impide volver a filtrar por `MOVFRUT1.Mov1Fecha`.
- La suite backend aprobo 11 pruebas y el frontend compilo 5.434 modulos.

En la ultima ola, 2026-08-02:

- Se completaron 13 pantallas de cabecera y cuatro relaciones de detalle.
- `npm run verify:pending-masters` comprobo alta, cambio y eliminacion real en
  SQL Server para todos los contratos nuevos y termino sin residuos.
- Las cascadas GX de `TIPMOV1` y `PARAMGE1` se verificaron al eliminar la
  cabecera dentro de una transaccion.
- La suite backend paso 8 pruebas y el frontend compilo correctamente con Vite.

En la ola anterior, 2026-07-30:

- `DESTINOS.DestNMP` fue agregado y verificado con largo 30.
- CRUD real de Condiciones, Origenes y Destinos paso alta, busqueda,
  modificacion y eliminacion sin dejar registros temporales.
- Origen ignoro una empresa enviada por pantalla y uso `EmpCod=1` de sesion.
- Backend: 5 pruebas automatizadas aprobadas.
- Frontend: build de Vite aprobado con 5425 modulos.
- ESLint dirigido termino sin errores; persisten advertencias de finales CRLF
  preexistentes en el repositorio.

La capa de Seguridad y los maestros anteriores tienen evidencia detallada en
sus documentos de modulo. No extender esta evidencia a objetos que no fueron
probados.

## Definicion de terminado

Un objeto queda `READY` solo cuando:

- nombre y finalidad GX estan confirmados;
- tabla, clave y niveles coinciden con GX8 y SQL Server;
- empresa proviene de sesion cuando corresponde;
- listado, filtros y formulario respetan el objeto antiguo;
- CRUD y dependencias fueron probados;
- ruta backend esta autorizada por programa;
- menu dinamico resuelve su `ProgNomGX`;
- exportaciones cumplen el alcance declarado;
- pruebas y evidencia quedaron documentadas;
- inventario y estado vigente fueron actualizados.

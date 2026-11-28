# Packing List en CONEX

El editor sigue la transacción `PackList` del XPZ. En la columna izquierda
quedan identificación, embarque, destino y transporte. La derecha reúne carga,
sellos, observaciones y los combos de despacho. El código de despacho conserva
su número y muestra las etiquetas del XPZ tanto en el packing como en la guía
precargada. Los indicadores nuevos que ofrece el editor son 7, 8 y 9. Los
indicadores 1 a 6 guardados anteriormente se conservan al editar otros datos.

El backend valida ambos RUT informados, el DUS y la fecha de despacho editada.
Las validaciones de alta y edición identifican el campo en la respuesta. La
ficha lo resalta y muestra el motivo debajo, incluida la homologación del
país destino y de cada puerto.
Al generar se inicializa la hora local. Para tipos 1 a 3 se hereda el tipo de
camión y se calcula el peso bruto por línea como kilos más peso bruto del
envase por cajas, según `PTraeKilosB` y `PTraePesoB`. El alta se verificó
en SQL local con una planilla de 4.176 kg brutos, y el ensayo revirtió el
packing y el correlativo. La edición se verificó con rollback sobre el 130.

Actualización 13-11-2026: se amplió la edición de la cabecera de exportación.
Exportadora, consignatario, destino, agente, despachador y puertos usan
catálogos; se pueden completar nave, contenedor, DUS/SPS, sellos/emisores,
termógrafos/pallets, marcas, contramarcas y segunda observación. Los códigos
de despacho y traslado se muestran separados. La API valida empresa y
homologaciones y actualiza `PACKLIST` y `PackingGuiaDatos` en una transacción.
Los campos avanzados omitidos por clientes anteriores no se sobrescriben.

## Origen GX8 y propósito

El XPZ `GXW.xpz` separa el flujo en tres WorkPanels: `PackingList` lista y abre
el documento, `GenPack` elige tipo y número de origen y `DetPackList` muestra
folios y cajas. `GeneraPackinglist` copia cabecera y totales desde `DESORIGEN`
(tipos 1 a 3, planilla `DORNumf`) o `DESCLI_FP` (tipo 4, `DesOTNumI`). El dato
físico permanece en `PACKLIST` con clave `EmpCod + TempCod + PackNumI`.

## Implementación actual

- Una página React `/procesos/packing-list` integra listado, generación,
  consulta del detalle y edición básica. Reutiliza tema y componentes de CONEX.
  La columna de acciones aparece primero. La consulta abre a pantalla completa
  una ficha con tarjetas de identificación, participantes, destino, transporte,
  sellos, trazabilidad, auditoría y las líneas del documento.
  El listado usa el banner operacional, presenta las tarjetas sobre los filtros
  y cada tarjeta abre el conjunto de packings que compone su número. Los filtros
  de fecha cargan el último mes, usan datepicker regional `DD/MM/YYYY` y se
  aplican en SQL sobre `PackFecha` junto con búsqueda y tipo.
- El menú GX `wpackinglist` resuelve a esa ruta. El backend exige permiso
  `100/2/13`; empresa y usuario se obtienen de la sesión, nunca del navegador.
- API `/backendDocker/packing-list`: `GET /form-data`, `GET /packings`,
  `GET /sources?type=`, `POST /packings`, `GET /packings/:id`,
  `PUT /packings/:id`, `GET /packings/:id/pdf?report=packing01|packing02`.
- Generar exige temporada activa y un origen único/finalizado para SAG. El
  diálogo replica `GenPack`: solo solicita tipo y documento de origen. Para
  despachos comerciales el cliente se hereda de `DESCLI_FP`; en los demás
  tipos queda pendiente para la edición. La fecha de zarpe también se informa
  después de generar. Verifica duplicados y usa `GenCor` bajo transacción
  serializable. El detalle lee `DESORIGEN1` o `DESCLI_FP1` según `PackTipo`.
- La lectura enriquece las claves GX8 con los nombres de exportadora,
  consignatario, destino, agente y despachador autorizado.
- `PackGuia` es el número heredado del documento origen; no representa el
  estado de emisión electrónica en APERP. Desde el detalle, `Generar guía`
  presenta una confirmación con cabecera, totales y líneas. Al aceptar, Conex
  abre el formulario compartido; APERP vuelve a leer el packing en servidor,
  crea el borrador en su propia base y abre la guía creada para revisión.
  `ge.GuiaOrigen` conserva la relación y evita una segunda guía para el mismo
  packing.

## Pendientes operativos

Después de generar se abre la edición del packing para completar cliente,
zarpe, conductor, RUT, patente y observación. Los RUT de conductor y
transportista aplican máscara chilena mientras se digitan y al cargar datos
existentes (`12.345.678-5`).
Los campos de auditoría y los totales heredados se conservan en lectura; la
edición avanzada ya incluye los campos operativos indicados arriba. Faltan la
exportación Excel del packing y la homologación editable de puertos y catálogos.
La generación crea un borrador central; la validación tributaria y la emisión
Púlsar siguen a cargo del módulo de Guías, no de `PACKLIST`.

El formulario de guía ahora es por pasos y conserva las magnitudes de origen
por separado. Recargar el origen permite completar vacíos o reemplazar tras
revisión; no se ejecuta una segunda generación de guía. Las fechas de guías
nuevas usan hoy en Chile, con opción explícita de tomar fechas logísticas del
packing. Las pruebas aisladas de actualización y rollback aprobaron. El servicio real
de edición se ensayó en CONEX local dentro de una transacción revertida,
comprobando que la cabecera y extensión permanecieran intactas.

## PDF Packing01 y Packing02 (2026-11-27)

Fuente revisada: `C:/Externo/Exe/Paso/packing_list.xpz`, objetos `Packing01`,
`Packing02` y procedimiento `BusIDDespa`. Los PrintBlocks y el código del XPZ
definen los campos y agrupaciones; el PDF usa el estilo verde de CONEX.

- `Packing01` conserva la cabecera de empresa, planilla, guía, embarque,
  participantes, transporte y termógrafos. Imprime folio, fecha de proceso,
  cajas, especie, variedad, envase, categoría, calibre y productor. Ordena por
  especie y folio, con subtotal de cajas y pallets por especie. Un folio cuenta
  una vez dentro de cada especie; el total general aparece si hay varias especies,
  igual que en GX. Formato Carta horizontal, con títulos al continuar página.
- `Packing02` conserva empresa, guía, planilla y fecha. Agrupa por los códigos
  de especie, variedad, envase, categoría y calibre; suma cajas entre folios,
  con subtotales por variedad y especie y total general. Formato Carta vertical.
- Ambos resuelven `PACKLIST.PackNumG = DESORIGEN.DORNumf` por empresa,
  temporada y tipo, para consultar todas las líneas de `DESORIGEN2` usando la
  clave interna `DORNum`. Los textos históricos se conservan, con respaldo de
  maestros cuando están vacíos. Los totales se calculan desde esas líneas.
- La API usa empresa de sesión, temporada activa y permiso de programa
  `100/2/13`. Rechaza origen inexistente/ambiguo, detalle vacío, formato desconocido
  y tipo comercial 4. `Packing01_OT`, `Packing01_PDF`, `Packing02US` y
  `Packing03US` siguen fuera de esta entrega.
- El listado y la consulta del packing ofrecen **PDF detalle** y **PDF resumen**,
  con vista previa en una ventana que permite imprimir o descargar. La edición
  debe guardarse antes de imprimir. La respuesta PDF no se almacena en caché.

Verificación: `node --test test/packingListPdf.test.js test/packingListEdicion.test.js`
cubre agrupación, conteo de folios, empresa/temporada/tipo, errores, paginación,
sesión, permiso del programa y contenido HTTP. `npm run build` del frontend
completó; ESLint dirigido no reportó errores, con advertencias de formato CRLF.
Se generaron los dos PDFs con SQL real de solo lectura para empresa 1, packing 1,
temporada histórica `2017-2018`: 2 líneas, 434 cajas y 2 pallets. La temporada
activa `2026-2027` no tenía packings; no se alteró su configuración ni se crearon
datos. Se revisaron visualmente documentos reales y muestras de 120 líneas.

Reproducción de la consulta histórica, sin cambiar la temporada activa:
`node scripts/verify-packing-pdf.js 1 1 2017-2018`. Sin el tercer argumento,
la verificación utiliza la temporada activa. Los archivos quedan en `output/pdf/`.

## Verificación

El 2026-10-15 se consultó la base configurada: temporada activa `2017-2018`,
12 packings, 9 orígenes SAG consultables y 20 líneas para el packing 129.
`npm run build` del frontend completó. El detalle 129 se consultó nuevamente
con los nombres relacionados y 20 líneas. No se insertaron datos de prueba.

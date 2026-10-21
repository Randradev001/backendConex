# Packing List en CONEX

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
  `PUT /packings/:id`.
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
zarpe, conductor, RUT, patente y observación.
Los campos avanzados de GX8 ya se presentan en modo lectura; su edición sigue
limitada a cliente, zarpe, conductor, RUT, patente y observación. Faltan la
impresión/Excel del packing y la homologación editable de puertos y catálogos.
La generación crea un borrador central; la validación tributaria y la emisión
Púlsar siguen a cargo del módulo de Guías, no de `PACKLIST`.

## Verificación

El 2026-10-15 se consultó la base configurada: temporada activa `2017-2018`,
12 packings, 9 orígenes SAG consultables y 20 líneas para el packing 129.
`npm run build` del frontend completó. El detalle 129 se consultó nuevamente
con los nombres relacionados y 20 líneas. No se insertaron datos de prueba.

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
- El menú GX `wpackinglist` resuelve a esa ruta. El backend exige permiso
  `100/2/13`; empresa y usuario se obtienen de la sesión, nunca del navegador.
- API `/backendDocker/packing-list`: `GET /form-data`, `GET /packings`,
  `GET /sources?type=`, `POST /packings`, `GET /packings/:id`,
  `PUT /packings/:id`.
- Generar exige temporada activa, origen único/finalizado para SAG, cliente y
  fecha de zarpe. Verifica duplicados y usa `GenCor` bajo transacción
  serializable. El detalle lee `DESORIGEN1` o `DESCLI_FP1` según `PackTipo`.
- `PackGuia` es el número heredado del documento origen; no representa el
  estado de emisión electrónica en APERP. El botón hacia Guías abre el módulo
  compartido para continuar el proceso.

## Pendientes operativos

La edición expone cliente, zarpe, conductor, RUT, patente y observación.
Faltan los campos avanzados de la transacción GX8 (puertos homologados,
exportadora, consignatario, sellos, contenedor, termógrafos y bruto), la
impresión/Excel del packing y un enlace directo que abra la guía APERP con
este packing ya seleccionado. La emisión tributaria sigue a cargo del módulo
de Guías, no de `PACKLIST`.

## Verificación

El 2026-10-15 se consultó la base configurada: temporada activa `2017-2018`,
12 packings, 9 orígenes SAG consultables y 20 líneas para el packing 129.
`npm run build` del frontend completó. No se insertaron datos de prueba.

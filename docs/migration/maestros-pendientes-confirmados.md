# Ola de maestros confirmados por PROGRAM

Fecha de contraste: 2026-08-02.

## Fuentes revisadas

- `C:\Users\andre\Downloads\GXW.xpz`: Transactions, WorkPanels, reglas y
  estructuras de nivel.
- `docs/gx8/inventory/`: claves, tablas y dependencias.
- `PROGRAM` de `CONEX_MIGRACION`: sistema, modulo, programa y llamado GX.
- `INFORMATION_SCHEMA.COLUMNS`: nombres, tipos y largos fisicos vigentes.

## Alcance implementado

| Programa | Objeto GX | Tabla cabecera | Detalle | Pantalla React |
|---:|---|---|---|---|
| 1 | `Tipdoc` | `TIPDOC` | - | Tipos de documento |
| 2 | `TipMov` | `TIPMOV` | `TIPMOV1` | Tipos de movimiento |
| 9 | `Procedencia` | `PROCEDENCIA` | - | Procedencias de procesos |
| 10 | `Secciones` | `SECCIONES` | - | Secciones |
| 15/16 | `Export` / `ExpProd` | `EXPORT1` | `EXPPROD` | Exportadoras y productores |
| 19 | `DespaAuto` | `DESPAAUTO` | - | Despachadores autorizados |
| 20 | `Puertos` | `PUERTOS` | - | Puertos de embarque y destino |
| 21 | `CausaAnul` | `CAUSAANUL` | - | Causales de anulacion |
| 22 | `TipEti` | `TIPETI` | - | Tipos de etiqueta |
| 23 | `TipBPa` | `TIPBPA` | - | Tipos de base de pallet |
| 24 | `TipAlt` | `TIPALT` | - | Tipos de altura |
| 30 | `paramgen` | `PARAMGEN` | `PARAMGE1` | Parametros generales |
| 31/32 | `Monedas` / `ValMon` | `MONEDAS` | `VALMEXT` | Monedas y valores por fecha |

`TIPMOV1` y `PARAMGE1` son niveles 2 reales. `EXPPROD` y `VALMEXT` son
Transactions relacionadas, pero se presentan dentro de su cabecera para
mantener el flujo operativo solicitado.

## Reglas GX conservadas

- La empresa de `EXPORT1`, `EXPPROD`, `TIPMOV`, `TIPMOV1`, `PARAMGEN`,
  `PARAMGE1`, `DESPAAUTO`, `PROCEDENCIA`, `SECCIONES`, `TIPETI`, `TIPBPA` y
  `TIPALT` proviene exclusivamente de la sesion.
- `Tipdoc.TdNom`, `Export.ExpNom`, RUT de Exportadora, `Monedas.MonDes`,
  `Puertos.PuNombre`, `DespaAuto.DANombre`, `Secciones.SecNom` y las
  descripciones de etiqueta, base y altura conservan sus validaciones GX.
- `CanLoginC`, `CanFecC` y `MonLogC` son valores administrados por el servidor.
- `DAVig` inicia en 1 y `PuNac` en 0.
- Valores de moneda exige fecha y valor mayor que cero.
- Puertos conserva filtros por nacionalidad y nombre.
- Valores de moneda conserva filtro por moneda y rango de fechas.

## Objetos aun no publicables

`DESTMP`, `ENVMP` y `PRODGEN` existen y se usan como catalogos especializados,
pero no tienen un programa de maestro confirmado en `PROGRAM`.
`MAELINEAEMBALAJE` aparece en GXW, pero no existe fisicamente en la base
operativa. No se agregan al menu ni se crean tablas supuestas en esta ola.

## Cierre verificado

- Los 17 contratos de cabecera/detalle respondieron consultas reales.
- `npm run verify:pending-masters` comprobo insercion, actualizacion y
  eliminacion en SQL Server sin dejar registros temporales.
- Las eliminaciones de `TIPMOV` y `PARAMGEN` eliminaron sus niveles 2 dentro de
  una transaccion.
- Las rutas exigen el programa GX8 correspondiente y la empresa multiempresa se
  obtiene de la sesion.
- React incluye visualizar, insertar, actualizar, eliminar, busqueda general,
  filtros GX confirmados y el componente comun de exportacion.
- `npm test`, ESLint dirigido y `npm run build` terminaron sin errores.

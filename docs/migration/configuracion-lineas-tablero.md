# Tablero de control de lineas

## Alcance decidido

La primera migracion visible de `linconfig` se implementa como un tablero para
monitorear y editar la configuracion vigente de las lineas de produccion de la
empresa autenticada.
El diseno solicitado reemplaza la grilla GX8 por tarjetas responsivas con estado,
configuracion vigente, filtro rapido por maquina, reloj local y actualizacion
automatica.

La edicion implementada cubre especie, calibre, envase, categoria y
estado de la linea. El alta crea la cabecera de linea y su configuracion inicial
desde un unico modal. La eliminacion y la impresion de etiquetas permanecen
pendientes y no deben darse por migradas por la existencia del tablero.

## Evidencia GeneXus

- WorkPanel principal: `linconfig`, carpeta `ConfiguracionLineas`.
- Transacciones: `Lineas` y `LinConfig`.
- Clave de `LINEAS`: `EmpCod + LinMaquina + LinID`.
- Clave de `LINCONFIG`: `EmpCod + LinMaquina + LinID + ConfID`.
- La configuracion operacional vigente usada por `TraeConf` corresponde a
  `ConfID=1`.
- `LinEstado` representa si la linea esta activa; `LinEstConf` y `ConfEstado`
  representan por separado el estado de configuracion.
- Los catalogos descriptivos son `ESPECIES`, `CALIBRES`, `ENVCAT` y `ENVCAT1`.
- La transaccion `Lineas` exige maquina, descripcion, ubicacion y PC; en alta
  inicializa `LinEstConf=0` y llama `CreaCabeza` para asegurar
  `LINCONFIG.ConfID=1`.
- El Procedure `Autonumber` obtiene el ultimo `LinID` de la empresa y suma uno.
- `LineasINS`, pese a su nombre y descripcion historica, edita la configuracion
  de una linea ya creada mediante `GrabaConf` y luego marca la linea configurada.

`Autonumber` y `CreaCabeza` quedan absorbidos por el alta transaccional del
backend. Los Procedures `GrabaConf`, `EstadoACt`, `EstadoCONF`, `DLTConf`,
`TraeConf` y `TraeEstLinea` no se declaran migrados de manera general en esta
fase, aunque parte de su comportamiento ya esta cubierta por el tablero.

## Contrato migrado

- Ruta React: `/procesos/control-lineas`.
- API: `GET /backendDocker/control-lineas`,
  `GET /backendDocker/control-lineas/catalogs` y
  `POST /backendDocker/control-lineas`, ademas de
  `PUT /backendDocker/control-lineas/:machine/:line`.
- Programa de Seguridad: `SistCod=100`, `Modcod=6`, `ProgCod=11`,
  `ProgNomGX=wlinconfig`.
- La empresa se obtiene exclusivamente de `req.context.empCod`.
- El endpoint devuelve todas las lineas de la empresa, la configuracion
  `ConfID=1`, nombres de catalogo, resumen de activas/inactivas y las maquinas
  disponibles para el filtro rapido.
- React vuelve a consultar el endpoint periodicamente. Al pulsar una tarjeta
  abre un modal con selects dependientes; guardar actualiza de forma atomica
  `LINEAS.LinEstado` y la configuracion `LINCONFIG.ConfID=1`.
- El boton de alta abre un modal con maquina, descripcion, ubicacion, PC,
  persona opcional, configuracion y estado. Node genera el siguiente `LinID`
  dentro de una transaccion serializable, valida los catalogos por empresa e
  inserta `LINEAS` y `LINCONFIG.ConfID=1` como una sola unidad.
- Lectura y escritura exigen el programa `100/6/11`. La autorizacion por accion
  individual continua fuera de esta etapa, igual que en los CRUD vigentes.

## Presentacion

Cada tarjeta muestra maquina/linea, descripcion, especie, calibre, envase,
categoria y estado. `LinEstado=1` usa la variante activa verde; cualquier otro
valor usa la variante inactiva roja. Una linea inactiva puede conservar datos de
configuracion: el tablero no confunde inactividad con ausencia de configuracion.

Las cerezas se desplazan mediante animacion CSS solamente cuando
`LinEstado=1`. La animacion es representacion visual del estado persistido, no
telemetria fisica.

El indicador superior representa la conexion del tablero con la API, no el
estado de una linea especifica. El filtro rapido usa `LinMaquina`; `Todas`
restaura la vista completa.

El encabezado muestra ademas las cajas procesadas de la orden activa. La
temporada se obtiene desde `TEMP01.TempActiva=1`, la orden desde
`ORDPROC.OrdpEstado=1` y el total cuenta filas de `CAP001` enlazadas por
`EmpCod + TempCod + CAPNproc`. No se filtra `CAPEst`: una caja sigue siendo
procesada aunque luego cambie a paletizada o despachada. Si no existe una orden
activa, el indicador muestra cero y `Sin proceso activo`.

## Base de datos

`database/20260901_control_lineas_tablero_2016.sql` agrega de forma repetible las
tablas GX8 cuando falten, los indices de consulta y el registro de menu. No
asigna el programa a usuarios o roles; el acceso debe concederse desde Seguridad.

## Riesgos y pendientes

- `LinPC` no era unico en GX8 aunque `TraeConf` espera identificar una linea.
- No existen claves foraneas fisicas entre las tablas de lineas y sus catalogos.
- La eliminacion y la impresion ZPL siguen pendientes. `LineasINS` queda
  reemplazado por los modales de alta y edicion, sin declarar migrado su bloque
  historico de impresion comentado.
- El tablero presenta el estado persistido; no incorpora sensores ni telemetria
  externa de movimiento de fruta.

## Verificacion requerida

1. Una empresa no puede leer lineas de otra empresa.
2. La ruta devuelve `403` sin permiso `100/6/11`.
3. La consulta usa `ConfID=1` y conserva lineas aun sin configuracion.
4. Los textos `CHAR` se entregan sin relleno.
5. La pantalla responde en escritorio, tableta y movil.
6. El filtro por maquina y el refresco automatico no alteran datos.
7. El guardado rechaza catalogos que no pertenecen a la empresa o que no
   respetan especie/envase, y actualiza linea y configuracion en una transaccion.
8. Solo las tarjetas activas animan las cerezas.
9. El total de cajas usa solo la empresa, temporada y orden activa; una caja no
   desaparece del total al cambiar su estado posterior.
10. El alta genera un `LinID` sin colisiones, crea `LINEAS` y
    `LINCONFIG.ConfID=1` en la misma transaccion y revierte ambas escrituras ante
    cualquier error.

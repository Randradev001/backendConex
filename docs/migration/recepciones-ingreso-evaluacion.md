# Evaluacion de impacto: ingreso de recepciones de fruta

Fecha de revision: 2026-08-04

Estado: ingreso manual implementado y verificado.

## Conclusion

El WorkPanel `Recepciones`, carpeta `Ingresos`, es el ingreso operativo que
alimenta la consulta de recepcion de fruta ya migrada. Su impacto es **alto**:
crea o modifica en una sola operacion la cabecera `MOVFRUT` y sus lotes en
`MOVFRUT1`, reserva correlativos, calcula pesos y totales, y deja stock que
luego consumen las ordenes de proceso.

Por decision funcional, todo lo relacionado con pesaje automatico, puerto
COM1, `MovFrutPesaje` y `PesajeAuto` queda fuera del alcance de migracion.

## Menu y autorizacion

- sistema `100`: Control de Produccion Fruticola;
- modulo `2`: Procesos Planta;
- programa `1`: Recepcion de Fruta;
- objeto `wrecepciones`;
- acciones: `1 crea`, `2 modifica`, `3 elimina`.

El backend debe exigir `requirePermission(100, 2, 1)` y la accion correcta por
operacion. GX llama por error la accion 1 tambien al modificar y eliminar; no
se debe copiar ese defecto. `EmpCod` y login salen solo de `req.context`.

## Objetos que necesita el ingreso

| Objeto | Tipo | Responsabilidad |
|---|---|---|
| `Recepciones` | WorkPanel | Bandeja, alta manual, cambio, baja y vista |
| `MovFrut` | Transaction de dos niveles | Cabecera y lotes del ingreso manual |
| `SumDetRecep` | Procedure | Recalcula totales de cabecera desde los detalles |
| `TraePeso` | Procedure | Obtiene peso y destare del envase |
| `TraeCor` | Procedure | Reserva el correlativo `LOTE` |
| `TraeTemp` | Procedure | Obtiene la temporada activa |
| `TraeNomProductor` | Procedure | Obtiene el nombre del productor |
| `ListadoRecep` | Report | Lista recepciones/lotes filtrados |
| `GuiaIng1` | Report | Documento completo de una recepcion |

## Unidad transaccional y tablas

`MovFrut` tiene dos niveles y debe guardarse como una unidad:

| Nivel | Tabla | Clave |
|---|---|---|
| Cabecera | `MOVFRUT` | `EmpCod`, `TempCod`, `OriCod`, `MovTDoc`, `MovNGuia`, `MovProd` |
| Detalle | `MOVFRUT1` | clave de cabecera + `Mov1Nlote` |

`MOVFRUT1` no es un maestro independiente. Cabecera, detalles, correlativos y
totales deben confirmarse o revertirse en una sola transaccion SQL.

La cabecera necesita empresa autenticada, temporada, origen, tipo y numero de
guia, productor, `MovFecha`, observacion, `TMcod=1`, `TMSCod=1`, modo
manual (`MovAuto=0`), totales y auditoria. La fecha que manda siempre es
`MOVFRUT.MovFecha`; fecha, ano y mes del detalle se derivan de ella.

Cada detalle necesita lote, cuartel, especie, variedad, envase, condicion,
numero de envases, peso, destare, kilos brutos/netos, movimiento `1/1` y
envases procesados inicialmente en cero.

## Catalogos requeridos

- `TEMP01`: temporada activa;
- `ORIGEN`: origenes activos;
- `PRODUCTORES` y `PRODUCTORES1`: productor y sus cuarteles;
- `ESPECIES` y `ESPECIES1`: especie y sus variedades;
- `ENVCAT`: envase, peso, destare y uso (`EnvUso=2` en pesaje);
- `CONDICIONES`: condiciones activas;
- `GENCOR`: correlativo `LOTE`;
- `DEFEMP`: datos de impresion;
- `TIPMOV` y `TIPMOV1`: movimiento `1/1`.
- `TIPDOC`: tipos de documento no bloqueados, seleccionados mediante buscador.

La base revisada tiene una temporada activa, tres origenes activos, 25
productores, 15 envases (tres de uso 2) y dos condiciones activas. Si hay cero
o mas de una temporada activa, la API debe devolver error funcional; no debe
elegir silenciosamente la ultima como GX.

## Reglas del backend

1. Validar fecha y guia; en cada detalle exigir envases y kilos brutos totales
   mayores que cero.
2. Leer peso/destare de `ENVCAT` y guardar esa instantanea en `MOVFRUT1`.
3. Por decision funcional, calcular el peso estimado por envase como
   `round(kilos brutos totales / numero de envases, 2)` y guardarlo en
   `Mov1Peso`. El total ingresado se conserva en `Mov1KilB` y `Mov1KilN` para
   los totales y saldos aguas abajo.
4. Derivar fecha, ano y mes del detalle desde la fecha de cabecera.
5. Reservar lote con `GENCOR/LOTE` y bloqueo. `nextCorrelative` ya usa
   `UPDLOCK, HOLDLOCK`; nunca calcular `MAX + 1` en React.
6. Recalcular `MovTotEnv`, `MovTotKilB` y `MovTotKilN` desde `MOVFRUT1` tras
   toda mutacion.
7. Registrar auditoria desde la sesion.

## Pantalla y contratos recomendados

La pantalla necesita bandeja con temporada, fechas, origen, guia minima y
productor; alta de cabecera y grilla de lotes; selectores productor -> cuartel
y especie -> variedad; totales devueltos por la API; vista, modificacion e
impresion; y enlace de retorno a la consulta migrada.

- `GET /recepciones-ingreso/catalogos`;
- `GET /recepciones-ingreso`;
- `GET /recepciones-ingreso/:clave`;
- `POST /recepciones-ingreso` para el alta integral;
- `PUT /recepciones-ingreso/:clave` para el cambio integral;
- anulacion o `DELETE` solo despues de validar dependencias;
- PDF/XLSX desde backend usando el conjunto filtrado completo.

La clave compuesta debe codificarse o enviarse como parametros validados;
nunca se acepta `EmpCod` del cliente.

## Impacto aguas abajo

`ORDPROC1` referencia los lotes por empresa, temporada y lote. La base no tiene
claves foraneas que impidan inconsistencias; ademas, `OrdenProcINS` y
`Crea_Detalle_LOTE` consumen el lote y generan movimientos negativos.

En la base configurada se encontraron 669 recepciones `1/1`, 1.294 detalles
positivos, 948 numeros de lote, 1.029 combinaciones empresa/temporada/lote
referenciadas por `ORDPROC1` y 544 recepciones con algun lote utilizado.

No se debe borrar ni cambiar la clave de un lote usado en `ORDPROC1` o en
movimientos descendientes. Para esos casos se recomienda anulacion auditable;
su efecto sobre stock requiere decision funcional previa.

## Riesgos principales

| Riesgo | Control requerido |
|---|---|
| Alta parcial | Transaccion SQL con rollback total |
| Lote duplicado | Correlativo bloqueado y clave unica |
| Borrar recepcion procesada | Validar ordenes y movimientos descendientes |
| Cambio posterior del envase | Guardar peso/destare historicos |
| Cruce de empresas | Empresa de sesion en todos los accesos |
| Acciones GX incorrectas | Autorizar 1/2/3 por separado |
| Fechas divergentes | Derivar detalle de `MOVFRUT.MovFecha` |
| Totales desfasados | Recalculo backend tras cada cambio |

## Implementacion realizada

1. API `/backendDocker/recepciones-ingreso`, aislada por empresa y protegida
   por el programa `100/2/1` y sus acciones 1, 2 y 3.
2. Bandeja, catalogos, alta manual integral y modificacion de cabecera/lotes.
3. Correlativo `LOTE`, insercion de detalles y totales dentro de una transaccion.
4. Bloqueo de cambios sobre lotes consumidos y de eliminacion de recepciones
   relacionadas con `ORDPROC1`.
5. Pantalla React `/recepciones/ingreso`, publicada desde `wrecepciones`.
6. Buscadores con lupa para tipo de documento y para la combinacion de
   movimiento de recepcion `1/1`; detalle distribuido en tres filas logicas.
7. El alta y la modificacion se abren en un dialogo de pantalla completa, con
   cabecera fija, guardado visible y una guia breve de uso.
8. Tablero operacional de lotes en `/recepciones/lotes-tablero`, alimentado
   desde `MOVFRUT1`. Presenta seis botones de fecha, desde cinco dias atras
   hasta hoy, y muestra solo los productores y lotes de la fecha seleccionada,
   tomando `MOVFRUT.MovFecha` como fecha oficial. La primera fase es de
   consulta; al seleccionar un lote se abre el formulario operativo de fase 2.
9. Inicio de fase 2: `MAdanos` parametriza por empresa y especie los danos
   activos y su orden. La cabecera de recepcion es fija y cada lote es un
   `field array` con danos, calibre, color, firmeza y observaciones. El guardado
   persiste una cabecera operacional por lote y cuatro detalles normalizados.
10. Los calibres de inspeccion se obtienen desde el detalle GX8 `CALIBRES` por
    `EmpCod + Especod`, se limitan a `calRecepcion=1` y se presentan en el
    orden editable `CalOrden`, usando `CalCod` como desempate interno. Ambos
    campos operacionales se administran desde el CRUD del detalle de calibres
    de la especie. El dashboard usa el mismo orden para sus graficos de calibre
    y color por calibre.
11. `MAPlagas` agrega un catalogo por especie para plagas, virus y dipteros. El
    CRUD vive como detalle de Especies y solo los registros activos se
    despliegan como seleccion multiple dentro del `field array` del lote, antes
    de Observaciones.
12. El menu separa el tablero operacional (`100/2/31`) del mantenedor de
    controles (`100/2/32`). Este ultimo protege crear, modificar y anular con
    las acciones 1, 2 y 3 respectivamente.
13. `CALRECEPFOTO` conserva multiples fotografias por control como
    `VARBINARY(MAX)`. La metadata se lista separada del binario y cada imagen
    se recupera mediante una ruta autorizada para consulta y futuro PDF.
14. El dashboard analitico consolida controles finalizados por fecha y lote.
    Sus metas de firmeza, Brix, premium y ponderacion de aprobacion son
    preliminares y se informan en pantalla hasta disponer de parametrizacion.
15. Los listados operacionales exponen la trazabilidad por lote: ingreso manual
    muestra todos los `MOVFRUT1.Mov1Nlote` de cada cabecera como tarjetas; el
    mantenedor de calidad destaca el lote y formatea `CalRecFecha`; y el
    detalle de Recepcion de fruta conserva una fila por lote y enlaza el ultimo
    `CALRECEP` no anulado mediante la llave GX completa. La consulta puede ver
    el estado, pero abrir el control mantiene el permiso `100/2/32`.
16. El resumen de Recepcion de fruta presenta los lotes de cada cabecera y
    cuenta como pendiente todo lote cuyo ultimo control vigente no este
    finalizado. Los borradores permanecen pendientes; solo `CalRecEstado='F'`
    completa el lote.
17. El control valida contra `CalRecTamMuestra`: el total de danos y los frutos
    de firmeza no pueden superar la muestra. Calibre, pre calibre, rojo claro
    y rojo oscuro son distribuciones y cada fila debe sumar exactamente 100%;
    exportacion y comercial se limitan a 100%. Estas reglas se evalúan mientras se captura: resaltan campos y
    totales, muestran mensajes por sección y bloquean Guardar hasta corregir.
    El total de danos se recalcula en cada cambio.
18. Desde 2026-08-15 el color se registra por calibre en
    `CALRECEPCOLORCALIBRE`. `CALRECEPCOLOR` permanece como historico de la
    captura anterior por tamano; la lectura y el dashboard lo identifican como
    historico y no reinterpretan esos datos.
19. `CALRECEP.CalRecPorCalidad` conserva el indicador calculado como
    `max(0, 100 - danos/tamano muestra*100)`. React lo recalcula en cada cambio
    y lo presenta al final de la tarjeta de danos; Node vuelve a calcularlo al
    crear o modificar, sin confiar en un porcentaje enviado por el cliente.
20. Los listados de fruta (resumen y detalle) y de controles de calidad muestran
    `CalRecPorCalidad` dentro del chip del lote. En fruta se obtiene desde el
    ultimo control vigente; si no existe un control, el chip no presenta un
    porcentaje artificial.
21. En `/recepciones/ingreso`, Origen usa `Autocomplete` de Material UI tanto
    en el filtro como en la cabecera del formulario, permitiendo escribir y
    buscar. En las lupas de documento y movimiento, la accion de seleccion se
    presenta como icono a la izquierda de cada resultado.
22. El listado de `/recepciones/ingreso` inicia con un rango local desde la
    misma fecha del mes anterior hasta hoy. Para dias que no existen en el mes
    anterior, se usa su ultimo dia, evitando tambien desfases por UTC.
23. Se retiro el aviso informativo superior del listado para compactar el area
    operacional; la ayuda contextual permanece dentro del formulario.
24. En el control de calidad, `porcentaje comercial = danos / tamano muestra`
    y `porcentaje exportacion = 100 - porcentaje comercial`. Ambos se muestran
    como solo lectura en Firmeza y Node los recalcula al crear o modificar. El
    tablero presenta Calidad, Exportacion y Comercial dentro de cada lote con
    control completado.
25. Calibre, pre calibre, color y firmeza se capturan como numero de frutos.
    Calibre mas pre calibre debe completar el tamano de muestra y el total de
    colores debe cumplir la misma regla. React muestra los totales de frutos y
    sus porcentajes calculados; Node valida cantidades enteras y el dashboard
    normaliza las distribuciones por el total de frutos observado.
    La grilla presenta un unico total conjunto para calibre/pre calibre y otro
    para rojo claro/rojo oscuro; no valida subtotales independientes por fila.
26. Se retiro del formulario el aviso general sobre cabecera y arreglo del lote;
    permanecen solamente los mensajes de validacion y ayudas operacionales.
27. Se retiraron Grados y Brix del ingreso manual. En cada lote se capturan
    kilos brutos totales y se muestra el peso estimado por envase como total
    dividido por cantidad de envases. Las modificaciones no sobrescriben los
    valores históricos `MovGrados` y `MovGBrik`.
28. `GuiaIng1` se implementa como PDF individual descargable desde la bandeja
    y desde la vista de la recepcion. Node obtiene el registro completo por su
    clave GX y empresa de sesion; incluye datos de empresa, documento,
    movimiento, productor, observacion, totales y cada lote con las
    descripciones de cuartel, especie, variedad, envase y condicion. No usa la
    pagina cargada en React ni el dialogo de impresion del navegador.
29. El dashboard de calidad presenta las observaciones registradas en
    `CALRECEP.CalRecObservacion` como tarjetas trazables por control y lote,
    incluyendo fecha, productor, especie y variedad. La misma seccion forma
    parte de la impresion/PDF del navegador y omite controles sin observacion.

`ListadoRecep` queda como siguiente corte de reportes. El pesaje automatico no
se contempla.

## Verificacion minima

- alta con dos lotes y totales exactos;
- rollback completo al fallar un detalle;
- dos altas concurrentes sin repetir lote;
- modificacion con recalculo y auditoria;
- rechazo de empresa enviada por cliente;
- permisos separados de alta, cambio y baja;
- rechazo de eliminacion/cambio de lote consumido;
- fecha de detalle, filtros y reportes basados en cabecera;
- catalogos dependientes sin mezclar empresas;
- exportacion completa y no solo de filas cargadas.

## Evidencia

- `GXW.xpz`: eventos, reglas, niveles y fuentes de los objetos relacionados.
- `Inventario_GX8_Conex.xlsx`: objetos, claves, indices y dependencias de
  `Ingresos`.
- SQL Server configurado: esquema, catalogos, permisos, correlativo y
  dependencias con `ORDPROC1`, consultados en modo lectura.

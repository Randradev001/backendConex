# Operacion de ordenes de proceso

Fecha de revision: 2026-09-30.

Estado: alta y modificacion implementadas.

## Alcance

La pantalla `/ordenes-proceso/operacion` migra el WorkPanel GX8
`OrdenProcINS`. Selecciona saldos disponibles de recepciones manuales y crea
`ORDPROC`, su detalle `ORDPROC1` y el movimiento de salida asociado en
`MOVFRUT/MOVFRUT1`, siempre dentro de una transaccion serializable.

La empresa y el usuario provienen de la sesion. La operacion reutiliza el
programa `110/2/2` y la accion de alta o modificacion correspondiente.

## Presentacion operacional

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

## Verificacion 2026-09-30

- La consulta real del ADM en `CONEX_MIGRACION` devolvio para la orden 176
  `ProdNom=GUILLERMO DONOSO` y `ExpNom=RIO DUERO`, en lugar de los codigos 7 y
  6 mostrados anteriormente.
- El frontend compilo 6.033 modulos y el lint dirigido de
  `gxMaestroCrud.jsx` termino sin errores.

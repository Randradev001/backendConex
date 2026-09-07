# Operacion de ordenes de proceso

Fecha de revision: 2026-09-07.

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

## Regla de saldo

Node vuelve a consultar y bloquear el lote antes de guardar. Rechaza una
seleccion si envases o kilos superan el saldo disponible, aunque la pantalla
haya mostrado un valor anterior. El protagonismo visual del saldo no reemplaza
esta validacion transaccional.

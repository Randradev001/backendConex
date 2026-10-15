# Anulaciones de folios inspeccionados

El WorkPanel GX8 `Anulaciones` y la transacción `AnuINS` se migran a
`/procesos-sag/anulaciones` y `/backendDocker/anulaciones`. El programa
histórico es `100/20/4` (`wanulaciones`); la empresa se obtiene únicamente de
la sesión autenticada.

La cabecera es `ANUINS` por `EmpCod + TempCod + ANUFolio`. El correlativo se
obtiene con `GenCor.DETINT`; fecha, causal, autorizador vigente y una
observación de hasta 200 caracteres se guardan junto con fecha y login de
creación. `DACod` es la clave física del
autorizador y `DANombre` solo se resuelve para mostrarlo.

El detalle no es una tabla nueva: usa las asociaciones `SOLICITUDES2`.
Agregar un folio disponible cambia `Sol2Dispo` a 1 y asigna
`Sol2NumAnu=ANUFolio`. Cuando `CAUSAANUL.CanPE=1` (permite reinspección), se
deja también `FOLIOSPROC.FPDisponible=1`. Quitar el folio aplica la operación
inversa. Cada modificación recalcula `AnuTotFol`.
La pantalla muestra como `N° Solicitud` el atributo impreso `SolnumI` del XPZ;
`SolNum` se conserva internamente para identificar la fila al agregar o quitar
folios. El selector de folios reproduce `AgrFol_Anu`: filtra por el N° de
Solicitud impreso (`SOLICITUDES1.SolnumI`), folio y especie, muestra únicamente folios disponibles, permite seleccionar
todo/nada y solo agrega filas disponibles.
El listado `Folios anulados` conserva las columnas del XPZ y sus títulos:
`SolnumI` (N°Solicitud), `Sol2Folio` (Folio), `sol2nespe` (Especie),
`Sol2CajasDes` (Total Cajas Des), `SolNDest` (Mercado) y `Sol2NumAnu`
(N°Anulación).

El botón Eliminar replica la liberación de `EliFoliosAnu` dentro de una misma
transacción: captura los folios asociados, pone
`SOLICITUDES2.Sol2Dispo=0` y `SOLICITUDES2.Sol2NumAnu=0`, y cuando
`CAUSAANUL.CanPE=1` pone `FOLIOSPROC.FPDisponible=0`. Después elimina
físicamente la cabecera de `ANUINS`, de modo que los folios quedan disponibles
para las demás operaciones.

El botón Archivo conserva `ArchiDET`: genera `<CodigoPlanta><ANUFolio>.det`,
usa `ANUINS.AnuTotFol` en la línea de cabecera cuando existen folios, escribe
un folio por línea y termina con `&&`. El PDF se genera en Node como
`AnuFolios14` en blanco y negro y replica el diseño del layout XPZ: código,
versión, vigencia y página; informe, establecimiento, fecha, cantidad de
certificados y “QUE ANULA O DEVUELVE”; detalle de tipo de actividad, N°
actividad, folio, especie, condición, producto, cantidad/envases, tipo/envases
y causal/anulación; observaciones y firmas al pie con líneas.

La migración `database/20261013_anulaciones_inspeccion_2016.sql` completa
`ANUINS.DACod` en instalaciones creadas por el instalador parcial, agrega los
índices GX de consulta y registra el programa si aún no existe.

## Verificación requerida

- Crear con uno o más folios y verificar el conteo, `Sol2Dispo` y
  `Sol2NumAnu`.
- Verificar ambas causales `CanPE`, incluida la disponibilidad para
  reinspección.
- Rechazar autorizador inactivo, folio no disponible y empresa ajena.
- Quitar folio y eliminar una anulación con y sin detalle, verificando la
  liberación de sus folios asociados.
- Validar el contenido del `.det`, el orden textual del PDF y la autorización
  `100/20/4`.

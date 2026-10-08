# Inspecciones

## Alcance de la primera entrega

La ruta React `/procesos-sag/inspecciones` y la API
`/backendDocker/inspecciones` migran la consulta del WorkPanel GX8
`Inspecciones` con el permiso histórico `100/20/1`. La empresa se toma de la
sesión autenticada; no se acepta desde el navegador.

La API expone `GET /backendDocker/inspecciones/solicitudes/:solNum/pdf` para
generar un PDF carta vertical sin restringirlo por estado. El documento combina
los campos de `Solicit01` (carátula) y `Solicit02` (detalle) en ese orden; los
procedimientos `Solicit01CU` y `SolicitCU` no forman parte de este botón.

El nombre mostrado en el banner se obtiene desde `DEFEMP.EmpNom` usando la
empresa autenticada; no queda fijo en el código de la pantalla.

La pantalla resuelve la temporada activa desde `TEMP01.TempActiva=1`, inicia
con los últimos 60 días y consulta únicamente solicitudes `SOLICITUDES1` de
tipo `INS`. Permite filtrar por número de solicitud, rango de fechas, especie,
destino y estado. Presenta los campos GX: N° solicitud, fecha, especie,
destino, cajas, pallets, estado, solicitante, creador y destinos aprobados.
Los totales compactos de solicitudes, cajas y pallets se calculan con el mismo
conjunto filtrado y no solo con la página visible. El encabezado presenta cinco
cards de estado sobre ese mismo conjunto: Cant. Solicitudes, En curso,
Aprobadas, Rechazadas y Anuladas; cada una tiene color e icono propios. Las
cards son controles presionables (clic, Enter o Espacio) y abren un modal con
el listado paginado del estado correspondiente, conservando los demás filtros
activos de la pantalla.

La acción **Agregar** abre `/procesos-sag/inspecciones/nueva`. La pantalla
reproduce la transacción GeneXus `Solicitudes`: captura únicamente una cabecera
con fecha, especie, destino, solicitante y destinos aprobados; el número y el
estado En curso son automáticos. Guardar crea una sola solicitud y vuelve al
listado Inspecciones mostrando el mensaje de creación exitosa. Desde antes de guardar se pueden preparar folios
en una lista temporal; al guardar, la cabecera y todos los folios preparados
se vinculan en una sola transacción. El selector de disponibles permite marcar
varios folios mediante casillas por fila e incorporarlos en una sola acción;
los ya preparados quedan inhabilitados para evitar duplicados. Cada folio
preparado se puede quitar individualmente. Al seleccionar un folio preparado,
su detalle se consulta en modo lectura desde `FOLIOSPROC1`; no se reserva ni
modifica hasta guardar. El selector conserva un único botón inferior que agrega
todos los folios marcados, evitando una acción repetida en cada línea.
La cabecera también presenta en modo lectura los datos de aprobación/rechazo
(`SollogAP`, `SolFecAP`, `SollogRE`, `SolFecRE`) y el bloque de cajas por rango
(`solcajasRA`, `SolcajasRB`, `SolcajasRC`), siempre tomados desde
`SOLICITUDES1`. Estos dos bloques se muestran únicamente en los modos
Visualizar o Modificar; no aparecen al crear ni eliminar la solicitud.

## Dependencias y reglas conservadas

- Cabecera: `SOLICITUDES1`; detalle posterior: `SOLICITUDES2` y
  `SOLICITUDES3`.
- Catálogos visuales: `ESPECIES` y `DESTINOS`. La base operativa conserva los
  códigos `solespe` y `SolDest` en la cabecera, por lo que sus nombres se
  resuelven desde esos catálogos.
- Estados: `0 En curso`, `1 Aprobada`, `2 Rechazada`, `5 Anulada`.
- La alta usa una transacción serializable: genera `SolNum` con `SOLINTER` y
  `SolnumI` con `SOLINS` e inserta una sola cabecera en `SOLICITUDES1`, con
  estado inicial 0. Los folios preparados o agregados desde el detalle se
  validan individualmente contra `FOLIOSPROC` con las condiciones originales
  del XPZ: misma empresa y temporada, especie seleccionada, `FPEstado=10` y
  `FPDisponible=1`; luego copian sus datos a
  `SOLICITUDES2/3`, incluyendo `Sol2CajasDes/Sol2KilosDes` y
  `Sol3CajasDes/Sol3KilosDes` con las cantidades del folio, actualizan los
  totales y reproducen `RangoCajas` con `EnvPesoSag` (o `EnvPeso` como respaldo).
  Finalmente actualizan
  `FOLIOSPROC.FPDisponible=0`, `FOLIOSPROC.FPIns=1` y
  `FOLIOSPROC1.Fp2Ins=1`.
- El selector **Agregar un folio a la solicitud** aplica en el servidor las
  condiciones de disponibilidad (`EmpCod`, `TempCod`, `FPEspe`, `FPEstado=10`
  y `FPDisponible=1`) y excluye de forma explícita los folios ya presentes en
  `SOLICITUDES2`. La exclusión evita que asociaciones históricas con una marca
  de disponibilidad inconsistente vuelvan a aparecer en el selector.
- Si `FOLIOSPROC1` contiene correlativos históricos repetidos (`FP2Cor`) para
  un mismo folio, la asociación conserva todas sus líneas y asigna
  correlativos únicos en `SOLICITUDES3.Sol3Corr`. De ese modo un defecto de
  numeración del origen no impide incorporar el folio ni elimina información.
- La pantalla de alta y la antigua vista `Detalle Solicitudes` se unifican en
  `/procesos-sag/inspecciones/nueva` y `/procesos-sag/inspecciones/:solNum`.
  La misma pantalla cambia dinámicamente entre **Nueva solicitud de
  inspección**, **Visualizar solicitud de inspección** y **Modificar solicitud
  de inspección** según el contexto de navegación; la ruta de detalle ya no
  se presenta como una pantalla independiente. En modo existente conserva la
  cabecera, el resumen `SOLICITUDES2` y las líneas `SOLICITUDES3` del WorkPanel
  GX `solcitud02`, además de sus catálogos históricos. El modo Visualizar es
  solo de consulta, mientras que Modificar habilita los campos y las acciones
  de folios únicamente cuando la solicitud está en curso.
  En solicitudes en curso, el selector Agregar Folio permite marcar uno o varios
  folios disponibles y dejarlos pendientes; Quitar folio exige seleccionar un
  folio y confirmar, pero también queda pendiente. Los cambios de folios se
  aplican al pulsar Guardar, después de actualizar la cabecera, y las
  operaciones del servidor eliminan sus líneas de `SOLICITUDES3/2`, liberan
  `FPDisponible`, revierten `FPIns/Fp2Ins` y recalculan los totales. La operación
  se rechaza si el folio tiene despacho, repaletizaje, anulación u otra marca
  de uso. La modificación actualiza la cabecera en una transacción serializable
  y no permite cambiar la especie cuando ya existen folios asociados.
- Cada fila del listado incorpora el botón **Archivo**. Solo se habilita para
  estado `1 Aprobada` y descarga el archivo plano `.INS` de `ArchiINS`: usa
  `PARAMGE1` (`PARCod=20`, `PAR1Cod=30`) como código PL y
  `ESPECIES.EspeSag` como código SAG, normaliza destinos desde 700 a `700`,
  incluye únicamente `SOLICITUDES2` con cajas mayores a cero y finaliza con
  `&&`. El servidor valida la configuración y los límites históricos antes de
  producir el archivo. En Chrome/Edge se solicita la carpeta de destino; en
  otros navegadores se usa la descarga estándar.
- Cada fila también incorpora **Modificar** y **Eliminar** en la columna
  Acciones. Modificar abre el detalle únicamente para solicitudes en curso.
  Eliminar solicita confirmación y anula la solicitud (estado 5) cuando está
  en curso; antes de cambiar el estado elimina sus líneas de `SOLICITUDES3/2`
  y libera automáticamente los folios en `FOLIOSPROC/FOLIOSPROC1` dentro de la
  misma transacción. No se realiza borrado físico. Las cantidades iniciales
  `Sol2CajasDes/Sol2KilosDes` no bloquean la liberación: se registran al asociar
  el folio y representan cantidades disponibles para un despacho futuro. Si un
  folio tiene movimientos o marcas de uso posteriores incompatibles, la
  anulación se rechaza para no dejar datos inconsistentes.
- Cada fila incorpora **PDF** para todos los estados. El botón genera un único
  PDF carta vertical que combina `Solicit01` y `Solicit02` y lo abre en una
  ventana flotante del visor del navegador. El orden visual puede ser moderno,
  pero se conservan los campos históricos de ambos procedimientos y el título de solicitud se presenta como
  `N° SOLICITUD INSPECCIÓN`
  (totales, rangos, productor, CSG, provincia, comuna, variedad, proceso,
  kilos, cajas y fecha). Cuando un folio tiene más de una línea, el detalle
  agrega inmediatamente una fila de subtotal con sus Kilos y Cajas; los folios
  de una sola línea no agregan esa fila. La numeración de solicitud mantiene sus ceros y el
  pie muestra la página abajo a la derecha. Las filas del listado usan una
  altura vertical compacta y las filas de subtotal conservan espacio para sus
  dos líneas. La carátula compacta integra el
  bloque `Reservado S.A.G` en la primera página cuando el contenido lo permite;
  reserva su espacio antes de dibujarlo para evitar páginas en blanco creadas
  por el salto automático de PDFKit. El bloque usa casillas para los
  estados y líneas horizontales para certificados, inspector, firma, fecha y
  observaciones, alineado con el formulario GeneXus. Observaciones conserva dos
  líneas de escritura: la primera junto a la etiqueta y la segunda desde el margen izquierdo. Los formatos `Solicit01CU`
  y `SolicitCU` quedan fuera de este flujo.
  El resumen de totales del PDF se presenta en dos filas compactas: métricas
  principales (lote, kilos, pallets y categoría) y rangos/reservas, con valores
  jerarquizados y separadores suaves para facilitar la lectura.
  La tarjeta de datos de la solicitud usa un espaciado vertical compacto entre
  sus dos filas para aprovechar mejor el espacio de la carátula.
- El listado incorpora la acción visual **Cambiar Estado** para solicitudes en
  curso. El botón abre un modal pequeño siguiendo `CambiaEstadoSol` del XPZ,
  muestra número de solicitud, usuario y estado actual. Sus botones **Aprobar**
  y **Rechazar** consumen `PATCH /solicitudes/:solNum/status` con estados `1` y
  `2`, respectivamente; se deshabilitan para solicitudes que ya no están en
  curso y actualizan los contadores/listados después de una operación exitosa.
  El endpoint valida la empresa y la temporada activa, bloquea la cabecera con
  una transacción serializable y registra `SollogAP/SolFecAP` o
  `SollogRE/SolFecRE`; las solicitudes ya aprobadas, rechazadas o anuladas no
  se pueden volver a cambiar desde esta acción.
- La modificación de la cabecera se realiza desde la pantalla unificada
  mediante `PUT /solicitudes/:solNum`, sin cambios de esquema y manteniendo
  las transacciones GX (`Solicit01`, `solcitud02`).

## Verificación

`node --test test/inspecciones.service.test.js` comprueba el rango inicial de
60 días, el filtro Todos, los estados GX permitidos, las validaciones de
fechas/estado, la creación de cabecera sin folios, el cambio transaccional de
estado con auditoría, la creación atómica de detalles con bloqueo de folios,
el PDF carta vertical combinado y el contenido exacto del archivo `.INS`.

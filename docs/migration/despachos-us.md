# Despachos US

## Alcance implementado

El WorkPanel GX8 `DespachosUS` se migró como un listado operativo en
`/procesos-sag/despachos-us`, protegido por el programa histórico
`SistCod=100`, `ModCod=20`, `ProgCod=11`. La entrega contiene:

- listado paginado de `DESORIGEN`;
- filtros de fecha desde/hasta, estado, tipo de proceso, N° de planilla y N°
  de guía;
- el filtro Tipo de proceso ofrece Todos, Fumigación y Muestreo; Todos consulta
  exclusivamente los códigos `2` y `3`;
- banner operativo alineado visualmente con Despachos SAG, usando la imagen de
  planta, identificación de Packing, título USDA y temporada activa;
- pantalla independiente de alta en `/procesos-sag/despachos-us/nuevo`;
- Visualizar y Modificar dentro de un diálogo de pantalla completa;
- Eliminar como anulación lógica a estado Nula;
- columna `Acciones` con Visualizar, Modificar, Anular, PDF y Finalizar;
- PDF real generado en Node con las estructuras `PlaniDUS` y `DPlaniUSDA`, en
  formato carta vertical y en dos hojas;
- el PDF conserva los marcos internos de los bloques, pero elimina el contorno
  exterior de la página para evitar una línea perimetral adicional. El bloque
  `PlaniDUS` conserva el orden de sus bloques 1, encabezado central, 2, 3, 4,
  5, 6, 7, 8 y 9. El bloque 5 usa las columnas del layout XPZ, incluyendo el
  grupo `CONSIGNATARIO` con `NOMBRE` y `CODIGO`; los bloques 7 y 8 reproducen
  las tres líneas de texto y las firmas del layout original, respectivamente.
  El bloque 9 mantiene el nombre de la contraparte, la línea `NOMBRE
  CONTRAPARTE`, firma y timbre. El bloque 4 solo imprime los campos de
  transporte del XPZ y no agrega un campo independiente `DESTINO`;
- detalle de folios USDA en `DESORIGEN1/2`, con las validaciones de
  disponibilidad de `PROCUSDA/PROCUSDA1/PROCUSDA2`.


## Evidencia GX8

La fuente es `C:\Externo\DespachosUS.xpz`, WorkPanel `DespachosUS`, carpeta
`USDA`. El SubFile consulta la cabecera `DESORIGEN` con:

- empresa y temporada de la sesión;
- `DorTipPlani = &DorTipPlani`, con `2 FUMIGACION` como valor inicial y `3
  MUESTREO` como alternativa;
- fechas inclusivas `FecD`/`FecH`;
- estado `0 En Proceso`, `1 Finalizado`, `5 Nula` o `9 Todos`;
- `DORNumf` y `DorNguia` opcionales.

La grilla conserva las columnas visibles del SubFile: N° interno, N° de
planilla, N° de guía, fecha, cajas, kilos, folios, puerto de embarque, puerto
de destino, destino, estado, despachador, sellos, tipo de transporte y datos
de auditoría de creación/anulación. El orden es descendente por `DORNum`.

La evidencia específica del selector de folios está en
`C:\Externo\FoliosUS.xpz`, WorkPanel `BajaFolDesUS`. Para Fumigación el
`GxCondition` exige `PUSTipo=2`, especie exacta, `PUS1CajDes > 0`,
`PUS1Dispo=1` y `PUSEstado=1`, además de empresa y temporada. El procedimiento
`BajaFolDespUS` solo se ejecuta después de seleccionar la fila y copia los
detalles `PROCUSDA2`; `EliFolDesUS` libera nuevamente `PUS1Dispo` al retirar el
folio.

## Finalizar

El botón reproduce la intención del evento `Estado` y del procedimiento
`CamEstDespaUS`. Solo se habilita para filas con `DorEstado=0`. El backend
bloquea la fila dentro de una transacción serializable, usa la empresa y la
temporada activa de la sesión, asigna el correlativo `DFUMIOR` para tipo 2 o
`DMUESOR` para tipo 3 mediante `GenCor`, escribe `DORNumf` y cambia
`DorEstado=1`. Las solicitudes repetidas para una fila finalizada son
rechazadas.

Esta lógica no reutiliza las validaciones adicionales de `DespachosSAG` porque
el XPZ de USDA no las ejecuta en `CamEstDespaUS`.

## Alta, consulta, modificación y eliminación

La transacción GX8 `DesFumi1` conserva una cabecera común para Fumigación y
Muestreo. React reutiliza la composición visual de Despachos SAG, pero la
configuración USDA limita el tipo a `2` o `3`, oculta los campos exclusivos de
SAG y expone el selector de tipo de proceso. Crear utiliza el correlativo
transaccional `DESORINT`; los folios preparados antes de guardar se asocian en
transacciones separadas y las operaciones existentes vuelven a validar la
disponibilidad dentro de SQL Server. En el diálogo Agregar Folio de Despachos
US, la especie parte en `Seleccione` y debe elegirse antes de habilitar
`Agregar seleccionados`; la consulta de folios solo se activa con esa selección.
Al entrar en Nuevo Despacho US, el foco inicial queda en el selector Tipo de
proceso.
En el alta de Nuevo Despacho US, salir o
cerrar descarta directamente los cambios sin mostrar una confirmación; la
confirmación se mantiene para modificaciones y para las pantallas SAG.

Visualizar es solo lectura. Modificar queda disponible únicamente para
despachos En Proceso. Eliminar no borra físicamente: reproduce `AnulaDespaUS`,
marca `DorEstado=5`, libera `PROCUSDA1.PUS1Dispo` y conserva el historial. La
empresa, temporada y usuario provienen siempre de la sesión autenticada.
Al abrir Visualizar o Modificar desde el listado, la pantalla conserva también
`DorTipPlani` de la fila; esto evita consultar un despacho de Muestreo (`3`)
como si fuera de Fumigación (`2`).

## Impacto técnico y límites

- No se crea una tabla ni se cambia la estructura: se reutilizan
  `DESORIGEN`/`DESORIGEN1` con `DorTipPlani=2` o `3`.
- Se amplía `/backendDocker/despachos-us`, con autorización explícita
  `100/20/11`; `EmpCod` nunca se recibe desde React.
- Se agrega la ruta y la entrada de menú `wdespachosus` en React.
- Las tablas `PROCUSDA`, `PROCUSDA1` y `PROCUSDA2` son origen histórico de los
  folios y se consultan para asociar, liberar y detallar el despacho.
- Para Fumigación y Muestreo, el listado de folios reproduce el `GxCondition`
  de `BajaFolDesUS`: empresa, temporada, tipo, especie exacta, `PUS1CajDes >
  0`, `PUS1Dispo = 1` y `PUSEstado = 1`. No usa destino ni despacho como
  condiciones del listado; `PROCUSDA2` solo se copia al asociar el folio.
- El PDF consulta el resultado completo desde Node; no depende de las filas
  visibles en la grilla React.
- La primera página reproduce `PlaniDUS` con los bloques apilados y celdas de
  texto truncadas para evitar cruces de líneas o desborde de contenido. La
  segunda página reproduce `DPlaniUSDA` como Packing List, con detalle por
  folio, productor, Packing-IDP, totales y firmas de contraparte. Los datos de
  Packing e IDG se resuelven desde `PRODUCTORES`.
- La entrega requiere que el programa `100/20/11` exista en la capa de
  Seguridad y que los correlativos `DFUMIOR`/`DMUESOR` sean utilizables en
  `GenCor`.

## Verificación

La prueba `test/despachosUS.service.test.js` verifica el permiso, los filtros,
el aislamiento por tipo USDA, el orden del listado, la asignación de
correlativo diferenciada durante la finalización, el rechazo de tipos SAG, el
contrato del PDF y su tamaño carta vertical. También se ejecuta la suite
existente de `DespachosSAG` para comprobar que sus filtros, ABM y finalización
no cambien.

# Despachos SAG

## Alcance del listado

La primera entrega migra el WorkPanel GX8 `DespachosSAG` como un listado
operativo en `/procesos-sag/despachos-sag`. La ruta usa el programa
`100/20/3` (`ProgNomGX=wdespachossag`) y toma `EmpCod`, `login` y la temporada
desde la sesion/backend. El navegador no puede cambiar la empresa consultada.

La pantalla conserva los filtros visibles del XPZ:

- fecha desde/hasta;
- estado `0 En Proceso`, `1 Finalizado`, `5 Nula` y `9 Todos`;
- N° de Planilla SAG (`DORNumf`);
- N° de Guia (`DorNguia`).

El WorkPanel fija `DorTipPlani=1`, obtiene la temporada con `PTraeTemp` y abre
inicialmente los ultimos 30 dias hasta la fecha del servidor. Las variables GX
`Espe` y `Destino` aparecen en el objeto, pero no forman parte de la condicion
ni del formulario visible y no se agregan como filtros en esta fase.

La grilla muestra la cabecera `DESORIGEN`: N° interno, N° planilla, N° guia,
fecha, cajas, kilos, folios, puertos, destino, estado, despachador, sellos,
tipo de transporte y auditoria de creacion/anulacion. Los detalles de
`DESORIGEN1` y `DESORIGEN2` no son un listado independiente. Por defecto se
ordena de forma descendente por N° interno, de modo que el último despacho
creado queda al inicio en todas las páginas.

Cada fila ofrece dos salidas:

- **PDF**: genera un PDF real en Node para una sola planilla, siempre vertical
  y en tamaño Carta. Conserva el orden de las salidas GeneXus: `PlaniDSAG` y
  luego `DPlaniSAG`, con la cabecera y todos los folios/detalles de la planilla.
- **Archivo**: genera un `.des` por una sola planilla. Se habilita solamente
  para `DorEstado=1`, usa `PARAMGE1` `20/30`, normaliza destino mayor a 700 a
  700, toma `ESPECIES.EspeSag`, termina con `&&` y permite elegir una carpeta
  mediante `showDirectoryPicker` cuando el navegador lo soporta. Si no puede
  escribir en la carpeta, se usa la descarga normal como respaldo.

La acción **MultiPuerto** sigue el procedimiento `ArchiMP` del XPZ. Se abre
como diálogo sobre el listado, sin filtrar por `DorEstado`, y reutiliza o crea
la fila `DATMP` de la empresa, temporada activa y `DORNum`. Sus campos de texto
se mantienen como escritura libre, tal como el formulario `DATMP`; las cuatro
ubicaciones usan el Combo Box definido en el XPZ. Guardar
actualiza esa fila y Generar Archivo produce `MP<CodigoSAG><DORNumf>.txt`.
El modal y el backend aplican los límites del layout: códigos numéricos de
hasta 4 dígitos y ubicaciones seleccionables del Combo Box del XPZ (1 a 6),
nombres y tipos de transporte de 30 caracteres,
nombre de ingrediente activo de 50, concentración y duración de 50, sellos de
30 y fecha de tratamiento seleccionable con `DateCalendar`, visible como
`DD/MM/YYYY`. El backend vuelve a validar estos límites y los rangos numéricos
antes de guardar.
El archivo conserva las 26 columnas separadas por punto y coma: una línea por
combinación de especie/envase, códigos `*MP` de los maestros, kilos con punto
decimal, comunas separadas por `-` y sellos con el formato
`sello,ubicación-sello,ubicación`. La fecha de despacho se escribe como
`DD-MM-YYYY` y la de tratamiento como `AAAAMMDD`; el terminador `&&` no se
agrega porque está comentado en `ArchiMP`. La selección de carpeta se realiza
en el navegador y nunca se recibe una ruta desde el cliente.

El listado conserva además las acciones de la pantalla unificada: Agregar,
Visualizar, Modificar, Finalizar y Anular. Finalizar solo se muestra para
`DorEstado=0`, valida fecha, puertos, destino, observaciones y al menos un
folio, y cambia el despacho a `DorEstado=1`. Desde ese estado la cabecera y
los folios quedan bloqueados; el archivo `.des` queda habilitado. La pantalla
de mantenimiento reutiliza la
cabecera y sus dos niveles dentro de la misma transacción `DesOrigen`; no son
maestros separados.

## Pantalla `Despacho` y detalle de folios

La segunda entrega está disponible en `/procesos-sag/despachos/nuevo` y en las
rutas `/procesos-sag/despachos/:dorNum/{ver,editar,eliminar}`. El título
principal cambia según el modo a `Nuevo Despacho`, `Visualizar Despacho`,
`Modificar Despacho` o `Eliminar Despacho`. Los bloques de la pantalla usan
`Accordion` y el primero queda abierto al ingresar.

La cabecera respeta las reglas del XPZ: temporada activa de sesión, fecha por
defecto, observaciones obligatorias, validación de puerto de embarque nacional,
correlativo `DESORINT` y auditoría del usuario autenticado. Agentes,
consignatarios, exportadoras y despachadores se resuelven contra sus catálogos
por empresa; `EmpCod` nunca proviene del formulario.
El campo Puerto Embarque ofrece un filtro opcional **Solo nacionales**, basado
en `PUERTOS.PuNac`, sin descartar el puerto ya seleccionado al activar el filtro.

El bloque de folios permite agregar y quitar registros de `SOLICITUDES2` para
`DorTipPlani=1` y de `PROCUSDA1/2` para tipos 2 y 3. El selector conserva las
condiciones del XPZ `BajaFolDespa` y `BajaFolDesUS`: para origen exige
`Sol2Espe`, `Sol2CajasDes > 0`, `Sol2Dispo=0`, `SolEstado=1` y los filtros de
destino/destinos aprobados; para USDA exige `PUSTipo`, `PUS1Espe`,
`PUS1CajDes > 0`, `PUS1Dispo=1` y `PUSEstado=1`. El texto del folio es un
filtro adicional de la pantalla. `Sol2Dispo=0` significa disponible y el alta
lo cambia a `1`; en USDA `PUS1Dispo=1` significa disponible y el alta lo cambia
a `0`. Empresa y temporada se obtienen del contexto autenticado y la temporada
activa; el modal permite elegir especie y, para origen, destino y otros destinos
aprobados. El listado de folios de origen también devuelve `SolDestinos` como
`approvedDestinations` para mostrar los otros destinos aprobados tanto en el
selector como en **Detalle de folios**.
Durante el alta permite preparar folios antes de guardar; al guardar la
cabecera, la pantalla los asocia mediante las mismas operaciones protegidas del
detalle. Si todo el guardado termina correctamente, vuelve al listado Despachos
SAG con un mensaje de confirmación; si alguna asociación es rechazada,
continúa sobre el despacho creado para poder corregirla.
Eliminar no realiza borrado físico del despacho: ejecuta la anulación histórica,
libera los folios fuente y deja `DESORIGEN.DorEstado=5` (`Nula`). La pantalla de
Eliminar solicita confirmación y es de solo lectura; Visualizar también es de
solo lectura.

La API de mantenimiento está protegida por `100/20/3` y expone la cabecera,
folios disponibles, alta/baja de folios, finalización y anulación. Las tablas USDA deben
existir en la base operativa para habilitar los tipos 2 y 3; no forman parte de
la migración aditiva de `DESORIGEN`.

## Modelo fisico y compatibilidad

El inventario confirma:

- `DESORIGEN`, clave `EmpCod + TempCod + DorTipPlani + DORNum`;
- `DESORIGEN1`, clave de folio `EmpCod + TempCod + DorTipPlani + DORNum + dor1Folio`;
- `DESORIGEN2`, clave de detalle `EmpCod + TempCod + DorTipPlani + DORNum + dor1Folio + Dor2Corr`.

La base operativa configurada ya contiene filas en las tres tablas, pero su
instalador versionado tenia una representacion reducida de `DESORIGEN` y las
tablas hijas no incluian todos los atributos descriptivos del Transaction GX8.
La migracion aditiva `database/20261006_despachos_sag_2016.sql` completa las
columnas faltantes e indices de consulta sin borrar ni renombrar las tablas.
`Dor2CSG` se agrega porque el reporte `DPlaniSAG` del XPZ lo referencia,
aunque no aparece en la estructura resumida del inventario.
La migración `database/20261007_multipuerto_2016.sql` agrega `DATMP` y
`TipoTransMP` con la llave y atributos del XPZ. La generación de comunas
reproduce `GenComu` directamente desde `DESORIGEN2`, `PRODUCTORES` y
`COMUNAS`, evitando filas temporales compartidas de `PS_InfG001`.

## Reglas de PDF y archivo

El evento GX8 `Impri` llama a `RPlaniDSAG` y `RDPlaniSAG`. El PDF nuevo usa
los mismos datos y orden de negocio, pero se genera server-side y no depende
de las filas actualmente cargadas en React.

La planilla principal se mantiene en una sola página Carta vertical y respeta
el orden visual del layout XPZ:
`1.- Identificacion Centro`, `2.- Control SAG`, `10.- Antecedentes Generales`,
`3.- Transporte y Destino`, `4.- Antecedentes de la Carga`,
`5.- Observaciones`, `8.- Verificación SAG Puerto`, `9.- Datos Despachador`,
`6.- Condición de la Carga` y `7.- Tratamiento Detalle`. La tabla de carga usa
las mismas columnas del layout: N°, Especie, Variedad, Lote, Condición,
Producto, Cantidad por unidad de medida, Tipo unidad de medida, Cantidad de
envase, Tipo de envase, Puerto/País destino y Consignatario.

En la página `DESPACHO DE FRUTA INSPECCIONADA`, el detalle agrega una fila de
totales por folio únicamente cuando el folio aparece en más de una línea. La
fila usa el mismo resaltado verde y tipografía destacada del PDF de
Inspecciones, con el subtotal de Cajas bajo su columna. El listado respeta el
layout del XPZ y muestra, en orden, N°, N° Folio, Especie, Variedad, Provincia
Origen, Comuna Origen, CSG, N° Ins., Fecha Ins. y N° de Cajas. El cierre se
ubica al pie de la última página que contiene el listado del detalle: una fila
verde de una sola línea con `Total Pallet`, `Totales`, Kilos y Cajas queda
pegada al final del listado y debajo se muestran, sin recuadro ni fondo de
color, los campos de nombre y firma de la contraparte profesional. Las filas
de subtotal muestran `Totales` y el folio en líneas verticalmente alineadas.
La fecha de emisión se muestra junto al título `DETALLE DE LA PLANILLA` en
cada página del anexo.
El bloque de firma usa dos columnas con el nombre de la contraparte y la firma,
siguiendo el layout de `DPlaniSAG`, sin recuadro ni fondo de color.

`ArchiDES` escribe:

1. cabecera `CodigoPlanta + Destino + AAAAMMDD + TotalFolios`;
2. una linea por `DESORIGEN1`: `Folio + Cajas + EspeSag`;
3. terminador `&&`.

El nombre conserva `CodigoPlanta + DORNumf + .des`. El selector de carpeta es
responsabilidad del frontend; el backend nunca recibe una ruta del equipo del
usuario.

## Evidencia y verificacion

- XPZ recibido: WorkPanel `DespachosSAG`, procedimientos `ArchiDES` y
  `CamEstDespa`, reportes `PlaniDSAG` y `DPlaniSAG`, y `MultiPuerto.xpz` con
  `DATMP`, `ArchiMP`, `BuscaDatMP`, `CreaDatMP` y `GenComu`.
- Inventario: `tables.csv`, `project-objects.csv` y registro editable de
  revision.
- Programa de seguridad verificado en SQL Server: `SistCod=100`,
  `Modcod=20`, `ProgCod=3`, `ProgNomGX=wdespachossag`.
- Pruebas backend: filtros GX, aislamiento por empresa/temporada, archivo
  `.des` byte a byte, archivo MultiPuerto con la secuencia del XPZ, PDF no
  vacio y lectura completa de detalles.
- Verificacion funcional controlada: listado, PDF y archivo contra SQL Server;
  el build frontend valida la ruta y el selector de carpeta con fallback de
  descarga queda implementado para una prueba E2E en Chrome/Edge.

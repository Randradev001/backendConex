# Estado vigente de la migracion CONEX

Ultima actualizacion documental: 2026-09-01.

Este es el documento de entrada para continuar el proyecto. Describe el estado
observado en el codigo y en `CONEX_MIGRACION`. Antes de trabajar, ejecutar
`git status --short`: esta fotografia puede incluir cambios aun no confirmados
en Git.

## Objetivo y alcance

Se migra CONEX desde GeneXus 8 a:

- React 19 + Vite + Material UI en el frontend;
- Node.js + Express en el backend;
- SQL Server conservando el modelo fisico GX8;
- una sola base operativa durante la validacion.

Rutas activas:

- backend: `C:\Proyectos2025\Conex\backend\backendConex`;
- frontend: `C:\Proyectos2025\Conex\Frontend\conex-frontend`.

No continuar cambios en `C:\Proyectos2025\AS`; fue una copia temporal y quedo
fuera del alcance por decision del usuario.

## Fuentes de verdad

- Exportacion GX8: `C:\Users\andre\Downloads\GXW.xpz`.
- Inventario consolidado: `C:\Proyectos2025\Conex\DocumentacionIA\Inventario_GX8_Conex.xlsx`.
- Inventario versionado: `docs/gx8/inventory/`.
- Exportacion de Seguridad reciente: `C:\paso\APERPSeguridad.xpz`.
- Codigo backend y frontend de las rutas activas.
- Esquema y datos de la base configurada en `SQLSERVER_DATABASE`.

No interpretar el nombre del codigo generado como nombre funcional. Usar el
nombre del objeto GX y documentar su descripcion de negocio.

## Decisiones cerradas

1. Se conserva una sola base SQL Server. Durante la validacion se usa
   `CONEX_MIGRACION`; el renombre final a `CONEX` sigue pendiente.
2. Se conservan nombres fisicos GX8. Solo se agregan columnas o tablas de forma
   aditiva mediante scripts versionados.
3. En negocio se usa `EmpCod`; en tablas de Seguridad se conserva `GECODEMP`.
   Ambos representan la misma empresa de la sesion.
4. El login obtiene la empresa desde `SEGUSUEMP` y `DEFEMP`. React no permite
   cambiar `EmpCod` dentro de un maestro.
5. Los niveles 2 se mantienen dentro de la pantalla cabecera-detalle del padre;
   no son maestros independientes en el menu.
6. `NivSeg` se conserva por compatibilidad. La autorizacion vigente usa
   `ASIGSIST`, `ASIG`, `ASIGPROG`, `ASIGPROG1` y roles.
7. `VA` se retiro. La finalidad de `VA2` se implementa en middleware backend.
8. Las reglas de consulta, validacion, calculo, escritura y autorizacion se
   implementan en Node. React solo presenta y consume la API.
9. El menu se arma desde `SISTEMAS -> MODULOS -> PROGRAM` y permisos efectivos.
10. La marca visual es CONEX-CO, Control de exportacion, con paleta verde. No
    volver a textos, colores o documentacion de Mantis.

## Base de datos

Estado operativo:

- `CONEX_MIGRACION` contiene el modelo original CONEX y la homologacion de
  Seguridad.
- El backend no consulta `BDCONEXCO` ni `CONEX_GX8_ANALISIS` en ejecucion.
- `database/20260728_CONEX_original_homologacion.sql` define el soporte aditivo
  de Seguridad para una copia original.
- `database/20260728_import_BDCONEXCO_security.sql` contiene la importacion
  compatible que se uso durante la consolidacion.
- `database/20260730_maestros_condiciones_origenes_destinos.sql` fue ejecutado
  y confirmo `DESTINOS.DestNMP` con largo 30.
- `database/20260815_instalador_conex_2016.sql` prepara una base `CONEX` vacia
  compatible con SQL Server 2016, crea las tablas operacionales usadas por la
  migracion actual y siembra la capa de Seguridad con usuario, rol, menu y
  permisos iniciales; no migra datos historicos GX8.
- `database/20260815_tablas_operacionales_faltantes_2016.sql` es el parche
  complementario para bases donde ya se ejecuto el instalador inicial: crea
  solo las tablas operacionales faltantes y omite las existentes.
- `ORDPROC` y `ORDPROC1` conservan su estructura GX8 completa. El primer ADM de
  Ordenes de Proceso usa el CRUD generico con grilla, filtros y autorizacion
  `110/2/2`; sus eliminaciones validan dependencias en `ORDPROC1`.
- La operacion `OrdenProcesos/OrdenProcINS` se implemento en
  `/ordenes-proceso/operacion` como alta de ADM con permiso `110/2/2`: consulta lotes disponibles,
  permite seleccionar el lote completo o cantidades parciales y genera la
  cabecera/detalle en una transaccion serializable, evitando sobreconsumo. La
  generacion solicita variedad, exportadora, fecha y etiqueta, y persiste la
  salida de proceso en `MOVFRUT/MOVFRUT1` usando `OriCod=90`, `MovTDoc=90`,
  `MovNGuia=Ordpnum`, `TMcod=2` y `TMSCod=1`, alineado con `PCreaLOTE` y
  `PCrea_Detalle_LOTE`. La cabecera conserva `OrdploginC/OrdpFecC` como datos
  de creación y deja la orden en estado 0. El ADM permite visualizar cabecera
  y detalle; editar reutiliza la pantalla operacional y actualiza cabecera,
  detalle y movimiento de salida dentro de una transacción serializable,
  conservando el mismo `Ordpnum` y validando saldo sin contar la propia orden.
- `database/20260818_importar_usuarios_rut_real_login_2016.sql` importa desde
  `CONEX_MIGRACION` a `CONEX` solo usuarios activos con RUT/DV valido y empresa
  asignada; copia empresas, `SEGUSUEMP`, credenciales modernas si existen y
  permisos/roles relacionados para iniciar sesion.
- `database/20260818_generar_inserts_login_usuarios_rut_real.sql` genera lineas
  `INSERT ... VALUES (...)` literales para `DEFEMP`, `USUARIOS`, `SEGUSUEMP` y
  `SEGUSUCRED`, filtrando usuarios activos con RUT/DV real desde
  `CONEX_MIGRACION`.
- `database/20260818_generar_solo_inserts_login_usuarios_rut_real.sql` es la
  variante solicitada para servidor destino con tablas ya creadas: su resultado
  contiene solo sentencias `INSERT INTO ... VALUES (...)`.
- `database/20260901_control_lineas_tablero_2016.sql` agrega de forma repetible
  `LINEAS`, `LINCONFIG`, sus indices de consulta y el programa historico
  `100/6/11` cuando falten. Fue ejecutado sobre `CONEX_MIGRACION`.

Los scripts con `BDCONEXCO` en el nombre son antecedentes de la etapa previa.
No ejecutarlos sobre la base actual sin estudiar su objetivo y precondiciones.

El corte final se describe en `conex-single-database-cutover.md` y requiere
pruebas completas, `verify:conex` y `DBCC CHECKDB` antes del renombre.

## Seguridad implementada

| Area | Estado | Implementacion |
|---|---|---|
| Login por RUT y clave | Operativo | `seguridad.service.js`, cookie HttpOnly y `SEGSESION` |
| Empresa de sesion | Operativo | `SEGUSUEMP`, `DEFEMP`, `req.context.empCod` |
| Menu dinamico | Operativo | `seguridadMenu.service.js` y `authorizedMenu.jsx` |
| Usuarios y catalogos | Implementado | CRUD protegido por administrador de Seguridad |
| Roles por usuario | Operativo | `URolesPorUser`; agregar y quitar conserva permisos directos |
| Plantilla de rol | Implementado | programas en `ASIGPROG` con `GECODEMP=0` |
| Permisos directos | Implementado | editor por usuario, sistema, modulo y programa |
| Acciones directas | Conservadas | `ASIGPROG1`; pantalla avanzada disponible |
| Acciones dentro del rol | Pendiente | no se migran crear/modificar/eliminar en esta etapa |
| `NivSeg` | Compatible | se conserva, no reemplaza permisos explicitos |

La pantalla `Asignacion de accesos` selecciona una vez el usuario. Muestra una
pestana `Directos`, todas las pestanas de roles asignados y controles para
agregar o quitar roles. Administrar una pestana de rol modifica la plantilla y
afecta dinamicamente a todos sus usuarios; no modifica asignaciones directas.

La importacion historica no cargo automaticamente las plantillas de rol porque
los codigos de `PROGRAM` de las dos bases no son equivalentes. La homologacion
manual sigue pendiente. No atribuir permisos directos existentes a un rol sin
una tabla de correspondencia confirmada.

Ocultar una ruta en el menu no la protege. Las rutas asociadas a un programa
GX8, incluida la primera ola, ya comprueban ese programa en backend. Definicion
de Empresa conserva su tratamiento de raiz y Comunas es una consulta auxiliar
sin programa propio. La autorizacion por accion crear/modificar/eliminar sigue
fuera de esta etapa.

## Maestros implementados

### Cabeceras visibles

| Pantalla | Tabla GX8 | Detalle en la misma pantalla | Programa | Ruta backend |
|---|---|---|---:|---|
| Definicion de Empresa | `DEFEMP` | - | excepcion raiz | `/maestros/empresas` |
| Temporadas | `TEMP01` | - | 18 | `/maestros/temporadas` |
| Especies | `ESPECIES` | `ESPECIES1`, `CALIBRES` | 3 y 4 | `/maestros/especies` |
| Envases | `ENVCAT` | `ENVCAT1` | 6 | `/maestros/envases` |
| Productores | `PRODUCTORES` | `PRODUCTORES1` | 5 | `/maestros/productores` |
| Condiciones de fruta | `CONDICION` | - | 7 | `/maestros/condiciones` |
| Origenes de ingreso | `ORIGEN` | - | 8 | `/maestros/origenes` |
| Destinos de exportacion | `DESTINOS` | - | 11 | `/maestros/destinos` |
| Clientes | `CLIENTES` | - | 12 | `/maestros/clientes` |
| Agentes | `AGENTES` | - | 13 | `/maestros/agentes` |
| Consignatarios | `CONSIG` | - | 14 | `/maestros/consignatarios` |
| Tipos de documento | `TIPDOC` | - | 1 | `/maestros/tipos-documento` |
| Tipos de movimiento | `TIPMOV` | `TIPMOV1` | 2 | `/maestros/tipos-movimiento` |
| Procedencias | `PROCEDENCIA` | - | 9 | `/maestros/procedencias` |
| Secciones | `SECCIONES` | - | 10 | `/maestros/secciones` |
| Exportadoras | `EXPORT1` | `EXPPROD` | 15 y 16 | `/maestros/exportadoras` |
| Despachadores autorizados | `DESPAAUTO` | - | 19 | `/maestros/despachadores-autorizados` |
| Puertos | `PUERTOS` | - | 20 | `/maestros/puertos` |
| Causales de anulacion | `CAUSAANUL` | - | 21 | `/maestros/causales-anulacion` |
| Tipos de etiqueta | `TIPETI` | - | 22 | `/maestros/tipos-etiqueta` |
| Tipos de base de pallet | `TIPBPAL` | - | 23 | `/maestros/tipos-base-pallet` |
| Tipos de altura | `TIPALT` | - | 24 | `/maestros/tipos-altura` |
| Parametros generales | `PARAMGEN` | `PARAMGE1` | 30 | `/maestros/parametros-generales` |
| Monedas | `MONEDAS` | `VALMEXT` | 31 y 32 | `/maestros/monedas` |

Todos usan el CRUD reutilizable de React y el controller declarativo de Node.
Las pantallas ofrecen listar, visualizar, insertar, actualizar, eliminar,
busqueda general y botones de exportacion. Los filtros especificos se agregan
solo cuando existen en el WorkPanel GX8.

### Estado de autorizacion

- Cada ruta asociada a un programa GX8 usa `requirePermission` o
  `requireAnyPermission`, ademas de la sesion autenticada. Empresa y Comunas
  mantienen las excepciones descritas arriba.
- Los detalles comparten pantalla con su cabecera, pero conservan el programa
  historico cuando existe: Exportadora/Productores (15/16) y Monedas/Valores
  (31/32).
- La empresa efectiva siempre proviene de `req.context.empCod`; un `EmpCod`
  enviado por React no cambia el contexto multiempresa.

### Catalogos de consulta

- Comunas permanece como consulta/lupa. No tiene un programa propio en
  `PROGRAM`, por lo que no se publico como CRUD independiente.
- Los catalogos con programa GX8 confirmado ya tienen CRUD. Comunas continua
  siendo una consulta auxiliar sin entrada propia en el menu.

### Exportaciones actuales

Los botones se reutilizan mediante `ListExportButtons`, pero tienen limitaciones
que una IA no debe ocultar:

- Excel genera HTML con extension `.xls`, no un archivo XLSX real.
- PDF abre una vista HTML y el dialogo de impresion; no descarga un PDF desde
  el servidor.
- Ambos exportan solamente las filas cargadas en React.

Se consideran operativos para validacion visual, no listos para produccion.
La solucion final debe exportar el resultado completo filtrado y generar XLSX y
PDF reales.

## Maestros pendientes

La lista activa de `PROGRAM` para el modulo Maestros quedo cubierta. No publicar
los siguientes catalogos hasta confirmar su llamada y comportamiento de
negocio:

1. Multipuerto (`DESTMP`).
2. Envases multipuerto (`ENVMP`).
3. Productos generales (`PRODGEN`).
4. Lineas de embalaje (`MAELINEAEMBALAJE`), cuya tabla no existe en la base
   configurada.

`GenCor` permanece como servicio transaccional, no CRUD comun. La importacion
Excel de valores de moneda tambien es un proceso especializado y no una
importacion generica del maestro.

## Control de lineas implementado

El WorkPanel `linconfig` se rediseño en `/procesos/control-lineas` como tablero
de monitoreo y edicion. La API `/control-lineas` une `LINEAS` con la
configuracion `LINCONFIG.ConfID=1` y sus catalogos. Usa exclusivamente
`req.context.empCod`, exige el permiso `100/6/11` y devuelve resumen y filtros
por `LinMaquina`.

React presenta tarjetas responsivas verdes o rojas según `LinEstado`, reloj,
estado de conexion y actualizacion automatica cada diez segundos. Una linea
inactiva conserva visibles sus datos configurados porque `LinEstado`,
`LinEstConf` y `ConfEstado` no representan lo mismo.

El encabezado incluye las cajas procesadas de la orden activa de la temporada
activa. La API localiza `TEMP01.TempActiva=1`, selecciona
`ORDPROC.OrdpEstado=1` y cuenta las filas de `CAP001` por
`EmpCod + TempCod + CAPNproc`. No filtra `CAPEst`, porque el cambio posterior a
paletizada o despachada no deja de representar una caja procesada. Sin orden
activa devuelve cero y `Sin proceso activo`.

Las cerezas se animan solo cuando `LinEstado=1`. Al pulsar una tarjeta se abre
un modal con selects dependientes para especie, calibre, envase y
categoria, mas un switch para `LinEstado`. El guardado conserva el permiso de
programa `100/6/11`, valida los catalogos por empresa y actualiza `LINEAS` y
`LINCONFIG.ConfID=1` en una transaccion. Variedad no forma parte del formulario
ni del contrato porque la tabla GX8 original no la almacena.

La creacion general de lineas mediante `LineasINS`, la eliminacion y la
impresion ZPL continúan pendientes. Ver
[configuracion-lineas-tablero.md](configuracion-lineas-tablero.md).

## Consultas de recepcion implementadas

Las consultas `CRecepFrut` y `RRecepFrut` estan implementadas como una unica
pantalla React con reporte; `CRecepciones` se incorporo como vista de resumen y
no como ruta independiente.

El alcance es de solo lectura sobre `MOVFRUT` y su nivel 2 `MOVFRUT1`; no
incluye aun la captura operativa de `Recepciones`/`MovFrut`. La fecha oficial
es `MOVFRUT.MovFecha`, incluso para el detalle. La ruta backend exige permiso
`100/15/1`, toma `EmpCod` de sesion y genera XLSX/PDF completos. Transacciones,
tablas, hallazgos y evidencia se documentan en
[recepcion-fruta-evaluacion.md](recepcion-fruta-evaluacion.md).

El ingreso manual del WorkPanel operativo `Recepciones` esta implementado en
`/recepciones/ingreso`: usa el programa `100/2/1`, acciones 1/2/3, empresa de
sesion, correlativo transaccional, fecha de cabecera y proteccion de lotes
consumidos. Origen usa un `Autocomplete` escribible en el filtro y en la
cabecera. El formulario usa buscadores de catalogo para documento y movimiento
`1/1`; sus resultados presentan la seleccion como icono a la izquierda, y
organiza cada lote en tres filas. El listado inicia filtrado desde la misma
fecha del mes anterior hasta la fecha local de hoy. Por decision funcional,
el pesaje automatico y COM1 no se
contemplan. Ver
[recepciones-ingreso-evaluacion.md](recepciones-ingreso-evaluacion.md).

El tablero operacional `/recepciones/lotes-tablero` muestra seis fechas, desde
cinco dias atras hasta hoy, y deja `Hoy` seleccionado inicialmente. Al elegir
una fecha reemplaza el area de trabajo con sus productores y lotes de
`MOVFRUT1`, usando como fecha oficial `MOVFRUT.MovFecha`. En fase 1 es de
consulta y reutiliza el permiso del ingreso `100/2/1`. La opcion separada fue
registrada en `PROGRAM` como `100/2/31`, con
`ProgNomGX=wtablerolotesrecep`, mediante
`database/20260811_recepciones_tablero_lotes_menu.sql`.

El control de calidad se abre desde la tarjeta de un lote en un dialogo de
pantalla completa. La cabecera de recepcion es fija y el lote se modela como
`field array` con danos, calibre, color, firmeza y observaciones. El maestro
`MAdanos` fue creado por empresa y especie mediante
`database/20260811_maestro_danos_recepcion.sql`; para cereza (`Especod=1`) se
cargaron los 16 defectos iniciales. El guardado operacional usa `CALRECEP` y
los detalles normalizados `CALRECEPDANO`, `CALRECEPCALIBRE`,
`CALRECEPCOLOR` y `CALRECEPPLAGA`, creados por
`database/20260811_control_calidad_recepcion_operacional.sql`. La ruta
`/recepciones/calidad` lista los controles y reutiliza el mismo formulario en
modos Ver y Editar. El mantenedor se registra como opcion independiente
`100/2/32`, `ProgNomGX=wctrlcalidadrecep`, con acciones crear, modificar
y anular, mediante `database/20260811_control_calidad_recepcion_menu.sql`.
Los programas 31 y 32 deben asignarse expresamente desde Seguridad a los
usuarios o roles correspondientes. El rango por defecto del tablero calcula
`Hoy` con la fecha local del servidor para no adelantarse un dia al cambiar la
fecha UTC.
Las tarjetas del tablero consultan `CALRECEP` por la clave completa del lote:
un control vigente las marca como completadas en verde y la ausencia de control
las mantiene pendientes en rojo. Al seleccionar una tarjeta completada se abre
un modal exclusivo de lectura con el ultimo control vigente; una pendiente
continua abriendo el formulario de registro. El mantenedor incorpora filtro general,
fecha, estado y exportaciones Excel/PDF sobre las filas filtradas y cargadas.
El rango de fechas se inicializa desde un mes atras hasta la fecha local de hoy.
Las tarjetas completadas muestran porcentajes de Calidad, Exportacion y
Comercial. En el formulario, Comercial corresponde a la incidencia de danos
sobre la muestra y Exportacion al porcentaje restante; React los presenta como
solo lectura y Node los recalcula antes de persistir.
Calibre, pre calibre, color y firmeza representan cantidades de frutos. La suma
de calibre y pre calibre, y por separado la suma de los colores, debe coincidir
con el tamano de muestra; los porcentajes de distribucion son resultados
calculados y no valores capturados.
Las fotografias de danos se almacenan en `CALRECEPFOTO` como
`VARBINARY(MAX)`, fuera del JSON principal y vinculadas a `CALRECEP`. Se
admiten hasta 10 imagenes JPEG, PNG o WebP de 5 MB por control; el formulario
permite carga multiple y la vista de consulta presenta una galeria.
En dispositivos moviles, `Tomar foto` solicita la camara trasera mediante
`capture=environment`; `Elegir fotos` conserva el selector multiple de galeria.
Ambas alternativas se presentan desde un dialogo compacto de seleccion de
origen, independiente del formulario de pantalla completa.
El dashboard `/recepciones/calidad-dashboard` agrega por periodo y lote los
controles finalizados. Presenta indicadores preliminares normalizados,
segregacion premium, color, calibre, defectos, aprobacion, sanidad y porcentaje
de lotes con virus. Los graficos usan una paleta verde consistente; los
hallazgos de plagas, virus y dipteros se separan en tarjetas visuales y la
observacion general fue reemplazada por tarjetas de conclusiones rapidas.
Cada grafico presenta una conclusion contextual calculada y el cierre incluye
una conclusion general de negocio que combina rendimiento, condicion,
segregacion, defectos y riesgo sanitario.
El dashboard incluye evidencia fotografica agrupada por lote. Las imagenes se
descargan mediante la ruta autenticada, se esperan antes de abrir la impresion
y se incorporan al PDF del navegador con paginacion especifica para galerias.
Mantiene una conclusion deterministica e impresion optimizada mediante el
dialogo PDF del navegador.
Se publica en Consultas de Procesos como `100/15/15`,
`ProgNomGX=wdashcalidadrecep`; su endpoint usa el mismo permiso específico.
Los calibres del control se despliegan desde el detalle `CALIBRES` de la
especie del lote, filtrado por `EmpCod + Especod`, `calRecepcion=1` y ordenado
por `CalCod`. El CRUD de calibres expone `calRecepcion` como el selector
`Indicador recepcion`; la migracion es
`database/20260811_calibres_indicador_recepcion.sql`.
`MAPlagas` parametriza por empresa y especie los hallazgos de tipo `PLAGA`,
`VIRUS` y `DIPTERO`, con orden y estado activo. Su CRUD se integra como detalle
de Especies y el formulario los despliega como seleccion multiple antes de
Observaciones. La migracion es
`database/20260811_maestro_plagas_recepcion.sql`. Para cereza se cargaron
ejemplos concretos mediante `database/20260811_maestro_plagas_ejemplos.sql`;
los nombres genericos de los tipos no se usan como hallazgos seleccionables.
`MAColores` parametriza por `EmpCod + Especod` los colores utilizados en el
control de recepcion, su orden, estado activo y si aportan a la clasificacion
premium. `CALRECEPCOLOR` conserva el codigo historico y agrega `Especod` para
referenciar el maestro. El formulario, la consulta y el dashboard consumen
esta configuracion dinamica. La migracion es
`database/20260812_maestro_colores_recepcion.sql` y el CRUD se presenta como
detalle de Especies.

## Archivos clave

### Backend

- `src/controllers/maestrosController.js`: contratos, campos, claves, filtros,
  busqueda y dependencias de eliminacion.
- `src/Router/maestros.routes.js`: endpoints y permisos por programa.
- `src/services/seguridad.service.js`: login, sesion y permisos efectivos.
- `src/services/seguridadMenu.service.js`: menu autorizado.
- `src/services/seguridadRoles.service.js`: roles y plantillas.
- `src/services/seguridadAsignaciones.service.js`: permisos directos.
- `src/middleware/securityAuthorization.js`: `requirePermission`.
- `database/`: migraciones SQL aditivas y repetibles.

### Frontend

- `src/pages/maestros/gxMaestrosConfig.js`: definicion visual de maestros.
- `src/pages/maestros/gxMaestroCrud.jsx`: CRUD generico y cabecera-detalle.
- `src/api/maestrosApi.js`: mapa de endpoints.
- `src/menu-items/authorizedMenu.jsx`: traduccion de `ProgNomGX` a rutas React.
- `src/routes/MainRoutes.jsx`: rutas protegidas por sesion.
- `src/contexts/AuthContext.jsx`: usuario, empresa y menu de sesion.
- `src/pages/seguridad/`: administracion de Seguridad.

`TEMP_SESSION_CONTEXT` aun existe como valor inicial de configuracion, pero
`gxMaestroCrud.jsx` reemplaza `EmpCod` en ejecucion con `company.empCod` desde
`AuthContext`. El backend sigue siendo la barrera definitiva y nunca acepta una
empresa de pantalla para un maestro multiempresa.

## Como migrar el siguiente maestro

1. Ejecutar `git status --short` en ambos repositorios y respetar cambios
   existentes.
2. Localizar Transaction, niveles, WorkPanel, Report y Procedures en el XPZ y
   el inventario.
3. Escribir la finalidad de negocio con nombre GX, no con nombre generado.
4. Confirmar claves, tipos, largos, reglas, filtros, columnas visibles y
   dependencias de eliminacion.
5. Clasificarlo como global, por empresa o raiz de empresa.
6. Consultar el esquema SQL real. Crear un script aditivo solo si falta una
   estructura confirmada por GX8.
7. Identificar `SistCod`, `Modcod`, `ProgCod` y ruta de `ProgNomGX`.
8. Documentar el objeto en `docs/migration/` antes del cambio funcional.
9. Completar contrato backend, rutas y `requirePermission`.
10. Completar configuracion React, API, ruta y menu dinamico.
11. Mantener nivel 2 dentro del modal de la cabecera.
12. Probar alta, listado, busqueda, actualizacion, eliminacion protegida,
    empresa de sesion y exportaciones. Limpiar datos temporales.
13. Ejecutar pruebas, lint dirigido y build.
14. Actualizar este archivo y `project-review-register.csv`.

## Evidencia verificada

En el tablero Control de lineas, 2026-09-01:

- La migracion SQL repetible se ejecuto sobre `CONEX_MIGRACION` y confirmo las
  dos tablas y el programa `100/6/11`.
- La consulta real devolvio 20 lineas, 15 activas y 5 inactivas, todas
  configuradas y distribuidas en 20 maquinas para `EmpCod=1`.
- La temporada activa real es `2017-2018`; no tiene una orden con
  `OrdpEstado=1`, por lo que el indicador devuelve cero y `Sin proceso activo`.
  El conteo se verifico por el indice existente
  `IND_CAPORDPROC (EmpCod, TempCod, CAPNproc)`.
- La extension de edicion usa cuatro catalogos filtrados, validacion relacional
  y escritura transaccional protegida por el programa.
- La suite backend aprobo 43 pruebas, el lint dirigido del frontend termino sin
  errores y Vite compilo 5.732 modulos.
- La revision visual automatizada quedo limitada por falta de una sesion
  autenticada en los navegadores disponibles; no se usaron credenciales.

En la estandarizacion de fechas del frontend, 2026-08-21:

- Los campos de fecha usan el DatePicker oficial de MUI X con adaptador Moment,
  calendario y formato visible `DD/MM/YYYY`; los formularios y la API conservan
  valores `YYYY-MM-DD`.
- Los filtros de recepciones mantienen el periodo inicial desde un mes atras
  hasta hoy, y una recepcion nueva toma la fecha local actual.
- Se verifico en navegador la apertura del calendario, el valor visible y el
  cambio de fecha; el build completo del frontend aprobo 5.716 modulos.

En los ajustes analiticos del dashboard de calidad, 2026-08-18:

- `Rendimiento proyectado` usa el historico ponderado de muestras del periodo
  y no cambia al seleccionar un lote. `Fruta exportacion` y `Fruta comercial`
  se calculan sobre la seleccion activa como muestra sin dano/con dano y su
  suma es siempre 100%.
- El selector buscable conserva todos los lotes finalizados del rango aunque
  exista un lote activo; seleccionar el lote 394 mantuvo disponibles 394, 395,
  397 y 404 para cambiar el filtro sin volver primero a "Todos".
- La segregacion de calidad se calcula sobre frutos de muestra: fruta con dano
  es la suma de danos y fruta sin dano es muestra menos dano, ambas expresadas
  como porcentaje. Para el lote 394 se verifico 79,4% sin dano y 20,6% con dano.
- Calibre y pre calibre se agregan como numero de frutos por calibre, sin
  normalizarlos nuevamente como porcentajes.
- La distribucion de color toma exclusivamente `CALRECEPCOLORCALIBRE` y presenta
  los frutos rojo claro y rojo oscuro bajo el calibre al que pertenecen.

En la compatibilidad productiva de Consulta recepcion de fruta, 2026-08-18:

- El resumen dejo de usar `STRING_AGG`, funcion no disponible en SQL Server
  2016. Los lotes y su estado de calidad se concatenan con `STUFF` y
  `FOR XML PATH`, conservando el mismo contrato para React.
- La consulta exacta del error productivo devolvio localmente seis recepciones
  y mantuvo `lotsText`, `lotQualityText` y el conteo de lotes pendientes.
- Se agrego una prueba que impide reintroducir funciones de agregacion JSON o
  `STRING_AGG` incompatibles con SQL Server 2016.

En la configuracion PWA, 2026-08-18:

- El manifiesto PWA usa la base configurada por ambiente: en produccion su
  `id`, `start_url` y `scope` son `/co/`, en lugar de la ruta legada `/free/`.
- La PWA queda en espanol, con identidad visual, actualizacion automatica del
  service worker, limpieza de caches antiguos y metadatos de instalacion iOS.
- Los recursos favicon y apple-touch-icon respetan la ruta base de Vite.

En las validaciones de control de calidad, 2026-08-15:

- Se aplico `database/20260815_color_recepcion_por_calibre.sql`; la captura
  nueva persiste color por calibre sin modificar `CALRECEPCOLOR` historica.
- Backend rechaza danos y firmeza sobre el tamano de muestra; calibre, pre
  calibre y las dos distribuciones de color deben sumar exactamente 100%.
  Exportacion/comercial no pueden superar 100%.
- React valida esas reglas en cada ingreso, marca campos/totales en rojo,
  informa la sección afectada y deshabilita Guardar mientras exista un error.
- La estructura historica `CALRECEPCOLOR` se conserva en base de datos por
  compatibilidad, pero no se presenta en ingreso, lectura ni dashboard porque
  no permite relacionar el color con un calibre. Esas vistas usan
  exclusivamente `CALRECEPCOLORCALIBRE`.
- Se aplico `database/20260815_control_calidad_porcentaje_calidad.sql`; el
  porcentaje de calidad se deriva de muestra menos incidencia de danos y queda
  persistido en `CALRECEP.CalRecPorCalidad`.
- El resumen y detalle de recepcion de fruta, y el listado de controles de
  calidad, presentan ese porcentaje dentro del chip de cada lote; los listados
  de fruta toman el ultimo control vigente y omiten el indicador cuando no hay
  control asociado.
- La suite backend aprobo 31 pruebas.

En la mejora de trazabilidad recepcion-calidad, 2026-08-14:

- El ingreso manual devuelve y presenta todos los lotes de cada cabecera sin
  consultas N+1.
- El detalle de Recepcion de fruta conserva una fila por `MOVFRUT1` y enlaza
  el ultimo `CALRECEP` no anulado usando la llave GX completa.
- El resumen agrupa visualmente sus lotes y muestra cuantos siguen pendientes;
  solo un control finalizado descuenta el lote del indicador.
- Una consulta real en SQL Server confirmo las guias `465465465` y `11124`
  con sus lotes, y los lotes `394` y `395` con controles finalizados.
- La suite backend aprobo 27 pruebas, ESLint dirigido termino sin errores y el
  frontend compilo correctamente con Vite.

En la ola de consultas de recepcion, 2026-08-04:

- `verify:recepcion-fruta` comprobo contra SQL Server resumen, detalle y
  exportaciones reales para la temporada activa.
- La fecha del detalle se obtuvo de `MOVFRUT.MovFecha`; la prueba automatizada
  impide volver a filtrar por `MOVFRUT1.Mov1Fecha`.
- La suite backend aprobo 11 pruebas y el frontend compilo 5.434 modulos.

En la ultima ola, 2026-08-02:

- Se completaron 13 pantallas de cabecera y cuatro relaciones de detalle.
- `npm run verify:pending-masters` comprobo alta, cambio y eliminacion real en
  SQL Server para todos los contratos nuevos y termino sin residuos.
- Las cascadas GX de `TIPMOV1` y `PARAMGE1` se verificaron al eliminar la
  cabecera dentro de una transaccion.
- La suite backend paso 8 pruebas y el frontend compilo correctamente con Vite.

En la ola anterior, 2026-07-30:

- `DESTINOS.DestNMP` fue agregado y verificado con largo 30.
- CRUD real de Condiciones, Origenes y Destinos paso alta, busqueda,
  modificacion y eliminacion sin dejar registros temporales.
- Origen ignoro una empresa enviada por pantalla y uso `EmpCod=1` de sesion.
- Backend: 5 pruebas automatizadas aprobadas.
- Frontend: build de Vite aprobado con 5425 modulos.
- ESLint dirigido termino sin errores; persisten advertencias de finales CRLF
  preexistentes en el repositorio.

La capa de Seguridad y los maestros anteriores tienen evidencia detallada en
sus documentos de modulo. No extender esta evidencia a objetos que no fueron
probados.

## Definicion de terminado

Un objeto queda `READY` solo cuando:

- nombre y finalidad GX estan confirmados;
- tabla, clave y niveles coinciden con GX8 y SQL Server;
- empresa proviene de sesion cuando corresponde;
- listado, filtros y formulario respetan el objeto antiguo;
- CRUD y dependencias fueron probados;
- ruta backend esta autorizada por programa;
- menu dinamico resuelve su `ProgNomGX`;
- exportaciones cumplen el alcance declarado;
- pruebas y evidencia quedaron documentadas;
- inventario y estado vigente fueron actualizados.

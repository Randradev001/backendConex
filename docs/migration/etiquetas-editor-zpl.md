# CRUD visual de etiquetas y diseñador ZPL versionado

## Alcance decidido

El diseñador visual se implementa como un CRUD de cards accesible desde
`/etiquetas/disenos`. Reutiliza la opción de menú y el permiso vigente de
`Configuraciones de Etiquetas`, programa `110/1/1`, `ProgNomGX=wconfigeti`; no
crea un segundo programa de Seguridad. Cada card representa una cabecera
`ETIQUETA` y permite visualizar o editar una versión de diseño completa.

La primera etapa permite crear etiquetas sin líneas artificiales, generar
versiones en blanco o copiadas, importar, editar y generar un subconjunto
controlado de ZPL. `ETIQUETA` guarda la cabecera y `ETIQUETAVERSION` el JSON/ZPL
completo de cada edición. `CONFIGETI` y `ETIQUETAPLANTILLA` se conservan como
compatibilidad histórica, pero ya no son el mantenedor operativo.

Para las configuraciones históricas `VINASA`, el CRUD puede rescatar el layout
de `Eti_CV_VINA2016`: transforma posiciones, fuentes, líneas, textos y Code 128
en un documento editable, y convierte los datos de `CONFIGETI` en variables
como especie, variedad, productor, comuna, provincia, envase, calibre, fecha y
código. El rescate se usa como contenido inicial de una nueva versión; desde
ese punto la edición no depende de `ConfText1a`, `ConfText1b`, `ConfLin1` ni
`ConfDato1`.

El procedimiento histórico define sus campos con orientación Zebra `I` (180
grados). El documento conserva esas coordenadas y rotaciones para no alterar el
ZPL, pero agrega `displayRotation=180`: preview y canvas se muestran en posición
de lectura. El canvas resuelve los marcadores con sus valores de ejemplo y mide
el texto con la fuente visible; no usa el largo literal de `{{variable}}` como
ancho. Los campos de texto exponen alto y ancho de fuente, que son los parámetros
reales de `^A`, en lugar de una caja ficticia calculada por caracteres.

## Evidencia GeneXus

- Transaction `ConfigEti`, descripción `Configuracion de Etiqueta`, carpeta
  `ETIQUETAS`, clave `EmpCod + ConfCod + ConfLinea`.
- WorkPanel `ConfEtiquetas`, descripción `Configura Etiquetas`.
- La acción `Impri` de `ConfEtiquetas` llama `Impi_Etiquetas` pasando el
  `ConfCod` seleccionado.
- `Impi_Etiquetas` recorre todas las filas `CONFIGETI` de la empresa y el
  `ConfCod`; `ConfLinea` determina la posición dentro de los arreglos de texto.
- `ConfDato1a/1b` selecciona datos dinámicos como especie, variedad,
  productor, comuna, provincia, envase, categoría y calibre.
- `ConfLin1/1b` define si se imprime texto fijo, dato de negocio o una
  combinación. `ConfTipFecha` y `ConfSepFec` controlan el formato de fecha.
- `ConfTipEti` selecciona los formatos históricos `NORMAL`, `MEXICO`, `CHINA`,
  `RIOBLANCO` o `VINASA`.
- Los Procedures históricos contienen ZPL real con `^XA`, `^XZ`, `^PW`,
  `^LL`, `^FO`, `^FT`, `^FD`, `^FS`, `^A0`, otras fuentes residentes, `^GB`,
  `^BY`, `^BC`, `^FH`, `^MM`, `^LS`, `^PQ`, `~DG`, `^XG` e `^ID`.

La fuente de esta evidencia es `C:\Users\andre\Downloads\GXW.xpz` y el
inventario versionado en `docs/gx8/`.

## Estado observado en la base

En `CONEX_MIGRACION`, el 2026-09-02:

- `CONFIGETI` conserva las 14 columnas de la Transaction GX8;
- existen 24 filas, agrupadas en dos configuraciones de 12 líneas:
  `LAVINA16` y `POLCURA16`;
- ambas son ejemplos `VINASA`: contienen textos de cereza, productor,
  packing, provincia, comuna, fecha, FDA y GGN;
- `database/20260901_etiquetas_cabecera_versiones_2016.sql` creó `ETIQUETA` y
  `ETIQUETAVERSION`;
- la migración agrupó las 24 filas en dos cabeceras, `LAVINA16` y `POLCURA16`;
- no creó versiones automáticamente ni alteró las 24 filas históricas;
- `PROGRAM` contiene únicamente `110/1/1`, descripción
  `Configuraciones de Etiquetas`, `ProgNomGX=wconfigeti`;
- `PROGRAM1` no contiene todavía acciones para ese programa.

## Relación y persistencia

El modelo operativo es cabecera y versiones completas:

```text
ETIQUETA (EmpCod + EtiCod)
             |
             +-- ETIQUETAVERSION (... + EtiVersion)
             |
             +-- TEtCod -> TIPETI (EmpCod + TEtCod)

CONFIGETI ---------> solo rescate GX8 mediante EtiConfCodOrigen
```

`ETIQUETAVERSION` tiene clave foránea a la cabecera y una sola versión puede
estar marcada vigente. La empresa siempre proviene de la sesión; React no
envía ni puede reemplazar `EmpCod`.

`ETIQUETA.TEtCod` es el tipo de negocio y referencia el maestro GX8 `TIPETI`
dentro de la misma empresa. La migracion toma el tipo fisico de `TIPETI.TEtCod`:
`smallint` en la base GX8 o `int` en instalaciones creadas por el instalador
2016. El select excluye el valor histórico cero. El campo
`EtiTipo` preexistente conserva únicamente el formato técnico de origen, como
`VINASA`, y no se presenta como tipo de negocio.

`EtiDesignJson` es la fuente editable y versionada. `EtiZpl` es una salida
derivada por el generador backend y no se confía en un ZPL enviado por pantalla.
`ROWVERSION` evita sobrescrituras concurrentes.

## Arquitectura técnica

Frontend implementado:

```text
src/modules/etiquetas/
  pages/
  components/
  store/
  api/
```

Backend:

```text
src/modules/etiquetas/
  etiquetas.routes.js
  etiquetas.controller.js
  etiquetas.service.js
  etiquetasVersiones.service.js
  zpl/zplCore.js
```

La ruta React principal presenta cards verdes con búsqueda y estado. Cada card
muestra código, nombre, tipo, estado, cantidad de versiones, versión elegida,
medidas y última modificación; ofrece `Visualizar`, `Editar`, `Nueva versión`,
editar datos y eliminar. El diseñador versionado abre
`/etiquetas/disenos/:etiCod/:version`. La API nueva se monta bajo
`/backendDocker/etiquetas/catalogo` y exige el programa `110/1/1`.

Eliminar una cabecera elimina sus versiones por la relación declarada, pero
nunca elimina las filas históricas de `CONFIGETI`.

## Core ZPL y procedencia

La arquitectura de importación y round-trip toma como referencia el core MIT
de ZPLab, repositorio `https://github.com/u8array/ZPLab`, commit de referencia
`ceadd9b2dcb6bd1b47fc976e1fbf6f0ec8a2febb` (copyright 2026 u8array). No se
copiaron archivos del proyecto: se adaptaron sus conceptos de modelo
intermedio, rangos de origen y patch round-trip en un core propio de CONEX,
`src/modules/etiquetas/zpl/zplCore.js`.

El modelo conserva el ZPL original, rangos de origen por elemento y comandos
no modelados. Una importación sin cambios debe reexportarse sin diferencias;
un elemento editado reemplaza solamente su rango cuando el parche sea seguro.

## Subconjunto inicial

Elementos editables:

- texto con `^FO` o `^FT`, fuente `^A0` o fuente Zebra residente;
- rectángulo y línea mediante `^GB`;
- Code 128 con `^BY` y `^BC`;
- QR con `^BQ`;
- imágenes o referencias conservadas mediante `^GF`, `~DG` y `^XG`.

Comandos de configuración o no modelados permanecen en el ZPL original. El
informe de importación debe advertirlos sin moverlos al final del documento.

`Eti_CV_VINA2016` contiene primero un bloque de inicialización de impresora y
luego el bloque de etiqueta. Para obtener un único canvas editable, el rescate
consolida la inicialización dentro del bloque `^XA ... ^XZ`; no declara todavía
equivalencia de impresión física.

## Variables

El documento admite marcadores `{{nombre}}`, almacenados como bindings
estructurados. El render backend valida valores y escapa `^`, `~` y el
indicador de `^FH`; React no sustituye datos productivos directamente sobre el
ZPL final.

Variables iniciales: `producto`, `lote`, `fecha`, `codigo`, `productor` y
`variedad`. La correspondencia completa con `ConfDato1a/1b` se implementará
solo después de reproducir las reglas de `Impi_Etiquetas` con pruebas.

El rescate `VINASA` sí reproduce la selección `ST`, `TN`, `TNE`, `N` y `NE`
de `Impi_Etiquetas` para los códigos de dato observados en `LAVINA16` y
`POLCURA16`. Los formatos `NORMAL`, `MEXICO`, `CHINA` y `RIOBLANCO` siguen
pendientes de conversión automática.

## Seguridad

- Todas las rutas exigen sesión y permiso `110/1/1`.
- El backend obtiene `EmpCod` y login desde `req.context`.
- Una configuración de otra empresa responde como inexistente.
- La ruta actual del CRUD debe pasar explícitamente módulo y programa al
  helper de autorización; el llamado incompleto observado no debe conservarse.
- Las acciones finas de `PROGRAM1` se mantienen pendientes porque la base no
  contiene acciones para `110/1/1`.

## Verificación requerida

1. Importar y exportar sin editar conserva exactamente el ZPL.
2. Editar un campo no altera comandos desconocidos ni otros campos.
3. El generador produce ZPL determinista y escapa variables.
4. No se puede abrir ni guardar una etiqueta o versión inexistente en la empresa.
5. `EmpCod` enviado por pantalla no modifica la empresa efectiva.
6. Un `ROWVERSION` antiguo devuelve conflicto y no sobrescribe datos.
7. La ruta responde `403` sin permiso `110/1/1`.
8. El menú `wconfigeti` abre el CRUD de cards sin crear otro programa de Seguridad.
9. Preview e impresión física no se consideran producción hasta probar el
   worker de `src/impresion-worker/` con ZPL real y una impresora Zebra del ambiente.
10. Crear una versión desde una fuente `VINASA` genera un documento de 799 por
    400 puntos con 22 elementos editables.
11. Canvas y preview presentan `VINASA` con la misma orientación de lectura;
    cambiar un tamaño de fuente sigue generando los parámetros ZPL equivalentes.
12. Una variable histórica cuya muestra era solo su nombre usa un valor de
    dominio representativo en canvas y preview, sin modificar el diseño guardado.

## Implementación y evidencia 2026-09-02

- Se aplicó `database/20260901_etiqueta_plantilla_configeti_2016.sql` en
  `CONEX_MIGRACION`; creó `ETIQUETAPLANTILLA` y confirmó el programa 110/1/1.
- Se aplicó `database/20260901_etiquetas_cabecera_versiones_2016.sql`; creó las
  tablas de cabecera/versión y agrupó los datos GX8 en dos etiquetas sin crear
  versiones ficticias.
- Se aplicó `database/20260907_etiqueta_tipo_fk_2016.sql`; agregó `TEtCod` y la
  clave foránea compuesta hacia `TIPETI`. Las tres etiquetas existentes quedaron
  sin asignación automática para evitar inferir el tipo; el select ofrece los
  valores operativos `1 · POL-LAV` y `10 · POLCURA`.
- Una prueba real creó una cabecera temporal con `TEtCod=1`, confirmó que la API
  devolvía `POL-LAV` mediante la relación y la eliminó sin dejar residuos.
- La API valida `EmpCod` desde sesión, existencia de `ConfCod`, JSON, medidas,
  DPI y `ROWVERSION`; el ZPL persistido siempre lo genera el backend.
- El frontend usa React-Konva para mover, rotar y redimensionar; Zustand y
  zundo para estado y deshacer/rehacer; bwip-js para representar Code 128 y QR.
- El menú `wconfigeti` abre el CRUD de cards verdes. Cada etiqueta permite
  elegir una versión, visualizarla con Labelary, editarla o crear una nueva.
- La suite backend aprobó 63 pruebas, incluidas listado, eliminacion protegida
  por `ROWVERSION`; la consulta real devolvió `LAVINA16` y `POLCURA16`, cada una
  con 12 líneas. El rescate real generó para ambas 22 elementos editables en
  799 por 400 puntos, sin escribir plantillas.
- El rescate marca la orientación visual en 180 grados sin reescribir los
  comandos históricos. El editor usa muestras de variables y métricas de fuente
  en el canvas para evitar anchos inflados y superposiciones que no aparecían en
  Labelary. Los diseños VINASA guardados antes de este ajuste se normalizan al
  cargarlos.
- La muestra genérica `CALIBRE` de versiones ya guardadas se sustituye solo al
  representar por un código real corto del catálogo, por ejemplo `00LL`. El
  ajuste no cambia los demás textos ni reescribe una versión persistida.
- El canvas traduce el origen de línea base de `^FT` al origen superior de
  Konva según la rotación. La operación inversa se aplica al arrastrar o cambiar
  tamaño, por lo que editar visualmente conserva las coordenadas ZPL.
- Las líneas y rectángulos `^GB` compensan su ancho y alto al rotarse, porque
  Zebra y Konva usan extremos distintos como origen del gráfico.
- Una verificación real creó temporalmente una versión VINASA de 22 elementos,
  799 por 400 puntos y volvió a eliminarla sin residuos propios. Se preservó la
  versión 1 de `LAVINA16`, creada por el usuario `MANDRADE` desde la pantalla.
- El preview real de esa versión devolvió una imagen PNG de 33.962 bytes.
- El worker separado reutiliza `generateZpl`, resuelve la versión vigente y
  aplica variables productivas; permanece deshabilitado hasta la puesta en
  marcha descrita en `impresion-etiquetas-worker.md`.
- El diseñador versionado incorpora `Imprimir prueba`: selecciona una
  configuración con IP y envía el diseño abierto con valores de muestra mediante
  el backend de impresión, protegido por el permiso `110/1/1`.
- El frontend compiló 5.828 módulos con Vite. ESLint de la pantalla y API del
  CRUD terminó sin errores.
- El preview usa Labelary desde el backend y sigue siendo una ayuda de diseño,
  no una garantía de impresión física. El worker Zebra está implementado, pero
  su activación y prueba física siguen pendientes.

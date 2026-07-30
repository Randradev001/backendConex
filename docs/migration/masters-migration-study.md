# Estudio de migracion de Maestros GX8

Fecha de revision: 2026-07-23

## 1. Objetivo

Migrar los maestros del modelo GeneXus 8 de Conex a React, Node.js y SQL Server conservando:

- nombres de negocio y nombres fisicos GX necesarios para trazabilidad;
- columnas, filtros y orden de los listados originales;
- reglas de insercion, modificacion y eliminacion;
- relaciones entre niveles de una misma Transaction;
- empresa obtenida desde la sesion, sin selector visible;
- autorizacion por sistema, modulo, programa y accion;
- exportacion completa a Excel y PDF en cada listado.

La equivalencia buscada es funcional. Se permiten mejoras de usabilidad siempre que no alteren reglas, claves, resultados ni alcance de empresa.

## 2. Fuentes revisadas

- `GXW.xpz`: exportacion del modelo `ConexSQL2000`.
- `CONEX.rar`: modelo y fuentes generadas de GeneXus 8.
- `Inventario_GX8_Conex.xlsx`: inventario consolidado de 774 objetos, 225 Procedures, 105 Transactions, 174 WorkPanels, 55 Reports, 114 tablas y 1.063 atributos.
- `project-objects.csv`, `tables.csv` y `attributes.csv` del inventario local.
- Backend actual de maestros y seguridad.
- Frontend actual, configuracion de los CRUD, rutas, menu y exportaciones.
- Bases SQL Server disponibles: `conex` y `BDCONEXCO`.

## 3. Conclusion ejecutiva

El componente generico de CRUD es una base reutilizable, pero todavia no representa todos los maestros GX8 ni garantiza equivalencia funcional.

La prioridad inmediata no es agregar mas pantallas. Primero debe resolverse la fuente de datos:

- El backend esta conectado actualmente a `BDCONEXCO`.
- `BDCONEXCO` contiene el modelo `Empresas`, `MAEspecies`, `MACampos`, `covEnvases`, etc., asociado a Control Campo/Cosecha.
- Los CRUD ya escritos consultan `DEFEMP`, `ESPECIES`, `ENVCAT`, `PRODUCTORES`, `TEMP01`, etc., que corresponden al modelo GX8 `ConexSQL2000`.
- Esas tablas no existen en `BDCONEXCO`, por lo que los maestros actuales no pueden operar correctamente con la conexion vigente.
- La base `conex` si contiene una parte del esquema GX8, pero esta incompleta y casi sin datos.

Tambien existe una diferencia de empresa: `BDCONEXCO.Empresas` usa codigos 100 y 200, mientras que `conex.DEFEMP` contiene `EmpCod=1`. La sesion no puede aplicarse directamente al negocio hasta definir una unica codificacion o un mapeo explicito.

## 4. Inventario funcional de maestros GX8

La carpeta GX8 `Maestros` contiene:

- 29 Transactions;
- 17 WorkPanels, de los cuales 13 son mantenedores/listados y 4 son lupas de seleccion;
- 10 Reports;
- 5 Procedures compartidos.

### 4.1 Transactions de maestros

| Transaction GX | Negocio | Empresa | Nivel o dependencia | Estado actual |
|---|---|---:|---|---|
| Agentes | Agentes de despacho/exportacion | Si | Nivel 1 | Solo listado backend |
| Calibres | Calibres por especie | Si | Depende de Especies | CRUD React/Node |
| CausaAnul | Causales de anulacion | No | Nivel 1 | Ausente |
| Clientes | Clientes | Si | Nivel 1 | Solo listado backend |
| Comunas | Comunas | No | Catalogo global | Solo listado/lookup backend |
| Condicion | Condiciones de fruta | No | Catalogo global | Solo listado backend |
| Consig | Consignatarios | Si | Nivel 1 | Solo listado backend |
| DespaAuto | Despachadores autorizados | Si | Nivel 1 | Ausente |
| Destinos | Destinos | No | Catalogo global | Solo listado backend |
| DestMP | Destinos Multipuerto | No | Catalogo global | Ausente |
| EnvCat | Envases y categorias | Si | EnvCat1 es nivel 2 | CRUD React/Node en una pantalla con pestanas |
| EnvMP | Envases Multipuerto | No | Catalogo global | Ausente |
| Especies | Especies y variedades | Si | Especies1 es nivel 2 | CRUD React/Node en una pantalla con pestanas |
| Export | Exportadoras | Si | Tabla `Export1` | Solo listado backend |
| ExpProd | Exportadoras por productor | Si | Relacion Exportadora-Productor | Ausente |
| GenCor | Correlativos | Si | Infraestructura critica | Servicio parcial; no tratar como CRUD comun |
| MaeLineaEmbalaje | Lineas de embalaje | No detectado | Catalogo global | Ausente |
| Monedas | Monedas | No | Padre de ValMExt | Ausente |
| Origen | Origenes | Si | Nivel 1 | Solo listado backend |
| paramgen | Parametros generales | Si | `paramge1` es nivel 2 | Ausente como maestro |
| Procedencia | Procedencias | Si | Nivel 1 | Ausente |
| ProdGen | Productos generales | No | Catalogo global | Ausente |
| Productores | Productores y cuarteles | Si | Productores1 es nivel 2 | CRUD React/Node en una pantalla con pestanas; SQL pendiente |
| Puertos | Puertos | No | Catalogo global | Ausente |
| Secciones | Secciones | Si | Nivel 1 | Ausente |
| Temp01 | Temporadas | Si | Nivel 1 | CRUD React/Node |
| Tipdoc | Tipos de documento | No | Catalogo global | Solo listado backend |
| TipMov | Tipos y subtipos de movimiento | Si | TipMov1 es nivel 2 | Ausente |
| ValMExt | Valores de moneda por fecha | No | Depende de Monedas | Ausente |

`DefEmp`, ubicado en la carpeta GX8 `Seguridad`, se mantiene como maestro adicional porque define la empresa del negocio.

### 4.2 Listados GX8 identificados

| WorkPanel GX | Columnas visibles GX8 | Filtros/condiciones GX8 |
|---|---|---|
| Agentes | AgeCod, Agerut, AgeDv, AgeNom | Empresa de sesion |
| Calibres | Especod, EspeNom; detalle Calibre | Empresa y especie seleccionada |
| Clientes | CliCod, Clirut, CliDv, CliNom | Empresa y nombre de cliente |
| Consig | ConsCod, ConsRut, ConsDV, ConsNom | Empresa de sesion |
| EnvCat | EnvCod, EnvNom, EnvNomExt; detalle Catcod, CatNom, CatnomExt | Empresa y envase seleccionado |
| Especies | Especod, EspeNom, EspeDiaV; detalle VarCod, VarNom | Empresa y especie seleccionada |
| ExporProd | ExpCod, ExpNom; detalle ProdCod, ProdNom | Empresa y exportadora seleccionada |
| Export | ExpCod, ExpNom, ExpRut, ExpDv | Empresa de sesion |
| paramgen | EmpCod, PARCod, PARDes, PARValor1, PARValor2, PARValor3 | Empresa de sesion |
| Productores | ProdCod, ProdNom, ProdRut, ProdDv, ProdComuna, ProdProvincia | Empresa y nombre de productor |
| Puertos | PuCod, PuNombre, PuNac | Nacionalidad y nombre de puerto |
| Tempo | EmpCod, TempCod, TempDes, TempActiva, fechas y usuarios | El GX8 no declara filtro; en React debe limitarse a la empresa de sesion |
| ValMon | MonCod, MonDes, VMEFec, VMEVal | Moneda y rango de fechas aparecen en pantalla, pero su condicion no fue detectada; requiere prueba GX8 |

Las lupas GX8 detectadas son Productores (`Gx00B0`), Puertos (`Gx03R0`), Productos generales (`Gx04F0`) y Clientes (`PrClientes`). Deben convertirse en un componente reutilizable de busqueda y seleccion, conservando filtros y columnas de cada catalogo.

## 5. Estado de la implementacion actual

### 5.1 Reutilizable

- Controlador generico con SQL parametrizado.
- Validacion de tipos, largos, requeridos, rangos y valores permitidos.
- Contexto de empresa aplicado en backend desde la sesion.
- Formularios genericos con combos y lupa para catalogos grandes.
- CRUD para nueve rutas React: Empresa, Temporada, Especie, Variedad, Envase, Categoria, Calibre, Productor y Cuartel.
- Busqueda general y filtros configurables.
- Botones Excel y PDF comunes.

### 5.2 Brechas funcionales

1. Solo 5 de las 29 Transactions de la carpeta `Maestros` tienen CRUD completo de nivel principal. Nueve tienen solo consulta backend y quince no estan implementadas.
2. Los listados React muestran todos los campos del formulario. GX8 usa subconjuntos especificos; deben separarse `formFields` y `listColumns`.
3. La busqueda general no cubre necesariamente todas las columnas visibles y claves relevantes.
4. El frontend todavia conserva `TEMP_SESSION_CONTEXT.EmpCod=1`; debe consumir `company.empCod` desde `AuthContext`.
5. El menu dinamico proviene de `BDCONEXCO.PROGRAM`, cuyos programas CCO/COV no corresponden a los objetos del `GXW.xpz` estudiado.
6. Las rutas de maestros solo exigen autenticacion. Falta aplicar permisos de programa y accion a listar, insertar, modificar, eliminar y exportar.
7. La eliminacion generica no comprueba dependencias de negocio antes de borrar padres o maestros usados.
8. Los niveles secundarios estan separados en pantallas. Es valido como mejora, pero debe existir navegacion padre-detalle y conservar la clave padre bloqueada.
9. El limite de consulta actual es 500 desde React y 1.000 en backend. La exportacion solo incluye las filas cargadas, no necesariamente todo el resultado filtrado.

## 6. Excel y PDF

La implementacion actual no alcanza todavia el criterio de exportacion productiva:

- Excel genera una tabla HTML con extension `.xls`; no es un archivo XLSX real y Excel puede advertir que formato y extension no coinciden.
- PDF abre una ventana HTML y el dialogo de impresion; no genera ni descarga un PDF directamente.
- Ambos usan solamente las filas ya cargadas en el navegador.

### Propuesta

Crear exportaciones en backend, usando la misma definicion de columnas y filtros que el listado:

- `GET /maestros/:catalogo/export.xlsx`
- `GET /maestros/:catalogo/export.pdf`

Requisitos comunes:

- aplicar empresa de sesion, filtros GX8 y busqueda general;
- exportar todo el resultado filtrado mediante paginacion interna, no solo la pagina visible;
- usar nombres descriptivos, fecha, empresa, usuario y filtros aplicados;
- excluir acciones y campos tecnicos ocultos;
- registrar auditoria de la exportacion;
- respetar permiso de consulta/exportacion;
- generar XLSX real y PDF descargable.

`ValMon` tiene ademas una importacion Excel real en GX8: fecha y valor desde la fila 2 para una moneda seleccionada. Esa carga debe migrarse como proceso independiente con plantilla, vista previa, validacion por fila, transaccion y resumen de errores. No se recomienda habilitar importacion generica en todos los maestros.

## 7. Filtros y busqueda

Cada maestro debe declarar en una sola configuracion:

- `listColumns`: columnas y orden exacto del WorkPanel GX8;
- `searchColumns`: codigo, nombre y todas las columnas textuales visibles;
- `keyFilters`: filtros por claves o relaciones;
- `gxFilters`: filtros presentes en el WorkPanel original;
- `defaultOrder`: indice u orden GX8;
- `formFields`: todos los campos editables de la Transaction;
- `requiredFields`: reglas GX8, incluidas reglas por nivel;
- `lookups`: combo para conjuntos pequenos y lupa paginada para conjuntos grandes.

La busqueda general debe combinarse con los filtros clave, no reemplazarlos. Para rendimiento, la busqueda debe ejecutarse en SQL Server con paginacion y un retraso corto en frontend.

## 8. Niveles GX8

Los niveles deben conservarse como una unidad de negocio:

- Especies -> Variedades.
- Envases -> Categorias.
- Productores -> Cuarteles.
- Parametros generales -> Detalle de parametro.
- Tipos de movimiento -> Subtipos.
- Exportadoras -> Productores asignados.
- Especies -> Calibres como dependencia relacionada.

Se recomienda una pantalla padre con detalle en pestaña o panel secundario, manteniendo tambien rutas directas si ayudan a la operacion. Insertar un hijo siempre debe recibir la clave padre desde la seleccion; nunca debe permitir escribirla libremente.

## 9. Reglas GX8 que no deben perderse

- Validacion de RUT y digito verificador en Agentes, Clientes, Consignatarios, Exportadoras y Productores.
- Campos obligatorios y claves inmutables al modificar.
- Fechas y usuarios de creacion asignados por servidor en Temporadas, Causales y Monedas.
- Valores predeterminados como `TempActiva=1`, `EnvUso=1`, `DAVig=1` y `PuNac=0`.
- Correlativo `CalCod` obtenido mediante la logica de `TraeCor`; debe ser atomico.
- Reglas obligatorias por segundo nivel para Variedades, Categorias y Cuarteles.
- Permisos GX `PVA/PVA2`: 1 insertar, 2 modificar, 3 eliminar y las acciones adicionales definidas en `PROGRAM1/ASIGPROG1`.

## 10. Base de datos y empresa

### Decision de nombres fisicos en BDCONEXCO

Se adopta un mapeo hibrido y acotado. Solo se usan los nombres fisicos de
BDCONEXCO cuando ya existe una tabla equivalente:

| Objeto GX8 | Tabla BDCONEXCO |
|---|---|
| DEFEMP | Empresas |
| TEMP01 | MATemporadas |
| ESPECIES | MAEspecies |
| ESPECIES1 | MAEspeciesVar |
| ENVCAT | covEnvases |

Las demas tablas conservan sus nombres GX8, por ejemplo CALIBRES, ENVCAT1,
COMUNAS, PRODUCTORES, PRODUCTORES1, CLIENTES, EXPORT1, CONSIG, AGENTES,
ORIGEN, CONDICION, DESTINOS y TIPDOC. No se crean nombres nuevos como
MAClientes o MAProductores sin una tabla BDCONEXCO preexistente que lo
justifique.

La capa Node traduce nombres de campos equivalentes, por ejemplo EmpCod a
GECODEMP. Los campos GX8 sin equivalente se agregan solamente cuando una
regla o pantalla del negocio confirme que son necesarios.

### Primera ola implementada

- El controller generico traduce columnas para Empresas, MATemporadas,
  MAEspecies, MAEspeciesVar y covEnvases en listados, filtros, busqueda y
  operaciones de escritura.
- React obtiene EmpCod desde AuthContext; el backend continua imponiendo la
  empresa autenticada en los maestros dependientes.
- Los listados comunes incluyen Visualizar, Actualizar y Eliminar, ademas de
  los filtros y exportaciones existentes.
- La pantalla parte con el listado completo de `ESPECIES`; no expone pestanas
  superiores independientes para Variedades o Calibres. Sus rutas historicas
  se conservan como compatibilidad y abren el mismo listado de Especies.
- Visualizar y editar una especie mantiene la cabecera visible y muestra sus
  variedades de `ESPECIES1` y calibres de `CALIBRES` como detalles relacionados.
  En edicion, ambos detalles permiten crear, modificar y eliminar registros.
- Los detalles se limitan por la empresa autenticada y por `Especod`. Para
  corregir el texto clave de un calibre, el backend recibe `OriginalCalibre`
  solo como clave de busqueda y conserva la nueva clave validada en `Calibre`.
- La pantalla de Envases parte con `ENVCAT`. Visualizar y editar un envase
  mantiene su cabecera visible y lista las categorias de `ENVCAT1`; en edicion
  permite crear, modificar y eliminar categorias dentro del mismo dialogo.
- La pantalla de Productores parte con `PRODUCTORES`. Visualizar y editar un
  productor mantiene su cabecera visible y lista sus cuarteles de
  `PRODUCTORES1`; en edicion permite mantener esos cuarteles.
- Las rutas directas de categorias y cuarteles se conservan como compatibilidad,
  pero abren el listado del padre. El menu muestra una sola entrada por cada
  Transaction cabecera/detalle.
- El script agrega la clave foranea MAEspeciesVar -> MAEspecies; la revision
  previa de BDCONEXCO no encontro variedades huerfanas.
- El script `database/20260723_BDCONEXCO_gx8_masters.sql` agrega los campos
  faltantes y crea CALIBRES, ENVCAT1, COMUNAS, PRODUCTORES, PRODUCTORES1 y
  GenCor cuando no existen.
- La ejecucion del script sobre BDCONEXCO queda pendiente de aplicacion y
  verificacion; estos maestros no deben marcarse listos antes de esa prueba.

DEFEMP es el maestro raiz de empresas y constituye una excepcion al filtro
multiempresa: su listado y mantenimiento no se limitan por
req.context.empCod. Su clave EmpCod se ingresa en el formulario. Las tablas
dependientes conservan el filtro obligatorio por la empresa de sesion. En
Seguridad se mantiene el nombre fisico GECODEMP, traducido al mismo
req.context.empCod por el backend.

### Opcion recomendada

Separar explicitamente las conexiones mientras se completa la migracion:

- `SECURITY_DATABASE=BDCONEXCO` para autenticacion, sesiones y autorizaciones.
- `BUSINESS_DATABASE=conex` para las tablas GX8 del negocio.

Esto requiere un mapeo de empresa porque hoy los codigos no coinciden. Puede resolverse con una tabla `SEGEMPRESAMAP` o, preferentemente, cargando en Seguridad las empresas reales de `DEFEMP` con el mismo `EmpCod`.

Antes de construir mas CRUD se debe elegir una de estas alternativas:

1. Mantener dos bases con conexiones y mapeo explicitos.
2. Completar todo el esquema GX8 dentro de `BDCONEXCO`.
3. Llevar Seguridad a `conex` y operar con una unica base.

Los mapeos hacia `MAEspecies` y `covEnvases` deben incorporar explicitamente
las claves, campos y reglas GX8 que falten; la semejanza del nombre no se
considera equivalencia funcional por si sola.

## 11. Plan propuesto

### Ola 0: Base y contrato comun

- decidir arquitectura de base y empresa;
- crear/verificar todas las tablas e indices GX8 necesarios;
- reemplazar empresa fija del frontend por empresa de sesion;
- agregar paginacion SQL, permisos y contrato comun de exportacion;
- separar columnas de lista de campos de formulario.

### Ola 1: Corregir lo ya construido

- DefEmp, Temp01, Especies/Variedades, EnvCat/Categorias, Productores/Cuarteles y Calibres;
- igualar columnas y filtros GX8;
- aplicar todas las reglas y dependencias;
- habilitar XLSX y PDF reales;
- pruebas CRUD, multiempresa y autorizacion.

### Ola 2: Completar los nueve catalogos ya consultables

- Agentes, Clientes, Comunas, Condicion, Consignatarios, Destinos, Exportadoras, Origenes y Tipos de documento;
- agregar campos, reglas, CRUD, menu, rutas y exportaciones.

### Ola 3: Maestros operativos faltantes

- Causales de anulacion, Despachadores autorizados, Procedencias, Puertos, Secciones, Monedas/Valores, Parametros generales y Tipos de movimiento;
- migrar importacion Excel de valores de moneda.

### Ola 4: Relaciones y catalogos especializados

- Exportadoras-Productores, Multipuerto, Productos generales y Lineas de embalaje;
- confirmar uso real mediante `PROGRAM` de la base GX8 y usuario experto.

### Ola 5: Componentes tecnicos

- GenCor como servicio transaccional, no CRUD comun;
- auditoria, concurrencia, pruebas de carga y bloqueo de eliminaciones referenciadas.

## 12. Criterio de terminado por maestro

Un maestro se considera migrado solo cuando cumple todos estos puntos:

- tabla, claves, indices y niveles cotejados con GX8;
- empresa aplicada desde sesion cuando corresponde;
- columnas y orden del listado cotejados con el WorkPanel;
- filtros GX8 y busqueda general operativos;
- alta, modificacion y eliminacion equivalentes;
- reglas GX8 implementadas en backend y reflejadas en frontend;
- combos y lupas resuelven claves relacionadas;
- permisos ocultan acciones y protegen tambien el endpoint;
- Excel XLSX y PDF descargan todo el resultado filtrado;
- eliminacion controlada por dependencias;
- pruebas automatizadas y prueba comparativa con GX8 aprobadas;
- ruta registrada en `PROGRAM` y visible solo para usuarios autorizados.

## 13. Informacion que falta

Para continuar sin inventar comportamiento se necesita:

1. Confirmar si `BDCONEXCO` sera la base unica o solo la base de Seguridad.
2. Entregar o conectar la base SQL Server real usada por el GX8, idealmente con datos, o autorizar la creacion completa del esquema en `conex`.
3. Obtener los registros originales de `SISTEMAS`, `MODULOS`, `PROGRAM`, `PROGRAM1` y asignaciones del sistema GX8 Conex; la XPZ contiene las estructuras, pero no el menu activo de produccion.
4. Confirmar cuales de las 29 Transactions siguen vigentes; no todas tienen WorkPanel de listado y algunas pueden ser tecnicas o historicas.
5. Ejecutar una prueba breve en GX8 para `ValMon` y para los mantenedores sin WorkPanel, con el fin de confirmar filtros, orden y acciones visibles.

Con esas decisiones se puede producir el script SQL completo y comenzar la Ola 0 sin mezclar los dos modelos de negocio.

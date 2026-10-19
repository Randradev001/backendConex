# Vistas de origen Conex para el módulo de guías APERP

> Actualización 13-10-2026: `wguiasd` abre un listado operativo de lectura de guías históricas Conex. La sesión y el permiso Conex filtran la empresa en el backend; la pantalla compartida vive en APERP. El resto del documento describe el prototipo inicial.

## Precarga y guardado central habilitados

La implementación operativa conserva una sola pantalla en APERP y aplica el tema verde cuando se abre desde Conex. El backend Conex crea un ticket aleatorio de un solo uso, con hash y vencimiento de dos minutos, después de comprobar la sesión y el permiso `70/6/3` o `100/2/20`. APERP consume el ticket en una transacción y entrega una sesión de 30 minutos limitada a las rutas de Guías. Esa sesión fija usuario, empresa Conex, empresa APERP homologada y origen `CONEX`; los parámetros del navegador no pueden sustituir esos valores.

El script `database/20261013_guias_bridge_y_precarga.sql` agrega `integracion.GuiaAcceso` y vistas de precarga para Packing List y despacho comercial. APERP usa `ge.ConexEmpresaMap`, `ge.GuiaBridgeSesion` y `ge.GuiaOrigen`, creadas por su migración `20261013_guias_conex_bridge.sql`. La homologación de empresas se configura por instalación después de validar la entidad legal; las migraciones no inventan equivalencias.

El formulario consulta hasta 100 orígenes por tipo y temporada. Al elegir un Packing List recupera cabecera, datos de exportación/transporte y líneas de `DESORIGEN2`; al elegir despacho comercial recupera `DESCLI_FP/DESCLI_FP1`. El guardado vuelve a consultar el documento desde servidor, persiste la guía en APERP con `SistemaOrigen=CONEX` y registra la clave completa de origen. Un índice único impide crear dos guías centrales para el mismo documento Conex. El listado Conex conserva las guías históricas y agrega los borradores centrales autorizados.

Validación local: empresa Conex 1 homologada solamente en el ambiente de prueba con APERP 100. Se canjeó un ticket, se precargó el despacho comercial disponible 283 de temporada 2013-2014, se guardó y leyó el borrador con una línea y trazabilidad completa, y después se eliminó el registro de prueba. También se comprobó un Packing List disponible de 54 líneas. Los documentos que ya tienen guía relacionada se excluyen del selector y se rechazan en el guardado. Producción requiere su propia homologación revisada.

## Listado operativo inicial

`GET /backendDocker/guias-electronicas` usa exclusivamente `integracion.vGuiaCabeceraOrigen` y `integracion.vClienteGuiaOrigen`. Exige sesión Conex y uno de los programas `70/6/3` o `100/2/20`. La empresa proviene de la sesión; el navegador no envía un código de empresa. Entrega las columnas consolidadas para la tabla: número interno, folio legado, fecha, temporada, receptor, destino, cajas, tipo y estado originales. Los estados y tipos se muestran como «legado 0/1/5» hasta validar sus reglas GeneXus; la pantalla no los presenta como DTE emitidos.

El menú `wguiasd` resuelve ahora `/co/guias/electronicas` en todos los modos. Conex consulta su API protegida y pasa las filas al componente de listado de APERP mediante `postMessage` con origen comprobado; así se reutilizan la pantalla y el tema verde. La ruta de APERP `/erp/integrado/guias/conex-listado` es solo un visor: no lee bases, no acepta escrituras y no concede sesión APERP. En producción se debe configurar `VITE_APERP_GUIDES_URL` con su URL absoluta y permitir el encuadre desde el origen Conex aprobado.

La base APERP sigue siendo dueña de **nuevas** guías y borradores. Este primer listado muestra solo el histórico Conex; no une aún borradores APERP porque las empresas `EmpCod` y `GECODEMP` no tienen equivalencia confirmada en las bases locales. No hay generación electrónica, impresión ni modificación desde este listado. Antes de incorporar borradores centrales se requiere el mapa de empresas y una identidad de integración verificable para las operaciones de escritura.

Verificación local: 1.522 registros para la empresa Conex 1, cero para la empresa 2, y respuesta 401 del endpoint sin sesión. Se compiló el frontend Conex y el APERP compartido.

En desarrollo, el cliente Axios conserva el host usado para abrir Conex (`localhost` o `127.0.0.1`) al llamar al backend local. Esto evita que la cookie de sesión se envíe a un host distinto del de la pantalla. La URL de producción `VITE_API_URL` no cambia.

Estado al 7 de octubre de 2026: vistas de **solo lectura** creadas y verificadas en la base local `CONEX`. No hay emisión, permisos externos ni escritura desde APERP hacia Conex.

## Fuente y finalidad

El XPZ `GXW.xpz` contiene `GuiasD`, `GuiasE`, `GuiasDFruta` y la generación `PImp_GuiaXML`. En SQL local se comprobaron `dbo.GUIASD`, `dbo.GUIASD1`, `dbo.PACKLIST` y `dbo.CLIENTES`. `EmpCod + TempCod + GuiNumInt` identifica la cabecera de guía; `Gui1Corr` distingue la línea. En packing, la cabecera usa `EmpCod + TempCod + PackNumI`.

El documento y la aplicación de guías estarán en APERP. Las vistas en Conex exponen claves y datos fuente estables para que el adaptador APERP prepare o consulte guías sin cambiar nombres GX ni escribir en las tablas de Conex. Los códigos `EmpCod` de ambos sistemas requieren una equivalencia explícita con la empresa emisora autorizada.

## Vistas verificadas

Script: [`20261007_guias_origen_vistas.sql`](../../database/20261007_guias_origen_vistas.sql).

| Vista Conex | Fuente | Filas locales verificadas | Uso |
|---|---|---:|---|
| `integracion.vGuiaCabeceraOrigen` | `GUIASD` | 1.522 | Cabeceras históricas, origen y temporada |
| `integracion.vGuiaDetalleOrigen` | `GUIASD1` | 3.803 | Líneas históricas por correlativo |
| `integracion.vPackingCabeceraOrigen` | `PACKLIST` | 293 | Selección preliminar de packing |
| `integracion.vClienteGuiaOrigen` | `CLIENTES` | 110 | Identidad y domicilio de receptor |

Las vistas no contienen filtro de empresa; el servicio APERP deberá aplicar la empresa y temporada autorizadas en cada consulta. Antes de conceder acceso a otro principal SQL se definirá el permiso mínimo sobre estas vistas. No se concedieron permisos nuevos en el script.

La verificación de claves compuestas no encontró duplicados de cabecera, línea ni packing en la copia local. La base `BDAPERP` del mismo SQL Server leyó `CONEX.integracion.vGuiaCabeceraOrigen` y obtuvo 1.522 filas. Esto demuestra la ruta local entre bases, pero no establece que las instalaciones de producción compartan instancia ni que el principal de producción tenga permiso.

## Brechas por resolver

- No se encontró una tabla física `PACKLIST1` ni otra tabla cuyo nombre contenga `PACK` aparte de `PACKLIST` en esta base. **No se ha identificado el detalle de packing.** La vista de cabecera no sirve para construir líneas de exportación. Trazar las consultas/procedimientos GX y datos reales antes de conectar ese selector.
- Las cantidades `Gui1Cant` y `Gui1Cajas` representan unidades distintas según el caso. La vista conserva ambas sin escoger una. El adaptador deberá aplicar la regla por tipo y validar unidad y precio.
- El destino físico, emisor legal y maestro de variedades requieren más trazado; no inferirlos de `GuiHasta`, `GuiEmisor` o `Especod` sin comprobar semántica y datos.
- `GUIASD` histórico no es dueño de escritura de las guías nuevas. Su relación con el documento central se registrará mediante clave completa de origen.
- La disponibilidad de packing y stock no se deduce con seguridad de estas vistas. La confirmación necesita un servicio de origen con concurrencia e idempotencia.

## Vista previa desde el menú Conex

El frontend Conex resuelve el `ProgNomGX` existente `wguiasd` a `/co/guias/aperp-preview` únicamente en desarrollo. El menú sigue viniendo de la autorización del backend; la página vuelve a comprobar los códigos de programa `70/6/3` o `100/2/20` presentes en la sesión. En la copia local se recorrió `Control Bodega > Movimientos de bodega > Guías de Despacho` y se vio el frontend APERP dentro del layout Conex. La pantalla APERP inicia en contexto Conex mediante `origin=CONEX` y utiliza solo datos ficticios.

La entrada abre ahora un listado con filtros por fecha, estado y tipo, contadores y columnas consolidadas desde los XPZ de APERP y Conex. «Nueva guía» abre el formulario de ejemplo y este permite volver al listado. En el encuadre Conex solo aparecen filas ficticias de origen Conex; la vista APERP directa muestra ambos orígenes. Los estados, folios y cantidades del listado no proceden aún de las vistas SQL ni equivalen a documentos emitidos. El mapeo de columnas y los límites están en `APERP/backendAperpBodega/docs/migration/guias-listado-prototipo.md`.

Este encuadre de desarrollo no es SSO. La ruta embebida de APERP no acepta operaciones reales ni autenticación, y el menú de producción no expone todavía este enlace. La integración definitiva deberá autorizar cada petición en APERP con usuario, empresa emisora y programa, sin confiar en el parámetro de origen del navegador.

La presentación desde Conex usa el encabezado «Guías de Despacho» y la paleta verde de Conex. El parámetro `embedded=1` oculta el título duplicado del contenido APERP y aplica sus tokens verdes solo dentro de esa vista. La ruta APERP directa mantiene su tema azul.

El contexto de origen de la vista previa se fija al entrar por la ruta Conex; no hay selector manual en la pantalla. Conex inicia temporada ficticia `2026-2027` y Comercial fruta, mientras APERP directo inicia el año de emisión y Bodega. El servidor deberá validar esta procedencia en la implementación real.

Por ajuste visual, se retiraron los mensajes informativos iniciales del contenedor Conex y del formulario APERP. Al ingresar se ve el listado; al crear una guía aparecen cabecera y detalle. Los avisos de respuesta a acciones siguen presentes.

## Verificación reproducible

En un ambiente autorizado con SQL Server 2016 SP1 o posterior:

```text
node scripts/run-sql-file.js database/20261007_guias_origen_vistas.sql CONEX
```

El script valida base y tablas, crea o actualiza vistas y muestra sus conteos. Se ejecutó en la copia local sin modificar filas de negocio. La revisión de consultas desde APERP fue de solo lectura. No marcar `GuiasD`, `GuiasE` ni `PImp_GuiaXML` como migrados por este avance.

# Vistas de origen Conex para el módulo de guías APERP

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

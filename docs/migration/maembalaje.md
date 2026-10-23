# MAEmbalaje

## Alcance

Se creó únicamente la estructura SQL del maestro `MAEmbalaje`, a solicitud
del negocio. No se agregan pantalla, rutas, API, programa de Seguridad ni datos
iniciales.

## Estructura

| Campo | Tipo | Regla |
|---|---|---|
| `EmpCod` | `smallint` | Empresa; forma parte de la clave |
| `EmbCod` | `smallint` | Código del embalaje; forma parte de la clave |
| `EmbDes` | `varchar(20)` | Descripción obligatoria |

La clave primaria es `(EmpCod, EmbCod)`, siguiendo el patrón de los maestros
multiempresa existentes. La longitud de `EmbDes` se dejó en 20 caracteres,
alineada con las descripciones de envases del modelo físico vigente; debe
confirmarse contra la definición GX8 si posteriormente se construye el CRUD.

La migración repetible está en
`database/20261022_maembalaje_2016.sql`.

La migración se ejecutó y se verificó en la base local `CONEX`; la segunda
ejecución terminó correctamente sin duplicar la tabla.

## Maestros relacionados

Las tablas locales `Fam`, `Gru` y `MaeArt` fueron retiradas del diseño local:
sus valores deben provenir de APERP. La migración
`database/20261022_vistas_maestros_aperp_2016.sql` las reemplaza por vistas de
solo lectura en `CONEX` que consultan `[BDAPERP].[dbo]`. En `Fam` y `MaeArt`
se expone `GECODEMP` como `EmpCod`; en copias antiguas de APERP donde `Gru` no
contiene empresa, `EmpCod` queda en `NULL` porque ese catálogo es global.

La base `BDAPERP` ya está disponible en la misma instancia que `CONEX`. La
migración se ejecutó correctamente y se verificó que los tres objetos son
vistas; devolvieron 0 filas en `Fam`, 0 en `Gru` y 2 en `MaeArt`. La segunda
ejecución también terminó correctamente.

Al ser vistas de origen externo, SQL Server no permite declarar claves foráneas
desde `EmbvsMat` hacia estos tres objetos. La existencia de familia, grupo y
artículo deberá validarse mediante consultas de lectura y reglas del backend.

La tabla `EmbvsMat` fue creada con la migración
`database/20261023_embvsmat_2016.sql`. Su clave es
`(EmpCod, EmbCod, FamFam, GruGru, ArtNum)` y `EmbMatCant` es
`decimal(12,5)`. Se agregó FK únicamente hacia `MAEmbalaje`; las vistas de
APERP no admiten claves foráneas en SQL Server. No se agregaron pantallas ni
API.

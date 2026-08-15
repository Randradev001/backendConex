# Maestros Condiciones, Origenes y Destinos

Fecha de revision: 2026-07-30

Estado: implementado, migracion SQL aplicada y CRUD verificado.

Implementacion principal:

- backend: `src/controllers/maestrosController.js` y
  `src/Router/maestros.routes.js`;
- frontend: `src/pages/maestros/gxMaestrosConfig.js`,
  `src/pages/maestros/gxMaestroCrud.jsx` y `src/api/maestrosApi.js`;
- menu: `src/menu-items/authorizedMenu.jsx`;
- SQL: `database/20260730_maestros_condiciones_origenes_destinos.sql`.

## Alcance GX8

| Objeto GX8 | Tabla | Clave | Empresa | Programa |
|---|---|---|---|---|
| Condicion | `CONDICION` | `ConCod` | Global | 100 / 1 / 7 |
| Origen | `ORIGEN` | `EmpCod`, `OriCod` | Sesion | 100 / 1 / 8 |
| Destinos | `DESTINOS` | `DestCod` | Global | 100 / 1 / 11 |

Los tres objetos son Transactions de un solo nivel. No se crean tablas hijas
ni pantallas de detalle. `EmpNom` en Origen es un atributo inferido y no una
columna fisica de `ORIGEN`.

## Reglas conservadas

- Condicion conserva `ConCod`, `ConNom`, `ConNomC` y `ConEst`.
- Origen recibe `EmpCod` exclusivamente desde la sesion autenticada.
- `ConEst` y `OriEst` aceptan `1` Activo y `2` Bloqueado.
- Destinos exige `DestCod` distinto de cero y `DestNom`, como indican sus
  reglas GX8.
- `DestNMP` vuelve a `DESTINOS` como `char(30)` porque pertenece a la
  Transaction y al reporte GX8, pero falta en la base SQL actual.

No se detectaron procedimientos de negocio asociados. Los `parm` historicos
transportaban contexto de empresa, usuario y programa; React y Node lo reciben
ahora desde la sesion y el middleware de autorizacion.

## Listados y filtros

- Condiciones: codigo, nombre, nombre corto y estado.
- Origenes: codigo, nombre y estado dentro de la empresa autenticada.
- Destinos: codigo, nombre, codigo de origen y destino Multipuerto.
- Los tres usan busqueda general sobre todas sus columnas visibles.
- No se agregan filtros especificos porque no existen WorkPanels GX8 que los
  definan para estos objetos.
- Excel y PDF reutilizan la exportacion operativa comun de los maestros.

## Eliminacion

Antes de eliminar se comprueban relaciones GX8 que la base no declara como
llaves foraneas:

- Origen: `MOVFRUT` y `MOVFRUT1` por empresa y codigo de origen.
- Destinos: `DESORIGEN` y `PACKLIST` por codigo de destino.

## Comunas

Comunas se mantiene como catalogo de consulta y lupa. No se publica todavia
como CRUD porque el catalogo `PROGRAM` GX8 no contiene un programa que permita
autorizar su mantenimiento de manera equivalente.

## Evidencia

- XPZ `GXW.xpz`: estructuras y reglas de Condicion, Origen y Destinos.
- Inventario: claves simples para Condicion y Destinos; clave compuesta para
  Origen.
- SQL Server: tablas existentes con 2 condiciones, 3 origenes y 51 destinos
  antes de la migracion; `DestNMP` era la unica columna GX8 ausente.
- El script se ejecuto sobre `CONEX_MIGRACION` y confirmo `DestNMP` con largo
  30 sin alterar las cantidades existentes.
- Se verificaron alta, busqueda general, modificacion y eliminacion mediante el
  controller real para los tres maestros. La prueba confirmo que Origen ignora
  una empresa enviada por pantalla y usa `EmpCod=1` desde la sesion.
- Los registros temporales se eliminaron al finalizar la verificacion.

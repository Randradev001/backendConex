# Migracion de Clientes, Agentes y Consignatarios

## Alcance

Primera ola posterior a los maestros ya cerrados. Los tres objetos son transacciones GeneXus 8 de nivel 1 y dependen de la empresa autenticada (`EmpCod`). No contienen tablas de segundo nivel.

| Maestro | Transaccion / WorkPanel GX8 | Tabla | Clave | Programa de seguridad |
| --- | --- | --- | --- | --- |
| Clientes | `Clientes` / `wclientes` | `CLIENTES` | `EmpCod`, `CliCod` | 100 / 1 / 12 |
| Agentes | `Agentes` / `wagentes` | `AGENTES` | `EmpCod`, `AgeCod` | 100 / 1 / 13 |
| Consignatarios | `Consig` / `wconsig` | `CONSIG` | `EmpCod`, `ConsCod` | 100 / 1 / 14 |

Fuentes revisadas: `GXW.xpz`, inventario GX8, reglas de las transacciones, navegación de los WorkPanels y esquema físico de `CONEX_MIGRACION`.

## Reglas Conservadas

- La empresa siempre proviene de `req.context.empCod`; cualquier `EmpCod` enviado por la pantalla se ignora.
- Los códigos son obligatorios, mayores que cero e inmutables al actualizar.
- El nombre es obligatorio en los tres maestros.
- `Agentes` exige RUT y dígito verificador. En `Clientes` y `Consig` son opcionales, pero deben informarse juntos.
- El dígito se valida con el algoritmo módulo 11 del procedimiento `Verirut`, incluyendo `K` y `0`.
- Los límites numéricos conservan los dominios GX8: cliente Numeric(5), agente/consignatario Numeric(3), RUT Numeric(9) y código MP Numeric(5).
- `wclientes` filtra opcionalmente por `CliNom`; `wagentes` y `wconsig` no tienen filtros específicos y usan búsqueda general.
- Los listados conservan las columnas GX8. Los campos adicionales de Clientes y `AgecodMP` permanecen en visualizar/crear/editar.
- Excel y PDF exportan las mismas columnas visibles y respetan filtros y búsqueda activos.

## Integridad Al Eliminar

La base original no declara llaves foráneas para estas relaciones. Antes de eliminar se comprueba uso en las tablas físicas encontradas:

- Clientes: `CAP001`, `DESCLI_FP`, `DESPCAJS`, `FACTURA`, `GUIASD`, `GUIASD_Back`, `LISTPRECIOS`, `PACKLIST`.
- Agentes: `DESORIGEN`, `PACKLIST`.
- Consignatarios: `DESORIGEN`, `PACKLIST`.

Si existe uso, la API responde `409` y no elimina el registro.

## Decisiones De Migracion

- No se crean hooks con reglas de negocio. React sólo consume el controlador de maestros.
- No se cambia el nombre de tablas ni atributos físicos.
- El permiso se evalúa por programa, conforme al modelo actual de roles. No se migran niveles separados de crear/modificar/eliminar.
- Los registros históricos con código cero pueden listarse, pero las nuevas altas respetan la regla GX8 que exige código mayor que cero.

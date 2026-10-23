# Lista de Precios

## Alcance

El WorkPanel GX8 `Lprecio` lista y mantiene la Transaction `ListPrecios`,
descrita como `Lista de Precios` dentro de Factura. La primera etapa web publica
el listado operacional en `/facturacion/lista-precios`, protegido por el
programa histórico `100/9/10` (`wLPRECIO`).

La tabla propietaria es `LISTPRECIOS`. Su clave GX8 está compuesta por
`EmpCod + CliCod + Especod + Calibre + EnvCod + LSPFecD + LSPFecH + MonCod`.
`EmpCod` siempre proviene de la sesión autenticada. El listado resuelve los
nombres desde `CLIENTES`, `ESPECIES`, `ENVCAT` y `MONEDAS`; `CALIBRES` conserva
la relación de especie y calibre para la futura transacción.

Los límites del formulario conservan los atributos GX8: `CliCod` admite cinco
dígitos, `Especod` y `EnvCod` tres, `MonCod` dos y `Calibre` diez caracteres.
`LSPPrecioU` mantiene precisión total de 13 posiciones y ahora admite hasta
cuatro decimales, por lo que su máximo validado es `999999999.9999`.

## Comportamiento de la primera etapa

- El rango inicial conserva los últimos 30 días del WorkPanel GX8.
- Las fechas se aplican por solapamiento de vigencia: un precio se incluye
  cuando `LSPFecH >= Desde` y `LSPFecD <= Hasta`.
- Cada extremo puede limpiarse para formar un intervalo abierto.
- Cliente, especie, envase, moneda y búsqueda general se aplican en backend.
- Indicadores, grilla, diálogos de indicadores y exportaciones usan el mismo
  conjunto filtrado. Los indicadores muestran total, vigentes hoy, vigentes
  que vencen dentro de 30 días y vencidos.
- La pantalla no usa ni muestra temporada porque `LISTPRECIOS` no tiene
  `TempCod`.
- `CliCod=0` se presenta como `General`.
- `LSPIndTodos` se conserva como `Sí/No`; su efecto adicional de negocio queda
  pendiente de confirmar y no se inventa en React ni Node.
- Agregar, Visualizar y Modificar reutilizan un único formulario en `Dialog`.
  En modificación la clave compuesta queda bloqueada y solo cambian precio e
  indicador Todos.
- Anular reemplaza a Eliminar: conserva la fila, registra usuario y fecha, la
  muestra con estado Anulado y bloquea modificaciones posteriores.

Excel y PDF son las ayudas generales del listado: Excel continúa siendo HTML
con extensión `.xls` y PDF usa el diálogo de impresión del navegador. Ambos
recuperan el conjunto filtrado completo, no solo la página visible.

## Transacción y autorización

El backend valida cliente general o de empresa, especie, calibre perteneciente
a la especie, envase, moneda, precio positivo con hasta cuatro decimales, orden
de fechas y duplicidad de la clave completa. Las acciones vigentes de `PROGRAM1` son Crea 1, Modifica 2 y
Anula 3. Esta correspondencia prevalece sobre la inversión 2/3 observada en el
evento del XPZ, porque coincide con las asignaciones administradas actualmente.

La anulación usa las columnas aditivas `LSPAnulado`, `LSPLoginA` y `LSPFecA`.
Creación y modificación registran sus propios usuario y fecha. No se cambia la
clave GX8 ni se elimina información histórica.

## Base de datos y compatibilidad

La base verificada contiene la estructura GX8 completa y 20 registros de la
empresa 1. Los instaladores de 2026-08-15 tenían una definición auxiliar de
solo tres columnas. `database/20261022_lista_precios_compatibilidad_2016.sql`
completa instalaciones parciales sin borrar datos y agrega el índice de empresa
y vigencia. Los instaladores base también quedaron corregidos para instalaciones
nuevas.

## Evidencia 2026-10-22

- Consulta real sin rango: 20 registros; 20 vencidos y ninguno vigente.
- Solapamiento 15/11/2017 a 20/11/2017: 9 registros.
- Intervalo abierto desde 15/11/2017: 9 registros.
- Intervalo abierto hasta 25/11/2013: 11 registros.
- Seis pruebas unitarias validan rango inicial, intervalos abiertos, rango
  invertido, estados, normalización de la transacción y sus validaciones.
- Una prueba CRUD real agregó, modificó y anuló un precio temporal, verificó
  precio, estado y usuario de anulación, y eliminó exclusivamente ese registro
  de prueba al finalizar.
- El lint dirigido del frontend terminó sin errores.

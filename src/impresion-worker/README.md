# Worker de impresión CONEX

Proceso Node.js independiente del servidor HTTP. Lee `OrdenImpresion`, reproduce
el flujo histórico de `ImprimeETBD`, y también consume `OrdenImpresionFolio`, que
recibe ZPL ya generado por `Ventana de Impresión`. Ambos flujos envían a la IP
configurada.

## Compatibilidad GX8

Aunque el atributo `OPLCIMP` se titula Impresora, `OrdImprePLC` lo entregaba a
`ImprimeETBD` como `LinID`. El worker conserva esa conducta. Cada línea tiene
una fila `ConfImpresoras` cuyo `CIMPID` coincide con `LinID`; dos líneas pueden
tener la misma IP.

Estados: `0` pendiente, `1` impresa, `2` línea inactiva, `3` error previo al
envío, `4` resultado incierto y `9` tomada por el worker. Los estados 3, 4 y 9
no se reintentan automáticamente para evitar duplicados.

## Activación

Aplicar primero `database/20260909_impresion_worker_2016.sql` y
`database/20260930_ventana_impresion_2016.sql`, cargar las impresoras y validar
las etiquetas vigentes. El worker está deshabilitado por defecto:

```text
PRINT_WORKER_ENABLED=true
PRINT_EMP_COD=1
PRINT_POLL_MS=750
PRINT_PORT=9100
PRINT_TIMEOUT_MS=5000
```

Iniciar con `npm run start:printer`. No debe habilitarse mientras el trigger
histórico `Imprime` siga ejecutando el programa antiguo.

## Pruebas desde React

El router autenticado `/backendDocker/impresion` permite listar impresoras,
enviar una versión con datos de muestra desde el diseñador y crear una orden
pendiente desde el modal de una línea. La prueba del diseñador es directa; la
simulación de línea requiere el worker activo para completar la impresión.

La misma área de Control de líneas incluye el CRUD de `ConfImpresoras`. Cada
registro asigna nombre e IPv4 a un `LinID`; líneas diferentes pueden compartir
nombre e IP. Las escrituras usan el permiso `100/6/11` y la empresa autenticada.

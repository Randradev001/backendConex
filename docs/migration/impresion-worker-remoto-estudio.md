# Estudio: agente local de impresión conectado al backend web

Estado de implementación (2026-10-05): el cargador acepta perfiles aislados
mediante `CONEX_ENV_FILE`; existen plantillas separadas para backend y worker y
un diagnóstico que no expone secretos. La cola se fija en
`PRINT_QUEUE_SOURCE=database` porque el PLC inserta en `OrdenImpresion` local.
`PRINT_CONTEXT_SOURCE=database|api` selecciona dónde se resuelven los datos de
la etiqueta. `database` conserva el funcionamiento integrado y `api` ejecuta el
flujo distribuido solicitado.

La API `/backendDocker/print-agent/v1` autentica un agente por token, agente e
instalación; prepara una sola vez cada `installationId + localJobId`, reserva
`ETILIN`, genera el ZPL central y persiste su SHA-256. El worker valida el hash,
guarda primero ZPL y metadatos mediante renombre atómico en el spool, entrega a
la Zebra local y reporta `printed`, `failed_before_send` o `uncertain`. La
migración `database/20261005_print_agent_remoto_2016.sql` fue aplicada y
verificada en `CONEX_MIGRACION`. Falta desplegar código, migración y secretos en
el servidor web, además de ejecutar la prueba física controlada.

La verificación local aprobó las 103 pruebas backend. La migración se ejecutó
dos veces sobre `CONEX_MIGRACION` para comprobar repetibilidad; dejó una tabla,
un índice único de idempotencia y cero preparaciones de prueba, sin consumir
`ETILIN` ni imprimir.

## Objetivo

Desplegar CONEX con el frontend, API y SQL Server en un servidor web, mientras
la impresión física permanece dentro de la red de la planta. Un proceso local
debe leer los trabajos que el PLC inserta en `OrdenImpresion` local, resolver sus
datos desde SQL local o desde la API pública, enviarlos a las impresoras Zebra
de la LAN y confirmar el resultado en la cola local.

El proceso local no es completamente offline: puede seguir ejecutándose sin
exponer servicios hacia Internet, pero necesita conectividad saliente HTTPS al
backend para recibir trabajos y confirmar resultados. Una interrupción temporal
de Internet debe detener la toma de nuevos trabajos y conservar de forma segura
el trabajo que ya fue descargado.

## Estado actual

El worker vigente (`src/impresion-worker/`) está acoplado a la base de datos:

1. consulta y reclama directamente `OrdenImpresion`;
2. consulta línea, orden activa, productor, catálogos, etiqueta e impresora;
3. incrementa directamente el correlativo `GenCor.ETILIN`;
4. genera y guarda el ZPL en SQL Server;
5. abre TCP hacia la impresora configurada;
6. actualiza directamente el estado de la orden.

Esto funciona cuando worker, SQL Server e impresoras tienen conectividad entre
sí. No funciona con un backend en Internet y las Zebra dentro de una red local,
salvo que se exponga SQL Server o se cree una VPN. Exponer SQL Server no es una
opción aceptable para este flujo.

La ruta HTTP actual `/backendDocker/impresion/pruebas/etiqueta` también imprime
directamente desde el proceso web. En producción remota deberá crear un trabajo
para el agente local; el servidor web no podrá abrir TCP hacia una IP privada de
la planta.

## Arquitectura propuesta

```text
Usuario React
    |
    | HTTPS + sesión CONEX
    v
Backend web ---------------- SQL Server central
    ^
    | HTTPS: resolver contexto y generar ZPL
    |
Worker local ---- SQL Server local <---- PLC
    |               OrdenImpresion
    |
    | TCP 9100 dentro de la LAN
    v
Impresoras Zebra
```

## Dos modos de despliegue con el mismo código

Se debe conservar el funcionamiento actual como modo integrado y agregar el
modo distribuido para producción. La selección debe ser explícita mediante
variables de entorno; no debe inferirse solamente desde `NODE_ENV`.

### Modo integrado

Adecuado para desarrollo, pruebas y una instalación donde API, SQL Server,
worker e impresoras comparten red:

```text
Frontend + Backend + SQL Server + Worker -> Zebra
```

El worker usa el repositorio SQL actual y abre TCP directamente a la impresora.
Esto permite conservar `npm run start:printer` y el comportamiento que ya está
validado.

Configuración propuesta:

```dotenv
PRINT_DEPLOYMENT_MODE=integrated
PRINT_QUEUE_SOURCE=database
PRINT_CONTEXT_SOURCE=database
PRINT_DELIVERY_MODE=direct
PRINT_WORKER_ENABLED=true
PRINT_EMP_COD=1
PRINT_PORT=9100
```

### Modo web de producción

El servidor web contiene frontend, API y SQL Server. Prepara la cola, pero no
intenta alcanzar impresoras privadas:

```dotenv
PRINT_DEPLOYMENT_MODE=web
PRINT_DELIVERY_MODE=remote-agent
PRINT_AGENT_API_ENABLED=true
PRINT_WORKER_ENABLED=false
```

En este perfil ningún proceso del servidor web abre TCP hacia una Zebra. La
simulación web debe convertirse en una solicitud que el worker local pueda
incorporar a `OrdenImpresion`; los insert reales continúan llegando directamente
desde el PLC a esa tabla local.

### Modo agente local

El equipo de planta configura acceso solamente al SQL Server local de la cola.
Lee `OrdenImpresion`, consulta el contexto en la API web y entrega el ZPL en la
red local:

```dotenv
PRINT_DEPLOYMENT_MODE=agent
PRINT_QUEUE_SOURCE=database
PRINT_CONTEXT_SOURCE=api
DB_SERVER=localhost
DB_DATABASE=CONEX
DB_USER=...
DB_PASSWORD=...
PRINT_API_URL=https://api.ejemplo.cl/backendDocker/print-agent/v1
PRINT_AGENT_ID=packing-principal-01
PRINT_AGENT_TOKEN=<secreto-individual>
PRINT_LOCAL_SPOOL=C:\ProgramData\ConexPrintAgent\spool
PRINT_PORT=9100
```

### Adaptadores necesarios

La lógica común de procesamiento debe depender de contratos, no de SQL o HTTP
directamente:

```text
LocalPrintQueue
  `- SqlOrdenImpresionQueue  ambos modos; recibe insert del PLC

PrintContextSource
  |- SqlPrintContextSource   modo integrado
  `- ApiPrintContextSource   sistema web + worker local

PrintDelivery
  `- ZebraTcpDelivery        ambos modos que imprimen físicamente

WebPrintDispatcher
  |- DirectPrintDispatcher   modo integrado
  `- AgentQueueDispatcher    servidor web de producción
```

`impresion.service.js`, el generador ZPL, el código de caja y el cliente TCP
pueden reutilizarse. El arranque selecciona las implementaciones según el perfil
y debe rechazar combinaciones incompatibles, por ejemplo `web + direct` en un
servidor marcado como producción distribuida.

### Archivos de configuración

No se deben versionar secretos. El repositorio puede incluir plantillas:

- `.env.integrated.example`: entorno actual completo;
- `.env.production-web.example`: backend público y API de preparación;
- `.env.print-agent.example`: agente local con SQL de cola y contexto web.

El despliegue real usa secretos del servidor o archivos `.env` excluidos de
Git. Las tres plantillas deben compartir nombres consistentes y documentar qué
variables son obligatorias para cada perfil.

### Compatibilidad durante la transición

El modo integrado debe seguir pasando las pruebas actuales. Las nuevas pruebas
de contrato deben ejecutar el mismo escenario contra `SqlPrintContextSource` y
`ApiPrintContextSource`. Así se evita mantener dos implementaciones distintas
de las reglas de negocio.

Durante el corte puede habilitarse el contexto remoto por empresa o sede. La
cola `OrdenImpresion` y el proceso físico siguen siendo locales; una misma línea
debe tener un solo worker consumidor. La selección de contexto activa debe ser
única y auditable.

## Modo administrable desde un mantenedor

Los perfiles también pueden administrarse desde la aplicación. En ese diseño,
el `.env` conserva únicamente la configuración de arranque y los secretos; la
tabla define el comportamiento operativo vigente.

No se debe reutilizar `SISTEMAS`: esa tabla pertenece al menú y al modelo de
autorización. Tampoco conviene reutilizar `paramgen/paramge1`, cuyos valores y
largos no representan conexiones, agentes ni estados. Se recomienda una tabla
dedicada.

### Alcance de los modos

- `LOCAL`: backend, SQL Server, worker e impresoras comparten la red. El worker
  usa el repositorio SQL y entrega por TCP.
- `HIBRIDO`: backend y SQL Server están en el servidor web; un agente local
  obtiene trabajos por HTTPS y entrega a las Zebra. Es el modo recomendado para
  producción con impresoras en la planta.
- `WEB`: frontend, backend y SQL Server están en el servidor web. Solo puede
  imprimir si el destino es alcanzable desde ese servidor. No permite llegar a
  una Zebra con IP privada sin un agente o VPN.

### Configuración de arranque

La conexión a la base central no puede depender de una tabla dentro de esa
misma base: el backend necesita conectarse antes de poder consultar el modo. Por
eso deben permanecer fuera de la tabla:

```dotenv
DB_SERVER=...
DB_PORT=1433
DB_DATABASE=CONEX
DB_USER=...
DB_PASSWORD=...
```

En el agente local también deben permanecer como bootstrap:

```dotenv
PRINT_API_URL=https://api.ejemplo.cl/backendDocker/print-agent/v1
PRINT_AGENT_ID=packing-principal-01
PRINT_AGENT_TOKEN=<secreto>
```

La tabla puede administrar la URL pública que se entrega al usuario o a un
instalador, pero el agente necesita una URL y credencial local válida para
conectarse y leer cualquier cambio posterior.

### Tabla propuesta

Si la configuración es por empresa y sistema, la clave funcional es
`EmpCod + SistCod + ModoCod`. Si el despliegue será global, puede usarse una
empresa técnica `0`; no se debe aceptar `EmpCod` desde la pantalla para sustituir
la empresa autenticada.

```text
SISTEMAMODOOPERACION
- EmpCod                 smallint
- SistCod                smallint
- ModoCod                varchar(10)   LOCAL | HIBRIDO | WEB
- ModoNombre             varchar(40)
- Activo                 bit
- ApiUrl                 varchar(300)  nullable
- AgentId                varchar(80)   nullable
- SedeCod                varchar(30)   nullable
- PollMs                 int
- PrintPort              int
- TimeoutMs              int
- FechaModificacion      datetime
- LoginModificacion      varchar(40)
- RowVersion             rowversion
```

Claves y controles:

- PK: `EmpCod + SistCod + ModoCod`;
- FK de `EmpCod` a `DEFEMP` cuando no se use empresa técnica 0;
- FK de `SistCod` a `SISTEMAS`;
- `CHECK` para los tres códigos admitidos, puertos y tiempos;
- índice único filtrado por `EmpCod + SistCod WHERE Activo=1`, para impedir dos
  modos activos simultáneos;
- procedimiento transaccional de activación: desactiva el modo anterior y activa
  el seleccionado como una sola unidad;
- auditoría de usuario, fecha y valores anteriores.

El índice garantiza como máximo un activo. El servicio debe rechazar una
configuración sin activos y la activación debe ejecutarse mediante una sola
transacción para que siempre quede exactamente uno.

### Datos que no deben guardarse directamente

El mantenedor no debe mostrar ni persistir en texto visible:

- contraseña de SQL Server;
- token del agente;
- cookies o tokens de usuario;
- claves TLS.

Los tokens de agente se generan y rotan desde una acción separada. SQL Server
guarda solamente su hash. El valor completo se presenta una vez para instalarlo
en el equipo local.

### Mantenedor React

La pantalla puede mostrar las tres filas como tarjetas o tabla:

```text
Modo       Estado     Conectividad       Acción
LOCAL      Inactivo   SQL/impresora      Probar | Activar
HIBRIDO    Activo     API/agente online  Probar | Editar
WEB        Inactivo   Backend web        Probar | Activar
```

El formulario permite editar URL, sede, agente, polling, puerto y timeout. La
empresa viene de la sesión. Para activar debe:

1. guardar la configuración;
2. ejecutar una prueba sin imprimir;
3. advertir si hay trabajos tomados o inciertos;
4. activar transaccionalmente el nuevo modo;
5. registrar el cambio en auditoría;
6. solicitar reinicio si el componente afectado no admite recarga segura.

### Lectura en ejecución

El backend carga el modo al arrancar y puede mantenerlo en caché durante un
intervalo corto. Al activar un modo, el servicio invalida esa caché. Los workers
y agentes consultan periódicamente una versión de configuración o la reciben en
la respuesta de heartbeat.

El cambio no debe interrumpir un trabajo ya tomado. Primero se drena o marca la
cola anterior, luego se habilita el consumidor nuevo. Un `RowVersion` evita que
dos administradores activen configuraciones basadas en datos obsoletos.

### Permisos

El mantenedor requiere un programa de Seguridad propio y permisos separados:

- ver configuración;
- modificar valores no secretos;
- probar conectividad;
- activar modo;
- rotar credencial de agente.

Activar un modo es una acción operativa sensible y debe quedar auditada. Ocultar
el botón en React no reemplaza la autorización del endpoint.

### Servidor web

Es la autoridad de los datos de negocio y de la preparación remota. Debe:

- autenticar al worker y limitarlo a su empresa/sede;
- resolver orden activa, línea, catálogos y versión de etiqueta;
- reservar el correlativo `ETILIN` una sola vez;
- generar y registrar el ZPL de forma idempotente para el identificador local;
- recibir confirmaciones, errores y latidos del agente;
- mostrar estado, agente, impresora, intentos y último contacto.

### Agente local

Debe ser un paquete pequeño independiente del backend. Contiene credenciales
solo para el SQL Server local donde escribe el PLC; no conoce las credenciales
del SQL central ni duplica reglas de negocio. Debe:

- autenticarse como dispositivo contra la API;
- reclamar atómicamente pendientes desde `OrdenImpresion` local;
- solicitar al backend web el contexto y ZPL usando `OPLCID` y `OPLCIMP`;
- guardar el ZPL en la fila local y en el spool antes de imprimir;
- validar que la impresora solicitada está permitida para ese agente;
- enviar exactamente el ZPL recibido a la IP local y puerto configurados;
- actualizar `OPLCProc` local y reportar éxito, error o entrega incierta;
- emitir heartbeat, versión del agente y estado de impresoras;
- reanudar después de un reinicio conservando el mismo ZPL para el mismo
  `OPLCID`.

La configuración local mínima sería:

```dotenv
PRINT_QUEUE_SOURCE=database
PRINT_CONTEXT_SOURCE=api
DB_SERVER=localhost
DB_DATABASE=CONEX
DB_USER=...
DB_PASSWORD=...
PRINT_API_URL=https://api.ejemplo.cl/backendDocker/print-agent/v1
PRINT_AGENT_ID=packing-principal-01
PRINT_AGENT_TOKEN=<secreto-individual>
PRINT_POLL_MS=2000
PRINT_LOCAL_SPOOL=C:\ProgramData\ConexPrintAgent\spool
```

Las direcciones IP de las impresoras pueden permanecer en el servidor como
metadatos, pero el agente debe aceptar únicamente direcciones privadas incluidas
en su lista autorizada. Para instalaciones con redes distintas conviene guardar
una sede y un identificador lógico de impresora, y mantener la IP efectiva en la
configuración local del agente.

## Contrato API inicial

Todas las rutas usan HTTPS y autenticación de agente, separada de las cookies de
usuario.

### `POST /agents/heartbeat`

Informa versión, host, empresa/sede, hora local, impresoras accesibles y último
error. El servidor actualiza `UltimoContacto`.

### `POST /jobs/prepare`

Recibe el trabajo ya reclamado en la cola local. El servidor resuelve el contexto
y prepara el ZPL de forma idempotente. La solicitud incluye como mínimo
`localJobId`, `lineId`, empresa, agente y un identificador de instalación. La
respuesta es:

```json
{
  "localJobId": 123,
  "preparationId": "valor-aleatorio",
  "printer": { "id": 1, "host": "192.168.10.50", "port": 9100 },
  "label": { "code": "POLCURA16", "version": 4 },
  "zpl": "^XA...^XZ",
  "sha256": "..."
}
```

Si la misma instalación repite `localJobId`, la API debe devolver el mismo
`preparationId`, correlativo y ZPL. No debe generar otra caja.

### `POST /jobs/:id/result`

Recibe `preparationId`, estado, hora, duración y detalle técnico. Estados:

- `printed`: el socket completó el envío;
- `failed_before_send`: no se abrió la conexión o el ZPL no se pudo almacenar;
- `uncertain`: hubo conexión o comenzó el envío, pero no existe certeza de que
  la Zebra procesó toda la etiqueta;
- `rejected_local`: impresora no autorizada o configuración local inválida.

El endpoint debe ser idempotente. Repetir la misma confirmación no puede
modificar correlativos ni generar otra impresión.

## Persistencia central

`OrdenImpresion` local continúa como cola operativa y fuente del estado físico.
El servidor central registra la preparación remota sin reemplazar esa tabla. Se
recomiendan tablas auxiliares:

- `PRINTAGENT`: agente, empresa, sede, estado, versión y último contacto;
- `PRINTAGENTCRED`: hash del token, fecha de creación, rotación y revocación;
- `PRINTAGENTPRINTER`: impresoras que puede usar cada agente;
- `PRINTJOBPREPARATION`: instalación, `localJobId`, agente, correlativo,
  checksum, ZPL, estado, tiempos y detalle técnico;
- `PRINTJOBEVENT`: auditoría inmutable de reclamo, preparación, entrega,
  confirmación, error y decisión manual.

El token del agente debe almacenarse como hash, igual que las sesiones de
usuario. La combinación instalación + `localJobId` debe ser única. Tanto la
preparación central como `OrdenImpresion.OPLCZpl` local conservan el ZPL exacto
para trazabilidad.

## Estados y recuperación

```text
OrdenImpresion local pendiente
   |
   v
tomada localmente (9) ---- reinicio antes de preparar ----> recuperar misma fila
   |
   +---- preparar una vez en web y guardar ZPL local
   |
   +---- error antes de conectar ----------------------> error controlado
   |
   +---- conexión iniciada y resultado dudoso ---------> incierto/manual
   |
   +---- envío completado -----------------------------> impreso
```

La preparación web debe ocurrir una sola vez por instalación + `OPLCID`. Una
repetición devuelve el mismo ZPL. Después de iniciar TCP no existe
garantía de impresión exactamente una vez con el protocolo RAW 9100: si la
conexión cae, la impresora pudo haber recibido la etiqueta. Ese caso debe quedar
`incierto` y exigir decisión humana; el reintento automático podría duplicar
una caja.

El spool local debe escribir primero un archivo temporal y renombrarlo de forma
atómica. Debe conservar al menos `localJobId`, `preparationId`, checksum, ZPL, destino
y fase local. Nunca debe registrar tokens ni ZPL completo en logs generales.

## Seguridad

- Solo conexión saliente desde la planta hacia HTTPS 443.
- El SQL Server local no se publica en Internet; el agente solo recibe una
  cuenta local limitada a la cola y tablas estrictamente necesarias.
- El agente no recibe credenciales del SQL Server central.
- Un token diferente por instalación, revocable y con rotación.
- El agente queda limitado a una empresa, sede e impresoras autorizadas.
- Rate limit específico para heartbeat, preparación y resultados.
- Comparación de checksum antes de enviar el ZPL.
- Logs sin claves, cookies, datos sensibles ni ZPL completo.
- El backend rechaza URLs o destinos aportados libremente por el agente.
- La API registra IP pública observada, versión y último contacto para soporte,
  sin usar la IP como autenticación.
- Para una segunda etapa puede agregarse certificado de cliente (mTLS), pero no
  es necesario para la primera versión si se usa HTTPS, tokens robustos y
  rotación.

## Servicio local

En Windows se recomienda empaquetar el agente y ejecutarlo como servicio con
reinicio automático. Puede usarse WinSW o NSSM para la primera instalación; el
proceso Node debe manejar `SIGTERM`, escribir logs rotativos y exponer un
comando local de diagnóstico. No debe abrir un servidor público.

El instalador debe incluir:

1. Node/runtime o ejecutable empaquetado;
2. archivos del agente;
3. directorio de spool con permisos restringidos;
4. configuración sin credenciales en texto dentro del repositorio;
5. registro del servicio;
6. prueba de HTTPS al backend;
7. prueba TCP controlada a cada Zebra;
8. mecanismo documentado de actualización y rollback.

## Cambios necesarios en el código actual

1. Separar la cola local, la preparación del contexto y la entrega física. La
   preparación puede ser SQL local o backend web; `printerClient.sendZpl`
   permanece en el worker local.
2. Dividir `createImpresionRepository()` en `SqlOrdenImpresionQueue`,
   `SqlPrintContextSource` y `ApiPrintContextSource`.
3. Crear middleware de autenticación para dispositivos, independiente de
   `authContext` y de las cookies React.
4. Crear endpoints de heartbeat, prepare y result.
5. Cambiar `printLabelTest` para crear una simulación que el worker incorpore a
   la cola local, en vez de abrir TCP desde el backend web.
6. Mantener el estado `UNCERTAIN` y agregar una pantalla de resolución manual.
7. Recuperar de manera controlada trabajos antiguos en estado 9. Actualmente no
   registran una fase recuperable y pueden quedar bloqueados para siempre.
8. Incorporar instalación, `EmpCod` y sede de forma inequívoca en la preparación
   central. La cola GX8 local no contiene `EmpCod` y depende de `PRINT_EMP_COD`.
9. Deshabilitar el trigger histórico `Imprime` antes de activar el nuevo flujo.

## Etapas recomendadas

### Etapa 1: simulación sin impresora

- Crear tablas y API del agente.
- Implementar autenticación, heartbeat e idempotencia por `localJobId`.
- Usar un adaptador local que guarde el ZPL sin enviarlo.
- Comprobar desconexión, reinicio, recuperación de estado 9 y confirmaciones repetidas.

### Etapa 2: Zebra de prueba

- Instalar un agente en un equipo local.
- Autorizar una sola impresora y una etiqueta no productiva.
- Verificar checksum, spool, TCP 9100 y estados inciertos.
- Mantener deshabilitado el trigger histórico.

### Etapa 3: paralelo controlado

- Habilitar una línea en una ventana acordada.
- Medir latencia, pérdidas de Internet, duplicados y recuperación.
- Validar correlativo y código impreso contra `CAP001` y la orden activa.

### Etapa 4: producción

- Instalar el servicio con reinicio automático.
- Configurar alertas por agente sin heartbeat, cola acumulada y estado incierto.
- Documentar rotación de token, reemplazo del equipo y recuperación del spool.
- Habilitar gradualmente las demás líneas.

## Criterios de aceptación

1. Ningún puerto de la planta queda publicado hacia Internet.
2. El agente conoce solo la base local de `OrdenImpresion` y nunca credenciales
   del SQL Server central.
3. Un `OPLCID` conserva el mismo correlativo y ZPL tras reiniciar.
4. Repetir `prepare` o `result` es idempotente.
5. Una caída antes de abrir TCP permite reintento seguro.
6. Una caída después de abrir TCP queda en estado incierto y no se reimprime
   automáticamente.
7. El agente solo imprime trabajos de su empresa, sede e impresoras permitidas.
8. La aplicación muestra último heartbeat, versión, cola, errores y estados
   inciertos.
9. La simulación del diseñador llega al mismo flujo local que atiende los insert
   reales del PLC.
10. El trigger histórico queda deshabilitado y existe un rollback documentado.

## Decisión recomendada

Implementar un worker que conserva `OrdenImpresion` local y consulta por HTTPS
solo la preparación es la opción preferida. Respeta el insert del PLC y evita
publicar el SQL local o entregar credenciales del SQL central. La API de
preparación concentra reglas, auditoría, compatibilidad e idempotencia sin
reemplazar la cola industrial existente.

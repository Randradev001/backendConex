# Despliegue del agente local de impresión

## Flujo

```text
PLC -> OrdenImpresion local -> worker local -> backend web -> ZPL
                                      |
                                      `-> spool local -> Zebra TCP 9100
```

El backend web resuelve los datos de negocio y genera el ZPL. El worker es el
único proceso que lee la cola del PLC y se conecta a la impresora.

## Servidor web

1. Publicar el código backend que contiene `src/print-agent/`.
2. Aplicar `database/20261005_print_agent_remoto_2016.sql` en `CONEX`.
3. Generar un token con `npm run print:token`. No reutilizar la contraseña SQL.
4. Agregar al `.env` existente:

```dotenv
PRINT_WORKER_ENABLED=false
PRINT_AGENT_API_ENABLED=true
PRINT_AGENT_ID=packing-principal-01
PRINT_INSTALLATION_ID=planta-principal-01
PRINT_AGENT_EMP_COD=1
PRINT_AGENT_TOKEN=<token-generado>
PRINT_PORT=9100
PRINT_TIMEOUT_MS=5000
```

5. Reiniciar el servicio `ConexBackend`.
6. Confirmar que `POST /backendDocker/print-agent/v1/heartbeat` responde 200 al
   enviar el token y ambos identificadores.

El backend web no debe ejecutar `npm run start:printer` ni tener acceso de red a
las Zebra.

## Equipo local de la planta

Copiar `.env.print-worker.example` como `.env.print-worker`. La conexión SQL es
la base local donde el PLC inserta `OrdenImpresion`; no son las credenciales del
SQL central.

Mientras el backend solo esté disponible mediante la IP HTTP indicada, usar:

```dotenv
PRINT_API_URL=http://190.3.171.48:3000/backendDocker/print-agent/v1
PRINT_API_ALLOW_INSECURE_HTTP=true
```

Esta excepción transmite el token sin TLS y debe ser transitoria. La
configuración productiva debe publicar la misma ruta mediante HTTPS y dejar
`PRINT_API_ALLOW_INSECURE_HTTP=false`.

El agente debe repetir exactamente los valores del servidor para:

```dotenv
PRINT_AGENT_ID=packing-principal-01
PRINT_INSTALLATION_ID=planta-principal-01
PRINT_AGENT_TOKEN=<mismo-token-generado>
```

Validar sin tomar trabajos:

```powershell
$env:CONEX_ENV_FILE='.env.print-worker'
npm run print:config:check
```

Antes de iniciar, comprobar que el trigger histórico `Imprime` está
deshabilitado. Luego iniciar con `npm run start:printer:profile` o actualizar el
servicio Windows del agente para ejecutar ese comando.

## Puesta en marcha controlada

1. Mantener la cola sin trabajos productivos.
2. Probar el heartbeat.
3. Insertar una sola orden controlada para una línea activa.
4. Confirmar el mismo `OPLCID` en el spool y en `PRINTJOBPREPARATION`.
5. Confirmar `OPLCProc=1` solo después de la entrega TCP.
6. Ante estado `4`, no reimprimir automáticamente: el envío pudo llegar a la
   Zebra antes del corte.

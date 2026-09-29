# Worker silencioso de impresión de etiquetas

## Alcance

Se implementa un proceso Node.js separado del servidor HTTP y contenido por
completo en `src/impresion-worker/`. Su responsabilidad es tomar solicitudes
del PLC desde `OrdenImpresion`, resolver la configuración productiva vigente,
generar ZPL con el core del diseñador y enviarlo por TCP a la impresora.

El proceso queda deshabilitado por defecto. No se considera productivo hasta
aplicar la migración, cargar `ConfImpresoras`, probar una Zebra real y retirar
controladamente el trigger SQL histórico.

## Evidencia GeneXus adicional

Fuente: `C:\paso\Export_Coneximprime.xpz`, exportada el 2026-09-08.

- `OrdImprePLC` recorre órdenes con `OPLCProc=0` y llama
  `ImprimeETBD(OPLCIMP, OPLCID, TempCod)`.
- `ImprimeETBD` recibe el primer parámetro como `LinID`, asigna
  `LinMaquina=LinID`, exige línea activa y orden de proceso activa.
- La configuración se obtiene desde la línea y la etiqueta parte de
  `ORDPROC.OrdpCodEti`; `ETIXCAL.ConfCod` la reemplaza cuando existe una regla
  para el calibre configurado.
- El código histórico concatena correlativo `ETILIN`, envase, categoría,
  código de calibre, máquina, línea y persona con anchos fijos.
- `traeImpresora` busca `ConfImpresoras` con `CIMPID=LinID` y devuelve el
  nombre. Por compatibilidad, el worker conserva una fila de configuración por
  línea; líneas distintas pueden compartir la misma IP.
- `ActuOrdenPLC` marca 1 al completar y 2 cuando la línea no está activa.
- La Transaction exportada incluye `OPLCFechaIns` y declara `OPLCID` como
  autonumerado. La base observada no contiene esa columna y no expone
  `OPLCID` como `IDENTITY`; esta diferencia requiere validación con la base a
  la que escribe el PLC.

## Flujo implementado

1. Reclama atómicamente la orden pendiente más antigua y la marca con estado 9.
2. Interpreta `OPLCIMP` como `LinID`, conforme al código GX exportado.
3. Obtiene `LINEAS`, `LINCONFIG.ConfID=1`, temporada y orden activas.
4. Resuelve la etiqueta por `ETIXCAL` y luego por `ORDPROC`.
5. Carga la versión activa desde `ETIQUETA/ETIQUETAVERSION`.
6. Incrementa `GenCor.ETILIN`, construye el código y genera el ZPL con variables.
7. Conserva una copia del ZPL, etiqueta y versión en la orden.
8. Envía UTF-8 por TCP a `CIMPIP`, puerto 9100 por defecto.
9. Solo después del envío actualiza `OPLCProc=1` y `OPLCFecha=GETDATE()`.

Los estados 3, 4 y 9 no se toman automáticamente. El 4 representa un resultado
incierto después de iniciar la entrega; no reintentarlo evita duplicados cuando
la impresora pudo recibir el ZPL antes de cortarse la conexión.

## Archivos

- `src/impresion-worker/`: worker, repositorio SQL, servicio, código de caja y
  cliente TCP.
- `database/20260909_impresion_worker_2016.sql`: columnas operacionales e índice
  de pendientes, compatible con SQL Server 2016.
- `test/impresionWorker.test.js`: composición histórica, orden de confirmación,
  entrega incierta y línea inactiva.

## Pendientes de puesta en marcha

1. Confirmar el `INSERT` real del PLC y el autonumerado en su base efectiva.
2. La migración SQL fue aplicada en `CONEX_MIGRACION` el 2026-09-09.
3. Cargar una fila de `ConfImpresoras` por línea con IP compartida cuando
   corresponda.
4. Confirmar una única temporada y orden activas, y etiquetas vigentes para los
   códigos utilizados por `ORDPROC/ETIXCAL`.
5. Probar primero una orden controlada en una Zebra fuera de producción.
6. Deshabilitar el trigger `Imprime`, que usa `xp_cmdshell` y apunta al ejecutable
   inexistente `AIMPRIMEETBD.EXE`, antes de habilitar el worker.
7. Instalar `npm run start:printer` como servicio de Windows con reinicio
   automático y `PRINT_WORKER_ENABLED=true`.

## Pruebas manuales desde la aplicación

- El diseñador versionado ofrece `Imprimir prueba`. Solicita una fila de
  `ConfImpresoras`, genera el diseño abierto con valores de muestra y lo envía
  directamente mediante el cliente TCP. Requiere permiso `110/1/1`.
- El modal de edición de línea ofrece `Simular impresión`. Se deshabilita si
  existen cambios sin guardar e inserta una orden pendiente equivalente a la
  botonera. Requiere permiso `100/6/11`, la migración aplicada y el worker.
- La API rechaza la simulación mientras el trigger histórico `Imprime` esté
  habilitado, evitando que una prueba ejecute simultáneamente el flujo antiguo.
- La empresa procede de la sesión. La simulación rechaza empresas distintas de
  `PRINT_EMP_COD` porque la cola histórica no almacena `EmpCod`.

## Evidencia de verificación

- La consulta SQL de resolución compiló contra `CONEX_MIGRACION` y terminó en
  la validación de negocio esperada: no existe una orden activa actualmente.
- La migración se ejecutó y confirmó `OPLCFechaIns` y `OPLCZpl`. Conservó las
  diez órdenes históricas pendientes y completó su fecha de inserción sin
  procesarlas. `ConfImpresoras` continúa sin filas con IP y el trigger
  `Imprime` continúa habilitado.
- La suite completa aprobó 69 pruebas, incluidas cinco del worker.
- El frontend compiló 5.828 módulos con ambos botones.
- Todos los archivos JavaScript nuevos aprobaron `node --check`.
- ESLint dirigido no pudo ejecutarse porque el backend no tiene una instalación
  ni configuración local de ESLint; `npx` obtuvo ESLint 10, que requiere
  `eslint.config.*`.

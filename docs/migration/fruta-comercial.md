# Fruta Comercial

## Fuente y alcance

La pantalla se reconstruyó desde `C:\Externo\FComercial.xpz`, usando los
objetos GX8 `FComercial` (Transaction/Table) y `FComercial` (WorkPanel). La
tabla física conservada es `FCOMERCIAL`, con clave
`EmpCod + TempCod + FCOProceso + FCONumI`.

El listado queda disponible en `/procesos-sag/fruta-comercial` y su API en
`/backendDocker/fruta-comercial`. La empresa se obtiene de la sesión y la
temporada se resuelve en Node desde la temporada activa; el cliente no puede
sobrescribir `EmpCod` ni `TempCod`.

## Listado y filtros

Se conservan los filtros del `SubFile` GX8:

- fecha desde y hasta, inicialmente los últimos 30 días;
- `FCOProceso`, con 0 como todos;
- `Especod`, con 0 como `0.- General`;
- `TMcod`, con -1 como `General`.

El orden del listado mantiene `FCOFecha`, `FCOProceso` y `Especod`. También se
conservan los totales de entradas, salidas y saldo; una fila con `TMcod=1` se
considera entrada y las demás salidas, igual que el cálculo del WorkPanel.

## Alta, visualización, modificación y anulación

`Agregar` abre la captura dentro de un componente MUI `Dialog`. La primera
generación incluye las acciones `Crear`, `Visualizar`, `Modificar` y `Anular`.
La confirmación de anulación usa el diseño visual proporcionado: encabezado
con icono rojo, tarjetas de identificación y pie con `Cancelar` y acción roja.

El alta genera `FCOProceso` con `TraeCor`/`GenCor` bajo el código `FCOMERCI`
con 10 dígitos, guarda el login de sesión y fuerza `FCOOrigen=0` para las
filas creadas manualmente. No se agregó botón PDF porque el XPZ no contiene un
reporte PDF para esta pantalla.

Los registros con `FCOOrigen=1` (Despacho de Clientes) o `NULL` (histórico)
solo se pueden visualizar. La anulación de una fila manual sigue el
comportamiento de borrado del XPZ y elimina físicamente esa fila; la etiqueta
visible de la acción es `Anular`.

## Límites de captura

Los límites se aplican en React y se vuelven a validar en Node:

| Campo | Regla |
| --- | --- |
| `FCONumI` | entero de 1 a 10 dígitos, distinto de 0 |
| `FCOFecha` | fecha válida `AAAA-MM-DD` |
| `TMcod`, `TMSCod` | selección de catálogo; código numérico de hasta 2 dígitos |
| `Especod` | selección de catálogo; código numérico de hasta 3 dígitos |
| `FCOKilos` | mayor que 0, máximo `99.999.999,99` |
| `FCOOBS` | máximo 50 caracteres |

La autorización de consulta usa `100/2/6`; crear, modificar y anular usan las
acciones vigentes `PROGRAM1/ASIGPROG1` 1, 2 y 3 respectivamente. Esto sigue el
modelo de autorización actual del proyecto, aunque el evento `PVA2` del XPZ
debe leerse como evidencia histórica y usa un orden diferente para sus
llamadas.

## Base de datos y verificación

`database/20261021_fruta_comercial_2016.sql` completa de forma aditiva la
tabla mínima que dejaba el instalador, agrega la clave/índices requeridos y
registra el programa 100/2/6 con sus acciones si aún no existen. El script no
se ejecuta automáticamente contra la base productiva.

Verificaciones realizadas:

- `node --test test/frutaComercial.service.test.js`: 4 pruebas aprobadas para
  máximos de entrada, kilos, observación y filtros GX8.
- `node --check` para servicio, rutas y router principal.
- `npm run build` en el frontend: compilación aprobada.

Queda pendiente aplicar el script SQL en el ambiente objetivo y ejecutar una
prueba integrada con una sesión autorizada y datos productivos antes de
marcar los objetos como `READY`.

## Homologación del listado operacional (2026-10-21)

La pantalla usa ahora el banner compartido, cuatro indicadores, filtros
reactivos con fechas abiertas, búsqueda general y exportaciones Excel/PDF del
conjunto filtrado completo. No se agregó un PDF oficial por fila porque el XPZ
no define ese reporte.

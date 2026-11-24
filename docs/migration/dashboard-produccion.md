# Dashboard de producción

Fecha de implementación: 2026-11-24.

## Finalidad

La ruta React `/dashboard/produccion` presenta a gerencia el estado en línea de
la orden de proceso vigente de la empresa autenticada. El endpoint es
`GET /backendDocker/dashboard-produccion`. La pantalla no modifica datos ni
reemplaza el dashboard operacional de temporada.

## Empresa y seguridad

La empresa se obtiene exclusivamente de `req.context.empCod`; la API no acepta
una empresa enviada por el navegador. Frontend y backend exigen el programa
`100/15/20 Dashboard de producción`. El menú autorizado resuelve
`ProgNomGX=wdashproduccion`. La migración
`database/20261124_dashboard_produccion.sql` completa el programa sin asignarlo
automáticamente a usuarios o roles.

## Selección de la orden

La consulta usa la temporada activa de `TEMP01` y selecciona una sola orden no
cuadrada. Prioriza estado 1 (`En proceso`), luego 4 (`Cerrada`) y finalmente 0
(`Ingresada`), ordenando por fecha y número descendente. Las órdenes cuadradas
o anuladas no alimentan esta vista previa a cuadratura.

## Indicadores

- Kilos ingresados: `ORDPROC.OrdpTotKilos`.
- Kilos procesados: suma de `CAP001.CAPKilos` para empresa, temporada y orden.
- Cajas leídas: suma de `CAP001.CAPCantidad` para la misma clave.
- Promedio Calidad: promedio de `CALRECEP.CalRecPorCalidad` ponderado por
  `ORDPROC1.Ordp1Kilos`; usa el último control finalizado por lote y omite lotes
  sin calidad finalizada. La escala se conserva entre 0 y 100.
- Exportación estimada: `kilos procesados / kilos ingresados * 100`.
- Comercial estimado: `100 - exportación estimada`.
- Pallets aproximados: `FLOOR(cajas leídas / PARAMGE1.PAR1Valor1)`, usando
  `PARCod=70` y `PAR1Cod=1` de la empresa de sesión.
- Cajas por calibre: suma de `CAP001.CAPCantidad`, ordenada por el maestro de
  calibres.

Si los kilos ingresados son cero, ambos porcentajes se devuelven sin base de
cálculo. Si el parámetro 70/1 falta o no es positivo, el endpoint responde
`409 PALLET_PARAMETER_INVALID`; no existe divisor fijo. Una producción superior
al ingreso se conserva como excepción visible en vez de limitar el porcentaje.

## Actualización

React consulta con TanStack Query y actualiza cada 30 segundos mientras la
página está visible. Todos los porcentajes son estimaciones en línea antes de
la cuadratura; la pantalla no usa `OrdpKilosExp` ni `OrdpKilosCom`.

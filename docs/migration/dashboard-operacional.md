# Dashboard operacional

Implementado el 2026-11-04 como una pantalla nueva en
`/dashboard/operacional`. La opción `Dashboard` del grupo Navigation apunta a
esta ruta; la portada anterior `/dashboard/default`, Accesos directos y los
dashboards de Calidad permanecen sin cambios.

El endpoint autenticado `GET /backendDocker/dashboard-operacional` obtiene la
empresa exclusivamente desde la sesión y usa la temporada activa de `TEMP01`.
Consolida órdenes cuadradas (`ORDPROC` estado 5), despachos finalizados,
recepciones y controles finalizados, hallazgos de plagas, facturas vigentes y
cajas no despachadas en línea. Presenta kilos del día y temporada segmentados
en exportación, comercial y desecho; kilos por variedad; camiones del día;
cobertura y umbral de calidad; plagas; facturación nacional/exportación y stock
por envase.

La clasificación de facturación conserva el modelo GX8: `FacEmisor=1` se
presenta como Comercial y `FacEmisor=2` como Exportación. Los importes se
muestran en CLP y no se convierten desde `FacTotalUSD`.

Verificación local: endpoint consultado para empresa 1, temporada activa
2017-2018; ESLint focalizado sin errores, build Vite exitoso y revisión visual
del tablero y del enlace Navigation.

# Evaluacion de migracion: consultas de recepcion de fruta

Fecha de revision: 2026-08-04

Estado: implementado y verificado.

## Conclusion

`CRecepFrut` y `RRecepFrut` se migraron como una sola capacidad de consulta
detallada con reporte. `CRecepciones` no crea una tercera pantalla: queda
cubierta por una vista `Resumen` dentro de la misma pantalla.

Este corte es de solo lectura y tiene impacto medio. No incluye el alta,
modificacion ni eliminacion de recepciones. Ese alcance pertenece al WorkPanel
`Recepciones`, a las Transactions `MovFrut` y `MovFrutPesaje` y a sus
procedimientos operativos; incorporarlo elevaria el impacto a alto.

## Objetos GX8 evaluados

| Objeto | Tipo | Finalidad | Decision propuesta |
|---|---|---|---|
| `CRecepciones` | WorkPanel | Lista cabeceras de recepcion y sus totales | Consolidar como vista `Resumen`; no crear ruta propia |
| `CRecepFrut` | WorkPanel | Consulta agrupada por origen, fecha, productor, cuartel, especie y variedad | Migrar como pantalla principal de consulta |
| `RRecepFrut` | Report | Impresion de la misma consulta agrupada | Implementar como exportacion backend de la consulta |

El inventario oficial ubica los tres objetos en la carpeta `Recepciones`. Los
dos WorkPanels tienen 16 y 43 variables respectivamente; el Report tiene 39.
Los tres quedaron `IMPLEMENTED` en el registro editable. El alcance sigue
siendo de solo lectura; no implica que la captura `Recepciones`/`MovFrut` este
lista.

## Transaccion propietaria y tablas

La Transaction propietaria es `MovFrut` (`Movimiento de Fruta`). Tiene dos
niveles GeneXus y deben conservarse como una sola unidad de negocio:

| Nivel | Tabla fisica | Clave |
|---|---|---|
| Cabecera | `MOVFRUT` | `EmpCod`, `TempCod`, `OriCod`, `MovTDoc`, `MovNGuia`, `MovProd` |
| Detalle | `MOVFRUT1` | clave de cabecera + `Mov1Nlote` |

`MOVFRUT1` no es un maestro independiente. Contiene cuartel, especie,
variedad, envase, condicion, cantidades, pesos y fecha del detalle.

### Tablas directas

- `MOVFRUT`: cabeceras, fecha documental, productor, tipo/subtipo y totales.
- `MOVFRUT1`: lotes y valores que se agrupan en la consulta y el reporte.

### Catalogos y nombres inferidos

- `TEMP01`: temporadas y temporada activa.
- `ORIGEN`: nombre y estado del origen.
- `PRODUCTORES`: nombre del productor.
- `PRODUCTORES1`: nombre del cuartel; es nivel 2 de Productores.
- `ESPECIES`: nombre de especie.
- `ESPECIES1`: nombre de variedad; es nivel 2 de Especies.
- `TIPMOV` y `TIPMOV1`: significado de `TMcod` y `TMSCod`.
- `DEFEMP`: razon social, giro, direccion y RUT usados en el encabezado del
  reporte.

Las tablas de Seguridad intervienen para publicar la ruta, pero no forman parte
del resultado de negocio: `SISTEMAS`, `MODULOS`, `PROGRAM`, `ASIGSIST`, `ASIG`,
`ASIGPROG` y, si se protegen acciones, `ASIGPROG1`.

## Comportamiento que debe conservarse

### Resumen de cabeceras (`CRecepciones`)

Consulta `MOVFRUT` por:

- empresa y temporada;
- origen opcional;
- numero de guia desde un minimo;
- productor opcional (`GG` significa todos);
- rango inclusivo de `MovFecha`.

Muestra origen, guia, productor, fecha, cantidad de items, envases, kilos
brutos y kilos netos. El objeto no restringe `TMcod`; por eso esta vista no
debe reutilizar sin mas la consulta detallada, que si exige recepcion.

### Detalle (`CRecepFrut`) y reporte (`RRecepFrut`)

Trabajan sobre `MOVFRUT1`, limitan `TMcod = 1` y `TMSCod = 1`, y filtran por:

- empresa autenticada y temporada;
- rango de origen;
- rango inclusivo de `MovFecha`, tomada de la cabecera;
- productor o todos;
- rango de cuartel;
- rango de especie.

Agrupan por temporada, origen, fecha, productor, cuartel, especie y variedad;
suman `Mov1NumE`, `Mov1KilB` y `Mov1KilN`. En React los filtros pueden ser
selectores simples, pero la API debe conservar la semantica de rangos del
reporte para no cerrar una futura impresion por intervalos.

La agregacion, filtros y totales deben ejecutarse en SQL/Node. React no debe
recalcularlos sobre las filas cargadas.

## Integracion de menu y autorizacion

La entrada activa encontrada para la consulta es:

- sistema `100`: Control de Produccion Fruticola;
- modulo `15`: Consultas de Procesos;
- programa `1`: Recepcion de Fruta;
- `ProgNomGX = wcrecepfrut`.

La captura operativa es otra entrada: sistema `100`, modulo `2` (Procesos
Planta), programa `1`, `ProgNomGX = wrecepciones`.

No se encontro una entrada `PROGRAM` propia para `CRecepciones`. Esto respalda
consolidarla dentro de `CRecepFrut` y proteger toda la consulta con
`requirePermission(100, 15, 1)`. La empresa debe salir exclusivamente de
`req.context.empCod`.

## Impacto tecnico

### Backend

- Servicio de consulta con dos proyecciones: `summary` desde `MOVFRUT` y
  `detail` agregado desde `MOVFRUT1`.
- Endpoint de catalogos dependientes de empresa y temporada para origen,
  productor, cuartel y especie.
- Paginacion y orden estable en ambas vistas.
- Exportacion PDF/Excel generada en backend a partir de los mismos filtros y
  sin limitarse a la pagina cargada en React.
- Pruebas de aislamiento por empresa, filtros, agrupacion, totales y permiso
  `100/15/1`.

### Frontend

- Una pantalla `Recepcion de fruta` con pestanas `Resumen` y `Detalle`.
- Filtros compartidos: temporada, desde, hasta, origen y productor.
- Filtros adicionales del detalle: cuartel y especie.
- Totales visibles de envases, kilos brutos y kilos netos.
- Accion de reporte/exportacion sobre el conjunto filtrado completo.

### Base de datos

No falta ninguna tabla requerida. En la base configurada se observaron 1.180
cabeceras y 2.421 detalles, de una empresa y diez temporadas. La fecha oficial
es `MOVFRUT.MovFecha`; el indice `IND_FECHA` existente comienza por empresa,
temporada, tipo, subtipo y esa fecha. No se agrego estructura SQL.

Las fechas son `datetime`. Para una fecha final inclusiva la consulta debe usar
`>= desde` y `< dia-siguiente(hasta)`, evitando excluir registros con hora.

## Hallazgos y riesgos

1. `RRecepFrut` obtiene los datos de empresa con `EmpCod = 1`, aunque recibe
   `EmpCod` como parametro y lo usa en el detalle. Es un defecto historico; la
   migracion debe usar la empresa autenticada también en el encabezado.
2. Hay 17 detalles cuya `Mov1Fecha` no coincide con la cabecera. Por decision
   funcional, resumen, detalle y reporte filtran y muestran `MovFecha`.
3. Existe un detalle sin cabecera. Queda fuera de la consulta porque no tiene
   la fecha oficial ni una recepcion propietaria valida.
4. En recepciones `TMcod=1/TMSCod=1` se detectaron diferencias entre totales de
   cabecera y suma del detalle: 9 en envases y 21 tanto en kilos brutos como
   netos. `Resumen` debe mostrar los totales guardados de cabecera, mientras
   `Detalle` y el reporte deben sumar el detalle, igual que GX8.
5. Hay 26 detalles cuyo productor ya no existe en `PRODUCTORES`. Los joins a
   catalogos deben ser `LEFT JOIN` y conservar codigos historicos aunque falte
   el nombre.
6. `CRecepciones` tiene el `parm` comentado y no posee entrada propia en
   `PROGRAM`; parece una consulta anterior o auxiliar. No debe convertirse en
   una pantalla autorizable separada sin evidencia de uso.
7. El llamado `RRRecepFrut` desde `CRecepFrut` corresponde al wrapper generado
   del Report `RRecepFrut`, no a una transaccion adicional.

## Implementacion realizada

1. API `/backendDocker/recepcion-fruta` protegida por `100/15/1`.
2. Empresa obtenida solo de `req.context.empCod`.
3. Consultas paginadas `resumen` y `detalle`, con filtros y totales calculados
   en SQL Server.
4. Pantalla React `/recepciones/fruta` con ambas pestanas y filtros GX8.
5. Exportaciones XLSX y PDF reales generadas por backend sobre todas las filas
   filtradas.
6. `npm run verify:recepcion-fruta` como verificacion reproducible.

La captura, modificacion y eliminacion de `Recepciones`/`MovFrut` debe
evaluarse por separado.

## Evidencia

- `GXW.xpz`: reglas, eventos, condiciones, estructura de `MovFrut` y fuentes
  de los tres objetos solicitados.
- Inventario GX8: tipos, carpeta, estructuras, claves e indices.
- SQL Server configurado: esquema fisico, indices, volumen y controles de
  coherencia ejecutados en modo lectura.
- La verificacion sobre la temporada activa `2017-2018` devolvio 66 filas de
  resumen y 40 agrupaciones de detalle; genero un XLSX de 9.187 bytes y un PDF
  de 5.570 bytes con firmas validas.
- La suite backend aprobo 11 pruebas y el build React transformo 5.434 modulos.

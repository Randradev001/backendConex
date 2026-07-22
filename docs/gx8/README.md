# Catalogo de Procedures GX8

Fuente: `C:\Users\andre\Downloads\GXW.xpz`

Procedures identificados: **225**. Este catalogo usa el nombre real del objeto GeneXus; el prefijo generado `P` solo se normaliza en las llamadas.

## Estados

- `PENDING_ANALYSIS`: falta confirmar entradas, salidas, tablas y comportamiento esperado.
- `READY`: analisis aprobado y casos de prueba definidos.
- `IN_PROGRESS`: migracion en curso.
- `VALIDATED`: resultado SQL y funcional comparado con GX8.
- `RETIRED`: objeto descartado con una justificacion registrada.

## Dependencias mas llamadas

- `TraeParametro`: 24 Procedures
- `TraeCor`: 22 Procedures
- `DesmarcaPrefactura`: 9 Procedures
- `TraeCorrGuia`: 8 Procedures
- `Eli_PS_InfG001`: 7 Procedures
- `SumDetGuia`: 7 Procedures
- `BusIDDespa`: 6 Procedures
- `gxSelDir`: 4 Procedures
- `RErrores`: 4 Procedures
- `TraeCodEspe`: 4 Procedures
- `gxSelFile`: 3 Procedures
- `TraePeso`: 3 Procedures
- `TraeNumSolInt`: 3 Procedures
- `TraeValorMoneda`: 2 Procedures
- `MontoEscrito`: 2 Procedures

## Regla de migracion

La logica de negocio se migra a servicios o casos de uso Node. Los hooks React solo consumen endpoints y administran estado de pantalla. Antes de cambiar un estado a `READY`, se deben registrar tablas leidas/escritas, limites transaccionales, Empresa, Temporada, llamadas y pruebas de equivalencia.

Los archivos `procedures.csv` y `procedures.json` son generados y se pueden reemplazar. Las decisiones manuales se registran en `migration-register.csv`, que el generador crea solo una vez.

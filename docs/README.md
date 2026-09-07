# Documentacion de migracion CONEX

Este directorio es la fuente de continuidad para la migracion GeneXus 8 a
React, Node.js y SQL Server.

## Orden de lectura

1. [Estado vigente](migration/CURRENT-STATE.md)
2. [Arquitectura de Seguridad](architecture/security.md)
3. [Decision del modelo de autorizacion](decisions/ADR-001-security-model.md)
4. [Decision de autenticacion](decisions/ADR-002-authentication.md)
5. Documento especifico del modulo que se va a modificar
6. Inventario y estudios GX8 como evidencia

## Precedencia

Cuando dos documentos parezcan contradictorios, usar este orden:

1. reglas obligatorias de `AGENTS.md`;
2. `migration/CURRENT-STATE.md`;
3. ADR aceptado;
4. documento de la ola o modulo;
5. estudios generales e inventario generado.

El codigo y el esquema SQL deben comprobarse antes de decidir. Si difieren del
estado vigente, no se corrige el documento a ciegas: se identifica primero si
la diferencia es trabajo incompleto, cambio no documentado o una regresion.

## Mapa de documentos

### Estado y continuidad

- [CURRENT-STATE.md](migration/CURRENT-STATE.md): implementado, pendiente,
  riesgos, archivos clave y siguiente orden recomendado.
- [conex-single-database-cutover.md](migration/conex-single-database-cutover.md):
  consolidacion y corte final de base de datos.
- [git-workflow.md](development/git-workflow.md): ramas, commits y revision.

### Seguridad

- [security.md](architecture/security.md): arquitectura de autenticacion,
  sesion, permisos, roles y menu dinamico.
- [security-status.md](migration/security-status.md): correspondencia de
  objetos GX y estado detallado.
- [APERPSeguridad-mapping.md](migration/APERPSeguridad-mapping.md): reglas
  tomadas de la exportacion APERP.
- [asignaciones-seguridad-interactivas.md](migration/asignaciones-seguridad-interactivas.md):
  permisos directos, roles y editor jerarquico.

### Maestros

- [maestros-gx8-conex-study.md](migration/maestros-gx8-conex-study.md): matriz
  estructural de Transactions, claves y niveles.
- [masters-migration-study.md](migration/masters-migration-study.md): estudio
  inicial, brechas y olas propuestas.
- [clientes, agentes y consignatarios](migration/maestros-clientes-agentes-consignatarios.md)
- [condiciones, origenes y destinos](migration/maestros-condiciones-origenes-destinos.md)

### Recepciones

- [evaluacion de consultas y reporte de recepcion de fruta](migration/recepcion-fruta-evaluacion.md):
  alcance propuesto, transaccion propietaria, tablas, riesgos y secuencia.
- [evaluacion del ingreso de recepciones](migration/recepciones-ingreso-evaluacion.md):
  WorkPanel `Recepciones`, transacciones, calculos, catalogos, pesaje y efecto
  sobre lotes y ordenes de proceso.

### Procesos

- [operacion de ordenes de proceso](migration/ordenes-proceso-operacion.md):
  seleccion de saldos, alta transaccional y confirmacion del correlativo.
- [tablero de control de lineas](migration/configuracion-lineas-tablero.md):
  rediseño de `linconfig`, monitoreo animado, alta y edicion, tablas, estados,
  permisos y pendientes de eliminacion e impresion.
- [CRUD visual de etiquetas y diseñador ZPL versionado](migration/etiquetas-editor-zpl.md):
  cards de etiquetas, versiones de diseño, persistencia JSON/ZPL, rescate GX8,
  seguridad y límites de preview e impresión.

### Inventario GX8

- [Catalogo de Procedures](gx8/README.md)
- [Inventario general](gx8/inventory/README.md)
- `gx8/inventory/project-review-register.csv`: registro editable de revision.
- `gx8/migration-register.csv`: decisiones de migracion de Procedures.

## Regla de mantenimiento

Todo cambio funcional debe actualizar en la misma tarea:

1. el documento especifico del objeto o modulo;
2. `migration/CURRENT-STATE.md` si cambia el estado;
3. el registro editable del inventario;
4. la evidencia de pruebas y scripts SQL ejecutados.

No se marca un objeto `READY` solo porque compila o porque se encontro su
codigo generado. Deben confirmarse nombre GX, finalidad de negocio, tablas,
niveles, empresa, permisos, filtros, operaciones y prueba reproducible.

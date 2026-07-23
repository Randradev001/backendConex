# CONEX Migration Guide

## Purpose

This repository is the Node.js backend for migrating the CONEX GeneXus 8 system. Preserve business behavior and GeneXus table names unless a documented decision says otherwise.

## Source Of Truth

- GeneXus export: `C:\Users\andre\Downloads\GXW.xpz`
- Inventory: `C:\Proyectos2025\Conex\DocumentacionIA\Inventario_GX8_Conex.xlsx`
- Migration documentation: `docs/`
- SQL migration scripts: `database/`

## Rules

- Respect GeneXus transaction levels. A level-two table is not an independent master.
- Multi-company data uses `EmpCod`; security assignments use the original `GECODEMP` name.
- The authenticated session supplies `req.context.empCod` and `req.context.login`.
- Never accept `EmpCod` from a screen to override the authenticated company.
- Preserve `NivSeg` for compatibility, but use `AsigSist`, `Asig`, `AsigProg`, and `AsigProg1` as the current authorization model.
- Retire `VA`; migrate the business behavior of `VA2` to backend permission middleware.
- Procedures that query, validate, calculate, update, or authorize belong in the backend. React hooks may call them but must not duplicate their business rules.
- Add short comments only where GeneXus compatibility or a non-obvious business rule needs explanation.

## Before Changing Behavior

1. Find the GX object in the XPZ and inventory.
2. Record its business purpose and dependencies in `docs/migration/`.
3. Implement backend tests or a reproducible verification for the migrated rule.
4. Update the migration status; do not mark an object ready from its generated-code name alone.

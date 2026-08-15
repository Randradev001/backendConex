# CONEX Migration Guide

## Purpose

This repository is the Node.js backend for migrating the CONEX GeneXus 8 system. Preserve business behavior and GeneXus table names unless a documented decision says otherwise.

## Working Scope

- Backend: `C:\Proyectos2025\Conex\backend\backendConex`
- Frontend: `C:\Proyectos2025\Conex\Frontend\conex-frontend`
- Do not continue work in copied projects such as `C:\Proyectos2025\AS`.

## Read First

Before analyzing or changing code, read these files in order:

1. `docs/README.md`
2. `docs/migration/CURRENT-STATE.md`
3. the module document linked from the current-state file;
4. the applicable ADR in `docs/decisions/`.

The studies in `docs/migration/*-study.md` are evidence and planning history.
They are not the current implementation status unless `CURRENT-STATE.md` says
so. When documentation and code differ, inspect the database and source, then
update `CURRENT-STATE.md` as part of the same change.

## Source Of Truth

- GeneXus export: `C:\Users\andre\Downloads\GXW.xpz`
- Inventory: `C:\Proyectos2025\Conex\DocumentacionIA\Inventario_GX8_Conex.xlsx`
- Migration documentation: `docs/`
- SQL migration scripts: `database/`
- Current migration state: `docs/migration/CURRENT-STATE.md`

## Rules

- Respect GeneXus transaction levels. A level-two table is not an independent master.
- Multi-company data uses `EmpCod`; security assignments use the original `GECODEMP` name.
- The authenticated session supplies `req.context.empCod` and `req.context.login`.
- Never accept `EmpCod` from a screen to override the authenticated company.
- Preserve `NivSeg` for compatibility, but use `AsigSist`, `Asig`, `AsigProg`, and `AsigProg1` as the current authorization model.
- Retire `VA`; migrate the business behavior of `VA2` to backend permission middleware.
- Procedures that query, validate, calculate, update, or authorize belong in the backend. React hooks may call them but must not duplicate their business rules.
- Add short comments only where GeneXus compatibility or a non-obvious business rule needs explanation.
- A hidden menu item is not authorization. Protect backend routes with the
  corresponding `SistCod`, `Modcod`, and `ProgCod`.
- Do not describe the current Excel/PDF helpers as production exports: Excel
  is HTML with `.xls`, PDF uses the browser print dialog, and both export only
  rows loaded in React.

## Before Changing Behavior

1. Find the GX object in the XPZ and inventory.
2. Record its business purpose and dependencies in `docs/migration/`.
3. Implement backend tests or a reproducible verification for the migrated rule.
4. Update the migration status; do not mark an object ready from its generated-code name alone.
5. Update `docs/migration/CURRENT-STATE.md` and the editable project review
   register when the status changes.

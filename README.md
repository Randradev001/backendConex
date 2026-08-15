# CONEX Backend

Node.js and SQL Server backend for the migration of the CONEX GeneXus 8
application.

This repository is not a generic starter project. Business behavior, table
names, transaction levels, security programs, and multi-company scope come
from the original CONEX model.

## Start Here

1. Read [AGENTS.md](AGENTS.md).
2. Read [docs/README.md](docs/README.md).
3. Check [the current migration state](docs/migration/CURRENT-STATE.md).
4. Run `git status --short` before editing because migration work may still be
   uncommitted.

## Commands

```powershell
npm install
npm start
npm test
npm run verify:conex
```

The backend normally listens on port `3000`. Connection values belong in
`.env`; never commit credentials.

## Repositories

- Backend: `C:\Proyectos2025\Conex\backend\backendConex`
- Frontend: `C:\Proyectos2025\Conex\Frontend\conex-frontend`

The project copy under `C:\Proyectos2025\AS` is outside the active migration
scope.

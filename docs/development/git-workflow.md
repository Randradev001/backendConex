# Flujo Git de CONEX

Backend y frontend son repositorios separados. La documentacion transversal vive en este backend para que viaje con la implementacion y pueda ser leida por herramientas de IA mediante `AGENTS.md`.

## Trabajo recomendado

1. Actualizar la rama principal sin descartar cambios locales.
2. Crear una rama por objetivo, por ejemplo `codex/seguridad-login`.
3. Revisar `git status` y `git diff` antes de confirmar.
4. Hacer commits pequenos con el motivo de negocio, no con el nombre generado de GX.
5. Subir la rama y abrir una revision antes de integrar en `master` o `main`.

Ejemplo para cada repositorio:

```powershell
git switch -c codex/seguridad-login
git status
git diff
git add <archivos revisados>
git commit -m "feat: incorpora login y contexto de empresa"
git push -u origin codex/seguridad-login
```

No se deben confirmar `.env`, claves, respaldos de base de datos, `node_modules` ni artefactos generados. Los scripts SQL y archivos Markdown si deben quedar en Git.

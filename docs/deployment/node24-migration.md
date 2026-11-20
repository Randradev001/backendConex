# Migración del runtime a Node 24

El backend CONEX se fija en Node 24.22.3 (`.nvmrc` y `engines`). La imagen Docker
usa la misma versión sobre Alpine 3.24 y instala dependencias con `npm ci` para
reproducir el lockfile. El frontend Vite puede compilarse con Node 24 y su salida
estática no requiere Node durante la ejecución.

## Servidor Windows

Node 24 puede convivir con otras versiones instaladas. El servicio CONEX debe
invocar la ruta absoluta de su `node.exe` y tener como directorio de trabajo la
carpeta del backend. Configurar `CHROME_PATH` con la ruta de Chrome/Chromium en
Windows si se usa la generación de imágenes mediante Puppeteer. En Docker se
utiliza `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`.

El backend web y el agente de impresión son procesos distintos. Actualizar y
probar ambos servicios antes de cambiar los ejecutables de producción.

## Comprobaciones locales del 2026-11-20

- `node --test` con Node 24.22.3: 259 pruebas correctas.
- Build Vite de CONEX con Node 24.22.3: correcto, con avisos de chunks grandes y
  datos Browserslist antiguos.
- La imagen `conex-backend:node24-evaluation` se construyó correctamente y
  arrancó Chromium 156 con Puppeteer dentro de un contenedor sin red.
- Pendiente: comprobar inicio de sesión, consulta SQL, PDF/imagen y agente de
  impresión en el servidor destino.
- Dependencias actualizadas: Puppeteer 25, ExcelJS 4.4, node-cron 4, nodemon 3,
  mssql 12 y parches transitivos. Tras la actualización, `npm audit --omit=dev`
  informa 5 avisos moderados y cero altos/críticos. Los frontends quedaron en
  cero avisos al actualizar Workbox/Glob mediante override acotado. Queda validar SQL real,
  exportaciones y horarios del cron antes de producción.
- La imagen reconstruida con el lockfile actualizado inició Node 24.22.3 y
  Chromium 156 sin red; el contexto excluye `.env`.

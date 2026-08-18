from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase.pdfmetrics import stringWidth


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "manual_despliegue_conex_windows_server.pdf"


BLUE = colors.HexColor("#143A5A")
BLUE_2 = colors.HexColor("#1F5A85")
LIGHT_BLUE = colors.HexColor("#EAF3FA")
GREEN = colors.HexColor("#2E7D32")
GRAY = colors.HexColor("#59636E")
LIGHT_GRAY = colors.HexColor("#F4F6F8")
RED = colors.HexColor("#A33535")


class ManualDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, **kwargs):
        super().__init__(filename, **kwargs)
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
        )
        self.addPageTemplates(
            [
                PageTemplate(id="main", frames=[frame], onPage=self.draw_page),
            ]
        )

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style_name = flowable.style.name
            if style_name == "ManualHeading1":
                text = flowable.getPlainText()
                self.notify("TOCEntry", (0, text, self.page))
            elif style_name == "ManualHeading2":
                text = flowable.getPlainText()
                self.notify("TOCEntry", (1, text, self.page))

    def draw_page(self, canvas, doc):
        canvas.saveState()
        page_width, page_height = A4
        canvas.setStrokeColor(colors.HexColor("#D8E2EA"))
        canvas.setLineWidth(0.6)
        canvas.line(2 * cm, 1.55 * cm, page_width - 2 * cm, 1.55 * cm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(GRAY)
        canvas.drawString(2 * cm, 1.1 * cm, "Manual tecnico de despliegue CONEX - Windows Server")
        canvas.drawRightString(page_width - 2 * cm, 1.1 * cm, f"Pagina {doc.page}")
        canvas.restoreState()


def stylesheet():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverBandTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=23,
            leading=27,
            alignment=TA_CENTER,
            textColor=colors.white,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverBandSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#D6E7F4"),
            spaceAfter=0,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=27,
            leading=32,
            alignment=TA_CENTER,
            textColor=BLUE,
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSubtitle",
            parent=styles["Normal"],
            fontSize=13,
            leading=19,
            alignment=TA_CENTER,
            textColor=GRAY,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ManualHeading1",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=21,
            textColor=BLUE,
            spaceBefore=12,
            spaceAfter=8,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ManualHeading2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=16,
            textColor=BLUE_2,
            spaceBefore=9,
            spaceAfter=5,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.6,
            leading=13.4,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#20262D"),
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=11,
            textColor=GRAY,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Callout",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12.5,
            textColor=colors.HexColor("#24313B"),
            backColor=LIGHT_BLUE,
            borderColor=colors.HexColor("#B9D7EA"),
            borderWidth=0.8,
            borderPadding=7,
            spaceBefore=5,
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Warn",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12.5,
            textColor=colors.HexColor("#3C2525"),
            backColor=colors.HexColor("#FFF0F0"),
            borderColor=colors.HexColor("#E0B4B4"),
            borderWidth=0.8,
            borderPadding=7,
            spaceBefore=5,
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CodeBlock",
            parent=styles["Code"],
            fontName="Courier",
            fontSize=7.3,
            leading=9.2,
            textColor=colors.HexColor("#202020"),
            backColor=LIGHT_GRAY,
            borderColor=colors.HexColor("#D3D8DD"),
            borderWidth=0.5,
            borderPadding=6,
            leftIndent=0,
            rightIndent=0,
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    return styles


def p(text: str, style="Body"):
    return Paragraph(text, STYLES[style])


def h1(text: str):
    return Paragraph(text, STYLES["ManualHeading1"])


def h2(text: str):
    return Paragraph(text, STYLES["ManualHeading2"])


def code(text: str):
    return Preformatted(text.strip("\n"), STYLES["CodeBlock"], maxLineLength=96)


def bullet(items: list[str]):
    story = []
    for item in items:
        story.append(p(f"- {item}"))
    return story


def make_table(rows, widths=None, header=True):
    if widths is None:
        widths = [4.2 * cm, 11.8 * cm]
    data = []
    for row in rows:
        data.append([p(str(cell), "Small") for cell in row])
    tbl = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    style = [
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#C9D3DC")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#DDE4EA")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ]
    tbl.setStyle(TableStyle(style))
    return tbl


def draw_cover(canvas, doc):
    page_width, page_height = A4
    canvas.saveState()
    canvas.setFillColor(BLUE)
    canvas.rect(0, page_height - 5.2 * cm, page_width, 5.2 * cm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 24)
    canvas.drawCentredString(page_width / 2, page_height - 2.35 * cm, "CONEX")
    canvas.setFont("Helvetica", 11)
    canvas.drawCentredString(page_width / 2, page_height - 3.05 * cm, "Manual tecnico de instalacion y despliegue")
    canvas.setStrokeColor(colors.HexColor("#D6E7F4"))
    canvas.setLineWidth(2)
    canvas.line(3.6 * cm, page_height - 3.75 * cm, page_width - 3.6 * cm, page_height - 3.75 * cm)
    canvas.restoreState()


def cover_story():
    band = Table(
        [
            [
                Paragraph("CONEX", STYLES["CoverBandTitle"]),
                Paragraph("Manual tecnico de instalacion y despliegue<br/>Windows Server + IIS + Node.js", STYLES["CoverBandSubtitle"]),
            ]
        ],
        colWidths=[5.2 * cm, 10.1 * cm],
        rowHeights=[3.1 * cm],
        hAlign="CENTER",
    )
    band.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BLUE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                ("LINEAFTER", (0, 0), (0, 0), 1.2, colors.HexColor("#D6E7F4")),
            ]
        )
    )
    return [
        band,
        Spacer(1, 1.3 * cm),
        p("Windows Server, IIS, ARR, URL Rewrite, PM2, Node.js y React/Vite", "CoverTitle"),
        p("Guia operativa para publicar frontend y backend sin exponer publicamente el puerto de Node.", "CoverSubtitle"),
        Spacer(1, 0.8 * cm),
        make_table(
            [
                ["Dato", "Valor"],
                ["Proyecto", "CONEX"],
                ["Version Node objetivo", "20.19.1"],
                ["Backend interno", "http://127.0.0.1:3000"],
                ["Frontend produccion", "https://www.conexco.cl/free"],
                ["API publica", "https://www.conexco.cl/free/api/backendDocker/..."],
                ["Fecha de documento", "17 de agosto de 2026"],
            ],
            widths=[4.6 * cm, 10.5 * cm],
        ),
        Spacer(1, 1 * cm),
        p(
            "Este documento resume los comandos usados durante la instalacion y configuracion, explica el sentido de cada paso y deja una metodologia reutilizable para desplegar nuevos proyectos frontend + backend en el mismo servidor.",
            "Callout",
        ),
    ]


def build_story():
    story = []

    story += cover_story()
    story.append(PageBreak())

    story.append(h1("Indice"))
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(
            fontName="Helvetica-Bold",
            fontSize=10,
            name="TOCHeading1",
            leftIndent=0,
            firstLineIndent=0,
            spaceBefore=5,
            leading=13,
            textColor=BLUE,
        ),
        ParagraphStyle(
            fontName="Helvetica",
            fontSize=8.8,
            name="TOCHeading2",
            leftIndent=14,
            firstLineIndent=0,
            spaceBefore=2,
            leading=11,
            textColor=GRAY,
        ),
    ]
    story.append(toc)
    story.append(PageBreak())

    story.append(h1("1. Alcance del manual"))
    story.append(
        p(
            "Este manual documenta la instalacion y configuracion aplicada para publicar CONEX en Windows Server. El despliegue contempla un frontend React/Vite publicado por IIS y un backend Node.js ejecutado con PM2 en un puerto local. El puerto de Node no queda expuesto directamente a internet."
        )
    )
    story.append(
        p(
            "La aplicacion .NET existente en IIS no debe ser modificada. Cada proyecto nuevo debe vivir en su propia carpeta, aplicacion virtual o sitio, con reglas URL Rewrite locales al proyecto."
        )
    )
    story.append(h2("Arquitectura aplicada"))
    story.append(code("""
Usuario
  -> https://www.conexco.cl/free
  -> IIS sirve frontend estatico
  -> https://www.conexco.cl/free/api/*
  -> IIS URL Rewrite + ARR
  -> http://127.0.0.1:3000/*
  -> Backend Node / Express / PM2
  -> SQL Server
"""))

    story.append(h1("2. Versiones y requisitos"))
    story.append(
        make_table(
            [
                ["Componente", "Uso"],
                ["Windows Server", "Servidor donde ya existe IIS y una aplicacion .NET."],
                ["IIS", "Sirve el frontend estatico y actua como entrada publica."],
                ["URL Rewrite", "Permite definir reglas de reescritura en web.config."],
                ["ARR", "Permite que IIS funcione como reverse proxy hacia Node."],
                ["Node.js 20.19.1", "Version objetivo usada por el proyecto."],
                ["npm", "Gestor de paquetes usado para instalar dependencias y compilar."],
                ["PM2", "Administrador de procesos Node."],
                ["pm2-windows-service", "Permite que PM2 arranque con Windows como servicio."],
                ["SQL Server", "Base de datos usada por el backend mediante mssql / tedious."],
            ]
        )
    )
    story.append(h2("Comandos de verificacion"))
    story.append(code("""
node -v
npm -v
pm2 -v
"""))

    story.append(h1("3. Instalacion base de Node y npm"))
    story.append(p("Como winget no estaba disponible en el servidor, se uso Chocolatey para instalar Node."))
    story.append(code("""
choco install nodejs-lts --version=20.19.1 -y
"""))
    story.append(
        p(
            "Si aparece error MSI 1603, normalmente indica un problema del entorno local, por ejemplo instalacion previa, reinicio pendiente o bloqueo del instalador. Revisar el log antes de repetir la instalacion.",
            "Warn",
        )
    )
    story.append(code("""
Get-Content "C:\\ProgramData\\chocolatey\\logs\\chocolatey.log" -Tail 100
"""))

    story.append(h1("4. Configuracion del backend CONEX"))
    story.append(h2("Ubicacion en servidor"))
    story.append(code("""
C:\\inetpub\\wwwroot\\conex\\backendConex
"""))
    story.append(h2("Variables de entorno minimas"))
    story.append(code("""
NODE_ENV=production
PORT=3000

DB_SERVER=localhost
DB_PORT=1433
DB_INSTANCE=
DB_DATABASE=CONEX_MIGRACION
DB_USER=TU_USUARIO
DB_PASSWORD=TU_PASSWORD

DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

CORS_ORIGINS=https://www.conexco.cl
"""))
    story.append(
        p(
            "No se deben hardcodear servidores, usuarios, claves, base de datos ni puertos dentro del codigo. Las credenciales deben permanecer fuera de Git en archivos .env."
        )
    )
    story.append(h2("Instalar dependencias"))
    story.append(code("""
cd C:\\inetpub\\wwwroot\\conex\\backendConex
npm install --omit=dev
"""))
    story.append(h2("Prueba manual del backend"))
    story.append(code("""
$env:NODE_ENV="production"
node index.js
"""))
    story.append(p("En otra consola PowerShell:"))
    story.append(code("""
Invoke-WebRequest http://127.0.0.1:3000/ping -UseBasicParsing -TimeoutSec 10
Invoke-WebRequest http://127.0.0.1:3000/backendDocker/test -UseBasicParsing -TimeoutSec 10
"""))

    story.append(h1("5. Configuracion del frontend CONEX"))
    story.append(h2("Variables de produccion"))
    story.append(code("""
VITE_APP_BASE_NAME=/free
VITE_API_URL=/free/api
"""))
    story.append(h2("Compilar frontend"))
    story.append(code("""
npm install
npm run build
"""))
    story.append(h2("Destino en servidor"))
    story.append(code("""
C:\\inetpub\\wwwroot\\conex\\frontConex
"""))
    story.append(p("Se sube al servidor el contenido generado dentro de la carpeta dist."))

    story.append(h1("6. IIS, URL Rewrite y ARR"))
    story.append(h2("Instalar ARR"))
    story.append(code("""
$downloadDir = "C:\\Temp\\IISModules"
New-Item -ItemType Directory -Force $downloadDir

$arrMsi = "$downloadDir\\requestRouter_amd64.msi"

Invoke-WebRequest `
  -Uri "https://download.microsoft.com/download/e/9/8/e9849d6a-020e-47e4-9fd0-a023e99b54eb/requestRouter_amd64.msi" `
  -OutFile $arrMsi

Start-Process msiexec.exe `
  -ArgumentList @("/i", $arrMsi, "/qn", "/norestart", "/l*v", "$downloadDir\\arr-install.log") `
  -Wait
"""))
    story.append(h2("Verificar ARR"))
    story.append(code("""
& "$env:windir\\system32\\inetsrv\\appcmd.exe" list config -section:system.webServer/proxy
"""))
    story.append(h2("Habilitar proxy ARR"))
    story.append(code("""
& "$env:windir\\system32\\inetsrv\\appcmd.exe" set config `
  -section:system.webServer/proxy `
  /enabled:"True" `
  /preserveHostHeader:"True" `
  /commit:apphost
"""))
    story.append(
        p(
            "ARR habilitado globalmente no redirige trafico por si solo. La redireccion concreta vive en el web.config del frontend, por eso no deberia afectar la aplicacion .NET existente si no se modifica su configuracion.",
            "Callout",
        )
    )
    story.append(h2("web.config de CONEX"))
    story.append(code("""
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="CONEX_FRONT_API_PROXY" stopProcessing="true">
          <match url="^api/(.*)$" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>

        <rule name="CONEX_FRONT_SPA" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/free/index.html" />
        </rule>
      </rules>
    </rewrite>

    <staticContent>
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
    </staticContent>
  </system.webServer>
</configuration>
"""))
    story.append(h2("Prueba publica de la API"))
    story.append(code("""
Invoke-WebRequest https://www.conexco.cl/free/api/backendDocker/test -UseBasicParsing -TimeoutSec 15
"""))

    story.append(h1("7. PM2 y servicio de Windows"))
    story.append(h2("Instalar PM2"))
    story.append(code("""
npm install -g pm2
pm2 --version
"""))
    story.append(h2("Instalar integracion de servicio"))
    story.append(code("""
npm install -g pm2-windows-service
& "$env:APPDATA\\npm\\pm2-service-install.cmd"
"""))
    story.append(h2("Agregar backend a PM2"))
    story.append(code("""
cd C:\\inetpub\\wwwroot\\conex\\backendConex

pm2 start index.js `
  --name conex-backend `
  --cwd "C:\\inetpub\\wwwroot\\conex\\backendConex" `
  --env production

pm2 save
"""))
    story.append(h2("Verificar estado y logs"))
    story.append(code("""
pm2 status
pm2 describe conex-backend
pm2 logs conex-backend --lines 100
Get-Service "pm2.exe"
"""))
    story.append(h2("Reiniciar backend"))
    story.append(code("""
pm2 restart conex-backend --update-env
pm2 save
"""))
    story.append(h2("Si el servicio queda detenido"))
    story.append(code("""
Get-EventLog -LogName Application -Newest 30 | Where-Object {
  $_.Source -like "*PM2*" -or $_.Message -like "*pm2*"
} | Select-Object TimeGenerated, Source, EntryType, Message

sc.exe qc "pm2.exe"
"""))
    story.append(
        p(
            "Si el servicio apunta a otro usuario, por ejemplo C:\\Users\\APAdmin\\..., y ahora se esta trabajando con Administrator, eliminar el servicio viejo y reinstalarlo desde la cuenta correcta.",
            "Warn",
        )
    )
    story.append(code("""
Stop-Service "pm2.exe" -ErrorAction SilentlyContinue
sc.exe delete "pm2.exe"

npm install -g pm2
npm install -g pm2-windows-service
& "$env:APPDATA\\npm\\pm2-service-install.cmd"
"""))

    story.append(h1("8. Checklist de validacion"))
    checks = [
        "Node y npm responden con la version esperada.",
        "PM2 muestra conex-backend en estado online.",
        "El servicio pm2.exe esta configurado y puede iniciar con Windows.",
        "El puerto 3000 escucha solo de forma interna.",
        "La API responde en http://127.0.0.1:3000/backendDocker/test.",
        "La API responde publicamente a traves de IIS en /free/api/backendDocker/test.",
        "El frontend carga desde /free.",
        "El login llama a /free/api/backendDocker/seguridad/login.",
        "Las variables .env no estan versionadas en Git.",
    ]
    story.extend(bullet(checks))
    story.append(code("""
node -v
npm -v
pm2 -v
pm2 status
Get-Service "pm2.exe"
Get-NetTCPConnection -LocalPort 3000 -State Listen
Invoke-WebRequest http://127.0.0.1:3000/backendDocker/test -UseBasicParsing
Invoke-WebRequest https://www.conexco.cl/free/api/backendDocker/test -UseBasicParsing
"""))

    story.append(h1("9. Guia para subir un nuevo proyecto"))
    story.append(h2("1. Definir rutas y puerto"))
    story.append(
        make_table(
            [
                ["Elemento", "Ejemplo recomendado"],
                ["Frontend", "C:\\inetpub\\wwwroot\\nuevoProyecto\\front"],
                ["Backend", "C:\\inetpub\\wwwroot\\nuevoProyecto\\backend"],
                ["Ruta publica", "https://www.tudominio.cl/nuevo"],
                ["API publica", "https://www.tudominio.cl/nuevo/api/..."],
                ["Puerto Node", "3001"],
                ["Proceso PM2", "nuevo-backend"],
            ]
        )
    )
    story.append(h2("2. Preparar backend"))
    story.append(code("""
New-Item -ItemType Directory -Force "C:\\inetpub\\wwwroot\\nuevoProyecto\\backend"
cd C:\\inetpub\\wwwroot\\nuevoProyecto\\backend
npm install --omit=dev
"""))
    story.append(h2("3. Crear .env.production del backend"))
    story.append(code("""
NODE_ENV=production
PORT=3001

DB_SERVER=localhost
DB_PORT=1433
DB_INSTANCE=
DB_DATABASE=NOMBRE_BD
DB_USER=USUARIO_BD
DB_PASSWORD=PASSWORD_BD

DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

CORS_ORIGINS=https://www.tudominio.cl
"""))
    story.append(h2("4. Agregar backend a PM2"))
    story.append(code("""
cd C:\\inetpub\\wwwroot\\nuevoProyecto\\backend

pm2 start index.js `
  --name nuevo-backend `
  --cwd "C:\\inetpub\\wwwroot\\nuevoProyecto\\backend" `
  --env production

pm2 save
pm2 status
"""))
    story.append(h2("5. Preparar frontend"))
    story.append(code("""
VITE_APP_BASE_NAME=/nuevo
VITE_API_URL=/nuevo/api
"""))
    story.append(code("""
npm install
npm run build
"""))
    story.append(h2("6. Publicar frontend en IIS"))
    story.append(code("""
New-Item -ItemType Directory -Force "C:\\inetpub\\wwwroot\\nuevoProyecto\\front"
"""))
    story.append(p("Copiar el contenido de dist dentro de C:\\inetpub\\wwwroot\\nuevoProyecto\\front."))
    story.append(h2("7. web.config del nuevo frontend"))
    story.append(code("""
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="NUEVO_API_PROXY" stopProcessing="true">
          <match url="^api/(.*)$" />
          <action type="Rewrite" url="http://127.0.0.1:3001/{R:1}" />
        </rule>

        <rule name="NUEVO_FRONT_SPA" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/nuevo/index.html" />
        </rule>
      </rules>
    </rewrite>

    <staticContent>
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
    </staticContent>
  </system.webServer>
</configuration>
"""))
    story.append(h2("8. Validar proyecto nuevo"))
    story.append(code("""
Invoke-WebRequest http://127.0.0.1:3001/ping -UseBasicParsing -TimeoutSec 10
Invoke-WebRequest https://www.tudominio.cl/nuevo/api/ping -UseBasicParsing -TimeoutSec 15
pm2 logs nuevo-backend --lines 100
"""))

    story.append(h1("10. Recomendaciones para no afectar la aplicacion .NET"))
    story.extend(
        bullet(
            [
                "No modificar el web.config raiz de la aplicacion .NET.",
                "Crear una carpeta independiente por cada frontend.",
                "Crear una aplicacion virtual o sitio independiente en IIS.",
                "Usar un puerto Node distinto por cada backend.",
                "Definir reglas URL Rewrite dentro del web.config del frontend nuevo.",
                "No exponer publicamente los puertos 3000, 3001 o similares.",
                "Guardar procesos PM2 con pm2 save despues de cada cambio.",
                "Mantener credenciales en .env.production y fuera de Git.",
            ]
        )
    )
    story.append(h2("Patron recomendado"))
    story.append(code("""
www.conexco.cl/free        -> frontend CONEX
www.conexco.cl/free/api/*  -> Node puerto 3000

www.conexco.cl/nuevo       -> frontend nuevo
www.conexco.cl/nuevo/api/* -> Node puerto 3001
"""))

    return story


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = ManualDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.9 * cm,
        bottomMargin=2.0 * cm,
        title="Manual tecnico de despliegue CONEX en Windows Server",
        author="Codex",
        subject="Instalacion, configuracion y despliegue de frontend y backend en Windows Server",
    )
    story = build_story()
    doc.multiBuild(story)
    return OUTPUT


if __name__ == "__main__":
    STYLES = stylesheet()
    output = build_pdf()
    print(output)

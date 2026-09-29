[CmdletBinding()]
param(
  [string]$Database = 'CONEX_MIGRACION',
  [string]$OutputFile
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repositoryRoot '.env'

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "No existe $envPath. Configure primero la conexion del backend."
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
  if ($line -match '^\s*([^#=]+)=(.*)$') {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim().Trim('"').Trim("'")
    $settings[$name] = $value
  }
}

function Get-Setting([string[]]$Names) {
  foreach ($name in $Names) {
    if ($settings.ContainsKey($name) -and $settings[$name]) {
      return $settings[$name]
    }
  }
  throw "Falta configurar una de estas variables en .env: $($Names -join ', ')"
}

$server = Get-Setting @('DB_SERVER', 'SQLSERVER_HOST')
$instance = if ($settings['DB_INSTANCE']) { $settings['DB_INSTANCE'] } else { $settings['SQLSERVER_INSTANCE'] }
$port = if ($settings['DB_PORT']) { $settings['DB_PORT'] } else { $settings['SQLSERVER_PORT'] }
$user = Get-Setting @('DB_USER', 'SQLSERVER_USER')
$password = Get-Setting @('DB_PASSWORD', 'SQLSERVER_PASSWORD')

if ($instance) {
  $target = "$server\$instance"
} elseif ($port) {
  $target = "$server,$port"
} else {
  $target = $server
}

$sqlcmd = (Get-Command sqlcmd -ErrorAction Stop).Source
$backupRoot = (& $sqlcmd -S $target -U $user -P $password -d master -C -h -1 -W -Q `
  "SET NOCOUNT ON; SELECT CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultBackupPath'));" |
  Where-Object { $_.Trim() } | Select-Object -First 1).Trim()

if (-not $backupRoot -or -not (Test-Path -LiteralPath $backupRoot)) {
  $backupRoot = (& $sqlcmd -S $target -U $user -P $password -d master -C -h -1 -W -Q `
    "SET NOCOUNT ON; SELECT CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultDataPath'));" |
    Where-Object { $_.Trim() } | Select-Object -First 1).Trim()
}

if (-not $backupRoot -or -not (Test-Path -LiteralPath $backupRoot)) {
  throw 'SQL Server no informo un directorio de backup o datos accesible.'
}

$engineEdition = (& $sqlcmd -S $target -U $user -P $password -d master -C -h -1 -W -Q `
  "SET NOCOUNT ON; SELECT CONVERT(int, SERVERPROPERTY('EngineEdition'));" |
  Where-Object { $_.Trim() } | Select-Object -First 1).Trim()
$compressionOption = if ($engineEdition -eq '4') { '' } else { ', COMPRESSION' }

$databaseSqlName = $Database.Replace(']', ']]')
$serverBackup = Join-Path $backupRoot 'CONEX_portable.bak'
$serverBackupSql = $serverBackup.Replace("'", "''")

Write-Host "Creando respaldo consistente de $Database..."
& $sqlcmd -S $target -U $user -P $password -d master -C -b -Q `
  "BACKUP DATABASE [$databaseSqlName] TO DISK = N'$serverBackupSql' WITH COPY_ONLY, INIT$compressionOption, CHECKSUM, STATS = 10; RESTORE VERIFYONLY FROM DISK = N'$serverBackupSql' WITH CHECKSUM;"
if ($LASTEXITCODE -ne 0) { throw 'SQL Server no pudo crear o verificar el respaldo.' }

if (-not $OutputFile) {
  $OutputFile = Join-Path $repositoryRoot 'database\docker\backup\CONEX.bak'
}

$outputDirectory = Split-Path -Parent $OutputFile
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
Copy-Item -LiteralPath $serverBackup -Destination $OutputFile -Force

$backup = Get-Item -LiteralPath $OutputFile
Write-Host "Respaldo listo: $($backup.FullName) ($([math]::Round($backup.Length / 1MB, 1)) MB)"
Write-Host 'Este archivo contiene datos reales y no debe agregarse a Git.'

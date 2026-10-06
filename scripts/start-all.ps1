[CmdletBinding()]
param(
  [string]$ExperienceBuilderRoot = $env:EXPERIENCE_BUILDER_ROOT,
  [string]$AllowedOrigin = $env:MAP_NARRATOR_ALLOWED_ORIGIN,
  [switch]$SkipTailscale,
  [switch]$Funnel,
  [switch]$NoFunnel,
  [switch]$Stop
)

$ErrorActionPreference = 'Stop'
if ($SkipTailscale -and ($Funnel -or $NoFunnel)) {
  throw '-SkipTailscale no se puede combinar con -Funnel o -NoFunnel.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDirectory = Join-Path $repoRoot 'services\map-narrator-api'
$widgetSource = Join-Path $repoRoot 'client\your-extensions\widgets\map-narrator'
$credentialsFile = Join-Path $env:LOCALAPPDATA 'map-narrator\backend.env'
$logDirectory = Join-Path $env:TEMP 'map-narrator'

# Puertos que ocupa el conjunto. Se usan tanto para liberar los anteriores como
# para construir las URLs locales, de modo que no puedan desincronizarse.
$apiPort = 8787
$builderPort = 3000
$clientPort = 3001
$narratorPorts = @($apiPort, $builderPort, $clientPort)

$apiBaseUrl = "http://127.0.0.1:$apiPort"
$apiHealthUrl = "$apiBaseUrl/healthz"
$builderUrl = "http://127.0.0.1:$builderPort"

# Margenes de espera, en segundos.
$apiReadyAttempts = 30
$clientCompileAttempts = 150
$builderReadyAttempts = 60
$publicReadyAttempts = 30

function Wait-ForHttp {
  param([string]$Uri, [string]$Name, [int]$Attempts, [System.Diagnostics.Process]$Process, [string]$ErrorLog)

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if ($Process -and $Process.HasExited) {
      $details = if (Test-Path $ErrorLog) { Get-Content -Raw $ErrorLog } else { '' }
      throw "$Name termino antes de estar listo. $details"
    }
    try {
      Invoke-WebRequest -Uri $Uri -TimeoutSec 2 -UseBasicParsing | Out-Null
      Write-Host "  $Name listo"
      return
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "$Name no respondio en $Uri tras $Attempts segundos. Consulta $ErrorLog."
}

function Get-TailscaleDnsName {
  if (-not (Get-Command tailscale.exe -ErrorAction SilentlyContinue)) {
    throw 'Tailscale no esta instalado o tailscale.exe no esta disponible en PATH.'
  }

  $statusJson = (& tailscale.exe status --json 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo consultar Tailscale: $statusJson"
  }

  try {
    $status = $statusJson | ConvertFrom-Json
  } catch {
    throw "Tailscale devolvio una respuesta no valida: $statusJson"
  }

  if ($status.BackendState -ne 'Running') {
    Write-Host "Tailscale esta '$($status.BackendState)'. Activando la conexion..."
    # La salida se descarta: si no, se mezclaria con el valor devuelto.
    $null = & tailscale.exe up 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw 'No se pudo activar Tailscale. Ejecuta "tailscale up" manualmente y vuelve a intentarlo.'
    }
    $statusJson = (& tailscale.exe status --json 2>&1 | Out-String)
    $status = $statusJson | ConvertFrom-Json
  }

  if ($status.BackendState -ne 'Running' -or [string]::IsNullOrWhiteSpace($status.Self.DNSName)) {
    throw 'Tailscale no esta conectado o no tiene un nombre DNS disponible.'
  }

  return $status.Self.DNSName.TrimEnd('.')
}

function Resolve-ExperienceBuilderRoot {
  param([string]$ConfiguredRoot)

  $candidates = @(
    $ConfiguredRoot,
    (Join-Path $HOME 'arcgis-experience-builder-1.21'),
    (Join-Path $HOME 'arcgis-experience-builder'),
    (Join-Path $HOME 'Downloads\arcgis-experience-builder-1.21')
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

  foreach ($candidate in $candidates) {
    $resolved = $candidate
    if (Test-Path $candidate) {
      $resolved = (Resolve-Path $candidate).Path
      if ((Test-Path (Join-Path $resolved 'server')) -and (Test-Path (Join-Path $resolved 'client'))) {
        return $resolved
      }
    }
  }

  if ($ConfiguredRoot) {
    Write-Warning "EXPERIENCE_BUILDER_ROOT no apunta a una instalacion valida: '$ConfiguredRoot'."
  }
  $entered = Read-Host 'Indica la ruta de ArcGIS Experience Builder'
  if (-not $entered -or -not (Test-Path (Join-Path $entered 'server')) -or -not (Test-Path (Join-Path $entered 'client'))) {
    throw 'No se encontro una instalacion valida de Experience Builder. Define EXPERIENCE_BUILDER_ROOT o usa -ExperienceBuilderRoot con una carpeta que contenga server y client.'
  }
  return (Resolve-Path $entered).Path
}

function Assert-CommandAvailable {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name no esta disponible en PATH. Instala la dependencia y vuelve a intentarlo."
  }
}

function Get-DescendantProcessIds {
  param([int]$RootId)

  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootId" -ErrorAction SilentlyContinue)
  $ids = @($children | ForEach-Object { $_.ProcessId })
  foreach ($child in $ids) {
    $ids += Get-DescendantProcessIds -RootId $child
  }
  return $ids
}

function Stop-ProcessesOnPorts {
  param([int[]]$Ports)

  $processIds = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $Ports } |
    Select-Object -ExpandProperty OwningProcess -Unique)
  if ($processIds.Count -eq 0) {
    return
  }

  Write-Host "Deteniendo procesos anteriores en los puertos $($Ports -join ', ')..."
  $allIds = @($processIds | ForEach-Object {
    @($_) + @(Get-DescendantProcessIds -RootId $_)
  } | Select-Object -Unique)
  foreach ($processId in ($allIds | Sort-Object -Descending)) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      # El proceso puede desaparecer entre la consulta de puertos y la detencion.
      if ($_.Exception.Message -match 'No se encuentra ning|Cannot find a process') {
        continue
      }
      if ($_.Exception -is [System.ComponentModel.Win32Exception] -or $_.Exception.Message -match 'Access is denied|Acceso denegado') {
        throw "No se pudo detener el proceso $processId. Ejecuta este script desde PowerShell como administrador."
      }
      throw
    }
  }
  Start-Sleep -Seconds 2
}

<#
  Publica los puertos locales mediante Tailscale Serve o Funnel.

  No devuelve nada a proposito. Las URLs publicas se derivan del nombre DNS en
  el arranque, y una funcion que ejecuta comandos externos y ademas devuelve un
  valor acaba contaminando ese valor con la salida de los comandos.
#>
function Set-TailscaleExposure {
  param([string]$DnsName, [switch]$UseFunnel)

  $command = if ($UseFunnel) { 'funnel' } else { 'serve' }
  Write-Host "Configurando Tailscale $command..."

  $null = & tailscale.exe $command --https=443 --bg "http://127.0.0.1:$builderPort" 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo publicar Experience Builder con Tailscale $command."
  }

  $null = & tailscale.exe $command --https=8443 --bg "http://127.0.0.1:$apiPort" 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo publicar la API con Tailscale $command."
  }
}

function Resolve-FunnelChoice {
  param([switch]$Enable, [switch]$Disable)

  if ($Enable -and $Disable) {
    throw 'No puedes usar -Funnel y -NoFunnel al mismo tiempo.'
  }
  if ($Enable) { return $true }
  if ($Disable) { return $false }

  do {
    $answer = (Read-Host '¿Quieres activar Tailscale Funnel para acceso público? (S/N)').Trim().ToLowerInvariant()
  } while ($answer -notin @('s', 'si', 'sí', 'n', 'no'))
  return $answer -in @('s', 'si', 'sí')
}

# El cliente de Experience Builder es `webpack --watch` y no escucha en ningun
# puerto, asi que Stop-ProcessesOnPorts no lo detiene. Varios watchers vivos a la
# vez reescriben client\dist y dejan una compilacion antigua (version del widget
# inconsistente).
function Stop-WebpackWatchers {
  param([string]$Root)

  $clientDir = (Join-Path $Root 'client').TrimEnd('\')
  $watchers = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessId -ne $PID -and $_.CommandLine -and
    $_.CommandLine.IndexOf($clientDir, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $_.CommandLine -match 'webpack|cross-env|pnpm'
  })
  if ($watchers.Count -eq 0) { return }

  Write-Host "Deteniendo $($watchers.Count) proceso(s) webpack anteriores del cliente..."
  $allIds = @($watchers | ForEach-Object {
    @($_.ProcessId) + @(Get-DescendantProcessIds -RootId $_.ProcessId)
  } | Select-Object -Unique)
  foreach ($processId in ($allIds | Sort-Object -Descending)) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
}

function Get-JsonVersion {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  return (Get-Content -Raw $Path | ConvertFrom-Json).version
}

# Espera a que webpack publique en client\dist la misma version que el fuente;
# si no, el navegador seguiria mostrando una compilacion antigua.
function Wait-ForWidgetBuild {
  param([string]$DistWidgetDir, [string]$ExpectedVersion, [int]$Attempts, [System.Diagnostics.Process]$Process, [string]$ErrorLog)

  $bundle = Join-Path $DistWidgetDir 'dist\runtime\widget.js'
  $marker = [regex]::Escape("$ExpectedVersion") + '\s\S{1,3}\sstable'
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if ($Process -and $Process.HasExited) {
      $details = if (Test-Path $ErrorLog) { Get-Content -Raw $ErrorLog } else { '' }
      throw "El cliente de Experience Builder termino durante la compilacion. $details"
    }
    if ((Get-JsonVersion (Join-Path $DistWidgetDir 'manifest.json')) -eq $ExpectedVersion -and (Test-Path $bundle) -and
        (Select-String -Path $bundle -Pattern $marker -Quiet)) {
      Write-Host "  Widget compilado: version $ExpectedVersion"
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "El widget compilado no alcanzo la version $ExpectedVersion tras $($Attempts * 2) segundos. Consulta $ErrorLog."
}

if ($Stop) {
  Stop-ProcessesOnPorts -Ports $narratorPorts
  if ($ExperienceBuilderRoot) { Stop-WebpackWatchers -Root $ExperienceBuilderRoot }
  Write-Host 'Procesos de Map Narrator detenidos.'
  exit 0
}

if (Test-Path $credentialsFile) {
  foreach ($line in Get-Content $credentialsFile) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      if (-not (Get-Item "Env:$($Matches[1])" -ErrorAction SilentlyContinue)) {
        Set-Item "Env:$($Matches[1])" $Matches[2]
      }
    } elseif (-not $env:OPENAI_API_KEY -and -not [string]::IsNullOrWhiteSpace($line)) {
      $env:OPENAI_API_KEY = $line.Trim()
    }
  }
  Write-Host "Configuracion cargada desde $credentialsFile"
}
if (-not $env:OPENAI_API_KEY) {
  throw 'Configura OPENAI_API_KEY o ejecuta .\scripts\save-api-key.ps1.'
}

Assert-CommandAvailable 'node.exe'
Assert-CommandAvailable 'npm.cmd'
Assert-CommandAvailable 'pnpm.cmd'

$ExperienceBuilderRoot = Resolve-ExperienceBuilderRoot -ConfiguredRoot $ExperienceBuilderRoot
$widgetTarget = Join-Path $ExperienceBuilderRoot 'client\your-extensions\widgets\map-narrator'
if (-not (Test-Path (Join-Path $widgetSource 'manifest.json'))) {
  throw "No se encontró el widget fuente en '$widgetSource'."
}
# Primero se detiene todo (incluidos los watchers de webpack) para que ningun
# proceso antiguo reescriba la compilacion mientras se sincroniza el widget.
Stop-ProcessesOnPorts -Ports $narratorPorts
Stop-WebpackWatchers -Root $ExperienceBuilderRoot

# /MIR elimina tambien los ficheros que ya no existen en el fuente.
New-Item -ItemType Directory -Force -Path $widgetTarget | Out-Null
& robocopy.exe $widgetSource $widgetTarget /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "No se pudo sincronizar el widget en '$widgetTarget' (robocopy $LASTEXITCODE)."
}
$global:LASTEXITCODE = 0
$expectedVersion = Get-JsonVersion (Join-Path $widgetSource 'manifest.json')
Write-Host "Widget $expectedVersion sincronizado en $widgetTarget"

# Se descarta la compilacion anterior para que el cliente genere una nueva.
$distWidgetDir = Join-Path $ExperienceBuilderRoot 'client\dist\widgets\map-narrator'
if (Test-Path $distWidgetDir) { Remove-Item -Recurse -Force $distWidgetDir }

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$apiOutput = Join-Path $logDirectory 'api.out.log'
$apiError = Join-Path $logDirectory 'api.err.log'
$builderOutput = Join-Path $logDirectory 'experience-builder.out.log'
$builderError = Join-Path $logDirectory 'experience-builder.err.log'
$clientOutput = Join-Path $logDirectory 'experience-builder-client.out.log'
$clientError = Join-Path $logDirectory 'experience-builder-client.err.log'

# Se declaran antes del arranque para que el bloque catch pueda consultarlos
# aunque el fallo ocurra antes de crear los procesos.
$apiProcess = $null
$clientProcess = $null
$builderProcess = $null
$funnelEnabled = $false
$tailscaleDnsName = $null

if ($SkipTailscale) {
  if (-not $AllowedOrigin) {
    $AllowedOrigin = "http://localhost:$clientPort"
  }
  $publicUrls = @{
    AppUrl = $AllowedOrigin
    ApiUrl = "$apiBaseUrl/api/map-description"
  }
} else {
  $tailscaleDnsName = Get-TailscaleDnsName
  $funnelEnabled = Resolve-FunnelChoice -Enable:$Funnel -Disable:$NoFunnel
  $publicUrls = @{
    AppUrl = "https://$tailscaleDnsName"
    ApiUrl = "https://$tailscaleDnsName`:8443/api/map-description"
  }
  $AllowedOrigin = $publicUrls.AppUrl
}

Write-Host '=== Map Narrator - Arranque completo ==='
$previousOrigin = $env:MAP_NARRATOR_ALLOWED_ORIGIN
$env:MAP_NARRATOR_ALLOWED_ORIGIN = $AllowedOrigin
try {
  Write-Host 'Arrancando backend API...'
  $apiProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' -WorkingDirectory $apiDirectory -RedirectStandardOutput $apiOutput -RedirectStandardError $apiError -PassThru
} finally {
  $env:MAP_NARRATOR_ALLOWED_ORIGIN = $previousOrigin
}
Write-Host "  Backend PID: $($apiProcess.Id)"

try {
  Wait-ForHttp -Uri $apiHealthUrl -Name 'Backend' -Attempts $apiReadyAttempts -Process $apiProcess -ErrorLog $apiError

  Write-Host 'Arrancando Experience Builder client...'
  $clientProcess = Start-Process -FilePath 'pnpm.cmd' -ArgumentList @('start') -WorkingDirectory (Join-Path $ExperienceBuilderRoot 'client') -RedirectStandardOutput $clientOutput -RedirectStandardError $clientError -PassThru
  Write-Host "  Experience Builder client PID: $($clientProcess.Id)"
  Wait-ForWidgetBuild -DistWidgetDir $distWidgetDir -ExpectedVersion $expectedVersion -Attempts $clientCompileAttempts -Process $clientProcess -ErrorLog $clientError

  Write-Host 'Arrancando Experience Builder...'
  $builderProcess = Start-Process -FilePath 'node.exe' -ArgumentList @('src/server', '--dev_edition', '--http_only') -WorkingDirectory (Join-Path $ExperienceBuilderRoot 'server') -RedirectStandardOutput $builderOutput -RedirectStandardError $builderError -PassThru
  Write-Host "  Experience Builder PID: $($builderProcess.Id)"
  Wait-ForHttp -Uri $builderUrl -Name 'Experience Builder' -Attempts $builderReadyAttempts -Process $builderProcess -ErrorLog $builderError

  if (-not $SkipTailscale) {
    Set-TailscaleExposure -DnsName $tailscaleDnsName -UseFunnel:$funnelEnabled
    Wait-ForHttp -Uri $publicUrls.AppUrl -Name 'Experience Builder via Tailscale' -Attempts $publicReadyAttempts -Process $builderProcess -ErrorLog $builderError
  }
} catch {
  foreach ($process in @($clientProcess, $builderProcess, $apiProcess)) {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id }
  }
  throw
}

Write-Host ''
Write-Host '=== Listo ==='
Write-Host "App: $($publicUrls.AppUrl)"
Write-Host "API: $($publicUrls.ApiUrl)"
if (-not $SkipTailscale) {
  Write-Host "Acceso público (Funnel): $funnelEnabled"
}
Write-Host "Logs: $logDirectory"

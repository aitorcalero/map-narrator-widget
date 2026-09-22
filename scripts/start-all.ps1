[CmdletBinding()]
param(
  [string]$ExperienceBuilderRoot = $env:EXPERIENCE_BUILDER_ROOT,
  [string]$AllowedOrigin = $env:MAP_NARRATOR_ALLOWED_ORIGIN,
  [switch]$SkipTailscale
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDirectory = Join-Path $repoRoot 'services\map-narrator-api'
$credentialsFile = Join-Path $env:LOCALAPPDATA 'map-narrator\backend.env'
$logDirectory = Join-Path $env:TEMP 'map-narrator'

function Wait-ForHttp {
  param([string]$Uri, [string]$Name, [int]$Attempts, [System.Diagnostics.Process]$Process, [string]$ErrorLog)

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if ($Process.HasExited) {
      $details = if (Test-Path $ErrorLog) { Get-Content -Raw $ErrorLog } else { '' }
      throw "$Name terminó antes de estar listo. $details"
    }
    try {
      Invoke-WebRequest -Uri $Uri -TimeoutSec 2 -UseBasicParsing | Out-Null
      Write-Host "  $Name listo"
      return
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "$Name no respondió en $Uri tras $Attempts segundos. Consulta $ErrorLog."
}

function Get-TailscaleDnsName {
  if (-not (Get-Command tailscale.exe -ErrorAction SilentlyContinue)) {
    throw 'Tailscale no está instalado o tailscale.exe no está disponible en PATH.'
  }

  $statusJson = (& tailscale.exe status --json 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo consultar Tailscale: $statusJson"
  }

  try {
    $status = $statusJson | ConvertFrom-Json
  } catch {
    throw "Tailscale devolvió una respuesta no válida: $statusJson"
  }

  if ($status.BackendState -ne 'Running') {
    Write-Host "Tailscale está '$($status.BackendState)'. Activando la conexión..."
    & tailscale.exe up
    if ($LASTEXITCODE -ne 0) {
      throw 'No se pudo activar Tailscale. Ejecuta "tailscale up" manualmente y vuelve a intentarlo.'
    }
    $statusJson = (& tailscale.exe status --json 2>&1 | Out-String)
    $status = $statusJson | ConvertFrom-Json
  }

  if ($status.BackendState -ne 'Running' -or [string]::IsNullOrWhiteSpace($status.Self.DNSName)) {
    throw 'Tailscale no está conectado o no tiene un nombre DNS disponible.'
  }

  return $status.Self.DNSName.TrimEnd('.')
}

function Configure-TailscaleServe {
  param([string]$DnsName)

  Write-Host 'Configurando Tailscale Serve...'
  & tailscale.exe serve --https=443 --bg http://127.0.0.1:3000
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo publicar Experience Builder con Tailscale Serve.'
  }
  & tailscale.exe serve --https=8443 --bg http://127.0.0.1:8787
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo publicar la API con Tailscale Serve.'
  }

  return @{
    AppUrl = "https://$DnsName"
    ApiUrl = "https://$DnsName`:8443/api/map-description"
  }
}

if (-not $env:OPENAI_API_KEY -and (Test-Path $credentialsFile)) {
  $env:OPENAI_API_KEY = (Get-Content -Raw $credentialsFile).TrimEnd([char[]]"`r`n")
  Write-Host "Credenciales cargadas desde $credentialsFile"
}
if (-not $env:OPENAI_API_KEY) {
  throw 'Configura OPENAI_API_KEY o ejecuta .\scripts\save-api-key.ps1.'
}
if (-not $ExperienceBuilderRoot) {
  $ExperienceBuilderRoot = Read-Host 'Indica la ruta de ArcGIS Experience Builder'
}
if (-not $ExperienceBuilderRoot -or -not (Test-Path (Join-Path $ExperienceBuilderRoot 'server'))) {
  throw "No se encontró la carpeta server en '$ExperienceBuilderRoot'. Define EXPERIENCE_BUILDER_ROOT o pasa -ExperienceBuilderRoot."
}

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$apiOutput = Join-Path $logDirectory 'api.out.log'
$apiError = Join-Path $logDirectory 'api.err.log'
$builderOutput = Join-Path $logDirectory 'experience-builder.out.log'
$builderError = Join-Path $logDirectory 'experience-builder.err.log'
$clientOutput = Join-Path $logDirectory 'experience-builder-client.out.log'
$clientError = Join-Path $logDirectory 'experience-builder-client.err.log'

if ($SkipTailscale) {
  if (-not $AllowedOrigin) {
    $AllowedOrigin = 'http://localhost:3001'
  }
  $publicUrls = @{
    AppUrl = $AllowedOrigin
    ApiUrl = 'http://127.0.0.1:8787/api/map-description'
  }
} else {
  $tailscaleDnsName = Get-TailscaleDnsName
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
  Wait-ForHttp -Uri 'http://127.0.0.1:8787/healthz' -Name 'Backend' -Attempts 30 -Process $apiProcess -ErrorLog $apiError
  Write-Host 'Arrancando Experience Builder client...'
  $clientProcess = Start-Process -FilePath 'pnpm.cmd' -ArgumentList @('start') -WorkingDirectory (Join-Path $ExperienceBuilderRoot 'client') -RedirectStandardOutput $clientOutput -RedirectStandardError $clientError -PassThru
  Write-Host "  Experience Builder client PID: $($clientProcess.Id)"
  Start-Sleep -Seconds 5
  if ($clientProcess.HasExited) {
    $details = if (Test-Path $clientError) { Get-Content -Raw $clientError } else { '' }
    throw "Experience Builder client terminó antes de compilar. $details"
  }
  Write-Host 'Arrancando Experience Builder...'
  $builderProcess = Start-Process -FilePath 'node.exe' -ArgumentList @('src/server', '--dev_edition', '--http_only') -WorkingDirectory (Join-Path $ExperienceBuilderRoot 'server') -RedirectStandardOutput $builderOutput -RedirectStandardError $builderError -PassThru
  Write-Host "  Experience Builder PID: $($builderProcess.Id)"
  Wait-ForHttp -Uri 'http://127.0.0.1:3000' -Name 'Experience Builder' -Attempts 60 -Process $builderProcess -ErrorLog $builderError
  if (-not $SkipTailscale) {
    $publicUrls = Configure-TailscaleServe -DnsName $tailscaleDnsName
    Wait-ForHttp -Uri $publicUrls.AppUrl -Name 'Experience Builder vía Tailscale' -Attempts 30 -Process $builderProcess -ErrorLog $builderError
  }
} catch {
  if ($clientProcess -and -not $clientProcess.HasExited) { Stop-Process -Id $clientProcess.Id }
  if ($builderProcess -and -not $builderProcess.HasExited) { Stop-Process -Id $builderProcess.Id }
  if ($apiProcess -and -not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id }
  throw
}

Write-Host ''
Write-Host '=== Listo ==='
Write-Host "App: $($publicUrls.AppUrl)"
Write-Host "API: $($publicUrls.ApiUrl)"
Write-Host "Logs: $logDirectory"

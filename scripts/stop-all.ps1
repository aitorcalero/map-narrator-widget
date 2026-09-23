[CmdletBinding()]
param(
  [switch]$ResetTailscale,
  [switch]$CloseWebpack
)

$ErrorActionPreference = 'Stop'

function Get-DescendantProcessIds {
  param([int]$RootId)

  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootId" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    @($child.ProcessId) + @(Get-DescendantProcessIds -RootId $child.ProcessId)
  }
}

function Stop-ProcessesOnPorts {
  param([int[]]$Ports)

  $processIds = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $Ports } |
    Select-Object -ExpandProperty OwningProcess -Unique)

  foreach ($processId in $processIds) {
    $allIds = (@($processId) + @(Get-DescendantProcessIds -RootId $processId)) |
      Select-Object -Unique |
      Sort-Object -Descending
    foreach ($id in $allIds) {
      try {
        Stop-Process -Id $id -Force -ErrorAction Stop
        Write-Host "Proceso detenido: $id"
      } catch {
        if ($_.Exception.Message -notmatch 'no existe|does not exist') {
          throw "No se pudo detener el proceso $id. Ejecuta PowerShell como administrador si tiene privilegios elevados."
        }
      }
    }
  }
}

function Stop-WebpackProcesses {
  $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine -match '(?i)webpack' -or
        $_.CommandLine -match '(?i)experience-builder.*client'
      )
    })

  foreach ($process in $processes) {
    $allIds = (@($process.ProcessId) + @(Get-DescendantProcessIds -RootId $process.ProcessId)) |
      Select-Object -Unique |
      Sort-Object -Descending
    foreach ($id in $allIds) {
      try {
        Stop-Process -Id $id -Force -ErrorAction Stop
        Write-Host "Webpack/proceso de cliente detenido: $id"
      } catch {
        if ($_.Exception.Message -notmatch 'no existe|does not exist') {
          throw "No se pudo detener el proceso Webpack $id. Ejecuta PowerShell como administrador si tiene privilegios elevados."
        }
      }
    }
  }
}

Write-Host 'Deteniendo Map Narrator en los puertos 8787, 3000 y 3001...'
Stop-ProcessesOnPorts -Ports @(8787, 3000, 3001)
if ($CloseWebpack) {
  Stop-WebpackProcesses
}

if ($ResetTailscale) {
  if (Get-Command tailscale.exe -ErrorAction SilentlyContinue) {
    $null = & tailscale.exe serve reset 2>&1
    $serveExit = $LASTEXITCODE
    $null = & tailscale.exe funnel reset 2>&1
    $funnelExit = $LASTEXITCODE
    if ($serveExit -ne 0 -and $funnelExit -ne 0) {
      throw 'No se pudo retirar la configuración de Tailscale Serve/Funnel.'
    }
    Write-Host 'Configuración de Tailscale Serve/Funnel retirada.'
  } else {
    Write-Warning 'tailscale.exe no está disponible; no se modificó Tailscale.'
  }
}

Write-Host 'Map Narrator detenido.'

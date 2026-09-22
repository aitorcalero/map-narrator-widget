[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$credentialsDirectory = Join-Path $env:LOCALAPPDATA 'map-narrator'
$credentialsFile = Join-Path $credentialsDirectory 'backend.env'

New-Item -ItemType Directory -Force -Path $credentialsDirectory | Out-Null
Write-Host '=== Guardado seguro de credenciales de OpenAI ==='
$secureKey = Read-Host 'Pega la clave de OpenAI' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($key)) {
    throw 'La clave está vacía.'
  }
  if (-not $key.StartsWith('sk-', [StringComparison]::Ordinal)) {
    throw "La clave debe empezar por 'sk-'."
  }
  if ([regex]::Matches($key, [regex]::Escape('sk-')).Count -ne 1) {
    throw "La clave debe contener exactamente un prefijo 'sk-'."
  }
  if ($key -match '[\x00-\x1f\x7f]') {
    throw 'La clave contiene caracteres de control.'
  }
  if ($key.Length % 2 -eq 0 -and $key.Substring(0, $key.Length / 2) -ceq $key.Substring($key.Length / 2)) {
    throw 'La clave parece estar duplicada.'
  }

  [System.IO.File]::WriteAllText($credentialsFile, $key, [System.Text.UTF8Encoding]::new($false))
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl = Get-Acl $credentialsFile
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')))
  Set-Acl -Path $credentialsFile -AclObject $acl
  Write-Host "Clave guardada para el usuario actual en $credentialsFile"
} finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

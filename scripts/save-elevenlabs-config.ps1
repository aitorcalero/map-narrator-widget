[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$credentialsDirectory = Join-Path $env:LOCALAPPDATA 'map-narrator'
$credentialsFile = Join-Path $credentialsDirectory 'backend.env'

New-Item -ItemType Directory -Force -Path $credentialsDirectory | Out-Null
Write-Host '=== Configuración segura de ElevenLabs ==='
$secureKey = Read-Host 'Pega la API key de ElevenLabs' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($key) -or $key -match '[\x00-\x1f\x7f]') {
    throw 'La API key está vacía o contiene caracteres no válidos.'
  }
  $voiceId = Read-Host 'Voice ID de ElevenLabs'
  if ([string]::IsNullOrWhiteSpace($voiceId) -or $voiceId -match '[\x00-\x1f\x7f]') {
    throw 'El Voice ID está vacío o contiene caracteres no válidos.'
  }
  $model = Read-Host 'Modelo de ElevenLabs [eleven_multilingual_v2]'
  if ([string]::IsNullOrWhiteSpace($model)) { $model = 'eleven_multilingual_v2' }
  if ($model -match '[\x00-\x1f\x7f]') { throw 'El modelo contiene caracteres no válidos.' }

  $values = @{}
  if (Test-Path $credentialsFile) {
    foreach ($line in Get-Content $credentialsFile) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $values[$Matches[1]] = $Matches[2]
      } elseif (-not $values.ContainsKey('OPENAI_API_KEY') -and -not [string]::IsNullOrWhiteSpace($line)) {
        $values.OPENAI_API_KEY = $line.Trim()
      }
    }
  }
  $values.ELEVENLABS_API_KEY = $key
  $values.ELEVENLABS_VOICE_ID = $voiceId
  $values.ELEVENLABS_MODEL = $model
  $content = @($values.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" })
  [System.IO.File]::WriteAllLines($credentialsFile, $content, [System.Text.UTF8Encoding]::new($false))

  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl = Get-Acl $credentialsFile
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')))
  Set-Acl -Path $credentialsFile -AclObject $acl
  Write-Host "ElevenLabs configurado para el usuario actual en $credentialsFile"
} finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

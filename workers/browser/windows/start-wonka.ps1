$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $env:LOCALAPPDATA 'Synthetiq'
$ProfileDir = Join-Path $StateDir 'ChromeWonka'
$TokenFile = Join-Path $StateDir 'worker-token.txt'
$DataDir = Join-Path $StateDir 'LocalComputerData'
$Port = 9222

if (-not (Test-Path $TokenFile)) { throw 'Falta la clave local. Ejecuta primero setup-wonka.ps1.' }

$Encrypted = (Get-Content -Raw -Path $TokenFile).Trim()
$SecureToken = ConvertTo-SecureString $Encrypted
$Ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
try { $Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr) }

$ChromeCandidates = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path $_) }
$Chrome = $ChromeCandidates | Select-Object -First 1
if (-not $Chrome) { throw 'No encontré Google Chrome instalado.' }

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# Chrome 136+ requiere un user-data-dir no predeterminado para remote debugging.
Start-Process -FilePath $Chrome -ArgumentList @(
  "--remote-debugging-port=$Port",
  '--remote-debugging-address=127.0.0.1',
  "--user-data-dir=$ProfileDir",
  '--no-first-run'
)

$Ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2
    $Ready = $true
    break
  } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $Ready) { throw 'Chrome Wonka no abrió el puerto local 9222.' }

$env:SYNTHETIQ_API_URL = 'https://lamanitodelvegano.vercel.app'
$env:SYNTHETIQ_WORKER_TOKEN = $Token
$env:SYNTHETIQ_WORKER_ID = "local-windows-$env:COMPUTERNAME"
$env:BROWSER_CDP_URL = "http://127.0.0.1:$Port"
$env:BROWSER_DATA_DIR = $DataDir
$env:BROWSER_HEADLESS = 'false'
$env:WORKER_PROVIDERS = 'google_flow,chatgpt_web,gemini_web,claude_web,higgsfield'
$env:POLL_MS = '4000'

Write-Host "\nSynthetiq Local Computer ONLINE" -ForegroundColor Green
Write-Host "Chrome Wonka: $ProfileDir"
Write-Host 'Puedes minimizar esta ventana. No la cierres mientras quieras que Wonka use las cuotas web.' -ForegroundColor Yellow

Push-Location $Root
try { node src/index.js }
finally { Pop-Location }

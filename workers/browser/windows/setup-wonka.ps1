$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$StateDir = Join-Path $env:LOCALAPPDATA 'Synthetiq'
$ProfileDir = Join-Path $StateDir 'ChromeWonka'
$TokenFile = Join-Path $StateDir 'worker-token.txt'

Write-Host "\n=== Synthetiq Local Computer · Setup ===" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js no está instalado. Instala Node.js LTS y vuelve a ejecutar este script.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm no está disponible.'
}

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

Push-Location $Root
try {
  Write-Host 'Instalando dependencias del worker...'
  npm install
} finally {
  Pop-Location
}

Write-Host "\nGenera una clave en Panel Maestro > Synthetiq Computer > Generar clave para este PC." -ForegroundColor Yellow
$SecureToken = Read-Host 'Pega aquí la clave local' -AsSecureString
$Encrypted = ConvertFrom-SecureString $SecureToken
Set-Content -Path $TokenFile -Value $Encrypted -Encoding UTF8 -NoNewline

$ChromeCandidates = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path $_) }
$Chrome = $ChromeCandidates | Select-Object -First 1
if (-not $Chrome) { throw 'No encontré Google Chrome instalado.' }

Write-Host "\nAhora se abrirá Chrome Wonka. Inicia sesión con la cuenta de trabajo que quieras usar (por ahora Makangru), abre Flow y confirma que entra normalmente." -ForegroundColor Green
Write-Host 'Cuando termines el login, CIERRA completamente esa ventana Chrome Wonka. Luego ejecuta start-wonka.ps1.' -ForegroundColor Green
Start-Process -FilePath $Chrome -ArgumentList @("--user-data-dir=$ProfileDir", '--no-first-run')

Write-Host "\nSetup terminado. Perfil: $ProfileDir" -ForegroundColor Cyan

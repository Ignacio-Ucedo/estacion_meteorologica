param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

function Test-CommandAvailable {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PythonCommand {
    if (Test-Path $VenvPython) {
        return $VenvPython
    }
    if (Test-CommandAvailable "python") {
        return "python"
    }
    if (Test-CommandAvailable "py") {
        return "py"
    }
    throw "No se encontro Python. Instala Python 3 y vuelve a ejecutar setup-simulation.bat."
}

function Get-PackageManager {
    if (Test-CommandAvailable "pnpm") {
        return "pnpm"
    }
    if (Test-CommandAvailable "npm") {
        return "npm"
    }
    throw "No se encontro pnpm ni npm. Instala Node.js LTS y vuelve a ejecutar setup-simulation.bat."
}

Write-Host "WeatherOS simulation setup" -ForegroundColor Cyan
Write-Host "Repository: $RepoRoot"
Write-Host ""

if (-not (Test-Path $BackendDir)) {
    throw "No existe la carpeta backend: $BackendDir"
}
if (-not (Test-Path $FrontendDir)) {
    throw "No existe la carpeta frontend: $FrontendDir"
}

if (-not $SkipBackend) {
    $pythonCommand = Get-PythonCommand
    if (-not (Test-Path $VenvPython)) {
        Write-Host "Creando entorno virtual Python en backend\.venv ..." -ForegroundColor Yellow
        & $pythonCommand -m venv (Join-Path $BackendDir ".venv")
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo crear backend\.venv."
        }
    }

    Write-Host "Instalando dependencias Python del backend ..." -ForegroundColor Yellow
    & $VenvPython -m pip install -r (Join-Path $BackendDir "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudieron instalar las dependencias Python."
    }
}
else {
    Write-Host "Omitiendo setup backend (-SkipBackend)." -ForegroundColor Yellow
}

if (-not $SkipFrontend) {
    $packageManager = Get-PackageManager
    Write-Host "Instalando dependencias del frontend con $packageManager ..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    try {
        if ($packageManager -eq "pnpm") {
            & pnpm install
        }
        else {
            & npm install
        }
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudieron instalar las dependencias del frontend."
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "Omitiendo setup frontend (-SkipFrontend)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup finalizado correctamente." -ForegroundColor Green
Write-Host "Ejecuta start-simulation.bat para iniciar la simulacion."

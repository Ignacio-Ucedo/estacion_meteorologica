param(
    [string]$AppId = "1",
    [string]$Broker = "localhost:1883",
    [string]$DevEui = "0000000000000002",
    [int]$DeviceId = 2,
    [int]$IntervalSeconds = 15,
    [switch]$Once,
    [switch]$SkipInfra,
    [switch]$SkipWeb,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$InfraDir = Join-Path $RepoRoot "infra"
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$GatewayMockDir = Join-Path $RepoRoot "firmware\gateway-mock"
$SimulationApi = Join-Path $ScriptDir "simulation_api.py"

function Test-CommandAvailable {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Start-ConsoleProcess {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $safeTitle = $Title.Replace("'", "''")
    $safeWorkingDirectory = $WorkingDirectory.Replace("'", "''")
    $script = @"
`$Host.UI.RawUI.WindowTitle = '$safeTitle'
Set-Location -LiteralPath '$safeWorkingDirectory'
$Command
"@

    $bytes = [System.Text.Encoding]::Unicode.GetBytes($script)
    $encoded = [Convert]::ToBase64String($bytes)
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        $encoded
    ) | Out-Null
}

Write-Host "Weather station simulation launcher" -ForegroundColor Cyan
Write-Host "Repository: $RepoRoot"
Write-Host ""

$dockerAvailable = Test-CommandAvailable "docker"
$cargoAvailable = Test-CommandAvailable "cargo"
$infraStarted = $false

if (-not (Test-Path $InfraDir)) {
    throw "No existe la carpeta infra: $InfraDir"
}
if (-not (Test-Path $BackendDir)) {
    throw "No existe la carpeta backend: $BackendDir"
}
if (-not (Test-Path $FrontendDir)) {
    throw "No existe la carpeta frontend: $FrontendDir"
}
if (-not (Test-Path $GatewayMockDir)) {
    throw "No existe la carpeta firmware\gateway-mock: $GatewayMockDir"
}
if (-not (Test-Path $SimulationApi)) {
    throw "No existe la API de simulacion: $SimulationApi"
}

$backendPython = "python"
$venvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    $backendPython = $venvPython
}
elseif (Test-CommandAvailable "python") {
    $backendPython = "python"
}
elseif (Test-CommandAvailable "py") {
    $backendPython = "py"
}
else {
    throw "No se encontro Python en PATH. Instala Python o habilita el comando py/python antes de iniciar la simulacion."
}

& $backendPython -c "import uvicorn, fastapi, paho.mqtt.client, influxdb_client" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Faltan dependencias Python para la ingesta. Ejecuta: cd backend; python -m pip install -r requirements.txt"
}

$packageManager = $null
if (Test-CommandAvailable "pnpm") {
    $packageManager = "pnpm"
}
elseif (Test-CommandAvailable "npm") {
    $packageManager = "npm"
}
else {
    $bundledPnpm = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"
    if (Test-Path $bundledPnpm) {
        $packageManager = $bundledPnpm
    }
}

if (-not $SkipWeb) {
    if ($null -eq $packageManager) {
        throw "No se encontro pnpm ni npm en PATH. Instalalo para iniciar el frontend."
    }
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        throw "Faltan dependencias del frontend. Ejecuta: cd frontend; $packageManager install"
    }
}

if ((-not $SkipInfra) -and $dockerAvailable) {
    Write-Host "Starting infrastructure with docker compose..." -ForegroundColor Yellow
    Push-Location $InfraDir
    try {
        & docker compose up -d
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Docker compose no pudo iniciar. Se continua con API simulada en memoria." -ForegroundColor Yellow
        }
        else {
            $infraStarted = $true
        }
    }
    finally {
        Pop-Location
    }
}
elseif ((-not $SkipInfra) -and (-not $dockerAvailable)) {
    Write-Host "Docker no esta disponible en PATH. Se omite infra; la web cargara con API simulada en memoria." -ForegroundColor Yellow
}
else {
    Write-Host "Skipping docker compose startup (-SkipInfra)." -ForegroundColor Yellow
}

$simulationApiCommand = @"
`$env:PYTHONPATH = '$BackendDir'
`$env:CHIRPSTACK_MQTT_BROKER = '$Broker'
`$env:CHIRPSTACK_APP_ID = '$AppId'
`$env:SIMULATION_REFRESH_SECONDS = '$IntervalSeconds'
& '$backendPython' -m uvicorn simulation_api:app --app-dir '$ScriptDir' --reload --host 127.0.0.1 --port 8000
"@

if (-not $SkipWeb) {
    Write-Host "Starting simulation REST API on http://127.0.0.1:8000/api/health ..." -ForegroundColor Yellow
    Start-ConsoleProcess `
        -Title "WeatherOS simulation REST API" `
        -WorkingDirectory $RepoRoot `
        -Command $simulationApiCommand
}

$backendCommand = @"
`$env:CHIRPSTACK_MQTT_BROKER = '$Broker'
`$env:CHIRPSTACK_APP_ID = '$AppId'
`$env:INFLUXDB_URL = 'http://localhost:8086'
`$env:INFLUXDB_TOKEN = 'weather-station-token'
`$env:INFLUXDB_ORG = 'weather-station'
`$env:INFLUXDB_BUCKET = 'weather'
& '$backendPython' -m uvicorn app:app --reload --host 127.0.0.1 --port 8001
"@

if ($infraStarted) {
    Write-Host "Starting MQTT ingestion backend on http://127.0.0.1:8001/health ..." -ForegroundColor Yellow
    Start-ConsoleProcess `
        -Title "WeatherOS MQTT ingestion backend" `
        -WorkingDirectory $BackendDir `
        -Command $backendCommand
}
else {
    Write-Host "Se omite backend de ingesta MQTT porque Docker/Mosquitto no esta disponible." -ForegroundColor Yellow
}

if ($cargoAvailable -and $infraStarted) {
    $gatewayArgs = "--broker $Broker --app-id $AppId --dev-eui $DevEui --device-id $DeviceId --interval-seconds $IntervalSeconds"
    if ($Once) {
        $gatewayArgs = "$gatewayArgs --once"
    }

    $gatewayCommand = @"
cargo run -- $gatewayArgs
"@

    Write-Host "Starting gateway mock: appId=$AppId devEui=$DevEui deviceId=$DeviceId interval=${IntervalSeconds}s ..." -ForegroundColor Yellow
    Start-ConsoleProcess `
        -Title "WeatherOS gateway mock" `
        -WorkingDirectory $GatewayMockDir `
        -Command $gatewayCommand
}
elseif (-not $cargoAvailable) {
    Write-Host "Cargo no esta disponible en PATH. Se omite gateway-mock; la web cargara con lecturas simuladas iniciales." -ForegroundColor Yellow
}
else {
    Write-Host "Se omite gateway-mock porque la infraestructura MQTT no esta activa." -ForegroundColor Yellow
}

if (-not $SkipWeb) {
    $frontendCommand = @"
`$env:VITE_API_URL = 'http://127.0.0.1:8000'
& '$packageManager' run dev -- --host 127.0.0.1 --port 5173 --strictPort
"@

    Write-Host "Starting frontend on http://127.0.0.1:5173 ..." -ForegroundColor Yellow
    Start-ConsoleProcess `
        -Title "WeatherOS frontend" `
        -WorkingDirectory $FrontendDir `
        -Command $frontendCommand

    if (-not $NoBrowser) {
        Start-Sleep -Seconds 3
        Start-Process "http://127.0.0.1:5173/estacion_meteorologica/" | Out-Null
    }
}

Write-Host ""
Write-Host "Simulation started." -ForegroundColor Green
Write-Host "- Docker services: ChirpStack http://localhost:8080, InfluxDB http://localhost:8086, MQTT $Broker"
if (-not $SkipWeb) {
    Write-Host "- Web dashboard: http://127.0.0.1:5173/estacion_meteorologica/"
    Write-Host "- Simulation REST API for the dashboard: http://127.0.0.1:8000/api/health"
}
if ($infraStarted) {
    Write-Host "- Ingestion backend health: http://127.0.0.1:8001/health"
}
Write-Host "- Gateway mock publishes ChirpStack-like MQTT uplinks to application/$AppId/device/$DevEui/event/up"
Write-Host ""
Write-Host "Leave the opened backend and gateway mock windows running while testing."

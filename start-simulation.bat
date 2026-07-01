@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo Iniciando simulacion WeatherOS...
echo Carpeta: %ROOT%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start-simulation.ps1" %*

if errorlevel 1 (
  echo.
  echo No se pudo iniciar la simulacion. Revisa el mensaje anterior.
  pause
  exit /b 1
)

echo.
echo Simulacion iniciada.
echo Pagina web: http://127.0.0.1:5173/estacion_meteorologica/
echo API simulada: http://127.0.0.1:8000/api/health
echo.
echo Si la pagina no abre automaticamente, copia y pega la URL anterior en el navegador.
echo Deja abiertas las ventanas de servicios mientras pruebas.
pause

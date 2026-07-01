@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo Preparando simulacion WeatherOS...
echo Carpeta: %ROOT%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\setup-simulation.ps1" %*

if errorlevel 1 (
  echo.
  echo No se pudo preparar la simulacion. Revisa el mensaje anterior.
  pause
  exit /b 1
)

echo.
echo Setup finalizado.
echo Para iniciar la simulacion ejecuta:
echo   start-simulation.bat
echo.
pause

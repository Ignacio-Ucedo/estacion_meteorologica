## Why

Provisionar una estación meteorológica hoy requiere tener instalado el toolchain de Rust, `esptool`, `cargo-espflash` y variables de entorno configuradas correctamente — una barrera alta para técnicos de campo o para escalar el proceso de fabricación. Una app de operario standalone elimina esa dependencia: el técnico descarga un ejecutable, conecta el ESP32 por USB y sigue un wizard, sin tocar la terminal.

## What Changes

- Nuevo componente `operator-app/` (Tauri + React) con wizard de aprovisionamiento paso a paso
- Pipeline CI (GitHub Actions) que compila y publica los binarios de firmware como artefactos descargables por versión
- Script de generación de NVS bin a partir de parámetros del wizard (sin nvs_partition_gen manual)
- Pool de DevEUI/AppKey: la app asigna claves únicas por dispositivo y las registra en ChirpStack vía API REST
- Log persistente de dispositivos provisionados (SQLite local) con estado: configurado, flasheado, verificado

## Capabilities

### New Capabilities

- `operator-flash-app`: Aplicación Tauri standalone para provisionar estaciones en campo. Cubre: descarga del firmware prebuildeado, configuración de parámetros por dispositivo (WiFi, ChirpStack host, OTAA keys), generación y flash de NVS, flash del firmware `.bin` vía `esptool` embebido, registro del dispositivo en ChirpStack y log local del proceso.
- `firmware-ci-release`: Pipeline CI que compila el firmware para cada tag de versión y publica los `.bin` (firmware + partition table) como GitHub Release assets descargables por la operator-app.

### Modified Capabilities

## Impact

- Nuevo componente `operator-app/` (Tauri + TypeScript/React) en la raíz del repo
- Nuevo directorio `.github/workflows/` con workflow de release del firmware
- La app consume la API REST de ChirpStack (puerto 8080) para registrar gateways y dispositivos automáticamente
- No modifica firmware ni backend existentes; los binarios son los mismos que se compilan manualmente hoy
- Dependencia externa: `esptool` bundleado o invocado como sidecar desde Tauri; `nvs_partition_gen.py` o reimplementación en Rust/JS

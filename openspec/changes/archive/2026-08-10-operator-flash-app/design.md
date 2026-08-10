## Context

Hoy provisionar una estación requiere que el operario tenga instalado el toolchain de Rust, esp-idf, cargo-espflash, esptool y las variables de entorno correctas. Cada dispositivo necesita claves OTAA únicas, credenciales WiFi y la IP del ChirpStack host. El proceso incluye: compilar firmware, generar NVS bin con nvs_partition_gen, flashear ambos con esptool/espflash, y registrar gateway + device en ChirpStack manualmente. Todo esto en terminal, sin guía visual, con riesgo de error humano y sin trazabilidad.

El objetivo es una app Tauri standalone: el operario conecta el ESP32, sigue un wizard de 4 pasos y la app maneja todo lo demás.

## Goals / Non-Goals

**Goals:**
- App standalone sin dependencias externas en la máquina del operario (ni Rust ni Python)
- Wizard paso a paso: detección de puerto USB → configuración → flash firmware → provisión NVS → registro ChirpStack
- CI que compila firmware por tag/release y publica `.bin` descargables
- Pool de DevEUI/AppKey con asignación automática y registro en ChirpStack vía API
- Log local SQLite de dispositivos provisionados (DevEUI, MAC, fecha, versión firmware, estado)
- Cross-platform: Linux, Windows, macOS

**Non-Goals:**
- No reemplaza el entorno de desarrollo (los devs siguen usando cargo/espflash)
- No gestiona actualizaciones OTA de firmware en campo
- No incluye calibración de sensores (eso es la app Android)
- No corre en navegador (Web Serial tiene limitaciones de permisos en producción)

## Decisions

### Tauri como framework de la app
**Decisión**: Tauri (Rust backend + React/TypeScript frontend)
**Alternativas**:
- Electron: más pesado (~150MB), misma UX; Tauri produce binarios de ~10MB
- Script Python: sin UI, requiere Python instalado, no portable
- Web Serial en browser: sin instalación, pero permisos USB problemáticos en Linux sin udev rules

**Rationale**: Tauri produce un binario standalone que bundlea la UI. El backend Rust puede invocar esptool directamente como proceso hijo o usar la librería `serialport` para comunicación USB. Comparte lenguaje con el firmware.

### esptool como sidecar bundleado
**Decisión**: Incluir el binario de `esptool` (compilado en CI) como sidecar en la app Tauri
**Alternativas**:
- Reimplementar el protocolo ESP ROM bootloader en Rust: excesiva complejidad
- Requerir esptool instalado en el sistema: viola el objetivo standalone

**Rationale**: Tauri tiene soporte nativo para sidecars. esptool tiene binarios standalone compilados con PyInstaller disponibles en sus releases oficiales. Se bundlea junto con la app.

### Generación de NVS bin en Rust
**Decisión**: Reimplementar `nvs_partition_gen.py` en Rust dentro del backend de Tauri
**Alternativas**:
- Bundlear Python + nvs_partition_gen.py: agrega ~30MB y complejidad
- Bundlear el script compilado con PyInstaller: viable pero pesado

**Rationale**: El formato NVS de ESP-IDF está documentado. Una implementación Rust de ~200 líneas genera el `.bin` directamente, sin dependencia de Python. Reduce el tamaño del bundle y simplifica el build.

### CI con GitHub Actions para release de firmware
**Decisión**: Workflow `firmware-release.yml` que compila en `ubuntu-latest` con `esp-rs` y sube los `.bin` como GitHub Release assets
**Rationale**: Los `.bin` prebuildeados son lo que descarga la operator-app. El tag de git es la versión. La app verifica la versión disponible al iniciar.

### Pool de OTAA keys con registro automático en ChirpStack
**Decisión**: La app mantiene un CSV/SQLite de pares DevEUI+AppKey pregenerados. Al provisionar, asigna el próximo par libre y lo registra en ChirpStack vía API REST (gRPC-gateway en puerto 8080).
**Alternativas**:
- El operario ingresa las claves manualmente: fuente de errores, no escala
- ChirpStack genera las claves: posible pero requiere más integración API

**Rationale**: El pool pregenerado desacopla la generación de claves (offline) del aprovisionamiento. El registro en ChirpStack es automatizable vía API REST con el JWT del admin.

## Risks / Trade-offs

- **[Riesgo] Permisos USB en Linux** → La app debe incluir instrucciones para agregar udev rules o usar `dialout`/`uucp`. Documentar en README de la app y mostrar en la UI si el flash falla con "permission denied".
- **[Riesgo] Versión de esptool bundleada vs. versión esperada por el firmware** → Pinear la versión de esptool en el CI de la app. Cambios de protocolo ROM bootloader son raros.
- **[Riesgo] ChirpStack API cambia entre versiones** → La app solo usa endpoints estables (login, gateway create, device create). Documentar la versión de ChirpStack soportada (v4.x).
- **[Trade-off] NVS generado en Rust puede tener bugs si el formato cambia** → Testear contra el NVS real generado por nvs_partition_gen.py y verificar con esptool read-back.

## Migration Plan

1. Operario descarga el instalador de la operator-app desde GitHub Releases
2. En Linux: ejecutar script de instalación que agrega udev rule para `/dev/ttyUSB*`
3. Al abrir la app, descarga automáticamente la última versión del firmware `.bin` desde GitHub Releases
4. Por dispositivo: conectar ESP32 → seguir wizard → desconectar

No hay rollback de datos (el log local es append-only). Si el flash falla, la app informa el error y permite reintentar desde el paso fallido.

## Open Questions

- ¿El pool de DevEUI/AppKey se genera con `espsecure.py` o con un generador propio? (El estándar EUI-64 requiere un OUI registrado; para prototipo se puede usar un OUI local `70:B3:D5` de prueba)
- ¿La app necesita conectarse a internet para descargar los `.bin`, o se distribuye con el firmware incluido? (por ahora: descarga al inicio, con opción offline si el `.bin` ya está en caché)
- ¿El log de dispositivos provisionados se sincroniza con el backend, o es solo local? (por ahora: solo local SQLite)

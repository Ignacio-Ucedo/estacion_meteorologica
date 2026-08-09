## 1. CI — Firmware Release Pipeline

- [x] 1.1 Crear `.github/workflows/firmware-release.yml` con trigger en tags `v*`
- [x] 1.2 Configurar el job de compilación con `esp-rs/idf-rust` en `ubuntu-latest` (toolchain xtensa)
- [x] 1.3 Compilar `gateway-node-mock` en release y exportar el `.bin` como artefacto
- [x] 1.4 Publicar el `.bin` y `partitions.csv` en el GitHub Release junto con sus checksums SHA256
- [ ] 1.5 Verificar el pipeline creando un tag `v0.1.0-test` y confirmando que el release se genera
  - Commit: `ci(firmware): agregar pipeline de release para binarios de firmware`

## 2. Scaffold de la Operator App (Tauri)

- [x] 2.1 Inicializar el proyecto Tauri en `operator-app/` con `create-tauri-app` (React + TypeScript)
- [x] 2.2 Configurar `tauri.conf.json`: nombre, identificador, permisos de shell para sidecar esptool
- [x] 2.3 Bundlear el binario de `esptool` como sidecar (descargar release oficial standalone de esptool)
- [x] 2.4 Verificar que `tauri dev` levanta la app en Linux
  - Commit: `feat(operator-app): scaffold inicial Tauri + React`

## 3. Detección USB y Selección de Puerto

- [x] 3.1 Agregar crate `serialport` al backend Tauri para listar puertos disponibles
- [x] 3.2 Implementar comando Tauri `list_ports` que retorna puertos con VID/PID (filtrar chips CP210x, CH340)
- [x] 3.3 Implementar listener de eventos de conexión/desconexión USB en tiempo real
- [x] 3.4 Construir componente React `PortSelector` que muestra la lista y actualiza automáticamente
  - Commit: `feat(operator-app): detección automática de puertos USB`

## 4. Pool de OTAA Keys

- [x] 4.1 Definir el esquema del pool: CSV con columnas `dev_eui,app_key,assigned,assigned_at`
- [x] 4.2 Implementar comando Tauri `next_available_key` que retorna el próximo par libre y lo marca como asignado
- [x] 4.3 Implementar comando `import_key_pool` que parsea un CSV y agrega pares al pool (SQLite local)
- [x] 4.4 Generar un pool de prueba con 20 pares DevEUI+AppKey (OUI local `70:B3:D5`) para desarrollo
  - Commit: `feat(operator-app): pool de OTAA keys con asignación automática`

## 5. Generación de NVS Bin

- [x] 5.1 Implementar en Rust (backend Tauri) el generador de partición NVS compatible con esp-idf
  - Formato: namespace `lorawan`, entradas `dev_eui` (hex2bin), `app_eui` (hex2bin), `app_key` (hex2bin); namespace `wifi`, entradas `ssid` y `pass` (string)
- [x] 5.2 Testear la salida contra el NVS generado por `nvs_partition_gen.py` con los mismos parámetros
- [x] 5.3 Exponer como comando Tauri `generate_nvs_bin` que retorna los bytes del `.bin`
  - Commit: `feat(operator-app): generador de partición NVS en Rust sin dependencias externas`

## 6. Wizard de Configuración (UI)

- [x] 6.1 Construir el componente `WizardStep1_Port`: selección de puerto USB detectado
- [x] 6.2 Construir `WizardStep2_Config`: campos SSID, password WiFi, host ChirpStack, DevEUI+AppKey asignados (solo lectura)
- [x] 6.3 Construir `WizardStep3_Flash`: progreso del flash del firmware con log en tiempo real
- [x] 6.4 Construir `WizardStep4_NVS`: progreso del flash del NVS y verificación post-flash
- [x] 6.5 Construir `WizardStep5_ChirpStack`: estado del registro en ChirpStack y confirmación final
  - Commit: `feat(operator-app): wizard de aprovisionamiento paso a paso`

## 7. Flash del Firmware vía esptool Sidecar

- [x] 7.1 Implementar comando Tauri `flash_firmware` que invoca el sidecar esptool con los parámetros correctos (`write_flash 0x0 firmware.bin`)
- [x] 7.2 Streamear stdout/stderr de esptool al frontend en tiempo real para mostrar progreso
- [x] 7.3 Detectar y manejar errores de permisos USB y mostrar instrucciones de corrección en la UI
- [x] 7.4 Implementar verificación de conectividad del ESP32 antes del flash (esptool `chip_id`)
  - Commit: `feat(operator-app): flash de firmware vía esptool sidecar`

## 8. Flash del NVS y Verificación

- [x] 8.1 Implementar comando Tauri `flash_nvs` que flashea el NVS generado en la dirección `0x9000`
- [x] 8.2 Implementar `verify_nvs` con read-back de la partición NVS y comparación byte a byte
- [x] 8.3 Mostrar resultado de verificación en la UI con indicador visual de éxito/error
  - Commit: `feat(operator-app): flash y verificación de partición NVS`

## 9. Registro en ChirpStack

- [ ] 9.1 Implementar cliente HTTP en Rust para la API REST de ChirpStack v4 (login, create device)
- [ ] 9.2 Implementar comando Tauri `register_device_chirpstack` con el DevEUI, AppKey y application ID
- [ ] 9.3 Manejar el caso de device ya existente (update en lugar de create)
- [ ] 9.4 Guardar credenciales de ChirpStack en configuración persistente de la app (host + token)
  - Commit: `feat(operator-app): registro automático de device en ChirpStack`

## 10. Log Local de Dispositivos

- [ ] 10.1 Crear esquema SQLite local: tabla `devices` con DevEUI, MAC, fecha, versión firmware, estado, parámetros JSON
- [ ] 10.2 Guardar entrada al completar cada aprovisionamiento (exitoso o parcial)
- [ ] 10.3 Construir vista de historial en la UI con filtros por estado y fecha
- [ ] 10.4 Implementar exportación a CSV del historial completo
  - Commit: `feat(operator-app): log persistente de dispositivos provisionados`

## 11. Descarga de Firmware desde GitHub Releases

- [ ] 11.1 Implementar consulta a la GitHub Releases API para obtener la última versión disponible
- [ ] 11.2 Descargar y cachear el `.bin` localmente (directorio de datos de la app)
- [ ] 11.3 Mostrar en la UI la versión de firmware que se va a flashear y ofrecer actualización si hay una nueva
- [ ] 11.4 Verificar checksum SHA256 del `.bin` descargado antes de usarlo
  - Commit: `feat(operator-app): descarga y caché de firmware desde GitHub Releases`

## 12. Build y Distribución

- [ ] 12.1 Configurar `tauri build` para Linux (AppImage/deb), Windows (.msi) y macOS (.dmg)
- [ ] 12.2 Agregar workflow CI `.github/workflows/operator-app-release.yml` que compila y publica los instaladores en cada tag
- [ ] 12.3 Documentar el proceso de instalación en `operator-app/README.md` incluyendo udev rules para Linux
  - Commit: `build(operator-app): configurar build multiplataforma y pipeline de distribución`

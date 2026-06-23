## Why

El proyecto necesita un primer spike de firmware con hardware real antes de comprometer trabajo de backend, Android, carcasa, pruebas de campo o autonomía energética. Este cambio reduce la mayor incertidumbre inicial: comprobar que dos ESP32 DevKitC V1 pueden leer las interfaces de sensores elegidas, empaquetar mediciones y comunicarse por LoRa P2P usando el módulo XL1278-SMT/SX1278 confirmado a 433 MHz.

## What Changes

- Agregar un spike de firmware en Rust con ESP-IDF para un nodo sensor sobre ESP32-WROOM-32 / DevKitC V1.
- Agregar un segundo rol de firmware para otro ESP32-WROOM-32 / DevKitC V1 como receptor/logger LoRa de prueba.
- Leer temperatura/humedad desde DHT22 y presión desde MPL115A2 en el nodo sensor, registrando los valores por consola serial.
- Contar pulsos de un pluviómetro de cubeta basculante con reed switch y de una entrada de viento asumida como pulso/NPN.
- Empaquetar las lecturas en un payload CSV compacto para depuración: `id,seq,temp,hum,pres,pulsos_lluvia,pulsos_viento`.
- Transmitir el payload CSV por LoRa P2P a 433 MHz y registrar paquetes parseados en el ESP32 receptor por USB serial.
- Documentar supuestos de hardware y constantes de calibración todavía no resueltas para lluvia y viento.
- Dejar para cambios posteriores deep sleep, autonomía con batería/panel solar, WiFi, FastAPI, InfluxDB, calibración BLE desde Android, payload binario de producción y validación de alcance en campo.

## Capabilities

### New Capabilities

- `firmware-lora-sensor-spike`: capacidad de firmware de banco para leer sensores iniciales de la estación meteorológica, contar pulsos de lluvia/viento, transmitir payloads CSV por LoRa P2P y validar la recepción en un segundo ESP32.

### Modified Capabilities

- Ninguna.

## Impact

- Componentes afectados: firmware y prototipo de gateway/receptor únicamente.
- Hardware: dos placas ESP32 DevKitC V1 con módulos ESP32-WROOM-32, dos módulos LoRa XL1278-SMT/SX1278 a 433 MHz, DHT22, MPL115A2, pluviómetro de cubeta basculante y entrada de anemómetro tratada como pulso/NPN para el spike.
- Stack de firmware: Rust con ESP-IDF mediante `esp-idf-hal` / `esp-idf-svc`, en lugar de `esp-hal` bare-metal, para preservar el camino hacia BLE y WiFi en cambios posteriores.
- Comunicación: LoRa P2P, sin LoRaWAN. Este spike usa intencionalmente un payload CSV de depuración en lugar del payload binario fijo final; migrar a binario queda como tarea posterior antes de producción/campo.
- Energía/autonomía: no hay deep sleep ni alimentación por batería/panel solar en este spike. Las placas funcionan por USB durante las pruebas de banco, por lo que este cambio no valida la autonomía final.
- Backend/API/base de datos/frontend/Android/3D: sin impacto directo de implementación.
- Rollback: todavía no existe firmware desplegado en campo; volver atrás implica regresar al estado vacío/prototipo anterior o flashear una imagen de firmware previa cuando exista.

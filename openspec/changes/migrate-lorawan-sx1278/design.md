## Context

El spike actual (`spike-firmware-lora-sensors`) validó el hardware del nodo sensor (DHT22, pluviómetro, anemómetro) usando LoRa P2P con módulos SX1278 a 433 MHz y un payload CSV de depuración. La comunicación es directa nodo → gateway ESP32 → HTTPS → FastAPI, sin protocolo de red estandarizado.

Este cambio reemplaza únicamente la capa de comunicación LoRa. El hardware de sensores, el backend FastAPI, el frontend React y la app Android no cambian en sus responsabilidades funcionales — solo cambia cómo el dato llega al backend.

El hardware disponible son 2× ESP32 DevKitC V1 con módulos SX1278 (XL1278-SMT) ya validados en el spike. No se adquiere hardware nuevo.

## Goals / Non-Goals

**Goals:**
- Reemplazar LoRa P2P por LoRaWAN con activación OTAA y band plan EU433 usando el hardware SX1278 existente.
- Incorporar ChirpStack como network server entre el gateway y el backend.
- Definir el payload binario de producción (reemplaza el CSV de debug del spike).
- Hacer que FastAPI ingeste datos desde ChirpStack en lugar de recibirlos directamente del gateway.
- Actualizar la documentación del proyecto para reflejar el stack real.

**Non-Goals:**
- Cambio de hardware de radio (se mantiene SX1278/EU433; AU915 queda descartado para esta etapa).
- Gateway de 8 canales spec-compliant (se mantiene single-channel como limitación de prototipo).
- Deep sleep y gestión de energía en el nodo (cambio futuro).
- Calibración BLE desde Android (cambio futuro).
- Validación de alcance en campo (cambio futuro).
- Soporte de múltiples nodos simultáneos (arquitectura lo soporta, pero no se prueba en este cambio).
- Hosting en producción de ChirpStack (Docker local es suficiente para el prototipo).

## Decisions

### 1. Mantener SX1278 con EU433 en lugar de migrar a SX1276/AU915

Se descartó adquirir módulos SX1276 para operar en AU915 (902–928 MHz, band plan LoRaWAN vigente en Argentina según ENACOM). El SX1278 (137–525 MHz) no alcanza los 900 MHz requeridos por AU915. Se adopta EU433 (433.175–434.665 MHz), el band plan LoRaWAN más cercano a la frecuencia del hardware disponible. Justificación: elimina costo y tiempo de adquisición de hardware, reutiliza completamente el hardware validado en el spike, y es suficiente para la prueba de concepto en entorno de banco/laboratorio. La banda 433 MHz ISM es de libre uso en Argentina dentro de los límites de potencia ENACOM. **Para una instalación de campo permanente, se recomienda evaluar la migración a AU915 con hardware SX1276/SX1262.**

### 2. OTAA sobre ABP

OTAA (Over-The-Air Activation) genera session keys dinámicas en cada join, lo que es el estándar recomendado por la LoRa Alliance. ABP (Activation By Personalization) hardcodea las session keys y no reinicia contadores de frame, lo que puede causar problemas de seguridad y de sincronización con el network server. Para un prototipo de un nodo con ChirpStack self-hosted, OTAA es igualmente simple de configurar y correcto.

### 3. ChirpStack self-hosted sobre TTN

The Things Network (TTN) tiene cobertura limitada en Argentina y requiere conectividad del gateway a internet vía TTN servers. ChirpStack self-hosted (Docker Compose en la misma máquina que el backend, o en la red local) elimina la dependencia de cobertura externa y permite operar con el gateway conectado por WiFi a la red local. Para el prototipo, esto es más robusto.

### 4. Stack LoRaWAN en firmware: LMIC portado a ESP-IDF, región EU433

`arduino-lmic` (IBM LMIC portado a Arduino/ESP-IDF) soporta EU433 con la región `LMIC_CFG_region = LMIC_REGION_eu433`. Es la opción más documentada para ESP32, con compatibilidad probada con ChirpStack. Las claves OTAA (DevEUI, AppEUI, AppKey) se almacenan en NVS (Non-Volatile Storage) del ESP32. Alternativa considerada: `LoRaWAN-ED-Stack` para ESP-IDF — descartada por menor soporte de comunidad para EU433.

### 5. Single-channel packet forwarder sobre gateway dedicado

Un gateway LoRaWAN real opera en múltiples canales simultáneos (requiere hardware tipo RAK7268 o Dragino LPS8). Para el prototipo con un solo nodo, un single-channel packet forwarder en el ESP32+SX1278 es suficiente. El forwarder implementa el protocolo UDP Semtech (Packet Forwarder Protocol) hacia ChirpStack, escuchando en **433.175 MHz SF7BW125** (canal 0 de EU433). **Esta limitación queda documentada explícitamente: no es spec-compliant con LoRaWAN, pero no impacta la funcionalidad del sistema con un nodo operando en canal fijo.**

### 6. Integración ChirpStack → FastAPI: MQTT sobre HTTP webhook

ChirpStack expone uplinks vía MQTT (`application/{id}/device/{devEUI}/event/up`) y vía HTTP integrations. Se elige MQTT porque: es el canal nativo de ChirpStack, tiene menor latencia que polling, y `paho-mqtt` en FastAPI con reconexión automática es simple de implementar. FastAPI levanta un cliente MQTT en startup que suscribe al topic y escribe en InfluxDB.

## Flujo de datos extremo a extremo

```
DHT22 + pluviómetro (reed switch) + anemómetro (pulso/NPN)
        │  GPIO interrupciones
        ▼
ESP32 nodo sensor (Rust + LMIC, EU433)
        │  LoRaWAN EU433, 433.175 MHz SF7BW125
        │  Uplink no confirmado cada 10 min
        │  FRMPayload: 14 bytes binarios (ver estructura abajo)
        ▼
ESP32 gateway (Rust + single-channel packet forwarder, SX1278)
        │  UDP Semtech Packet Forwarder Protocol
        │  WiFi → red local
        ▼
ChirpStack (Docker, red local)
        │  decodifica trama LoRaWAN, verifica MIC, descifra FRMPayload
        │  MQTT: application/{appId}/device/{devEUI}/event/up
        ▼
FastAPI backend (Python)
        │  cliente MQTT (paho-mqtt), deserializa payload binario, valida CRC8
        │  escribe en InfluxDB
        ▼
InfluxDB  ──────────────────────►  React frontend (gráficos históricos)
                                   Android app (verificación vía REST)
```

## Estructura del payload binario (FRMPayload, 14 bytes)

| Offset | Campo | Tipo | Unidad | Rango |
|--------|-------|------|--------|-------|
| 0 | `device_id` | u8 | — | 0–255 |
| 1–2 | `seq` | u16 LE | — | 0–65535 (wraps) |
| 3–4 | `temp_c_x100` | i16 LE | °C × 100 | −4000..+8500 |
| 5–6 | `hum_x100` | u16 LE | %RH × 100 | 0–10000 |
| 7–8 | `lluvia_pulsos` | u16 LE | pulsos | 0–65535 |
| 9–10 | `viento_pulsos` | u16 LE | pulsos | 0–65535 |
| 11–12 | `bateria_mv` | u16 LE | mV | 0–4200 |
| 13 | `crc8` | u8 | — | CRC-8/MAXIM sobre bytes 0–12 |

El FRMPayload se cifra por LoRaWAN antes de la transmisión; ChirpStack lo descifra y lo entrega al backend como bytes crudos en el campo `data` (base64) del evento MQTT.

## Schema InfluxDB

- **measurement**: `weather_reading`
- **tags**: `device_id` (string), `dev_eui` (string)
- **fields**: `temp_c` (float), `humidity_pct` (float), `rain_pulses` (integer), `wind_pulses` (integer), `battery_mv` (integer), `seq` (integer)
- **timestamp**: provisto por ChirpStack desde la trama LoRaWAN (campo `rxInfo[0].time`)

## Manejo de errores y reconexión

| Escenario | Comportamiento |
|-----------|---------------|
| Nodo sin cobertura LoRa | LMIC reintenta con backoff; el nodo continúa leyendo sensores y acumulando pulsos |
| Nodo pierde activación OTAA | LMIC reintenta join automáticamente |
| Gateway sin WiFi | El forwarder detecta timeout UDP y reintenta reconexión WiFi; los paquetes LoRa recibidos durante el outage se pierden (no hay buffer persistente en el forwarder) |
| ChirpStack caído | El gateway acumula intentos fallidos; ChirpStack recupera estado al reiniciar |
| FastAPI desconectado de MQTT | paho-mqtt reconecta automáticamente; mensajes publicados durante la desconexión pueden perderse (QoS 0 por defecto) |
| Payload con CRC inválido | FastAPI descarta la lectura y registra el error; no escribe en InfluxDB |

## Impacto en memoria/CPU del firmware (ESP32)

- LMIC stack: ~35 KB de flash, ~4 KB de RAM adicional sobre el firmware base del spike.
- ESP32 dispone de 4 MB de flash y 520 KB de RAM → impacto insignificante.
- Las claves OTAA (DevEUI 8 bytes, AppEUI 8 bytes, AppKey 16 bytes) se almacenan en NVS.
- El join OTAA agrega ~1–2 s de TX al primer arranque; no impacta el ciclo de lectura.
- Duty cycle EU433: ~1% por canal en la banda ISM 433 MHz. Un uplink de 14 bytes en SF7BW125 dura ~50 ms → 50 ms / 600 s = 0.008% por intervalo de 10 min, muy por debajo del límite.

## Risks / Trade-offs

- **Single-channel gateway no spec-compliant** → el nodo debe configurarse para transmitir en el canal fijo que escucha el forwarder (433.175 MHz SF7BW125). Si se agrega un segundo nodo, ambos deben usar el mismo canal. Mitigación: documentado como limitación de prototipo; para producción se reemplaza con gateway multi-canal o hardware dedicado (RAK7268, Dragino LPS8).
- **EU433 en lugar de AU915** → no alineado con el plan de frecuencias LoRaWAN oficial en Argentina (ENACOM AU915). Mitigación: documentado explícitamente como decisión de prototipo; la migración a AU915 requiere reemplazar los módulos SX1278 por SX1276/SX1262 y actualizar la configuración de LMIC y ChirpStack.
- **Pérdida de paquetes durante outage de WiFi del gateway** → en el contexto de la estación meteorológica (variables de cambio lento) la pérdida de una lectura cada 10 minutos durante un outage breve no es crítica. Mitigación: el nodo mantiene `seq` incremental; el backend puede detectar gaps.
- **MQTT QoS 0 entre ChirpStack y FastAPI** → puede haber pérdida de mensajes si FastAPI está caído. Mitigación: subir a QoS 1 con sesión persistente en ChirpStack, o aceptar la pérdida como tolerable para el prototipo.
- **Dependencia de ChirpStack en la red local** → si ChirpStack no está corriendo, no llega ningún dato al backend. Mitigación: Docker Compose con restart policy `unless-stopped`.

## Migration Plan

1. Levantar ChirpStack con Docker Compose configurado para EU433 (incluye servidor MQTT Mosquitto o broker embebido).
2. Registrar gateway y dispositivo en ChirpStack (DevEUI, AppEUI, AppKey generados en ChirpStack; band plan EU433).
3. Implementar firmware del nodo con LMIC (EU433) + payload binario.
4. Implementar single-channel packet forwarder en el gateway ESP32 (433.175 MHz SF7BW125).
5. Implementar cliente MQTT en FastAPI + escritura en InfluxDB.
6. Actualizar `openspec/config.yaml` y `CLAUDE.md`.

Rollback: flashear firmware del spike (`spike-firmware-lora-sensors`) en ambos ESP32. No hay datos de producción en riesgo.

## Open Questions

- ¿Versión de ChirpStack a usar? v4 (Go, unified) vs v3 (componentes separados). v4 es la versión activa recomendada.
- ¿QoS MQTT entre ChirpStack y FastAPI: 0 (fire-and-forget) o 1 (at-least-once)? Depende de qué tan crítica se considere la pérdida de una lectura.
- ¿Almacenar DevEUI/AppEUI/AppKey en NVS directamente o cargarlos en compilación como constantes? NVS permite cambiarlos sin recompilar; constantes son más simples para el prototipo.

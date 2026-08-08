## Context

El firmware `gateway-node-mock` (ESP32, `firmware/src/bin/gateway-node-mock.rs`) ya está implementado. Construye frames LoRaWAN reales con OTAA, cifrado AES-128 (AppSKey) y MIC (NwkSKey), los envuelve en el formato RXPK del protocolo Semtech UDP Packet Forwarder v2, y los inyecta al ChirpStack Gateway Bridge escuchando en el puerto 1700/UDP. Desde allí el flujo es idéntico al de un gateway LoRa físico: ChirpStack → MQTT → backend FastAPI → InfluxDB → frontend React.

La infra (docker-compose AU915, gateway bridge con prefijo `au915_2`, chirpstack-provision.py con `Region.AU915`) quedó corregida en el mismo commit que abre este change.

Flujo de datos completo validado en esta etapa:

```
ESP32 (gateway-node-mock)
  │  genera lectura sintética (MockEnvironmentSensor, device_id=3)
  │  construye frame LoRaWAN (OTAA cifrado, 14 bytes FRMPayload)
  │  empaqueta RXPK (freq=916.8 MHz, SF7BW125)
  ▼
ChirpStack Gateway Bridge  ← UDP :1700
  │  publica en MQTT: au915_2/gateway/<EUI>/event/up
  ▼
ChirpStack v4 (AU915 sub-band 2)
  │  verifica MIC, descifra FRMPayload
  │  publica uplink: application/<appId>/device/<devEUI>/event/up
  ▼
Backend FastAPI (paho-mqtt)
  │  decodifica payload binario 14 bytes
  │  escribe en InfluxDB (measurement weather_reading)
  ▼
Frontend React
  │  consulta REST API del backend
  └─ muestra lecturas en tiempo real
```

## Goals / Non-Goals

**Goals:**
- Verificar que cada tramo del flujo end-to-end funciona sin hardware LoRa
- Detectar y resolver cualquier problema de configuración de infra (puertos, MQTT topics, credenciales, device profile) antes de introducir hardware real
- Establecer una línea base de latencia end-to-end (ESP32 → frontend) para comparar contra etapas futuras

**Non-Goals:**
- No se evalúa el link RF LoRa (no hay radio en esta etapa)
- No se valida el comportamiento ante pérdida de WiFi en condiciones de campo (cobertura controlada, banco de trabajo)
- No se validan sensores físicos (datos son sintéticos)
- No se hacen pruebas de stress ni duración larga (basta con 3–5 ciclos de uplink verificados)

## Decisions

**SEND_INTERVAL_MS = 30 000 ms para la validación**: El valor por defecto de producción es 600 000 ms (10 min). Para validación se usa 30 s (ya configurado en el binario) para observar múltiples ciclos sin esperar. No requiere recompilación — ya está hardcodeado así en la rama de desarrollo.

**OTAA join via UDP, no via RF**: El ESP32 construye el JoinRequest, lo inyecta como RXPK, y escucha el JoinAccept en PULL_RESP del Gateway Bridge. ChirpStack procesa el join igual que uno RF — la sesión OTAA resultante (DevAddr, NwkSKey, AppSKey) es criptográficamente indistinguible. Esto confirma que el flujo de activación del stack backend funciona.

**device_id=3 dedicado al gateway-node-mock**: Diferencia los uplinks en InfluxDB de los del nodo real (device_id=1) y del sensor-node-mock (device_id=2). Permite correr esta validación en paralelo con otras sin colisión de series.

## Risks / Trade-offs

**[Riesgo] Backend no tiene el paho-mqtt subscriber completo** (`backend-lorawan-ingestion` está en 6/9 tareas) → Mitigación: verificar que el subscriber esté corriendo antes de la validación; si el tramo backend→InfluxDB falla, la validación de ChirpStack→MQTT se puede dar por buena de forma parcial y documentar el tramo pendiente.

**[Riesgo] Device profile EU433 viejo en ChirpStack** de runs anteriores → Mitigación: correr `chirpstack-provision.py` fresco (ya actualizado a AU915) o eliminar manualmente el perfil viejo desde la UI antes de provisionar.

**[Riesgo] NVS del ESP32 con sesión OTAA de runs anteriores con claves EU433** → Mitigación: en la task de provisioning, borrar la partición NVS con `cargo espflash erase-flash` antes de flashear, para forzar un join limpio.

**[Riesgo] ChirpStack Gateway Bridge y ChirpStack en la misma red Docker pero el ESP32 no puede alcanzar el host** → Mitigación: verificar que el ESP32 puede hacer ping al host donde corre el docker-compose; confirmar que el puerto 1700/UDP está expuesto en el docker-compose.

## Open Questions

- OQ1: ¿El tramo backend-lorawan-ingestion (change `backend-lorawan-ingestion`, 6/9 tareas) estará completamente funcional antes de ejecutar esta validación? Si no, la validación se puede hacer en dos partes: primero hasta ChirpStack, luego hasta frontend cuando el ingestion esté listo.

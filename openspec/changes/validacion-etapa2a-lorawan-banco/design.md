## Context

Esta etapa introduce el primer hardware LoRa real en el sistema. El nodo usa el crate `lr1121-modem-e` (FFI → SWDR009) con el LR1121 corriendo Modem-E v2.1.0, que gestiona el stack LoRaWAN 1.0.4 íntegro dentro del chip. El gateway usa `lr1121-transceiver` (FFI → SWDR001) con el LR1121 en modo transceiver (factory firmware), recibiendo frames LoRaWAN raw y reenviándolos via UDP.

El montaje de banco simplifica las variables al máximo: distancia corta (≤ 5 m), sin obstáculos, alimentación USB, sin condiciones ambientales adversas. El objetivo es confirmar que el stack funciona correctamente antes de agregar las variables de campo (distancia, antenas, alimentación autónoma).

Flujo de datos completo validado en esta etapa:

```
ESP32 nodo (sensor-node-mock, device_id=2)
  │  genera lectura sintética (MockEnvironmentSensor)
  │  llama a lr1121-modem-e → Modem-E AU915 sub-band 2
  │  OTAA join + uplink @ 916.8 MHz SF7BW125 (canal 8)
  ▼  ~~~ RF LoRa, 1–5 m ~~~
ESP32 gateway (gateway-node, lr1121-transceiver)
  │  LR1121 en RX continuo @ 916.8 MHz SF7BW125
  │  lee paquete recibido (payload + RSSI + SNR) vía DIO1
  │  construye RXPK y envía PUSH_DATA vía WiFi/UDP :1700
  ▼
ChirpStack Gateway Bridge → ChirpStack v4 (AU915)
  │  descifra FRMPayload, verifica MIC
  │  publica en MQTT
  ▼
Backend FastAPI → InfluxDB (measurement weather_reading)
```

## Goals / Non-Goals

**Goals:**
- Confirmar que el SPI entre ESP32 y LR1121 funciona en ambos dispositivos (HAL implementado en `migrate-lr1121-au915`)
- Verificar OTAA join via RF AU915: nodo obtiene DevAddr, NwkSKey, AppSKey del Modem-E
- Confirmar recepción en gateway: paquete recibido con RSSI y SNR dentro de rango esperado para corta distancia (RSSI > −80 dBm, SNR > 5 dB a ≤ 5 m sin obstáculos)
- Establecer la línea base de banco (RSSI/SNR de referencia) para comparar contra la prueba de campo
- Confirmar flujo end-to-end hasta InfluxDB (reutilizando la validación de Etapa 1)

**Non-Goals:**
- No se evalúa el rendimiento a distancia (eso es Etapa 2b)
- No se usan antenas definitivas (yagi/omni) — solo antenas genéricas de banco
- No se valida la alimentación autónoma del gateway
- No se validan sensores físicos (datos siguen siendo sintéticos)

## Decisions

**Banco antes que campo**: Introduce el hardware RF en el entorno más controlado posible. Fallas de SPI, Modem-E mal flasheado, o configuración de región incorrecta se detectan sin el costo operacional de una salida al campo.

**Nodo con sensor-node-mock (datos sintéticos)**: Desacopla la validación del link RF de la validación de sensores. Si el link RF falla, la causa está en el hardware LoRa, no en los sensores. Los sensores reales se agregan en Etapa 3.

**Antenas genéricas para el banco**: A ≤ 5 m sin obstáculos, cualquier antena razonablemente resonante en 915 MHz es suficiente. Las antenas definitivas (yagi para nodo, omni para gateway) se usan recién en Etapa 2b para no condicionar la interpretación de los resultados de banco.

**Métricas de aceptación de banco** (RSSI > −80 dBm, SNR > 5 dB): A 1–5 m en interior sin obstáculos, el link budget de 915 MHz SF7BW125 deja margen de sobra. Si no se alcanzan estos valores, hay un problema de hardware (antena desconectada, SPI mal cableado, canal incorrecto).

## Risks / Trade-offs

**[Riesgo] Modem-E no flasheado correctamente en el LR1121 del nodo** → Mitigación: verificar versión con `lr1121_modem_get_version()` por serial antes del test RF. Si retorna error, repetir el procedimiento de flash (tarea 1.1 de `migrate-lr1121-au915`).

**[Riesgo] LR1121 del gateway en modo Modem-E en vez de transceiver** (si el módulo fue flasheado anteriormente) → Mitigación: `lr1121-transceiver::init()` retorna error explícito si detecta Modem-E. En ese caso es necesario hacer factory reset del chip.

**[Riesgo] Interferencia en 916.8 MHz en el entorno de banco** (WiFi 5 GHz no interfiere; potencial interferencia de otros dispositivos 915 MHz) → Mitigación: el canal fijo PoC a SF7 es robusto a interferencia corta. Si hay pérdida > 20% en banco, cambiar de sala o hacer el test fuera de horas pico.

**[Riesgo] HAL SPI en `lr1121-modem-e` y `lr1121-transceiver` aún no completo** → Bloqueador: esta etapa está explícitamente bloqueada hasta que las tareas 2.2 (HAL SPI modem-e) y 4.2 (HAL SPI transceiver) de `migrate-lr1121-au915` estén completas.

## Open Questions

- OQ1: ¿Cuándo llegarán los módulos LR1121 físicos? Esta etapa no puede comenzar hasta tenerlos.
- OQ2: ¿El mismo ESP32 del banco de Etapa 1 se usa como gateway aquí, o es un ESP32 dedicado? Afecta el orden de flash y el manejo de NVS.

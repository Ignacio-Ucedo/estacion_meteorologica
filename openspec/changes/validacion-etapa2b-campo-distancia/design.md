## Context

Esta etapa es la primera salida al campo con hardware real. El gateway (ESP32 + LR1121 transceiver + antena omni SMA 915 MHz) se instala en una posición elevada con alimentación autónoma y backhaul a ChirpStack. El nodo mock (ESP32 + LR1121 Modem-E + antena yagi 915 MHz apuntada al gateway) se desplaza a distancias crecientes para mapear el link budget.

El canal fijo PoC (916.8 MHz SF7BW125) da un link budget teórico de ~154 dB. En espacio abierto y plano con antenas de ganancia moderada (yagi 6 dBi, omni 3 dBi), la distancia máxima esperada es varios kilómetros. Esta prueba establece el valor empírico real para el informe final.

Flujo de datos (idéntico a Etapa 2a, distancia extendida):

```
ESP32 nodo mock (sensor-node-mock, antena yagi 915 MHz)
  │  ~~~ RF LoRa, distancia variable ~~~
ESP32 gateway (gateway-node, antena omni 915 MHz, alimentación campo)
  │  WiFi/Ethernet → ChirpStack (IP accesible desde campo)
  ▼
ChirpStack → MQTT → Backend → InfluxDB
```

## Goals / Non-Goals

**Goals:**
- Determinar la distancia máxima de operación confiable con packet loss ≤ 10%
- Documentar RSSI y SNR en puntos de referencia (50 m, 200 m, 500 m, 1 km, máx alcanzado)
- Verificar que el gateway opera con alimentación autónoma durante la duración del test
- Comparar resultados empíricos contra el link budget teórico para el informe

**Non-Goals:**
- No se validan sensores físicos (el nodo sigue siendo mock)
- No se hace análisis de propagación en múltiples bandas
- No se evalúa la movilidad del nodo (posición fija en cada punto de medición)
- No se valida el enclosure 3D ni la estanqueidad

## Decisions

**Yagi en nodo, omni en gateway**: La yagi (alta ganancia, directiva) en el nodo maximiza el alcance de la prueba. El gateway usa omni para que no dependa de apuntado. En el sistema final el nodo también usará omni; el uso de yagi en esta etapa es deliberado para establecer el alcance máximo posible, no el operacional.

**Puntos de medición a distancias crecientes (50 m → 200 m → 500 m → 1 km → máx)**: Permite detectar dónde empieza la degradación del link. Si falla a 200 m es un problema de hardware o configuración; si falla a 3 km es el límite esperado del link budget.

**SEND_INTERVAL_MS reducido para la prueba de campo (30–60 s)**: Permite tomar mediciones estadísticas (≥ 5 uplinks por punto) sin esperar 50 minutos en cada ubicación.

**Packet loss ≤ 10% como criterio de aceptación por tramo**: 1 pérdida en 10 intentos es aceptable para LoRaWAN (el protocolo reintenta). Packet loss > 20% indica que ese tramo está fuera del rango confiable.

## Risks / Trade-offs

**[Riesgo] Backhaul del gateway no llega a ChirpStack desde el campo** → Mitigación: verificar conectividad del backhaul antes de salir (ping a ChirpStack desde el gateway). Si se usa WiFi de largo alcance, confirmar el SSID alcanzable desde la posición del gateway.

**[Riesgo] Alimentación del gateway no dura el test completo** → Mitigación: medir el consumo en banco antes de ir al campo y calcular la autonomía estimada. Llevar batería de repuesto o power bank.

**[Riesgo] Terreno no plano o con obstáculos entre nodo y gateway** → Mitigación: elegir un sitio con línea de visión directa para la prueba de máxima distancia. Documentar el perfil del terreno en los resultados.

**[Riesgo] Interferencia RF en campo** (otros dispositivos 915 MHz) → Mitigación: el canal fijo PoC con SF7 es relativamente robusto. Si hay interferencia puntual, repetir la medición. Documentar si la interferencia fue relevante.

## Open Questions

- OQ1: ¿Cuál es el sitio de campo elegido para la prueba? Debe tener línea de visión directa al menos 1 km y acceso con el backhaul del gateway.
- OQ2: ¿Qué sistema de backhaul usa el gateway en el campo: WiFi (router portable), Ethernet+W5500, o SIM7000G? El W5500 y SIM7000G son reservas de hardware sin driver implementado aún.

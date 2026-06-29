## Context

El stack LoRaWAN implementado en `migrate-lorawan-sx1278` está completo en
firmware: OTAA join, payload binario de 14 bytes, uplink cada 10 minutos.
Lo que bloquea la validación de banco es la ausencia de sensores físicos
soldados. El mock los reemplaza con un generador determinístico.

## Goals / Non-Goals

**Goals:**
- Binario flasheable que completa el join OTAA y envía uplinks válidos al
  gateway → ChirpStack → backend sin sensores físicos.
- Datos plausibles (temperatura, humedad, pulsos) que varían ciclo a ciclo.
- Distinguible del nodo real por `device_id` y por DevEUI/AppEUI distintos
  registrados en ChirpStack.

**Non-Goals:**
- Simular fallos de sensor ni reconexión por pérdida de LoRa (ya cubierto
  por sensor-node.rs y las tareas de validación de migrate-lorawan-sx1278).
- Despliegue en campo o autonomía con batería (es una herramienta de banco).
- Aleatoriedad real (no es necesaria; el patrón determinístico es suficiente
  para ejercitar el pipeline de datos).

## Flujo de datos

```
MockEnvironmentSensor (sin GPIO)
  │  temp_c ∈ [15, 25]°C, ciclo triangular de 144 pasos
  │  hum_rh ∈ [50, 75]%, inversamente correlada con temp
  ▼
build_binary() → [u8; 14] (device_id=2, CRC-8/MAXIM)
  ▼
lorawan::send_uplink() → trama Class A EU433 433.175 MHz SF7BW125
  ▼
SX1278 → gateway-node (Semtech UDP) → ChirpStack → MQTT → backend
```

## Generación de datos mock

### Temperatura y humedad

Se usa un ciclo triangular basado en `MockEnvironmentSensor::cycle` (u32
wrapping), con período de 144 pasos (≈ 24 h a 10 min/paso):

```
phase = cycle % 144
temp_c = si phase < 72:  15.0 + phase × (10.0 / 72.0)
         si phase ≥ 72:  25.0 − (phase − 72) × (10.0 / 72.0)
hum_rh = clamp(75.0 − (temp_c − 15.0) × 1.5, 40.0, 80.0)
```

Resultado: temperatura oscila entre 15 °C y 25 °C; humedad inversamente
correlacionada entre ~75 % y ~60 %.

### Pulsos de lluvia y viento

Basados en `seq` (u16 del loop principal), sin ISR:

```rust
lluvia_pulsos = if seq % 12 == 0 { 3 } else if seq % 7 == 0 { 1 } else { 0 };
viento_pulsos = (seq % 10) as u16;
```

Esto produce eventos de lluvia esporádicos y una velocidad de viento cíclica
de 0 a 9, suficiente para ejercitar el parser del backend.

### Batería

`bateria_mv = 3700` constante (batería saludable). El mock corre conectado
a USB; el valor es solo para completar el payload.

## Claves OTAA y registro en ChirpStack

El mock usa **claves OTAA distintas** a las del nodo real. Requiere registrar
un segundo dispositivo en ChirpStack con `device_id=2` en los metadatos.
El procedimiento es el mismo que para el nodo real (ver `infra/SETUP.md`).

Las claves se almacenan en NVS con el mismo namespace `lorawan` que el nodo
real. Esto implica que no se pueden coflashear ambos firmwares en la misma
placa sin reprovisionar NVS; se usa hardware separado o se reprovisiona entre
pruebas.

## Diferencias respecto al sensor-node real

| Aspecto | sensor-node (real) | sensor-node-mock |
|---------|-------------------|-----------------|
| device_id | 1 | 2 |
| Lecturas | DHT22 + GPIO (UnwiredEnvironmentSensor) | MockEnvironmentSensor |
| Pulsos | ISR de reed switch / anemómetro | Calculados de seq |
| Batería | 0 (placeholder) | 3700 mV (constante) |
| GPIO init | Sí (SPI + reset) | Solo SPI + reset (SX1278) |
| Uso esperado | Producción/campo | Banco/pruebas |

## Manejo de errores

- `MockEnvironmentSensor::read_environment()` nunca falla (retorna `Ok`
  siempre). Si el join OTAA falla, reintenta con backoff de 60 s (idéntico
  al nodo real). Si el uplink falla, continúa el ciclo (idéntico al nodo
  real).

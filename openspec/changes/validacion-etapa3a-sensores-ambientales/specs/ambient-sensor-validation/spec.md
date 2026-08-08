# Spec: ambient-sensor-validation

## ADDED Requirements

### Requirement: Lecturas DHT22 válidas por serial antes del primer uplink

Antes de transmitir el primer uplink real, el firmware SHALL leer al menos 3 muestras consecutivas del DHT22 sin error de checksum y loguear por serial temperatura en °C y humedad en % RH con resolución 0.1. Si las 3 lecturas iniciales fallan, el firmware SHALL loguear el error y reintentar indefinidamente (no transmitir valores inválidos).

#### Scenario: DHT22 lee temperatura y humedad correctamente al arrancar

- **WHEN** el firmware `sensor-node` arranca con el DHT22 correctamente soldado y el pull-up de 10 kΩ presente
- **THEN** el log serial muestra al menos 3 lecturas consecutivas con `temp_c` en [−40.0, 80.0] y `humidity_rh` en [0.0, 100.0] sin errores de checksum, dentro de los primeros 10 segundos

#### Scenario: Temperatura del DHT22 dentro de ±1 °C de referencia

- **WHEN** se compara la lectura del DHT22 con un termómetro de referencia en el mismo ambiente
- **THEN** la diferencia es ≤ 1.0 °C (tolerancia de fábrica del DHT22 es ±0.5 °C; se acepta ±1.0 °C incluyendo incertidumbre del instrumento de referencia)

#### Scenario: Firmware no transmite uplink si DHT22 falla en el arranque

- **WHEN** el DHT22 no está conectado o da error de checksum en las 3 lecturas iniciales
- **THEN** el firmware NO transmite ningún uplink LoRaWAN y continúa reintentando la lectura, logueando el error por serial


### Requirement: Lectura ADC de batería dentro del rango esperado

El firmware SHALL leer la tensión de la batería via ADC (divisor resistivo R1=R2=100 kΩ) y reportar el valor en mV. La lectura SHALL estar en el rango [3000, 4200] mV para una batería LiPo cargada, con estabilidad de ±50 mV entre lecturas consecutivas.

#### Scenario: Tensión de batería en rango LiPo cargado

- **WHEN** el nodo está alimentado por una batería LiPo con carga ≥ 80%
- **THEN** el campo `bateria_mv` en el log serial y en InfluxDB está en el rango [3500, 4200] mV

#### Scenario: Lectura ADC estable entre uplinks consecutivos

- **WHEN** se observan 5 uplinks consecutivos con la batería en reposo (sin carga adicional)
- **THEN** la variación de `bateria_mv` entre uplinks es ≤ 50 mV

#### Scenario: Lectura ADC coincide con multímetro dentro de tolerancia

- **WHEN** se mide la tensión de la batería con un multímetro directamente en sus bornes
- **THEN** el valor `bateria_mv` reportado por el firmware difiere ≤ 100 mV del valor del multímetro


### Requirement: Payload con datos reales llega a InfluxDB con campos correctos

El uplink del nodo sensor real SHALL contener temperatura y humedad del DHT22 y batería del ADC. En InfluxDB, los campos SHALL ser:
- `temp_c` en [−40.0, 80.0] (resolución 0.01 °C)
- `humidity_rh` en [0.0, 100.0] (resolución 0.01 %)
- `battery_mv` en [0, 4200]
- `lluvia_pulsos = 0` (hasta Etapa 3b)
- `viento_pulsos = 0` (hasta Etapa 3b)
- `device_id = 1`

#### Scenario: Valores reales de temperatura y humedad en InfluxDB

- **WHEN** el nodo transmite un uplink con datos del DHT22
- **THEN** InfluxDB contiene un punto con `device_id=1`, `temp_c` correspondiente al ambiente real (diferencia ≤ 1 °C respecto al termómetro de referencia), y `humidity_rh` correspondiente al ambiente real

#### Scenario: Campos de pulsos en cero hasta etapa 3b

- **WHEN** el nodo transmite uplinks sin pluviómetro ni anemómetro conectados
- **THEN** los campos `lluvia_pulsos` y `viento_pulsos` son 0 en todos los uplinks

#### Scenario: Frontend muestra valores reales (no datos sintéticos)

- **WHEN** el frontend React está corriendo y hay uplinks recientes del nodo real
- **THEN** las métricas de temperatura y humedad muestran valores coherentes con el ambiente (no el ciclo triangular sintético del mock)

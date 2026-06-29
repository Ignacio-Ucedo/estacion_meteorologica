# Spec: mock-sensor-node

## Purpose

Nodo sensor LoRaWAN que genera datos simulados (sin GPIO de sensores físicos)
para validar el pipeline completo en banco mientras los sensores reales no
están soldados.

## Scenarios

### Scenario 1: Datos plausibles en uplink

**Given** el binario `sensor-node-mock` está flasheado y las claves OTAA están
en NVS  
**When** completa el join OTAA y envía el primer uplink  
**Then** ChirpStack recibe una trama con `device_id=2`, temperatura ∈ [15, 25]°C,
humedad ∈ [40, 80]%, y CRC-8/MAXIM válido sobre los primeros 13 bytes

### Scenario 2: Variación entre ciclos

**Given** el nodo está en el loop principal  
**When** se envían N uplinks consecutivos  
**Then** los valores de temperatura y humedad varían de forma determinística
ciclo a ciclo (no todos son iguales), y `seq` incrementa en 1 por ciclo

### Scenario 3: Pulsos de lluvia y viento

**Given** el nodo envía uplinks sin reed switch ni anemómetro físico  
**When** el backend recibe los uplinks  
**Then** `lluvia_pulsos` es 0 la mayoría de los ciclos (1 o 3 en ciclos
específicos de `seq`) y `viento_pulsos` es 0–9 cíclicamente

### Scenario 4: Continuidad ante fallo de TX

**Given** el gateway está apagado  
**When** el mock intenta enviar un uplink  
**Then** registra el error por serial y continúa el ciclo; en el siguiente
ciclo vuelve a intentar el uplink

### Scenario 5: Distinguible del nodo real

**Given** el gateway está recibiendo uplinks de mock y nodo real  
**When** el backend escribe en InfluxDB  
**Then** las series tienen `device_id` distintos (1 vs 2) y las lecturas se
pueden filtrar independientemente

## Payload

Idéntico al de `lorawan-node`: 14 bytes little-endian, CRC-8/MAXIM en byte 13.
Ver spec `lorawan-node` para la definición de campos. La única diferencia es
`device_id=2`.

## Frecuencia de envío

10 minutos (idéntica al nodo real).

## Hardware requerido

ESP32 DevKitC V1 + módulo SX1278 (mismo hardware que el nodo real, sin
DHT22, sin reed switch, sin anemómetro). Conectado por USB a banco para
desarrollo.

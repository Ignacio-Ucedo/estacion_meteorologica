## ADDED Requirements

### Requirement: Gateway de campo operativo con backhaul y alimentación autónoma

El gateway (ESP32 + LR1121 transceiver + antena omni SMA 915 MHz) SHALL estar operativo en la posición de campo elegida con alimentación autónoma y backhaul a ChirpStack activo antes de iniciar las mediciones. El log serial del gateway SHALL mostrar `wifi_connected` (o equivalente para el backhaul usado) y el gateway SHALL aparecer Online en ChirpStack UI.

#### Scenario: Gateway online en ChirpStack desde posición de campo

- **WHEN** el gateway está montado en campo con alimentación autónoma y backhaul activo
- **THEN** ChirpStack UI muestra el gateway como Online y el log serial muestra conectividad activa

#### Scenario: Autonomía verificada durante el test

- **WHEN** el gateway opera con alimentación autónoma durante toda la duración del test de campo (mínimo 2 horas)
- **THEN** el gateway no se reinicia por falta de energía y mantiene la conectividad con ChirpStack


### Requirement: Uplinks recibidos en puntos de medición a distancias crecientes

El nodo mock SHALL transmitir al menos 10 uplinks en cada punto de medición (50 m, 200 m, 500 m, 1 km). Para cada punto, el RSSI y SNR de cada uplink recibido SHALL ser registrado. El packet loss SHALL ser ≤ 10% (≤ 1 de 10) en los puntos de hasta 500 m; para 1 km y más, se acepta hasta 20% de packet loss.

#### Scenario: Uplinks recibidos a 200 m con RSSI aceptable

- **WHEN** el nodo transmite 10 uplinks a 200 m de distancia en línea de visión directa
- **THEN** el gateway recibe al menos 9 de los 10 uplinks con RSSI > −110 dBm y SNR > −5 dB

#### Scenario: Uplinks recibidos a 1 km con packet loss registrado

- **WHEN** el nodo transmite 10 uplinks a 1 km de distancia en espacio abierto
- **THEN** el gateway recibe al menos 8 de los 10 y los valores de RSSI y SNR son registrados como referencia del informe


### Requirement: Distancia máxima documentada como línea base del informe

El test SHALL establecer la distancia máxima a la que el sistema alcanza packet loss ≤ 10% con el montaje de la PoC (yagi en nodo, omni en gateway, SF7BW125). Este valor SHALL quedar documentado en los resultados del change junto con el RSSI mínimo observado y el perfil del terreno.

#### Scenario: Distancia máxima registrada con datos de RSSI/SNR

- **WHEN** el nodo alcanza una distancia donde el packet loss supera el 20%
- **THEN** la distancia inmediatamente anterior (con ≤ 10% de pérdida) queda registrada como distancia máxima verificada, junto con el RSSI y SNR promedio en ese punto

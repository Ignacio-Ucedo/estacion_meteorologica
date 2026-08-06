## ADDED Requirements

### Requirement: Pinout SX1278 validado en ESP32-S3 DevKitC está documentado

El repositorio SHALL documentar en `hardware/netlist.md` la tabla de pinout del SX1278 en el ESP32-S3 DevKitC 38 pines, confirmando que los GPIOs actuales del gateway (SCK=18, MISO=19, MOSI=23, NSS=5, RST=14, DIO0=26) son válidos en el S3 y que GPIO5 no es strapping pin en el ESP32-S3.

#### Scenario: Pinout SX1278 para ESP32-S3 documentado en netlist

- **GIVEN** el archivo `hardware/netlist.md` existe
- **WHEN** un desarrollador consulta la tabla de pinout del gateway S3
- **THEN** encuentra la asignación SCK=18, MISO=19, MOSI=23, NSS=5, RST=14, DIO0=26 con nota explícita de que GPIO5 no es strapping pin en ESP32-S3

### Requirement: GPIOs reservados para W5500 y SIM7000G en ESP32-S3 están documentados

El repositorio SHALL documentar en `hardware/netlist.md` la reserva de GPIOs del ESP32-S3 DevKitC 38p para los módulos de expansión futuros del gateway, sin implementar los drivers:

| Módulo   | Señal     | GPIO reservado | Notas                                        |
|----------|-----------|----------------|----------------------------------------------|
| W5500    | CS        | GPIO10         | SPI2; sin conflicto con SX1278 (GPIO5)       |
| W5500    | INT       | GPIO9          | Input con pull-up interno                    |
| SIM7000G | TX        | GPIO17         | UART1 TX del S3                              |
| SIM7000G | RX        | GPIO16         | UART1 RX del S3                              |
| SIM7000G | PWR_KEY   | GPIO15         | Control de encendido del módulo              |
| ADC alim | VIN_MON   | GPIO4          | ADC1; sin conflicto WiFi en S3               |

Los GPIOs reservados SHALL quedar libres (sin inicializar) en el firmware de este change; su uso se implementará en changes posteriores.

#### Scenario: Tabla de reserva de GPIOs presente en netlist

- **GIVEN** el archivo `hardware/netlist.md` existe
- **WHEN** un desarrollador diseña la PCB del gateway definitivo o implementa un driver W5500/SIM7000G
- **THEN** encuentra en `hardware/netlist.md` la tabla de GPIOs reservados con módulo, señal, GPIO y notas, sin ambigüedad de conflictos con el SX1278

#### Scenario: GPIOs reservados no se usan en el firmware de este change

- **GIVEN** el firmware `gateway-node` compilado para ESP32-S3 en este change
- **WHEN** el gateway arranca y entra en operación normal (SX1278 + WiFi + UDP)
- **THEN** los GPIOs GPIO9, GPIO10, GPIO15, GPIO16, GPIO17 y GPIO4 no están inicializados ni configurados, quedando disponibles para cambios futuros

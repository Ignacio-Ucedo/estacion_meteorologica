## 1. Setup De Firmware

- [ ] 1.1 Crear el workspace Rust ESP-IDF para ESP32 DevKitC V1 / ESP32-WROOM-32. Requiere validar toolchain de build; commit sugerido `chore(firmware): crear workspace ESP-IDF para ESP32`.
- [ ] 1.2 Definir dos roles o binarios de firmware: `sensor-node` y `receiver-node`. Requiere verificación de build local; commit sugerido `feat(firmware): separar roles sensor y receptor LoRa`.
- [ ] 1.3 Agregar placeholders de configuración para id de dispositivo, frecuencia LoRa 433 MHz, intervalo de envío de 5 minutos y asignación de pines GPIO/SPI/I2C. Requiere revisar contra el cableado físico; commit sugerido `feat(firmware): agregar configuracion base de hardware`.

## 2. Entradas Del Nodo Sensor

- [ ] 2.1 Implementar lectura de temperatura/humedad DHT22 y log serial. Requiere prueba física con DHT22 en ESP32; commit sugerido `feat(firmware): leer temperatura y humedad con DHT22`.
- [ ] 2.2 Implementar lectura de presión MPL115A2 y log serial. Requiere prueba física con MPL115A2 en ESP32; commit sugerido `feat(firmware): leer presion con MPL115A2`.
- [ ] 2.3 Implementar conteo de pulsos del pluviómetro de cubeta basculante con reed switch. Requiere simulación física de pulsos o prueba con pluviómetro; commit sugerido `feat(firmware): contar pulsos del pluviometro`.
- [ ] 2.4 Implementar conteo de pulsos de viento usando la hipótesis pulso/NPN. Requiere primero simulación física de pulsos y prueba con anemómetro real solo después de confirmar la variante de salida; commit sugerido `feat(firmware): contar pulsos del anemometro`.
- [ ] 2.5 Registrar lecturas inválidas de sensores y errores de entrada sin detener el firmware del nodo sensor. Requiere pruebas de desconexión/falla de hardware; commit sugerido `fix(firmware): registrar errores de sensores sin detener firmware`.

## 3. Enlace LoRa P2P

- [ ] 3.1 Seleccionar e integrar el driver Rust LoRa/SX1278 compatible con SPI sobre ESP-IDF. Requiere compilar y probar inicialización SPI en hardware; commit sugerido `feat(firmware): integrar driver LoRa SX1278`.
- [ ] 3.2 Configurar el módulo XL1278-SMT/SX1278 para LoRa P2P a 433 MHz con parámetros de radio documentados para banco. Requiere dos módulos LoRa físicos; commit sugerido `feat(firmware): configurar LoRa P2P a 433 MHz`.
- [ ] 3.3 Construir el payload CSV del nodo sensor en el orden exacto `id,seq,temp,hum,pres,pulsos_lluvia,pulsos_viento`. Requiere inspección por serial; commit sugerido `feat(firmware): construir payload CSV del nodo sensor`.
- [ ] 3.4 Transmitir un payload CSV cada 5 minutos y reiniciar los contadores del intervalo solo después de preparar los valores transmitidos. Requiere prueba con dos placas; commit sugerido `feat(firmware): transmitir mediciones por LoRa`.

## 4. Receptor Logger

- [ ] 4.1 Implementar el loop de recepción LoRa del `receiver-node` con parámetros de radio compatibles. Requiere segundo ESP32 y módulo LoRa; commit sugerido `feat(firmware): recibir paquetes LoRa en nodo receptor`.
- [ ] 4.2 Parsear payloads CSV recibidos y registrar por USB serial tanto el payload crudo como los campos parseados. Requiere prueba con dos placas; commit sugerido `feat(firmware): parsear payload CSV recibido`.
- [ ] 4.3 Detectar payloads malformados y registrarlos sin detener el firmware del receptor. Requiere prueba con payload inválido; commit sugerido `fix(firmware): manejar payloads LoRa invalidos`.

## 5. Validacion De Banco

- [ ] 5.1 Flashear firmware `sensor-node` y `receiver-node` en dos placas ESP32 DevKitC V1. Requiere hardware físico.
- [ ] 5.2 Validar salida serial de DHT22 y MPL115A2 en el nodo sensor. Requiere sensores físicos.
- [ ] 5.3 Validar conteo de pulsos de lluvia y viento usando pulsos simulados o hardware confirmado. Requiere prueba física de entradas.
- [ ] 5.4 Validar entrega LoRa P2P a corta distancia de banco/patio y capturar logs seriales representativos de ambas placas. Requiere dos ESP32 y dos módulos SX1278.
- [ ] 5.5 Registrar limitaciones conocidas: sin deep sleep, sin medición de batería/panel solar, sin WiFi/backend, sin calibración BLE, sin validación de alcance en campo, sin constantes finales de calibración y sin payload binario de producción. Commit sugerido `docs(firmware): documentar resultados y limites del spike`.

## 6. Planificacion De Seguimientos Diferidos

- [ ] 6.1 Crear notas de seguimiento para confirmar la variante de salida del anemómetro RS-FSJT-N01 antes del diseño de hardware final. Commit sugerido `docs(firmware): registrar pendiente de interfaz del anemometro`.
- [ ] 6.2 Crear notas de seguimiento para constantes de calibración de lluvia/viento y flujo posterior de calibración BLE. Commit sugerido `docs(firmware): registrar pendientes de calibracion`.
- [ ] 6.3 Crear notas de seguimiento para migrar el payload LoRa de CSV de depuración a binario de tamaño fijo antes de producción o autonomía en campo. Commit sugerido `docs(firmware): registrar migracion futura a payload binario`.
- [ ] 6.4 Crear notas de seguimiento para deep sleep, presupuesto energético, batería/panel solar y validación de alcance en campo. Commit sugerido `docs(firmware): registrar pendientes de autonomia y alcance`.

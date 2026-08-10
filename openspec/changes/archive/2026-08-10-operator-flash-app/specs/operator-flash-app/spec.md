## ADDED Requirements

### Requirement: Detección de dispositivo ESP32 por USB
La app SHALL detectar automáticamente puertos serie disponibles y SHALL identificar cuáles corresponden a un ESP32 (por VID/PID del chip USB-serial).

#### Scenario: ESP32 conectado antes de abrir la app
- **WHEN** el operario abre la app con el ESP32 ya conectado por USB
- **THEN** la app SHALL mostrar el puerto detectado y el chip identificado en el paso 1 del wizard

#### Scenario: ESP32 conectado después de abrir la app
- **WHEN** el operario conecta el ESP32 mientras la app está abierta
- **THEN** la app SHALL actualizar la lista de puertos disponibles en tiempo real sin requerir reinicio

#### Scenario: Sin dispositivo conectado
- **WHEN** el operario avanza al paso de flash sin un ESP32 conectado
- **THEN** la app SHALL mostrar un error claro y SHALL bloquear el avance hasta que se detecte un dispositivo

### Requirement: Configuración de parámetros por dispositivo
La app SHALL proveer un formulario para configurar los parámetros del dispositivo antes del flash.

#### Scenario: Parámetros obligatorios completos
- **WHEN** el operario completa SSID WiFi, contraseña WiFi y host ChirpStack
- **THEN** la app SHALL habilitar el botón de avance al paso siguiente

#### Scenario: Asignación automática de OTAA keys
- **WHEN** el operario avanza al paso de configuración
- **THEN** la app SHALL asignar automáticamente el próximo par DevEUI+AppKey disponible del pool
- **AND** SHALL mostrar los valores asignados (solo lectura) al operario

#### Scenario: Pool de OTAA keys agotado
- **WHEN** el pool de DevEUI/AppKey no tiene pares disponibles
- **THEN** la app SHALL mostrar un error y SHALL permitir importar un nuevo pool CSV antes de continuar

### Requirement: Flash del firmware prebuildeado
La app SHALL flashear el firmware `.bin` al ESP32 usando esptool bundleado.

#### Scenario: Flash exitoso
- **WHEN** el operario inicia el flash
- **THEN** la app SHALL ejecutar esptool con los parámetros correctos (dirección 0x0, baud rate, puerto seleccionado)
- **AND** SHALL mostrar una barra de progreso durante el proceso
- **AND** SHALL confirmar el éxito al completarse

#### Scenario: Error de permisos USB (Linux)
- **WHEN** esptool falla con un error de permisos en el puerto serie
- **THEN** la app SHALL mostrar instrucciones específicas para agregar el usuario al grupo `uucp` o `dialout`
- **AND** SHALL ofrecer ejecutar el comando de corrección con elevación de privilegios

#### Scenario: Error de conexión con el ESP32
- **WHEN** esptool no puede conectar con el ESP32 (no entra en modo bootloader)
- **THEN** la app SHALL mostrar instrucciones para mantener presionado BOOT al conectar o durante el flash

### Requirement: Provisión de NVS con OTAA keys y credenciales WiFi
La app SHALL generar y flashear una partición NVS con los parámetros configurados, sin dependencias externas.

#### Scenario: Generación y flash de NVS exitoso
- **WHEN** el flash del firmware fue exitoso
- **THEN** la app SHALL generar el `.bin` de NVS en memoria a partir de los parámetros configurados
- **AND** SHALL flashearlo en la dirección 0x9000 usando esptool
- **AND** SHALL confirmar el éxito

#### Scenario: Verificación post-flash
- **WHEN** el NVS fue flasheado
- **THEN** la app SHALL realizar un read-back de la partición NVS y SHALL verificar que los bytes corresponden al `.bin` generado

### Requirement: Registro automático en ChirpStack
La app SHALL registrar el gateway y el device en ChirpStack usando su API REST.

#### Scenario: Registro de device exitoso
- **WHEN** el flash y la provisión de NVS están completos
- **THEN** la app SHALL crear el device en ChirpStack con el DevEUI y AppKey asignados
- **AND** SHALL asociarlo al application ID configurado
- **AND** SHALL confirmar el registro

#### Scenario: Device ya registrado en ChirpStack
- **WHEN** el DevEUI ya existe en ChirpStack
- **THEN** la app SHALL actualizar el device existente con las nuevas claves y SHALL notificar al operario

#### Scenario: ChirpStack no disponible
- **WHEN** la app no puede conectar al host de ChirpStack
- **THEN** la app SHALL completar el flash y NVS igualmente
- **AND** SHALL marcar el registro en ChirpStack como pendiente en el log local
- **AND** SHALL ofrecer reintentar el registro más tarde

### Requirement: Log persistente de dispositivos provisionados
La app SHALL mantener un registro local de todos los dispositivos provisionados.

#### Scenario: Registro tras provisión exitosa
- **WHEN** el proceso de provisión completa (flash + NVS + registro ChirpStack)
- **THEN** la app SHALL guardar en SQLite local: DevEUI, MAC WiFi (si disponible), fecha/hora, versión de firmware, estado (completo/parcial), parámetros configurados

#### Scenario: Exportación del log
- **WHEN** el operario solicita exportar el log
- **THEN** la app SHALL generar un CSV con todos los dispositivos provisionados ordenados por fecha

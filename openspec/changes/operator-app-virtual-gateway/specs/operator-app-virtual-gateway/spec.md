## ADDED Requirements

### Requirement: Configuración de OTAA keys y host ChirpStack
La sección de Gateway Virtual SHALL presentar campos editables para DevEUI (8 bytes hex), AppEUI (8 bytes hex), AppKey (16 bytes hex) y host ChirpStack (host:puerto, default `localhost:1700`), más un campo de intervalo de envío en segundos (default 30, rango 5–300).

#### Scenario: Carga de claves desde nvs_mock.csv
- **WHEN** el operario hace clic en "Cargar desde CSV" y selecciona un archivo CSV en formato nvs_mock
- **THEN** la app SHALL parsear el CSV y SHALL rellenar automáticamente los campos DevEUI, AppEUI y AppKey con los valores encontrados

#### Scenario: Validación de formato de campos
- **WHEN** el operario ingresa un DevEUI con longitud o caracteres inválidos
- **THEN** la app SHALL marcar el campo con error y SHALL deshabilitar el botón de inicio hasta que el valor sea válido

#### Scenario: Persistencia de configuración entre sesiones
- **WHEN** el operario cierra y vuelve a abrir la app
- **THEN** los valores de host ChirpStack e intervalo SHALL mantenerse desde la última sesión (las OTAA keys NO se persisten por seguridad)

### Requirement: Ciclo de vida del gateway virtual
El gateway virtual SHALL tener tres estados observables: `detenido`, `conectando` (durante el OTAA join) y `corriendo`. El operario SHALL poder iniciar y detener el gateway en cualquier momento.

#### Scenario: Inicio del gateway — OTAA join exitoso
- **WHEN** el operario hace clic en "Iniciar" con una configuración válida
- **THEN** la app SHALL mostrar estado `conectando`, SHALL enviar PULL_DATA al Gateway Bridge de ChirpStack, SHALL construir y enviar un JoinRequest LoRaWAN real (con MIC y crypto OTAA), y SHALL transicionar a estado `corriendo` al recibir el JoinAccept

#### Scenario: OTAA join fallido por ChirpStack no disponible
- **WHEN** el host ChirpStack no responde dentro de 10 segundos durante el join
- **THEN** la app SHALL mostrar estado `error` con mensaje claro y SHALL ofrecer reintentar sin requerir reinicio de la app

#### Scenario: OTAA join fallido por device no registrado en ChirpStack
- **WHEN** ChirpStack rechaza el JoinRequest (no hay device con ese DevEUI registrado)
- **THEN** la app SHALL mostrar estado `error` indicando que el device no está registrado y SHALL sugerir registrarlo en ChirpStack primero

#### Scenario: Detención del gateway
- **WHEN** el operario hace clic en "Detener" mientras el gateway está `corriendo`
- **THEN** la app SHALL cancelar la tarea tokio, SHALL mostrar estado `detenido` y SHALL preservar el log de la sesión hasta que el operario lo limpie manualmente

### Requirement: Generación y envío de uplinks sintéticos
Mientras el gateway está en estado `corriendo`, SHALL generar una lectura sintética cada intervalo configurado y SHALL enviarla como uplink LoRaWAN real (payload binario de 14 bytes cifrado con AppSKey, MIC calculado con NwkSKey) al Gateway Bridge de ChirpStack via PUSH_DATA UDP.

#### Scenario: Uplink enviado correctamente
- **WHEN** el gateway está `corriendo` y se cumple el intervalo
- **THEN** la app SHALL generar una lectura con variación aleatoria dentro de rangos realistas (temperatura 15–40 °C, humedad 20–95 %, lluvia y viento en pulsos), SHALL construir el payload binario de 14 bytes (mismo formato que el firmware real: device_id=3, seq incremental, temp*100, hum*100, lluvia_pulsos, viento_pulsos, bateria_mv=4200, crc8), SHALL cifrar el FRMPayload y SHALL enviarlo como PUSH_DATA con metadatos RF sintéticos (RSSI=-80, SNR=7.0, frecuencia 433.175 MHz, SF7BW125)

#### Scenario: Keepalive PULL_DATA
- **WHEN** han pasado 30 segundos desde el último PULL_DATA
- **THEN** la app SHALL enviar un nuevo PULL_DATA para mantener el endpoint UDP registrado en el Gateway Bridge y SHALL responder con TX_ACK a cualquier PULL_RESP recibido

### Requirement: Log en tiempo real
La sección de Gateway Virtual SHALL mostrar un panel de log con los eventos de la sesión actual, con timestamps y nivel de severidad.

#### Scenario: Eventos registrados en el log
- **WHEN** el gateway realiza cualquier acción significativa (PULL_DATA enviado, JoinRequest enviado, JoinAccept recibido, uplink enviado, error UDP, reconexión)
- **THEN** el log SHALL mostrar una nueva línea con timestamp HH:MM:SS, nivel (INFO/WARN/ERROR) y descripción del evento

#### Scenario: Scroll automático al evento más reciente
- **WHEN** se agrega un nuevo evento al log y el usuario no ha hecho scroll manual hacia arriba
- **THEN** el log SHALL hacer scroll automático para mostrar el evento más reciente

#### Scenario: Límite de líneas en el log
- **WHEN** el log acumula más de 500 líneas
- **THEN** las líneas más antiguas SHALL eliminarse del buffer visible para evitar crecimiento ilimitado de memoria

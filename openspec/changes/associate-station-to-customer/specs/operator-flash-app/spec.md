# Delta spec: operator-flash-app
# Change: associate-station-to-customer

## ADDED Requirements

### Requirement: Pantalla de selección de cliente antes del wizard

El operator-app SHALL mostrar una pantalla `CustomerSelect` antes de iniciar el `FlashWizard`. Esta pantalla SHALL:

1. Obtener la lista de clientes desde `GET /api/users` del backend configurado.
2. Mostrar un dropdown o lista de selección con `username` de cada cliente.
3. Permitir avanzar al wizard solo si hay un cliente seleccionado.
4. Mostrar un indicador de carga mientras obtiene la lista y un error inline si falla.

El `selectedCustomerId` (username del cliente) SHALL pasarse como prop al `FlashWizard` para usarse en la asociación post-provisión.

#### Scenario: Operario selecciona cliente antes de flashear

- **GIVEN** el backend tiene clientes registrados ["juan", "pedro"]
- **WHEN** el operario abre el wizard
- **THEN** ve la pantalla `CustomerSelect` con los clientes disponibles antes de ingresar al wizard

#### Scenario: Backend inaccesible al cargar clientes

- **GIVEN** el backend no está disponible
- **WHEN** el operario abre el wizard
- **THEN** la pantalla `CustomerSelect` muestra un error inline y un botón "Reintentar"; el wizard NO arranca

### Requirement: Asociación automática post-provisión

Al completar exitosamente el último step del wizard (ChirpStack para nodos, Registro para gateways), el wizard SHALL llamar automáticamente a `PUT /api/stations/{station_id}/owner` con el `selectedCustomerId`.

- `station_id` = `dev-{devEui[:8]}` (derivado del `devEui` provisioned en Step 2)
- Si la llamada falla, SHALL mostrarse un warning (no un error bloqueante): la provisión fue exitosa pero la asociación al cliente debe reintentarse manualmente.

#### Scenario: Provisión exitosa asocia la station al cliente

- **GIVEN** el wizard completó todos los steps exitosamente con `devEui="aabbccddee112233"` y cliente "juan" seleccionado
- **WHEN** el último step se completa
- **THEN** el wizard llama `PUT /api/stations/dev-aabbccdd/owner` con `{owner_id: "juan"}` y muestra confirmación de asociación

#### Scenario: Fallo en la asociación no revierte el flasheo

- **GIVEN** el wizard completó todos los steps exitosamente
- **WHEN** `PUT /api/stations/{id}/owner` falla (backend inaccesible)
- **THEN** el wizard muestra un warning "La estación fue provisionada pero no se pudo asociar al cliente. Intentá de nuevo desde la pantalla de gestión." El dispositivo físico no se ve afectado.

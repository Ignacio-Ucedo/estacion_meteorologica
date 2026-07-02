## ADDED Requirements

### Requirement: Nivel de batería en la lectura actual de una estación
El endpoint `GET /api/stations/{id}` SHALL incluir un campo `batteryLevel` dentro del objeto `current`, representando el porcentaje de carga de la batería (0-100, resolución 1%) de la última lectura conocida. El campo SHALL ser siempre un número; NUNCA SHALL devolverse como `null` cuando `current` existe. Cuando no se registró un valor explícito, el campo SHALL devolverse como `0` (default).

#### Scenario: Estación con dato de batería disponible
- **WHEN** el cliente solicita `GET /api/stations/alpha` y la última lectura almacenada tiene `battery_level = 78`
- **THEN** la respuesta incluye `"current": { ..., "batteryLevel": 78 }`

#### Scenario: Estación con lectura sin dato de batería explícito
- **WHEN** el cliente solicita `GET /api/stations/alpha` y la última lectura almacenada no registró un valor explícito de `battery_level`
- **THEN** la respuesta incluye `"current": { ..., "batteryLevel": 0 }` (default), nunca `null`

#### Scenario: Estación sin lecturas registradas
- **WHEN** el cliente solicita `GET /api/stations/{id}` de una estación registrada que aún no tiene ninguna lectura
- **THEN** `current` se devuelve como `null`, igual que el comportamiento existente para el resto de las variables (este es el único caso en que la ausencia de dato se representa con `null`; nunca a nivel del campo `batteryLevel` en sí)

---

### Requirement: Nivel de batería en el listado de estaciones
El endpoint `GET /api/stations` SHALL incluir un campo `batteryLevel` en cada elemento de `data`, representando el porcentaje de batería (0-100) de la última lectura conocida de esa estación. Cuando la estación no tiene ninguna lectura registrada, el campo SHALL devolverse como `null`; en cualquier otro caso SHALL ser un número (nunca `null` a nivel de campo cuando existe al menos una lectura).

#### Scenario: Estación con lecturas en el listado
- **WHEN** el cliente solicita `GET /api/stations` y la estación `alpha` tiene lecturas registradas, la más reciente con `battery_level = 62`
- **THEN** el elemento correspondiente a `alpha` en `data` incluye `"batteryLevel": 62`

#### Scenario: Estación sin lecturas en el listado
- **WHEN** el cliente solicita `GET /api/stations` y la estación `delta` no tiene ninguna lectura registrada
- **THEN** el elemento correspondiente a `delta` en `data` incluye `"batteryLevel": null`

---

### Requirement: Nivel de batería en el historial paginado de lecturas
El endpoint `GET /api/stations/{id}/readings` SHALL incluir el campo `batteryLevel` (porcentaje 0-100, nunca `null`) en cada elemento de `data`, manteniendo el resto del contrato de paginación sin cambios.

#### Scenario: Historial con lecturas que incluyen batería
- **WHEN** el cliente solicita `GET /api/stations/alpha/readings?page=1`
- **THEN** cada elemento de `data` incluye `batteryLevel` con el valor numérico (0-100); `0` si no fue registrado explícitamente para esa lectura

---

### Requirement: Persistencia del nivel de batería en el modelo de lecturas
El modelo de dominio `Reading` SHALL almacenar `battery_level` como un valor numérico (0-100, sin unidades adicionales, ya convertido a porcentaje antes de persistirse). El campo SHALL ser NOT NULL con valor por defecto `0`; las lecturas históricas previas a este requirement SHALL backfillearse a `0` en la migración, sin quedar en `NULL`.

#### Scenario: Inserción de una nueva lectura con batería
- **WHEN** se inserta una nueva fila en `readings` con `battery_level = 45.5`
- **THEN** el valor se persiste y es recuperable sin pérdida de precisión decimal

#### Scenario: Inserción de una lectura sin especificar batería
- **WHEN** se inserta una nueva fila en `readings` sin especificar `battery_level`
- **THEN** la columna toma el valor por defecto `0` y la inserción no falla

#### Scenario: Backfill de lecturas históricas al aplicar la migración
- **WHEN** se aplica la migración Alembic que agrega la columna `battery_level`
- **THEN** todas las filas existentes en `readings` quedan con `battery_level = 0`, no `NULL`

## ADDED Requirements

### Requirement: Nivel de batería en la lectura actual de una estación
El endpoint `GET /api/stations/{id}` SHALL incluir un campo `batteryLevel` dentro del objeto `current`, representando el porcentaje de carga de la batería (0-100, resolución 1%) de la última lectura conocida. Cuando la última lectura no tenga dato de batería registrado, el campo SHALL devolverse como `null`.

#### Scenario: Estación con dato de batería disponible
- **WHEN** el cliente solicita `GET /api/stations/alpha` y la última lectura almacenada tiene `battery_level = 78`
- **THEN** la respuesta incluye `"current": { ..., "batteryLevel": 78 }`

#### Scenario: Estación con lectura sin dato de batería
- **WHEN** el cliente solicita `GET /api/stations/alpha` y la última lectura almacenada no tiene `battery_level` (valor `NULL` en la base)
- **THEN** la respuesta incluye `"current": { ..., "batteryLevel": null }`

#### Scenario: Estación sin lecturas registradas
- **WHEN** el cliente solicita `GET /api/stations/{id}` de una estación registrada que aún no tiene ninguna lectura
- **THEN** `current` se devuelve como `null`, igual que el comportamiento existente para el resto de las variables

---

### Requirement: Nivel de batería en el historial paginado de lecturas
El endpoint `GET /api/stations/{id}/readings` SHALL incluir el campo `batteryLevel` (porcentaje 0-100 o `null`) en cada elemento de `data`, manteniendo el resto del contrato de paginación sin cambios.

#### Scenario: Historial con lecturas que incluyen batería
- **WHEN** el cliente solicita `GET /api/stations/alpha/readings?page=1`
- **THEN** cada elemento de `data` incluye `batteryLevel` con el valor numérico (0-100) o `null` si no fue registrado para esa lectura

---

### Requirement: Persistencia del nivel de batería en el modelo de lecturas
El modelo de dominio `Reading` SHALL almacenar `battery_level` como un valor numérico opcional (0-100, sin unidades adicionales, ya convertido a porcentaje antes de persistirse). El campo SHALL ser nullable para no romper la compatibilidad con lecturas históricas que no lo registraron.

#### Scenario: Inserción de una nueva lectura con batería
- **WHEN** se inserta una nueva fila en `readings` con `battery_level = 45.5`
- **THEN** el valor se persiste y es recuperable sin pérdida de precisión decimal

#### Scenario: Inserción de una lectura sin dato de batería
- **WHEN** se inserta una nueva fila en `readings` sin especificar `battery_level`
- **THEN** la columna queda en `NULL` y la inserción no falla

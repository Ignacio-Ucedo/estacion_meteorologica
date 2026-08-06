## ADDED Requirements

### Requirement: El modelo Reading incluye wind_direction

El backend SHALL agregar el campo `wind_direction` (tipo `FLOAT`, grados 0.0–359.9, nullable durante migración, luego NOT NULL con default 0.0) al modelo `Reading` de PostgreSQL, con la migración Alembic correspondiente.

#### Scenario: Migración Alembic agrega wind_direction

- **GIVEN** una base de datos PostgreSQL con la versión de esquema anterior
- **WHEN** se ejecuta `alembic upgrade head`
- **THEN** la tabla `readings` tiene la columna `wind_direction FLOAT NOT NULL DEFAULT 0.0` sin pérdida de datos existentes

#### Scenario: Reading con wind_direction se persiste correctamente

- **GIVEN** el ingestion bridge recibe un uplink con payload de 16 bytes válido
- **WHEN** se parsea el campo `veleta_dir` y se convierte a grados (`veleta_dir / 10.0`)
- **THEN** el `Reading` persiste con `wind_direction` en [0.0, 359.9] y el REST endpoint `/api/stations/{id}/readings` lo devuelve en el JSON de respuesta

#### Scenario: wind_direction aparece en la respuesta REST

- **GIVEN** existen Readings con valores de wind_direction en base de datos
- **WHEN** el cliente hace GET /api/stations/{id}/readings
- **THEN** cada lectura en la respuesta JSON incluye el campo `wind_direction` como número flotante

### Requirement: Parser de payload actualizado a 16 bytes en el ingestion bridge

El ingestion bridge SHALL parsear el nuevo payload de 16 bytes: `veleta_dir` en bytes 11–12, `bateria_mv` en bytes 13–14, CRC-8/MAXIM en byte 15. El parser SHALL rechazar payloads de longitud distinta a 16 bytes con `422 Unprocessable Entity`.

#### Scenario: Payload de 14 bytes (versión anterior) es rechazado

- **GIVEN** el backend está actualizado para 16 bytes y llega un webhook con payload de 14 bytes
- **WHEN** el ingestion bridge intenta parsear el payload
- **THEN** retorna `422 Unprocessable Entity` con log `payload_wrong_length expected=16 got=14`

#### Scenario: Payload de 16 bytes con CRC válido es aceptado

- **GIVEN** llega un webhook con payload de 16 bytes y CRC-8/MAXIM correcto
- **WHEN** el ingestion bridge lo parsea
- **THEN** `wind_direction = veleta_dir / 10.0` se persiste en `Reading` y retorna `200 OK`

## ADDED Requirements

### Requirement: El dashboard muestra la dirección de viento actual

El frontend React SHALL mostrar el valor de `wind_direction` de la lectura más reciente como tarjeta de métrica en el dashboard principal, con el ángulo en grados (0°–359°) y la rosa de los vientos textual (N, NE, E, SE, S, SW, W, NW) correspondiente.

#### Scenario: Dirección de viento visible en el dashboard

- **GIVEN** el backend retorna Readings con `wind_direction` para la estación seleccionada
- **WHEN** el usuario accede al dashboard
- **THEN** la tarjeta de métrica muestra el valor de `wind_direction` en grados (ej. "225°") y su punto cardinal aproximado (ej. "SW")

#### Scenario: Sin dato de dirección de viento

- **GIVEN** el backend retorna Readings sin `wind_direction` (null o ausente)
- **WHEN** el usuario accede al dashboard
- **THEN** la tarjeta muestra "—" o "N/A" sin errores de renderizado

#### Scenario: Punto cardinal correcto para los 8 sectores

- **GIVEN** el valor de `wind_direction` cae en uno de los 8 sectores de 45° (N: 337.5°–22.5°, NE: 22.5°–67.5°, …, NW: 292.5°–337.5°)
- **WHEN** el frontend calcula la etiqueta textual
- **THEN** la tarjeta muestra el punto cardinal correcto para el sector

## MODIFIED Requirements

### Requirement: Cliente HTTP tipado centralizado
El frontend SHALL exponer un módulo `src/api/` con funciones tipadas en TypeScript para cada endpoint de la API REST del backend. Toda comunicación HTTP del frontend SHALL pasar por este módulo.  
Cuando haya un token JWT activo en el `AuthContext`, el módulo SHALL incluir automáticamente el header `Authorization: Bearer <token>` en todas las peticiones.

#### Scenario: Llamada exitosa a la API
- **WHEN** se invoca una función del cliente (e.g. `getStation("alpha")`)
- **THEN** el módulo realiza un `fetch` a `VITE_API_URL/api/stations/alpha` y retorna el objeto tipado

#### Scenario: Error HTTP de la API
- **WHEN** la API responde con un código de estado ≥ 400
- **THEN** el cliente lanza un error con el mensaje y el código de status

#### Scenario: Backend no disponible
- **WHEN** el `fetch` falla por error de red (conexión rechazada, timeout)
- **THEN** el cliente lanza un error con mensaje descriptivo

#### Scenario: Petición con token activo
- **WHEN** hay un token JWT almacenado en `localStorage` y se realiza cualquier petición a la API
- **THEN** el header `Authorization: Bearer <token>` se incluye en la petición

#### Scenario: Petición sin token activo
- **WHEN** no hay token en `localStorage` y se realiza una petición a la API
- **THEN** el header `Authorization` no se incluye en la petición

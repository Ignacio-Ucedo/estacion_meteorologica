## ADDED Requirements

### Requirement: Compilación automática del firmware en CI
El pipeline CI SHALL compilar el firmware de la estación meteorológica en cada tag de versión y SHALL publicar los artefactos como GitHub Release assets.

#### Scenario: Tag de versión creado
- **WHEN** se crea un tag git con formato `v*` (e.g., `v1.0.0`)
- **THEN** el workflow SHALL compilar el binario `gateway-node-mock` en modo release para el target `xtensa-esp32-espidf`
- **AND** SHALL publicar el `.bin` como asset del GitHub Release asociado al tag

#### Scenario: Artefactos publicados
- **WHEN** la compilación es exitosa
- **THEN** el release SHALL incluir al menos: `firmware-vX.Y.Z.bin`, `partitions.csv`
- **AND** cada asset SHALL tener un checksum SHA256 publicado junto al archivo

#### Scenario: Fallo de compilación
- **WHEN** la compilación falla en CI
- **THEN** el release NO SHALL ser publicado
- **AND** el workflow SHALL reportar el error en el PR/commit asociado

### Requirement: Descarga del firmware desde la operator-app
La operator-app SHALL poder descargar el firmware prebuildeado desde GitHub Releases.

#### Scenario: Descarga de la última versión
- **WHEN** el operario abre la operator-app por primera vez o solicita actualizar el firmware
- **THEN** la app SHALL consultar la GitHub Releases API para obtener la última versión disponible
- **AND** SHALL descargar el `.bin` y almacenarlo en caché local

#### Scenario: Uso en modo offline
- **WHEN** la app no tiene conexión a internet pero tiene el firmware en caché
- **THEN** la app SHALL usar el `.bin` en caché y SHALL notificar al operario que está usando la versión cacheada

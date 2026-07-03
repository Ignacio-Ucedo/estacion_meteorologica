## ADDED Requirements

### Requirement: Scaffold de la Operator App (Tauri standalone)
La Operator App SHALL ser una aplicación de escritorio Tauri (Rust backend + React/TypeScript frontend) distribuible como binario standalone sin dependencias externas en la máquina del operario. El binario SHALL estar disponible para Linux, Windows y macOS.

#### Scenario: Apertura de la app sin configuración previa
- **WHEN** el operario abre la Operator App por primera vez
- **THEN** la app SHALL mostrar la sección activa por defecto (Gateway Virtual) sin errores ni pasos de configuración previos obligatorios

### Requirement: Navegación lateral entre secciones
La app SHALL presentar una barra lateral izquierda con las secciones disponibles para el operario. Cada sección SHALL ser accesible con un clic y SHALL mantener su estado interno al cambiar de sección y volver.

#### Scenario: Navegación entre secciones
- **WHEN** el operario hace clic en una sección de la barra lateral
- **THEN** el panel principal SHALL mostrar el contenido de esa sección sin recargar la app

#### Scenario: Estado conservado al cambiar de sección
- **WHEN** el gateway virtual está corriendo y el operario navega a otra sección y vuelve
- **THEN** el gateway SHALL seguir corriendo y el log SHALL mostrar los eventos acumulados

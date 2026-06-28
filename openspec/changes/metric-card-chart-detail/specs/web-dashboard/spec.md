## ADDED Requirements

### Requirement: Gráfico de la variable seleccionada siempre visible en el dashboard
El dashboard principal SHALL mostrar, en todo momento y debajo del grid de metric cards, un gráfico con la evolución temporal de la variable actualmente seleccionada (temperatura, humedad, velocidad del viento o precipitación acumulada), sin requerir abrir un elemento emergente ni abandonar la pestaña actual. El gráfico mostrado SHALL reutilizar el mismo componente y la misma configuración de gráfico (tipo de gráfico, color, unidad, dominio de ejes y periodos 1D/7D/30D/1Y) que utiliza la pestaña "Gráficas" para esa variable, sin duplicar la lógica de obtención o render de datos.

#### Scenario: Estado inicial del dashboard
- **WHEN** el usuario abre el dashboard principal por primera vez
- **THEN** la aplicación muestra el gráfico de evolución de una variable por defecto (Temperatura) debajo del grid de metric cards

#### Scenario: Seleccionar una metric card con histórico disponible
- **WHEN** el usuario hace click en la metric card de Temperatura, Humedad, Velocidad del viento o Precipitación acumulada en el dashboard principal
- **THEN** el gráfico mostrado debajo del grid se actualiza in place para mostrar la evolución de esa variable, con los mismos datos, colores y periodos que se ven en la pestaña "Gráficas", sin recargar la página, sin navegar a otra pestaña y sin ocultar el resto del dashboard
- **AND** la metric card seleccionada queda visualmente resaltada como activa

#### Scenario: Metric card sin histórico disponible
- **WHEN** el usuario hace click en una metric card que no tiene serie histórica definida (por ejemplo Dirección del viento o Batería)
- **THEN** el gráfico mostrado debajo del grid no cambia y la card permanece en su estado visual normal

### Requirement: Configuración de gráficos centralizada por variable
La configuración de presentación de cada gráfico (título, tipo de gráfico, color, unidad, dominio de ejes y series diarias) SHALL definirse en un único lugar compartido por la pestaña "Gráficas" y por el detalle de gráfico abierto desde una metric card, de modo que ambos flujos queden sincronizados ante cualquier cambio futuro en esa configuración.

#### Scenario: Cambio de configuración se refleja en ambos flujos
- **WHEN** se actualiza la configuración de presentación de una variable (por ejemplo su color o el dominio del eje Y)
- **THEN** tanto el gráfico mostrado en la pestaña "Gráficas" como el gráfico mostrado al seleccionar la metric card correspondiente reflejan el mismo cambio, sin requerir ediciones en dos lugares distintos

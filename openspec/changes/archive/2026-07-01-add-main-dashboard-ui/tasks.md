## 1. Frontend Shell

- [x] 1.1 Crear o identificar el scaffold frontend React donde vivira la pantalla. Commit sugerido `chore(frontend): preparar scaffold del dashboard principal`.
- [x] 1.2 Crear la estructura desktop del app shell con sidebar fija de 256px y area principal. Commit sugerido `feat(frontend): crear layout desktop del dashboard principal`.

## 2. Sidebar Estatica

- [x] 2.1 Implementar la marca visual de sidebar con `WeatherOS` y `Precision Monitoring`. Commit sugerido `feat(frontend): agregar marca visual de sidebar`.
- [x] 2.2 Implementar los items de sidebar requeridos: `Dashboard` activo, `Historial` inactivo, `Graficas` inactivo y `Gestion de estaciones` inactivo. Commit sugerido `feat(frontend): agregar navegacion visual del dashboard`.
- [x] 2.3 Asegurar que los items inactivos no ejecuten navegacion real en esta historia. Commit sugerido `fix(frontend): mantener sidebar como navegacion visual`.

## 3. Dashboard Principal

- [x] 3.1 Implementar top bar visual con titulo `Station Monitor`, botones de iconos y avatar sin comportamiento funcional. Commit sugerido `feat(frontend): agregar top bar del monitor de estacion`.
- [x] 3.2 Implementar header/status de estacion con nombre, ubicacion, estado online, badge operativo y ultima actualizacion usando mock data. Commit sugerido `feat(frontend): mostrar estado principal de estacion`.
- [x] 3.3 Implementar cards de metricas actuales para temperatura, humedad, velocidad del viento, direccion del viento y precipitacion acumulada usando mock data. Commit sugerido `feat(frontend): agregar cards de metricas actuales`.

## 4. Estilos Y Fidelidad Visual

- [x] 4.1 Aplicar paleta oscura, bordes, estados activos y tipografias alineadas al frame Figma `Dashboard Principal`. Commit sugerido `feat(frontend): aplicar estilos del dashboard principal`.
- [x] 4.2 Verificar que no se rendericen graficas ni componentes de historial dentro del dashboard principal. Commit sugerido `test(frontend): verificar ausencia de graficas en dashboard principal`.
- [x] 4.3 Verificar visualmente en viewport desktop que textos, cards y sidebar no se superpongan ni generen overflow inesperado. Commit sugerido `test(frontend): validar vista desktop del dashboard principal`.

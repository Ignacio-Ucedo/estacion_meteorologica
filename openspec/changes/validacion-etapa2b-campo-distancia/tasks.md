## 0. Prerrequisitos (verificar antes de salir al campo)

- [ ] 0.1 Confirmar que la Etapa 2a está archivada con resultados satisfactorios (OTAA join exitoso, RSSI banco > −80 dBm, packet loss banco ≤ 20%). Sin esto, ir al campo no tiene sentido.
  `chore(docs): verificar prerequisito etapa 2a completada antes de campo`
- [ ] 0.2 Ensamblar el gateway de campo: ESP32 + LR1121 + antena omni SMA 915 MHz + alimentación autónoma (batería/solar) + backhaul (WiFi AP portable u otro). Verificar en banco que el gateway arranca, conecta y aparece Online en ChirpStack. Requiere hardware físico.
  `chore(hardware): ensamblar y verificar gateway de campo en banco antes de salir`
- [ ] 0.3 Definir el sitio de campo: espacio abierto con línea de visión directa de al menos 1 km, acceso para el nodo mock a 50/200/500/1000 m del gateway. Documentar el sitio elegido (nombre, coordenadas aproximadas, perfil del terreno). Resolver OQ1.
  `chore(docs): definir y documentar sitio de campo para etapa 2b`
- [ ] 0.4 Verificar backhaul del gateway desde la posición de campo elegida: hacer un test previo (sin nodo) de que el gateway conecta a ChirpStack desde ese punto. Resolver OQ2.
  `chore(hardware): verificar backhaul del gateway desde posición de campo`

## 1. Montaje en campo

- [ ] 1.1 Instalar el gateway en la posición de campo (elevado si es posible). Encender, verificar `wifi_connected` (o backhaul activo) y confirmar Online en ChirpStack UI. Anotar hora de inicio. Requiere hardware de campo completo.
  `chore(hardware): montar gateway en posición de campo y verificar Online en ChirpStack`
- [ ] 1.2 Preparar el nodo mock con antena yagi 915 MHz apuntada al gateway. Encender, verificar OTAA join exitoso (log serial `lorawan_join_ok`). Ajustar SEND_INTERVAL_MS a 30–60 s para la prueba si no se hizo antes del flash. Requiere hardware físico.
  `chore(firmware): preparar nodo mock con yagi y verificar OTAA join en campo`

## 2. Mediciones por tramo

- [ ] 2.1 **Tramo 50 m**: Posicionar el nodo a 50 m del gateway en línea de visión. Esperar 10 uplinks. Registrar RSSI y SNR de cada uno desde el log del gateway. Verificar packet loss. Requiere campo.
  `test(firmware): medir RSSI/SNR a 50 m etapa 2b`
- [ ] 2.2 **Tramo 200 m**: Desplazar el nodo a 200 m. Repetir medición de 10 uplinks. Registrar RSSI, SNR y packet loss. Requiere campo.
  `test(firmware): medir RSSI/SNR a 200 m etapa 2b`
- [ ] 2.3 **Tramo 500 m**: Desplazar el nodo a 500 m. Repetir medición. Requiere campo.
  `test(firmware): medir RSSI/SNR a 500 m etapa 2b`
- [ ] 2.4 **Tramo 1 km**: Desplazar el nodo a 1 km. Repetir medición. Requiere campo.
  `test(firmware): medir RSSI/SNR a 1 km etapa 2b`
- [ ] 2.5 **Tramo máximo**: Continuar aumentando distancia hasta que packet loss > 20%. Registrar la última distancia con ≤ 10% de pérdida como distancia máxima verificada. Requiere campo.
  `test(firmware): determinar distancia máxima verificada etapa 2b`

## 3. Documentación de resultados

- [ ] 3.1 Registrar tabla completa: distancia (m), RSSI promedio (dBm), SNR promedio (dB), packet loss (%) por tramo. Comparar RSSI de campo vs. RSSI de banco (Etapa 2a). Documentar el sitio, perfil del terreno, condiciones climáticas y versión del firmware. Archivar el change al completar.
  `docs(docs): registrar tabla RSSI/SNR vs distancia y distancia máxima verificada etapa 2b`

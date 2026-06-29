## 1. Aplicación FastAPI

- [x] 1.1 Crear `backend/requirements.txt` con `fastapi`, `uvicorn[standard]`, `paho-mqtt` e `influxdb-client` en versiones fijadas. Commit sugerido: `chore(backend): agregar requirements del backend FastAPI`.
- [x] 1.2 Agregar cliente paho-mqtt en el startup de FastAPI; suscribir al topic `application/{appId}/device/{devEUI}/event/up` y reconectar automáticamente ante caídas del broker (`reconnect_delay_set`). Commit sugerido: `feat(backend): agregar cliente MQTT paho para uplinks de ChirpStack`.
- [x] 1.3 Implementar deserialización del FRMPayload binario de 14 bytes: decodificar base64 del campo `data`, parsear little-endian según la spec `lorawan-backend-integration`, validar CRC-8/MAXIM. Commit sugerido: `feat(backend): deserializar y validar payload binario de 14 bytes`.
- [x] 1.4 Implementar escritura en InfluxDB con el schema definido (`weather_reading`, tags `device_id` / `dev_eui`, campos numéricos convertidos, timestamp del evento ChirpStack). Commit sugerido: `feat(backend): escribir lecturas validadas en InfluxDB`.
- [x] 1.5 Implementar manejo de errores aislado: descartar uplinks con CRC inválido (log error), continuar procesando ante error de escritura en InfluxDB (log error). Commit sugerido: `fix(backend): manejar errores de CRC e InfluxDB sin detener el procesamiento`.

## 2. Configuración

- [ ] 2.1 Documentar las variables de entorno requeridas (`CHIRPSTACK_MQTT_BROKER`, `CHIRPSTACK_APP_ID`, `INFLUXDB_URL`, `INFLUXDB_TOKEN`, `INFLUXDB_ORG`, `INFLUXDB_BUCKET`) en `backend/README.md` con valores de ejemplo para el entorno local. Requiere coordinación con el responsable de infra para confirmar los valores del docker-compose. Commit sugerido: `docs(backend): documentar variables de entorno del backend`.

## 3. Validación

- [ ] 3.1 Verificar que el backend recibe y escribe correctamente uplinks del nodo físico: arrancar FastAPI con las variables de entorno del docker-compose, confirmar en los logs que los mensajes MQTT se procesan y los puntos aparecen en InfluxDB. Requiere el stack de infra corriendo y el nodo sensor transmitiendo.
- [ ] 3.2 Verificar comportamiento ante CRC inválido: enviar un payload adulterado directamente al topic MQTT y confirmar que se descarta con log de error sin escribir en InfluxDB.
- [ ] 3.3 Verificar reconexión MQTT: detener y reiniciar Mosquitto mientras el backend corre; confirmar que la suscripción se restablece sin reiniciar uvicorn.

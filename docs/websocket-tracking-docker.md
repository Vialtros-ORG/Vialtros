[#11] Verificar funcionamiento del WebSocket de tracking en Docker

## Descripción

Se realizaron pruebas de funcionamiento del WebSocket de seguimiento en tiempo real (`TrackingConsumer`) dentro del entorno Docker Compose de Vialtros.

## Cambios realizados

-Documentación técnica de la verificación del WebSocket.

-Validación de los servicios frontend, backend y PostgreSQL en Docker.

-Comprobación del funcionamiento de Daphne como servidor ASGI.

-Pruebas de conexión y transmisión de coordenadas mediante WebSocket.

-Verificación de la comunicación entre contenedores utilizando ws://backend:8000/ws/tracking/1/.

-Validación de la recepción de actualizaciones de ubicación en la página de seguimiento de la Ruta #1.

-Incorporación de comandos reproducibles para ejecutar las pruebas mediante Docker Compose.

-Documentación de las URL utilizadas, mensajes JSON y resultados obtenidos.

## Pruebas realizadas

- [x] Construcción y ejecución de contenedores con Docker Compose.
- [x] PostgreSQL en estado Healthy.
- [x] Backend y frontend ejecutándose correctamente.
- [x] Daphne escuchando conexiones en el puerto 8000.
- [x] Conexión WebSocket exitosa con respuesta `101 Switching Protocols`.
- [x] Conexión establecida con `TrackingConsumer`.
- [x] Envío y recepción de coordenadas de ubicación mediante JSON.
- [x]Comunicación HTTP entre contenedores con respuesta 200.
- [x]Conexión WebSocket entre frontend y backend utilizando el hostname backend.
- [x]Retransmisión de coordenadas desde TrackingConsumer.
- [x]Recepción de dos mensajes de ubicación en Chrome DevTools desde /tracking/1.
- [x]Visualización de la página de tracking con el mapa y marcador de posición.

## Evidencias

- Captura de los contenedores en ejecución.

- Registros del servidor Daphne.

- Captura de la conexión WebSocket con estado 101.

- Captura de la comunicación entre contenedores con mensaje CONECTADO: frontend -> backend.

- Captura de la recepción de coordenadas JSON.

- Captura de Chrome DevTools mostrando dos actualizaciones en Network → Socket → Messages.

- Captura de la página de seguimiento de la Ruta #1 con el mapa visible.

## Referencias

- `docs/arquitectura.md`
- `docs/websocket-tracking-docker.md`
- Issues de dependencias: #17 y #19.

## Checklist

- [x] Pruebas de comunicación WebSocket ejecutadas.
- [x] Validación de Daphne en Docker.
- [x] Documentación técnica preparada.
- [ ] Revisión y aprobación del Pull Request.
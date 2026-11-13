[#11] Verificar funcionamiento del WebSocket de tracking en Docker

## Descripción

Se realizaron pruebas de funcionamiento del WebSocket de seguimiento en tiempo real (`TrackingConsumer`) dentro del entorno Docker Compose de Vialtros.

Se verificó la conexión, el envío y la recepción de coordenadas geográficas mediante WebSocket, tanto desde el navegador como entre los contenedores Docker.

## Cambios realizados

- Documentación técnica de la verificación del WebSocket.

- Validación de los servicios frontend, backend y PostgreSQL en Docker.

- Comprobación del funcionamiento de Daphne como servidor ASGI.

- Pruebas de conexión y transmisión de coordenadas mediante WebSocket.

- Verificación de la comunicación entre contenedores utilizando ws://backend:8000/ws/tracking/1/.

- Validación de la recepción de actualizaciones de ubicación en la página de seguimiento de la Ruta #1.

- Incorporación de comandos reproducibles para ejecutar las pruebas mediante Docker Compose.

- Documentación de las URL utilizadas, mensajes JSON y resultados obtenidos.

- Verificación de PostgreSQL en estado `healthy`.
- Validación de dos conexiones WebSocket simultáneas desde Chrome con respuesta HTTP `101`.
- Comprobación de la retransmisión de coordenadas JSON a dos clientes suscritos a la misma ruta.
- Verificación de la resolución del hostname `backend` desde el contenedor `frontend`.
- Comprobación de la comunicación HTTP entre contenedores con respuesta `200`.
- Validación de la conexión WebSocket entre los contenedores `frontend` y `backend`.
- Comprobación del envío y recepción del JSON de coordenadas desde Node.js dentro de Docker.
- Diferenciación entre la URL WebSocket utilizada desde el navegador y la utilizada dentro de la red Docker.

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
- [x] Resolución del hostname `backend` desde el contenedor frontend.
- [x] Envío y recepción de coordenadas mediante WebSocket entre contenedores.

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

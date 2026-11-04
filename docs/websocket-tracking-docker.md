[#11] Verificar funcionamiento del WebSocket de tracking en Docker

## Descripción

Se realizaron pruebas de funcionamiento del WebSocket de seguimiento en tiempo real (`TrackingConsumer`) dentro del entorno Docker Compose de Vialtros.

## Cambios realizados

- Documentación técnica de la verificación del WebSocket.
- Validación de los servicios frontend, backend y PostgreSQL en Docker.
- Comprobación del funcionamiento de Daphne como servidor ASGI.
- Pruebas de conexión y transmisión de coordenadas mediante WebSocket.

## Pruebas realizadas

- [x] Construcción y ejecución de contenedores con Docker Compose.
- [x] PostgreSQL en estado Healthy.
- [x] Backend y frontend ejecutándose correctamente.
- [x] Daphne escuchando conexiones en el puerto 8000.
- [x] Conexión WebSocket exitosa con respuesta `101 Switching Protocols`.
- [x] Conexión establecida con `TrackingConsumer`.
- [x] Envío y recepción de coordenadas de ubicación mediante JSON.

## Evidencias

- Captura de los contenedores en ejecución.
- Registros del servidor Daphne.
- Captura de la conexión WebSocket con estado 101.
- Capturas de envío y recepción de ubicaciones desde la consola del navegador.

## Referencias

- `docs/arquitectura.md`
- `docs/websocket-tracking-docker.md`
- Issues de dependencias: #17 y #19.

## Checklist

- [x] Pruebas de comunicación WebSocket ejecutadas.
- [x] Validación de Daphne en Docker.
- [x] Documentación técnica preparada.
- [ ] Revisión y aprobación del Pull Request.
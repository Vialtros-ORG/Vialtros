# Configuración de servidor heredada

Este directorio conserva plantillas de Apache y systemd de un despliegue
anterior. No forman parte del entorno local recomendado y contienen rutas,
usuarios y valores que deben revisarse y sustituirse antes de usarlos.

- `apache2/vialtros.conf` configura el proxy y el frontend estático para una
  ruta de servidor específica.
- `systemd/vialtros-django.service` inicia Daphne como servicio ASGI.

No copies estos archivos directamente a un servidor de producción. Revisa
dominios, TLS, rutas, permisos, proxy WebSocket, variables, CORS y estrategia de
persistencia para el entorno de destino. Consulta
[Despliegue](../docs/despliegue.md) para conocer el alcance de los workflows
disponibles y sus limitaciones.

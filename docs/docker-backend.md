# Docker del backend Vialtros

## Imagen y arranque

El backend se construye desde `backend/Dockerfile`, usando `python:3.14-slim` como imagen base. El Dockerfile instala las dependencias de `requirements.txt`, copia el proyecto y ejecuta `python manage.py collectstatic --noinput` durante la construcción. Así, los archivos estáticos existen antes de que WhiteNoise inicialice su índice.

Daphne sirve la aplicación ASGI `core.asgi:application` en el puerto `8000`. El router de Channels conserva el tráfico HTTP y WebSocket; WhiteNoise sirve los recursos estáticos recolectados por Django.

Desde el directorio `backend/`, construye y ejecuta la imagen:

```bash
docker build -t vialtros-backend .
docker run -d --name vialtros-backend-container -p 8000:8000 vialtros-backend:latest
```

- Backend: http://localhost:8000
- Django Admin: http://localhost:8000/admin/
- WebSocket de tracking: `ws://localhost:8000/ws/tracking/<route_id>/`

La configuración local usa SQLite cuando no se definen `DB_ENGINE` ni `DB_HOST`. Con el comando anterior, la base queda en el sistema de archivos del contenedor (`/app/db.sqlite3`); no hay un volumen configurado, así que elimina o recrea el contenedor solo después de respaldar los datos que quieras conservar.

El contenedor atiende el entorno local y no depende del servidor antiguo `ds1.eleueleo.com`.

## Validación realizada

- `docker ps` confirmó que `vialtros-backend-container` estaba en ejecución.
- `docker exec vialtros-backend-container python manage.py check` terminó sin problemas.
- Django Admin respondió HTTP 200 en `/admin/login/`.
- Los archivos estáticos con hash respondieron HTTP 200 y con el MIME type correcto:
  - `/static/admin/js/theme.759b8d71767c.js`: `text/javascript`.
  - `/static/admin/css/base.6398cd16ee3d.css`: `text/css`.
- La ruta WebSocket `/ws/tracking/1/` completó el handshake con HTTP 101.

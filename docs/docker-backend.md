# Contenedor del backend

El backend se construye desde `backend/Dockerfile`, que usa
`python:3.14-slim`, instala `backend/requirements.txt`, recolecta los archivos
estáticos de Django y expone el puerto `8000`. El comando de servicio por
defecto inicia Daphne con `core.asgi:application`, que atiende HTTP y
WebSockets.

`backend/entrypoint.sh` ejecuta `python manage.py migrate --noinput` antes de
iniciar el comando del contenedor. Si falla una migración, el proceso de inicio
se detiene.

## Con Docker Compose

Compose configura PostgreSQL, variables de entorno, red y volumen persistente.
Usa el procedimiento de [Docker Compose](docker-compose.md) como ruta
recomendada para ejecutar y validar backend junto con el frontend.

## Ejecutar solo la imagen

Desde la raíz del repositorio:

```bash
docker build -t vialtros-backend ./backend
docker run --rm -p 8000:8000 vialtros-backend
```

Sin variables `DB_ENGINE` ni `DB_HOST`, Django selecciona SQLite. En este
comando la base de datos queda dentro del contenedor y no tiene volumen
persistente; no uses esta modalidad para datos que deban conservarse. Para
conectar una base externa, configura las variables `DB_*` y los ajustes de
Django requeridos para el entorno.

## Checks y pruebas

Con el stack iniciado por Compose:

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test
```

La suite usada por CI se ejecuta en el contenedor e incluye el conjunto de
pruebas disponible en el backend.

# Docker del backend Vialtros

## Imagen y arranque

El backend se construye desde `backend/Dockerfile`, usando `python:3.14-slim` como imagen base. El Dockerfile instala las dependencias de `requirements.txt`, copia el proyecto y ejecuta `python manage.py collectstatic --noinput` durante la construcción. Así, los archivos estáticos existen antes de que WhiteNoise inicialice su índice.

Al arrancar el contenedor, `entrypoint.sh` aplica las migraciones pendientes con `python manage.py migrate --noinput` y después inicia Daphne. Django registra las migraciones aplicadas, por lo que los reinicios no las duplican ni borran datos existentes. Si una migración falla, el proceso de arranque se detiene en lugar de iniciar el backend en un estado inconsistente.

Daphne sirve la aplicación ASGI `core.asgi:application` en el puerto `8000`. El router de Channels conserva el tráfico HTTP y WebSocket; WhiteNoise sirve los recursos estáticos recolectados por Django.

## Probar la migración automática y la persistencia

Ejecuta estos comandos desde la raíz del repositorio, donde está `docker-compose.yml`. Se recomienda PowerShell o una terminal con Docker Compose disponible. La prueba reinicia ambos servicios, pero conserva la base porque `docker compose down` no elimina el volumen nombrado `postgres_data`.

Primero confirma que PostgreSQL está saludable y guarda un conteo de los registros actuales:

```powershell
docker compose ps
docker compose exec -T backend python manage.py shell -c "from django.apps import apps; print([(m._meta.label, m.objects.count()) for m in apps.get_models() if m._meta.managed])"
```

Reinicia el stack sin borrar sus volúmenes:

```powershell
docker compose down
docker compose up -d --build
docker compose ps
```

Comprueba en los logs que el entrypoint aplique las migraciones antes de iniciar Daphne, y repite el conteo:

```powershell
docker compose logs --since=5m --no-color backend
docker compose exec -T backend python manage.py shell -c "from django.apps import apps; print([(m._meta.label, m.objects.count()) for m in apps.get_models() if m._meta.managed])"
docker compose exec -T backend python manage.py showmigrations --plan
docker compose exec -T backend python manage.py check
```

La prueba es satisfactoria cuando PostgreSQL está `healthy`, el backend está `Up`, los logs muestran `migrate` antes del inicio de Daphne, las migraciones existentes aparecen marcadas `[X]`, `check` termina sin errores y los conteos de registros coinciden antes y después. Si no había migraciones pendientes, el log de Django normalmente mostrará `No migrations to apply.`.

Para probar únicamente el reinicio del backend sin detener la base, puedes usar `docker compose restart backend` y luego revisar `docker compose logs --since=2m --no-color backend`. No ejecutes `docker compose down -v` durante esta prueba: esa opción elimina `postgres_data` y borra los datos persistidos.

Como comprobación adicional de que los archivos de migración están sincronizados con los modelos, ejecuta:

```powershell
docker compose exec -T backend python manage.py makemigrations --check --dry-run
```

Este último comando debe indicar que no hay cambios pendientes. Si informa que generaría una migración, hay cambios de modelos todavía no representados en archivos de migración; registra ese resultado por separado, porque `migrate` solo puede aplicar migraciones que ya existen.

Dado que el reinicio detiene temporalmente los servicios, realiza esta validación en un entorno local y no mientras otros usuarios dependan del stack.

### Resultado de la prueba local

En la prueba de reinicio, `docker compose down` y `docker compose up -d --build` finalizaron correctamente; después del arranque, PostgreSQL quedó `healthy` y el backend `Up`. Los logs mostraron la ejecución de `migrate` antes de que Daphne empezara a escuchar en el puerto `8000`, y los conteos de registros coincidieron antes y después del reinicio.

La revisión detectó cambios de estado del modelo que no estaban en migraciones, por lo que se agregó `users.0013_alter_notification_type_alter_routerating_stars`. También se declaró explícitamente en el modelo el nombre histórico del índice de tracking para evitar un renombrado innecesario. La migración se aplicó correctamente (`Applying users.0013... OK`) y `makemigrations --check --dry-run` terminó con `No changes detected`.

`sqlmigrate users 0013` mostró que las dos operaciones son `no-op` para el esquema de la base de datos: actualizan el estado de choices y validadores en Django, sin DDL ni transformación de filas. Los conteos siguieron iguales (`admin.LogEntry` 2, `auth.Permission` 52, `contenttypes.ContentType` 13, `sessions.Session` 1 y `users.User` 3; los demás modelos gestionados de la prueba continuaron en 0). `python manage.py check` terminó con `System check identified no issues (0 silenced)`, y `showmigrations --plan` mostró `users.0013` marcada `[X]`.

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

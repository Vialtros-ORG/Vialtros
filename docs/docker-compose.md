# Docker Compose — Vialtros

## Objetivo de Task #15

Configurar un entorno local integrado con Docker Compose para ejecutar el frontend React, el backend Django y PostgreSQL. Compose construye las imágenes del frontend y backend, conecta los servicios en una red común y conserva los datos de PostgreSQL en un volumen nombrado.

## Arquitectura

```text
Navegador
  ├── http://localhost:3000 ──> frontend (React, puerto 3000)
  ├── http://localhost:8000 ──> backend (Django/Daphne, puerto 8000)
  └── ws://localhost:8000 ────> backend (WebSocket)

frontend ── HTTP/WebSocket desde el navegador ──> backend
backend  ── PostgreSQL en vialtros-network ────> db:5432

db ── /var/lib/postgresql/data
     └── volumen nombrado postgres_data
```

Los tres servicios pertenecen a la red bridge `vialtros-network`. El backend resuelve PostgreSQL usando el nombre de servicio `db`, no `localhost`. Los valores de API y WebSocket del frontend apuntan a `localhost:8000` porque son usados por el navegador del usuario; el navegador no puede resolver el nombre interno `backend`.

## Servicios configurados

### `db`

- Imagen: `postgres:16-alpine`.
- Nombre de contenedor: `vialtros-postgres`.
- Base, usuario y contraseña iniciales: `vialtros`, `vialtros` y `POSTGRES_PASSWORD`, respectivamente.
- Expone el puerto `5432` del contenedor en el puerto `5432` del host.
- Monta `postgres_data` en `/var/lib/postgresql/data`.
- Usa `pg_isready -U vialtros -d vialtros` como healthcheck, con intervalo y timeout de 5 segundos y hasta 10 intentos.
- La política de reinicio es `unless-stopped`.

### `backend`

- Se construye desde `./backend` con `backend/Dockerfile`.
- Nombre de contenedor: `vialtros-backend`.
- Ejecuta Django con Daphne en `0.0.0.0:8000` y expone el puerto `8000` del host.
- Se conecta a `db:5432` con el motor PostgreSQL de Django; `DB_SSLMODE` está configurado como `disable` para este entorno local.
- Espera a que `db` tenga estado `healthy` antes de iniciarse.
- La política de reinicio es `unless-stopped`.

### `frontend`

- Se construye desde `./frontend` con `frontend/Dockerfile`.
- Nombre de contenedor: `vialtros-frontend`.
- Sirve la compilación estática de React en el puerto `3000`, publicado como `localhost:3000`.
- Depende del servicio `backend` para el orden de inicio; esta dependencia no espera a que el backend pase una comprobación de salud.
- La política de reinicio es `unless-stopped`.

## Red, puertos y comunicación

| Servicio | Puerto publicado | Uso |
| --- | --- | --- |
| `frontend` | `3000:3000` | Interfaz web desde el navegador en `http://localhost:3000`. |
| `backend` | `8000:8000` | API y WebSocket accesibles desde el navegador en el host. |
| `db` | `5432:5432` | PostgreSQL; el backend también accede al servicio por `db:5432` dentro de la red. |

Compose crea la red bridge `vialtros-network` y la asigna a los tres servicios. La conexión interna entre backend y PostgreSQL no necesita pasar por el puerto publicado del host. El frontend define URLs `localhost` para API y WebSocket, por lo que esas solicitudes las realiza el navegador hacia el puerto publicado del backend.

## Variables de entorno y argumentos de compilación

El archivo Compose no declara `env_file`. Compose interpola las variables indicadas con `${...}` a partir del entorno del proceso o del `.env` de Compose, si existe. Las expresiones con `:-` usan el valor predeterminado cuando la variable no está definida o está vacía.

| Variable / argumento | Valor o comportamiento configurado |
| --- | --- |
| `POSTGRES_DB` | `vialtros` en PostgreSQL. |
| `POSTGRES_USER` | `vialtros` en PostgreSQL. |
| `POSTGRES_PASSWORD` | `${POSTGRES_PASSWORD:-vialtros_dev_password}`; el backend recibe el mismo valor como `DB_PASSWORD`. |
| `DB_ENGINE` | `django.db.backends.postgresql`. |
| `DB_NAME` / `DB_USER` | `vialtros` / `vialtros`. |
| `DB_HOST` / `DB_PORT` | `db` / `5432`. |
| `DB_SSLMODE` | `disable`. |
| `DJANGO_SECRET_KEY` | `${DJANGO_SECRET_KEY:-docker-local-secret-key}`. |
| `DJANGO_DEBUG` | `${DJANGO_DEBUG:-True}`. |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,backend`. |
| `REACT_APP_API_URL` | Argumento de build fijo: `http://localhost:8000/api`. |
| `REACT_APP_WS_URL` | Argumento de build fijo: `ws://localhost:8000/ws`. |

Los argumentos `REACT_APP_*` se usan durante la compilación de React, no como variables de ejecución del contenedor. Para cambiar las URLs publicadas en el frontend se requiere reconstruir la imagen con los valores deseados.

## Persistencia

El volumen nombrado `postgres_data` conserva los archivos de PostgreSQL en `/var/lib/postgresql/data` cuando los contenedores se detienen o se recrean. `docker compose down` conserva el volumen. `docker compose down -v` lo elimina y puede borrar permanentemente la base local; no usarlo si se necesitan conservar esos datos.

No hay volúmenes configurados para frontend ni backend.

## Requisitos

- Docker Desktop (o Docker Engine) en ejecución.
- Docker Compose v2 disponible como `docker compose`.
- Acceso a la raíz del repositorio, donde está `docker-compose.yml`.
- Conectividad para descargar las imágenes base y dependencias durante el primer build.
- Puertos locales `3000`, `8000` y `5432` disponibles.

## Comandos de uso

Ejecutar desde la raíz del repositorio, en PowerShell o una terminal compatible:

```powershell
# Validar la configuración interpolada sin iniciar contenedores
docker compose config

# Construir las imágenes
docker compose build

# Construir y arrancar los tres servicios en segundo plano
docker compose up -d --build

# Revisar estado y healthcheck
docker compose ps

# Comprobar respuesta HTTP desde el host
curl.exe -I http://localhost:3000
curl.exe -I http://localhost:8000/admin/login/

# Consultar logs
docker compose logs --tail=100
docker compose logs -f backend

# Comprobaciones de Django y migraciones
docker compose exec backend python manage.py check
docker compose exec backend python manage.py showmigrations --plan
docker compose exec db pg_isready -U vialtros -d vialtros

# Detener servicios conservando postgres_data
docker compose down
```

La interfaz queda disponible en `http://localhost:3000`, el backend en `http://localhost:8000` y PostgreSQL en el puerto local `5432`. El endpoint `/` del backend puede redirigir a `/admin/`; el resultado HTTP 302 observado en una validación local no representa un error del servidor.

## Validaciones y resultados registrados

### Verificación de configuración en esta sesión

Se ejecutó:

```powershell
docker compose version
docker compose config --quiet
```

Resultado observado:

```text
Docker Compose version v5.5.1
compose_config_exit=0
```

La configuración Compose se procesó sin errores. Esta comprobación no construyó imágenes ni inició los servicios.

### Resultados de pruebas anteriores documentados en el repositorio

La documentación existente de PostgreSQL y backend registra resultados de una validación previa del stack:

- PostgreSQL alcanzó estado `healthy` y el backend quedó `Up`.
- Se ejecutaron migraciones de Django sobre PostgreSQL; tras reiniciar sin borrar el volumen, Django indicó `No migrations to apply`.
- Los conteos de registros antes y después del reinicio coincidieron.
- `python manage.py check` terminó con `System check identified no issues (0 silenced)`.
- `makemigrations --check --dry-run` terminó con `No changes detected`.
- También se registró una comprobación de backend en Docker: `manage.py check` sin problemas, Admin HTTP 200, recursos estáticos HTTP 200 y handshake WebSocket HTTP 101.

Estos resultados son los consignados en [docker-compose-database.md](docker-compose-database.md) y [docker-backend.md](docker-backend.md). No se encontró un resultado previo documentado para el arranque y la comprobación HTTP del servicio frontend integrado en este stack. Por tanto, no se afirma aquí que ese test se haya ejecutado.

## Errores de implementación

En los registros revisados para Task #15 y la documentación asociada no se encontró un error de Compose con resultado y resolución verificables. Para no atribuir causas o correcciones sin evidencia, no se inventa un incidente. La validación actual de `docker compose config --quiet` terminó con código `0`.

## Pendientes y limitaciones conocidas

- Ejecutar y registrar una prueba completa del frontend integrado: build, arranque, carga en navegador y solicitudes reales de API/WebSocket.
- Repetir una prueba de ciclo completo de los tres servicios en el estado actual de la configuración Compose y registrar sus resultados.
- Confirmar la política deseada para `DJANGO_DEBUG` en el entorno compartido; su valor predeterminado actual es `True`.
- `depends_on` del frontend solo ordena el inicio respecto al backend; no valida que la API esté lista.
- La configuración es para desarrollo local. No declara TLS ni restricciones de acceso por host para los puertos publicados.

## Consideraciones de seguridad

- Los valores predeterminados `vialtros_dev_password` y `docker-local-secret-key` son credenciales de desarrollo, no secretos aptos para producción. Configurar `POSTGRES_PASSWORD` y `DJANGO_SECRET_KEY` en el entorno local en lugar de reutilizar esos valores fuera de desarrollo.
- `DJANGO_DEBUG` usa `True` por defecto. No exponer el stack con depuración activa a redes no confiables.
- Las variables `REACT_APP_*` quedan incorporadas en los recursos compilados y son visibles para quien acceda al frontend; no poner secretos en ellas.
- El mapeo de puertos publica PostgreSQL, backend y frontend en el host. En equipos o redes compartidos, limitar el acceso a los puertos y no tratar el puerto PostgreSQL publicado como una interfaz segura.
- `DB_SSLMODE=disable` es adecuado solo para el tráfico local de esta configuración; no es una configuración de transporte cifrado.
- Evitar `docker compose down -v` si los datos de PostgreSQL deben conservarse.

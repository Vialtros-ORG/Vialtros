# Variables de entorno

Vialtros tiene dos configuraciones de entorno distintas:

1. **Docker Compose:** lee el archivo `.env` en la raíz y entrega al backend y
   al build del frontend solo las variables declaradas en `docker-compose.yml`.
2. **Desarrollo manual:** Django carga `backend/.env`; Create React App carga
   `frontend/.env` durante `npm start` o `npm run build`.

Las plantillas versionadas son [.env.example](../.env.example),
[backend/.env.example](../backend/.env.example) y
[frontend/.env.example](../frontend/.env.example). Copia la plantilla
correspondiente, completa valores locales y no subas archivos `.env` reales.

## Docker Compose

Desde la raíz, crea `.env`:

```powershell
Copy-Item .env.example .env
```

En Linux/macOS:

```bash
cp .env.example .env
```

### Base de datos y backend

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `POSTGRES_DB` | Sí | Nombre de la base PostgreSQL. |
| `POSTGRES_USER` | Sí | Usuario de la base PostgreSQL. |
| `POSTGRES_PASSWORD` | Sí | Contraseña de la base; el backend recibe el mismo valor. |
| `DJANGO_SECRET_KEY` | Sí | Secreto de Django. Debe ser privado y único para cada entorno. |
| `DJANGO_DEBUG` | Sí | `True` habilita debug; para ambientes expuestos se debe desactivar. |
| `DJANGO_ALLOWED_HOSTS` | Sí | Hosts aceptados por Django, separados por comas. |
| `FRONTEND_URL` | No | Origen usado para construir enlaces de restablecimiento; predeterminado `http://localhost:3000`. |
| `CORS_ALLOWED_ORIGINS` | No | Orígenes HTTP separados por comas; valor predeterminado `http://localhost:3000`. |

Compose configura internamente la conexión del backend a PostgreSQL:
`DB_ENGINE=django.db.backends.postgresql`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `DB_HOST=db`, `DB_PORT=5432` y `DB_SSLMODE=disable`.
No necesitas declararlas manualmente en el `.env` de raíz.

### Frontend compilado por Compose

| Variable | Predeterminado | Descripción |
| --- | --- | --- |
| `REACT_APP_API_URL` | `http://localhost:8000/api` | URL base de la API a la que se conecta el navegador. |
| `REACT_APP_WS_URL` | `ws://localhost:8000/ws` | URL base de los WebSockets. |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Vacío | Clave de navegador de Google Maps JavaScript API. |
| `REACT_APP_GOOGLE_MAPS_MAP_ID` | Vacío | Map ID opcional de Google Maps. |
| `REACT_APP_GOOGLE_ROUTES_API_KEY` | Vacío | Clave para Google Routes API; si no se define, el frontend puede reutilizar la clave de Maps. |
| `REACT_APP_MAPBOX_TOKEN` | Vacío | Token opcional para mapas Mapbox. |
| `REACT_APP_ROUTING_API_URL` | Vacío | URL opcional de un servicio compatible con OSRM; sin ella se usa el endpoint público de demostración. |

Las variables de esta tabla se pasan como argumentos al build del frontend. Si
se modifican, reconstruye la imagen:

```bash
docker compose up --build -d frontend
```

## Desarrollo manual

### Backend: `backend/.env`

Django carga este archivo desde `backend/core/settings.py`. Si no se definen
`DB_ENGINE` ni `DB_HOST`, Django usa SQLite en `backend/db.sqlite3`.

| Variable | Uso |
| --- | --- |
| `DJANGO_SECRET_KEY` | Secreto criptográfico de Django. |
| `DJANGO_DEBUG` | Modo de depuración; Django activa debug solo con el texto `True`. |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos separados por comas. |
| `DB_ENGINE` | Motor de Django; PostgreSQL usa `django.db.backends.postgresql`. |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Credenciales y host de la base de datos. |
| `DB_SSLMODE` | Modo SSL de la conexión PostgreSQL; el valor por defecto del backend es `require`. |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos cuando `DJANGO_DEBUG` es `False`. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | Configuración opcional SMTP; la contraseña es sensible. |
| `FRONTEND_URL` | Origen usado para construir enlaces de restablecimiento de contraseña. |
| `TRACKING_INGEST_TOKEN` | Token opcional de ingesta de tracking; sensible. |
| `REDIS_URL` | URL de Redis opcional para Channels; si está vacía se utiliza la capa en memoria. |
| `DJANGO_SECURE_SSL_REDIRECT` | Controla el redireccionamiento HTTPS cuando la configuración de producción lo permite. |

Para conectarte a PostgreSQL desde una ejecución manual, configura todas las
variables `DB_*` y un servidor PostgreSQL accesible. La plantilla incluye
ejemplos comentados; no son credenciales funcionales.

### Frontend: `frontend/.env`

Create React App lee estas variables durante la ejecución local y el build.
Las variables con prefijo `REACT_APP_` se exponen al código descargado por el
navegador.

| Variable | Uso |
| --- | --- |
| `REACT_APP_API_URL` | URL base del API; plantilla: `http://localhost:8000/api`. |
| `REACT_APP_WS_URL` | URL WebSocket; plantilla: `ws://localhost:8000/ws`. |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Clave de Maps JavaScript API. |
| `REACT_APP_GOOGLE_MAPS_MAP_ID` | Map ID opcional para funciones de mapas vectoriales. |
| `REACT_APP_GOOGLE_ROUTES_API_KEY` | Clave de Google Routes API; puede reutilizar la clave Maps. |
| `REACT_APP_MAPBOX_TOKEN` | Token opcional de Mapbox; el mapa de tracking tiene estilo CartoDB alternativo. |
| `REACT_APP_ROUTING_API_URL` | URL opcional de un servicio compatible con OSRM. |

Las claves cliente no deben tratarse como secretos de servidor. Cada integrante
debe configurar sus propias claves locales; no se comparten ni se versionan.
Restringe las claves de Maps y Mapbox por dominio y API en sus consolas.
Consulta [Mapas y rutas](mapas.md) para crear las claves, elegir restricciones,
configurar cada modo de ejecución y conocer los proveedores alternativos.

## Seguridad y resolución de problemas

- Los `.env` reales no deben versionarse, compartirse en tickets ni incluirse
  en capturas o logs.
- Los valores `change_me` y `dev-only-placeholder-change-me` son ejemplos de
  desarrollo, no secretos adecuados para despliegue.
- No pongas contraseñas, tokens privados ni `DJANGO_SECRET_KEY` en variables
  `REACT_APP_*`; se incorporan al bundle del navegador.
- En Compose, las variables requeridas para PostgreSQL y Django deben existir
  en `.env` o en el entorno del proceso. Comprueba los valores interpolados con
  `docker compose config` sin publicar su salida si contiene credenciales.
- Cambiar una variable de frontend no modifica una imagen ya construida: vuelve
  a compilar el servicio frontend.

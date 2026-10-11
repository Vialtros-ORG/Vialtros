# Task #13 — Variables de entorno

## Objetivo

Centralizar la configuración del backend y del frontend mediante variables de entorno, con plantillas versionadas para facilitar la configuración local y de despliegue sin incluir secretos reales en el repositorio.

## Alcance

- Plantillas de configuración: `backend/.env.example` y `frontend/.env.example`.
- Carga de variables del backend mediante `python-dotenv` desde `backend/core/settings.py`.
- Protección de archivos locales `.env` y `.env.*` mediante `.gitignore`; `.env.example` se mantiene versionado como excepción.
- Documentación de nombres, propósitos y consideraciones sobre datos sensibles.

## Protección de secretos

Los archivos `.env` y `.env.*` están ignorados por Git. `.env.example` es la plantilla versionada y no debe contener contraseñas, tokens, claves API ni otros secretos reales. Los valores reales se configuran solo en archivos `.env` locales o en el entorno de despliegue.

En `backend/.env.example`, estas variables sensibles permanecen vacías:

- `DB_PASSWORD`
- `EMAIL_HOST_PASSWORD`
- `TRACKING_INGEST_TOKEN`

`DJANGO_SECRET_KEY` usa el valor de desarrollo no apto para producción `dev-only-placeholder-change-me`. No es una clave real y debe sustituirse por un secreto propio en cada entorno.

Las claves de servicios que se usan en el frontend se entregan al navegador; deben configurarse sin publicar credenciales privadas y restringirse según las opciones del proveedor.

## Variables del backend

La plantilla está en `backend/.env.example`. Django carga su configuración de entorno con `python-dotenv` desde `core/settings.py`.

| Variable | Propósito |
| --- | --- |
| `DJANGO_SECRET_KEY` | Clave de seguridad de Django. **Sensible.** |
| `DJANGO_DEBUG` | Activa o desactiva el modo de depuración. |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos por Django, separados por comas. |
| `DB_ENGINE` | Motor de base de datos de Django. |
| `DB_NAME` | Nombre de la base de datos. |
| `DB_USER` | Usuario de la base de datos. |
| `DB_PASSWORD` | Contraseña de la base de datos. **Sensible.** |
| `DB_HOST` | Host de la base de datos. |
| `DB_PORT` | Puerto de la base de datos. |
| `EMAIL_HOST` | Servidor SMTP. |
| `EMAIL_PORT` | Puerto SMTP. |
| `EMAIL_HOST_USER` | Usuario de correo SMTP. |
| `EMAIL_HOST_PASSWORD` | Contraseña de correo SMTP. **Sensible.** |
| `FRONTEND_URL` | URL base del frontend. |
| `TRACKING_INGEST_TOKEN` | Token para autenticar la ingesta de tracking. **Sensible.** |
| `REDIS_URL` | URL de conexión a Redis para Channels. |
| `DJANGO_SECURE_SSL_REDIRECT` | Controla la redirección forzada a HTTPS. |
| `CORS_ALLOWED_ORIGINS` | Orígenes CORS permitidos, separados por comas. |

## Variables del frontend

La plantilla está en `frontend/.env.example`. Create React App expone al código del navegador las variables con prefijo `REACT_APP_`.

| Variable | Propósito |
| --- | --- |
| `REACT_APP_API_URL` | URL base de la API del backend. |
| `REACT_APP_WS_URL` | URL base de WebSocket; se deriva de la URL de API si no se define. |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Clave para Google Maps JavaScript API. |
| `REACT_APP_GOOGLE_MAPS_MAP_ID` | Map ID para mapas vectoriales de Google Maps. |
| `REACT_APP_GOOGLE_ROUTES_API_KEY` | Clave para Google Routes API; puede usar la clave de Maps como alternativa. |
| `REACT_APP_MAPBOX_TOKEN` | Token opcional para mapas vectoriales de Mapbox; CartoDB se usa como alternativa. |

## Comportamiento de la plantilla del backend

En `backend/.env.example`, todas las variables `DB_*` están comentadas. Si no se definen esas variables, SQLite es la base de datos local predeterminada. PostgreSQL/Neon es opcional: para usarlo hay que descomentar las variables `DB_*` necesarias y configurarlas con valores específicos del entorno. La plantilla no incluye credenciales, contraseñas, tokens ni secretos de producción reales.

`CORS_ALLOWED_ORIGINS` tiene una sola declaración de ejemplo y está comentada. Los campos sensibles de correo (`EMAIL_HOST_PASSWORD`) y tracking (`TRACKING_INGEST_TOKEN`) permanecen vacíos.

## Validaciones ejecutadas

Los siguientes son resultados observados al validar la configuración local; no son resultados meramente esperados.

### 1. Django system check

Ejecutado desde `backend/`:

```powershell
python manage.py check
```

Resultado:

```text
System check identified no issues (0 silenced).
```

### 2. Database engine and path

Ejecutado desde `backend/`:

```powershell
python manage.py shell -c "from django.conf import settings; print(settings.DATABASES['default']['ENGINE']); print(settings.DATABASES['default']['NAME'])"
```

Resultado:

```text
django.db.backends.sqlite3
C:\Users\LUAN\Desktop\proyecto\Vialtros\backend\db.sqlite3
```

Esto confirma que, al no estar configuradas las variables `DB_*`, Django seleccionó SQLite y la base local `db.sqlite3`.

### 3. Local HTTP server

El servidor de desarrollo se inició desde `backend/` con:

```powershell
python manage.py runserver
```

Se inició en `http://127.0.0.1:8000/`. La solicitud HTTP ejecutada fue:

```powershell
curl.exe -i http://127.0.0.1:8000/
```

Respuesta relevante:

```text
HTTP/1.1 302 Found
Content-Type: text/html; charset=utf-8
Location: /admin/
Server: daphne
```

El estado HTTP 302 confirma que el servidor local Django/Daphne respondió y redirigió `/` a `/admin/`; no fue una respuesta HTTP 200.

## Limpieza del `.env` temporal

Se usó `backend/.env` como copia local temporal de `backend/.env.example` para la validación. Un archivo `.env` no debe añadirse al repositorio. Si ya existe un `.env` perteneciente al usuario, no se debe eliminar a ciegas; solo debe retirarse un archivo temporal creado específicamente para esta validación.

Después de la limpieza, se ejecutó:

```powershell
Test-Path backend\.env
```

Resultado:

```text
False
```

Esto confirma que no quedó un `.env` temporal en `backend/`.

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

Estas variables del backend son sensibles y deben permanecer vacías o ser valores no reales en la plantilla:

- `DJANGO_SECRET_KEY`
- `DB_PASSWORD`
- `EMAIL_HOST_PASSWORD`
- `TRACKING_INGEST_TOKEN`

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

## Validaciones realizadas

- Se utilizó `git --no-pager diff HEAD~1 HEAD` para verificar los cambios completos.
- Se compararon las variables de entorno usadas por `settings.py` con `backend/.env.example`; no había variables de backend usadas por `settings.py` que faltaran en la plantilla.
- Se revisó `frontend/.env.example`.
- Se verificaron las variables sensibles de los archivos `.env.example`; los valores sensibles del backend se dejaron vacíos.
- Se creó un `.env` temporal con valores de prueba y se validó Django con `python manage.py check`. El resultado fue:

```text
System check identified no issues (0 silenced).
```

- El `.env` temporal se eliminó después de la validación.
- `git status` confirmó al concluir esas validaciones:

```text
nothing to commit, working tree clean
```

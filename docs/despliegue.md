# Ejecución y despliegue

## Entorno local recomendado

La forma recomendada de levantar la aplicación completa para desarrollo es
Docker Compose. El procedimiento, las variables y los comandos están en
[Entorno local con Docker Compose](docker-compose.md) y el resumen inicial está
en el [README principal](../README.md).

Compose es una configuración local: publica HTTP y PostgreSQL en el host, usa
`DJANGO_DEBUG=True` en la plantilla y no incluye TLS, proxy inverso, Redis ni
servicios gestionados. No la expongas directamente a redes no confiables ni la
consideres una configuración de producción.

## Desarrollo manual

También se pueden ejecutar Django y React por separado:

- Backend: instala `backend/requirements.txt`, configura
  `backend/.env`, ejecuta migraciones y arranca Daphne o Django.
- Frontend: instala dependencias con `npm ci`, configura `frontend/.env` y
  ejecuta `npm start`.

Las variables y valores predeterminados están descritos en
[Variables de entorno](variables-entorno.md). SQLite se usa en el backend
manual cuando no se configura PostgreSQL.

## Workflows de despliegue presentes

Los siguientes workflows existen en el repositorio; no equivalen a una receta
genérica para desplegar toda la plataforma en producción:

| Workflow | Disparador | Alcance |
| --- | --- | --- |
| `.github/workflows/deploy.yml` | Push a `master` | Construye y publica el frontend en GitHub Pages; no despliega el backend. |
| `.github/workflows/deploy-apache.yml` | Ejecución manual (`workflow_dispatch`) | Prepara frontend/backend y se conecta por SSH al servidor configurado en los GitHub Secrets. Requiere servidor, secretos y configuración externa. |
| `.github/workflows/backend.yml` | Workflow reutilizable (`workflow_call`) | Validación de build, checks, pruebas y arranque del contenedor backend; no es un workflow de publicación. |

`etc/apache2/` y `etc/systemd/` contienen archivos de configuración de servidor,
pero requieren adaptación a las rutas, usuario, dominio, TLS, base de datos y
secretos del ambiente de destino. Verifica esos requisitos y el workflow de
despliegue antes de usarlo; no presupongas que se aprovisiona una plataforma
completa automáticamente.

## Lista de verificación para un ambiente real

Antes de exponer la aplicación, define y valida al menos:

- `DJANGO_DEBUG=False`, una `DJANGO_SECRET_KEY` privada y
  `DJANGO_ALLOWED_HOSTS` con los dominios reales.
- PostgreSQL administrado o respaldado, credenciales seguras y conexión
  cifrada acorde al proveedor.
- HTTPS para la aplicación y `wss://` para WebSocket, con proxy ASGI que
  preserve el upgrade de WebSocket.
- `CORS_ALLOWED_ORIGINS` restringido a los orígenes frontend esperados.
- Redis si se ejecutarán varias instancias de Django Channels.
- Claves de mapas restringidas, cuotas y monitoreo de costos.
- Backups, logs, monitoreo, rotación de secretos y una estrategia de rollback.

Esta lista identifica decisiones de operación; no afirma que la infraestructura
esté aprovisionada por el repositorio. Para cambios y validaciones del código,
consulta [Checks de CI](ci-checks.md).

# Validaciones de CI

## Workflow `CI`

`.github/workflows/ci.yml` se ejecuta en cada Pull Request, en pushes a
`Develop`, `master` y `main`, y manualmente mediante `workflow_dispatch`.

| Job | Validaciones |
| --- | --- |
| Backend | Construye la imagen Docker, ejecuta `python manage.py check`, toda la suite `python manage.py test` y un smoke test HTTP de Daphne. |
| Frontend | Usa Node 22, ejecuta `npm ci`, las pruebas Jest con `--passWithNoTests` y `npm run build`. |
| Docker Compose integration | Valida Compose, construye e inicia PostgreSQL/backend/frontend, corre checks y pruebas backend sobre PostgreSQL y comprueba la respuesta HTTP del frontend y Django Admin. |
| Whitespace | Ejecuta `git diff --check` sobre los cambios del evento. |
| README links | Comprueba los enlaces locales del `README.md`; no consulta enlaces externos. |
| Markdown lint | Ejecuta markdownlint sobre archivos Markdown modificados. |

El job de Compose detiene los servicios al terminar sin eliminar los volúmenes.
La salida y los logs de cada job están disponibles en la pestaña **Actions** del
Pull Request.

## Workflow SonarQube

`.github/workflows/sonarqube.yml` analiza Pull Requests, pushes a `master` que
modifiquen rutas incluidas en sus filtros, y permite ejecución manual. Usa
SonarCloud y requiere el secreto `SONAR_TOKEN` configurado en GitHub Actions.

Este análisis es un workflow independiente del job `CI`; una integración
externa de GitHub puede publicar checks adicionales que no se definen en este
repositorio.

## Cómo investigar un fallo

1. Abre el check fallido desde el Pull Request.
2. Revisa el primer paso que terminó con error y sus logs.
3. Reproduce localmente el comando de validación correspondiente, si es posible.
4. Corrige el cambio en la misma rama y publica un nuevo commit.
5. Espera que CI termine nuevamente antes de solicitar el merge.

Los comandos locales de backend, frontend y Compose están en
[README](../README.md) y [Docker Compose](docker-compose.md).

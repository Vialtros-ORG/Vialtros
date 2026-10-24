# SonarQube

Vialtros analiza el backend Django, el frontend React y los workflows de GitHub Actions con un único proyecto SonarQube. La configuración del análisis está en `sonar-project.properties` y el workflow en `.github/workflows/sonarqube.yml`.

## Configuración inicial

1. En el servidor SonarQube, crea un proyecto con la clave `vialtros` y configura su rama principal como `Develop` mientras esa sea la rama de integración disponible. Cuando el repositorio complete la transición a `main`, actualiza la rama principal del proyecto en SonarQube.
2. Genera un token de análisis para ese proyecto.
3. En GitHub, abre **Settings > Secrets and variables > Actions** y agrega:
   - Secret `SONAR_TOKEN`: el token generado en SonarQube.
   - Variable `SONAR_HOST_URL`: URL del servidor, por ejemplo `https://sonar.ejemplo.com` (sin `/` al final).
4. Integra las ramas de trabajo mediante Pull Request a `Develop`; tras promover la integración a `main`, el análisis también se ejecuta en `main`. Para un análisis manual, selecciona la rama que quieras analizar en **Actions > SonarQube > Run workflow**.

El workflow analiza Pull Requests a `Develop` y cambios que lleguen a `main`, y espera el resultado del Quality Gate. Al revisar el repositorio, GitHub mostraba `Develop` y `master`, sin ramas `develop` ni `main`; el disparador de `main` quedará activo cuando esa rama exista. Para ejecutarse correctamente, el runner de GitHub debe poder acceder a `SONAR_HOST_URL`; un servidor accesible solo dentro de una red privada requiere un runner autoalojado con conectividad a esa red.

## Ramas y Pull Requests

El análisis de Pull Requests y de ramas requiere una edición de SonarQube Server que admita esas funciones. SonarQube Community Build solo analiza su rama principal y no admite análisis de Pull Requests; con esa edición, elimina el disparador `pull_request` y conserva el análisis en `main` después de la promoción.

## Alcance

Se excluyen migraciones de Django, dependencias instaladas, builds, cobertura generada, archivos estáticos recolectados, bytecode, bundles minificados y lockfiles. El escáner hace análisis estático; no instala dependencias ni ejecuta pruebas. Por tanto, el panel no mostrará cobertura hasta que el proyecto genere reportes y se añadan sus rutas a la configuración.

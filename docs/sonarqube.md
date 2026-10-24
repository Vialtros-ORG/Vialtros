# SonarQube

Vialtros analiza el backend Django, el frontend React y los workflows de GitHub Actions con un único proyecto SonarQube. La configuración del análisis está en `sonar-project.properties` y el workflow en `.github/workflows/sonarqube.yml`.

## Configuración inicial

1. En el servidor SonarQube, crea un proyecto con la clave `vialtros` y configura `Develop` como rama principal del análisis.
2. Genera un token de análisis para ese proyecto.
3. En GitHub, abre **Settings > Secrets and variables > Actions** y agrega:
   - Secret `SONAR_TOKEN`: el token generado en SonarQube.
   - Variable `SONAR_HOST_URL`: URL del servidor, por ejemplo `https://sonar.ejemplo.com` (sin `/` al final).
4. Integra las ramas de trabajo mediante Pull Request a `Develop`; después de promover los cambios, `master` ejecuta un análisis de rama. Para un análisis manual, selecciona la rama que quieras analizar en **Actions > SonarQube > Run workflow**.

El workflow analiza Pull Requests a `Develop` y cambios que lleguen a `master`, y espera el resultado del Quality Gate. Para ejecutarse correctamente, el runner de GitHub debe poder acceder a `SONAR_HOST_URL`; un servidor accesible solo dentro de una red privada requiere un runner autoalojado con conectividad a esa red.

## Ramas y Pull Requests

Este flujo requiere una edición de SonarQube que admita análisis de Pull Requests y ramas: `Develop` es la rama principal del análisis y `master` se analiza como una segunda rama. SonarQube Community Build solo analiza la rama principal y permite análisis de PR únicamente cuando el destino del PR es esa rama principal; no cubre este flujo completo de `Develop` hacia `master`.

## Alcance

Se excluyen migraciones de Django, dependencias instaladas, builds, cobertura generada, archivos estáticos recolectados, bytecode, bundles minificados y lockfiles. El escáner hace análisis estático; no instala dependencias ni ejecuta pruebas. Por tanto, el panel no mostrará cobertura hasta que el proyecto genere reportes y se añadan sus rutas a la configuración.

# SonarQube

Vialtros analiza el backend Django, el frontend React y los workflows de GitHub Actions con SonarCloud. La configuración del análisis está en `sonar-project.properties` y el workflow en `.github/workflows/sonarqube.yml`.

## Configuración inicial

1. En SonarCloud, importa el repositorio a la organización `Vialtros-ORG` y configura `Develop` como rama principal del análisis. La clave del proyecto debe ser `Vialtros-ORG_Vialtros`, igual que `sonar.projectKey`.
2. Genera un token de análisis para ese proyecto.
3. En GitHub, abre **Settings > Secrets and variables > Actions** y agrega el secret `SONAR_TOKEN` con el token generado en SonarCloud. El workflow ya apunta a `https://sonarcloud.io`; no requiere una variable `SONAR_HOST_URL`.
4. Integra las ramas de trabajo mediante Pull Request a `Develop`; después de promover los cambios, `master` ejecuta un análisis de rama. Para un análisis manual, selecciona la rama que quieras analizar en **Actions > SonarQube > Run workflow**.

El workflow analiza Pull Requests a `Develop` y cambios que lleguen a `master`, y espera el resultado del Quality Gate.

## Ramas y Pull Requests

SonarCloud admite análisis de Pull Requests y ramas: `Develop` es la rama principal del análisis y `master` se analiza como una segunda rama.

## Alcance

Se excluyen migraciones de Django, dependencias instaladas, builds, cobertura generada, archivos estáticos recolectados, bytecode, bundles minificados y lockfiles. El escáner hace análisis estático; no instala dependencias ni ejecuta pruebas. Por tanto, el panel no mostrará cobertura hasta que el proyecto genere reportes y se añadan sus rutas a la configuración.

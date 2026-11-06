# Documentación técnica

Guías de referencia para desarrollar, ejecutar y mantener Vialtros. El
[README principal](../README.md) es el punto de entrada para una primera
instalación; esta página organiza el detalle técnico sin repetir esos pasos.

## Arquitectura y aplicación

| Documento | Contenido |
| --- | --- |
| [Arquitectura](arquitectura.md) | Componentes, responsabilidades, comunicación y diagramas Mermaid |
| [Frontend](frontend.md) | Estructura, páginas, componentes y servicios React |
| [API](api.md) | Endpoints REST, autenticación y WebSocket |
| [Modelos de datos](modelos.md) | Entidades, relaciones y persistencia |
| [Mapas y rutas](mapas.md) | Arquitectura, creación y restricciones de claves propias, proveedores, variables y solución de problemas |

## Ejecución y operación

| Documento | Contenido |
| --- | --- |
| [Docker Compose](docker-compose.md) | Servicios, puertos, variables y comandos de operación |
| [Variables de entorno](variables-entorno.md) | Configuración de Compose y desarrollo sin Docker |
| [Despliegue](despliegue.md) | Modos soportados y workflows disponibles |
| [Docker del backend](docker-backend.md) | Imagen, entrypoint, migraciones y comprobaciones |
| [Checks de CI](ci-checks.md) | Workflows y validaciones automáticas |
| [SonarQube](sonarqube.md) | Configuración e integración de análisis estático |

## Contribuir

Sigue el [flujo completo de contribución](../README.md#contribuir), desde
actualizar `Develop` y crear una rama temporal hasta validar, abrir la PR y
limpiar la rama integrada. Usa la
[plantilla del Pull Request](../.github/PULL_REQUEST_TEMPLATE.md) y consulta
[CONTRIBUTING.md](../CONTRIBUTING.md). Las guías deben mantenerse alineadas
con los archivos de configuración y workflows del repositorio.

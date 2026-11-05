# Validaciones de CI

El workflow `CI` se ejecuta en cada Pull Request y en los cambios a `Develop`, `master` y `main`. Los análisis de backend y frontend son workflows reutilizables para mantener cada conjunto de pasos independiente.

| Check | Qué valida |
| --- | --- |
| `Backend CI (Modular)` | Construye la imagen Docker del backend Django, ejecuta `manage.py check` y toda la suite de pruebas en el contenedor, y espera una respuesta HTTP del admin para confirmar el arranque de Daphne. |
| `Frontend CI (Modular)` | Instala dependencias con `npm ci`, ejecuta las pruebas React si existen y compila el frontend. CRA permite que el check pase mientras el repositorio no tenga pruebas frontend. |
| `Docker Compose integration` | Valida `docker-compose.yml`, construye y levanta PostgreSQL, backend Django y frontend React; ejecuta pruebas del backend contra PostgreSQL y verifica respuestas HTTP del frontend y del admin Django. Al final baja los contenedores sin borrar el volumen de PostgreSQL. |
| `Check changed lines for whitespace errors` | Detecta espacios finales y errores de whitespace en las líneas modificadas. |
| `Check links in README` | Comprueba que las rutas locales enlazadas desde `README.md` existan. Los enlaces externos no se consultan para evitar fallos por disponibilidad de terceros. |
| `lint-markdown` | Ejecuta markdownlint sobre los archivos Markdown modificados en el cambio. |
| `SonarQube` | El workflow SonarCloud analiza Django y React y espera el Quality Gate. La PR #40 amplía su disparador a todas las PR. |

El check adicional `SonarCloud Code Analysis` lo publica la integración de SonarCloud instalada y vinculada al repositorio; no lo crea el workflow `CI`. El secret `SONAR_TOKEN` debe estar configurado en GitHub Actions. El backend de este proyecto es Django, por lo que el análisis no usa el job de NestJS mostrado en otras configuraciones. Para activar el análisis SonarQube en todas las PR, también debe integrarse la PR #40.

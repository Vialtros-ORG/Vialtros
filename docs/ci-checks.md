# Validaciones de CI

El workflow `CI` se ejecuta en cada Pull Request y en los cambios a `Develop`, `master` y `main`. Los análisis de backend y frontend son workflows reutilizables para mantener cada conjunto de pasos independiente.

| Check | Qué valida |
| --- | --- |
| `Backend CI (Modular)` | Construye la imagen Docker del backend Django, ejecuta `manage.py check` y todas las pruebas Django, y comprueba que el contenedor arranque. |
| `Frontend CI (Modular)` | Instala dependencias con `npm ci`, ejecuta las pruebas React si existen y compila el frontend. CRA permite que el check pase mientras el repositorio no tenga pruebas frontend. |
| `Check changed lines for whitespace errors` | Detecta espacios finales y errores de whitespace en las líneas modificadas. |
| `Check links in README` | Comprueba que las rutas locales enlazadas desde `README.md` existan. Los enlaces externos no se consultan para evitar fallos por disponibilidad de terceros. |
| `lint-markdown` | Ejecuta markdownlint sobre los archivos Markdown modificados en el cambio. |
| `SonarQube` | Analiza Django y React con SonarCloud y espera el Quality Gate. |

El check adicional `SonarCloud Code Analysis` lo publica la integración de SonarCloud instalada y vinculada al repositorio; no lo crea este workflow. El secret `SONAR_TOKEN` debe estar configurado en GitHub Actions. El backend de este proyecto es Django, por lo que el análisis no usa el job de NestJS mostrado en otras configuraciones.

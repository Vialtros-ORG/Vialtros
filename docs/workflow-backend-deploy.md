# Workflow de despliegue del backend con Docker

## Resumen

Este documento describe el modelo actual del backend de Vialtros en Docker: el workflow de GitHub Actions construye la imagen del backend, ejecuta validaciones y comprueba que el contenedor arranca correctamente.

## Modelo actual

El backend se ejecuta en un contenedor Docker construido a partir de `backend/Dockerfile`.

El flujo actual sigue esta lógica:

1. GitHub Actions hace checkout del repositorio.
2. Construye la imagen del backend con `docker build -t vialtros-backend ./backend`.
3. Ejecuta validaciones con `python manage.py check` dentro del contenedor.
4. Ejecuta las pruebas del app `users` con `python manage.py test users` dentro del contenedor.
5. Levanta el contenedor en modo smoke test para confirmar que arranca sin errores.

Esto implica que el backend se ejecuta como un servicio Docker, y no como un proceso directo sobre el servidor con `.venv` y `systemd`.

## Qué implica esto

El workflow de Docker asume que:

- existe un `Dockerfile` válido en `backend/`
- la imagen puede compilarse en GitHub Actions
- la aplicación puede arrancar con el comando por defecto del contenedor
- las pruebas y validaciones se ejecutan dentro del contenedor, como parte del pipeline

## Relación con Jenkins y la Entrega 2

Este flujo está orientado a Docker y es el modelo que debe mantenerse si el despliegue del backend en la entrega sigue siendo containerizado.

Si en la Entrega 2 se decide usar Jenkins, el flujo de GitHub Actions puede dejarse como validación de CI o reemplazarse por un job equivalente en Jenkins. La decisión debe documentarse según el entorno final adoptado.

## Conclusión

La configuración actual del workflow está adaptada para trabajar con Docker y valida la imagen del backend de una forma realista: compilación, pruebas y arranque del contenedor. Esto evita depender de un entorno local o de un servidor con `.venv` ya configurado.

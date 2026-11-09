# Frontend con Docker

El `Dockerfile` del frontend compila la aplicación React y sirve los archivos
estáticos en el puerto `3000`.

Para ejecutar la aplicación completa, usa la guía de
[Docker Compose](../docs/docker-compose.md). Para construir y ejecutar solo el
frontend desde la raíz del repositorio:

```bash
docker build -t vialtros-frontend ./frontend
docker run --rm -p 3000:3000 vialtros-frontend
```

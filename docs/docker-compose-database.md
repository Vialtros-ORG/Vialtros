# Base de datos PostgreSQL con Docker Compose — Vialtros

## Objetivo

Configurar PostgreSQL como servicio de base de datos mediante Docker Compose, garantizando la persistencia de los datos y la conexión correcta con el backend desarrollado en Django.

## Cambios realizados

- Se agregó el servicio de PostgreSQL en `docker-compose.yml`.
- Se configuró un volumen persistente para almacenar la información de la base de datos.
- Se definieron las variables necesarias para la conexión entre Django y PostgreSQL.
- Se configuró `DB_HOST=db` para permitir la comunicación entre los contenedores.
- Se agregó la variable `DB_SSLMODE` para permitir el funcionamiento de PostgreSQL de manera local sin SSL.
- Se mantuvo compatibilidad con conexiones externas que requieran SSL.
- Se configuró un `healthcheck` para comprobar que PostgreSQL esté disponible antes de iniciar el backend.

## Servicios

### PostgreSQL

La base de datos utiliza la siguiente imagen de Docker:

```text
postgres:16-alpine
```

Puerto expuesto:

```text
5432:5432
```

Volumen utilizado:

```text
postgres_data:/var/lib/postgresql/data
```

El volumen permite conservar la información almacenada en PostgreSQL aunque los contenedores sean detenidos o reiniciados.

Variables principales utilizadas:

```text
POSTGRES_DB=vialtros
POSTGRES_USER=vialtros
POSTGRES_PASSWORD=vialtros_dev_password
```

También se configuró un `healthcheck` que permite verificar que PostgreSQL se encuentre listo para aceptar conexiones antes de que se inicie el backend.

### Backend

El backend Django se conecta al servicio PostgreSQL mediante las siguientes variables:

```text
DB_ENGINE=django.db.backends.postgresql
DB_NAME=vialtros
DB_USER=vialtros
DB_PASSWORD=vialtros_dev_password
DB_HOST=db
DB_PORT=5432
DB_SSLMODE=disable
```

Se utiliza `DB_HOST=db` porque `db` corresponde al nombre del servicio de PostgreSQL definido dentro de `docker-compose.yml`.

La variable `DB_SSLMODE=disable` permite que la conexión local entre Django y PostgreSQL funcione sin requerir SSL.

## Ejecución del entorno

Para construir y levantar los servicios se utilizó:

```bash
docker compose up --build
```

Este comando inicia tanto el servicio de PostgreSQL como el backend de Django.

También se puede iniciar el entorno en segundo plano mediante:

```bash
docker compose up -d
```

## Validación de los servicios

Para verificar el estado de los contenedores se utilizó:

```bash
docker compose ps
```

Durante la prueba se verificó que:

- `vialtros-postgres` estuviera en estado `healthy`.
- `vialtros-backend` estuviera en estado `Up`.
- PostgreSQL estuviera escuchando correctamente en el puerto `5432`.
- El backend estuviera disponible en el puerto `8000`.

## Prueba de conexión entre Django y PostgreSQL

Para comprobar que el backend podía conectarse correctamente a PostgreSQL se ejecutó:

```bash
docker compose exec backend python manage.py migrate
```

Las migraciones de Django se aplicaron correctamente en PostgreSQL.

Entre las migraciones ejecutadas se encontraron las correspondientes a:

- `admin`
- `auth`
- `contenttypes`
- `sessions`
- `users`

Esto permitió comprobar que Django tenía acceso a la base de datos PostgreSQL configurada mediante Docker Compose.

## Verificación de tablas

Para revisar directamente las tablas almacenadas en PostgreSQL se ejecutó:

```bash
docker compose exec db psql -U vialtros -d vialtros -c "\dt"
```

La base de datos mostró correctamente tablas generadas por Django, entre ellas:

```text
auth_group
auth_group_permissions
auth_permission
django_admin_log
django_content_type
django_migrations
django_session
users_driver
users_notification
users_passenger
users_passwordresettoken
users_route
```

Esto confirma que las migraciones fueron almacenadas correctamente dentro de PostgreSQL.

## Prueba de persistencia

Para comprobar que la información de PostgreSQL no se perdiera al reiniciar los servicios se detuvieron los contenedores mediante:

```bash
docker compose down
```

Posteriormente se iniciaron nuevamente:

```bash
docker compose up -d
```

Después del reinicio se ejecutó nuevamente:

```bash
docker compose exec backend python manage.py migrate
```

El resultado obtenido fue:

```text
No migrations to apply.
```

Este resultado confirma que las migraciones realizadas anteriormente continuaban almacenadas en PostgreSQL después de detener y volver a iniciar los contenedores.

La persistencia se mantiene mediante el volumen:

```text
postgres_data
```

## Verificación del volumen

Los volúmenes de Docker pueden comprobarse mediante:

```bash
docker volume ls
```

El volumen asociado a PostgreSQL permite conservar los datos mientras no sea eliminado explícitamente.

Para detener los contenedores sin eliminar los datos se utiliza:

```bash
docker compose down
```

Se debe evitar utilizar:

```bash
docker compose down -v
```

cuando se desea conservar la base de datos, ya que la opción `-v` elimina también los volúmenes.

## Resultado

La configuración realizada permite ejecutar PostgreSQL y el backend de Vialtros utilizando Docker Compose.

Se verificaron correctamente los siguientes criterios:

- [x] PostgreSQL inicia mediante `docker compose up`.
- [x] El servicio de PostgreSQL alcanza el estado `healthy`.
- [x] El backend Django inicia correctamente.
- [x] Django se conecta a PostgreSQL.
- [x] Las migraciones se almacenan en PostgreSQL.
- [x] Los datos permanecen después de reiniciar los contenedores.
- [x] PostgreSQL utiliza un volumen persistente.

Con estas pruebas se valida la configuración de la base de datos PostgreSQL mediante Docker Compose para el proyecto Vialtros.
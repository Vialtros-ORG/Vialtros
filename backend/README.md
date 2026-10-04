# Backend Vialtros

## Estructura

- `core/`: Configuración principal de Django
- `users/`: Gestión de usuarios, roles y autenticación
- `routes/`: Modelos y lógica de rutas
- `tracking/`: Tracking en tiempo real y WebSockets

## Instalación y despliegue

### 1. Instalar dependencias

```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configurar base de datos

Asegúrate de tener PostgreSQL y Redis corriendo y configura la conexión mediante las variables de entorno descritas a continuación.

### Variables de entorno

El archivo `backend/.env.example` es la plantilla versionada para centralizar la configuración del backend. Desde el directorio `backend/`, crea tu archivo local con:

```powershell
Copy-Item .env.example .env
```

Django carga estas variables con `python-dotenv` desde `core/settings.py`. El archivo `.env` está ignorado por Git: úsalo localmente o en el entorno de despliegue y nunca confirmes secretos al repositorio. `.env.example` debe permanecer como plantilla y no contener contraseñas, tokens, claves API ni otros secretos reales.

| Variable | Propósito |
| --- | --- |
| `DJANGO_SECRET_KEY` | Clave de seguridad de Django. **Sensible.** |
| `DJANGO_DEBUG` | Activa o desactiva el modo de depuración. |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos por Django, separados por comas. |
| `DB_ENGINE` | Motor de base de datos de Django. |
| `DB_NAME` | Nombre de la base de datos. |
| `DB_USER` | Usuario de la base de datos. |
| `DB_PASSWORD` | Contraseña de la base de datos. **Sensible.** |
| `DB_HOST` | Host de la base de datos. |
| `DB_PORT` | Puerto de la base de datos. |
| `EMAIL_HOST` | Servidor SMTP. |
| `EMAIL_PORT` | Puerto SMTP. |
| `EMAIL_HOST_USER` | Usuario de correo SMTP. |
| `EMAIL_HOST_PASSWORD` | Contraseña de correo SMTP. **Sensible.** |
| `FRONTEND_URL` | URL base del frontend. |
| `TRACKING_INGEST_TOKEN` | Token para autenticar la ingesta de tracking. **Sensible.** |
| `REDIS_URL` | URL de conexión a Redis para Channels. |
| `DJANGO_SECURE_SSL_REDIRECT` | Controla la redirección forzada a HTTPS. |
| `CORS_ALLOWED_ORIGINS` | Orígenes CORS permitidos, separados por comas. |

`DJANGO_SECRET_KEY`, `DB_PASSWORD`, `EMAIL_HOST_PASSWORD` y `TRACKING_INGEST_TOKEN` deben tener valores reales solo en el `.env` local o en el entorno de despliegue; nunca los incluyas en `.env.example`.

**Validación:** se ejecutó `python manage.py check` con un `.env` temporal de valores de prueba y se obtuvo:

```text
System check identified no issues (0 silenced).
```

El `.env` temporal se eliminó después de la validación y el árbol de trabajo quedó limpio.

### 3. Migraciones y superusuario

```bash
python manage.py migrate
python manage.py createsuperuser
```

### 4. Ejecutar en desarrollo

```bash
python manage.py runserver  # Solo API REST
# o para WebSockets:
daphne core.asgi:application  # Requiere instalar daphne
```

### 5. Recomendaciones producción

- Usa `daphne` o `uvicorn` para ASGI.
- Configura Redis en producción.
- Usa variables de entorno para claves y credenciales.
- Revisa el archivo `.env.example` para ejemplo de configuración.

### 6. Ejecución local con Docker

`backend/Dockerfile` usa la imagen base `python:3.14-slim`, instala las dependencias de `requirements.txt` y ejecuta `collectstatic` durante el build. Al iniciar el contenedor, `entrypoint.sh` aplica las migraciones pendientes con `python manage.py migrate --noinput` antes de iniciar Daphne. Django registra las migraciones aplicadas y no vuelve a aplicar las que ya están al reiniciar; los datos existentes se conservan. Si una migración falla, el backend no se inicia. Daphne sirve `core.asgi:application` en el puerto `8000`; Django Channels mantiene el soporte WebSocket y WhiteNoise sirve los archivos estáticos. En desarrollo local se usa SQLite, sin depender del antiguo servidor `ds1.eleueleo.com`.

Desde el directorio `backend/`, construye y ejecuta el contenedor:

```bash
docker build -t vialtros-backend .
docker run -d --name vialtros-backend-container -p 8000:8000 vialtros-backend:latest
```

- Backend: http://localhost:8000
- Django Admin: http://localhost:8000/admin/

**Validación realizada:** `docker ps` confirmó que el contenedor estaba activo; `python manage.py check` no reportó problemas; Django Admin respondió correctamente; los archivos CSS y JavaScript estáticos se sirvieron con HTTP 200 y sus MIME types correspondientes; y se verificó una conexión WebSocket.

Al ejecutar el backend con Docker Compose, PostgreSQL debe estar saludable antes de iniciar el backend. Compose ya configura esta dependencia; las migraciones se ejecutan automáticamente cada vez que arranca el contenedor, incluidas las reinicializaciones.

Para probar el orden de arranque, verificar las migraciones y comparar los datos antes y después de reiniciar los servicios sin eliminar el volumen PostgreSQL, sigue la guía [Docker del backend](../docs/docker-backend.md#probar-la-migracion-automatica-y-la-persistencia).

---

## Explicación y ejemplos de uso

### Roles

- **Admin, Driver, User** definidos en el modelo User (`users/models.py`).

### Modelos principales

- **User:** Usuarios del sistema (con rol)
- **Driver:** Relación uno a uno con User, datos de conductor
- **Passenger:** Relación uno a uno con User, datos de pasajero
- **Route:** Rutas, origen, destino, conductor y pasajeros
- **Tracking:** Estado de recogida y ubicación en tiempo real
- **PickupStatus:** Estado recogido/no recogido

### API REST y JWT

- **Autenticación:**
  - POST `/api/token/` — Obtiene access/refresh token JWT
    - Body: `{ "username": "<usuario>", "password": "<contraseña>" }`
  - POST `/api/token/refresh/` — Refresca el access token
    - Body: `{ "refresh": "<refresh_token>" }`
- **Usuarios:**
  - GET `/api/users/` — Lista usuarios (requiere JWT)
  - GET `/api/users/me/` — Usuario autenticado
- **Drivers:**
  - CRUD `/api/drivers/`
- **Passengers:**
  - CRUD `/api/passengers/`
- **Routes:**
  - CRUD `/api/routes/`
- **Tracking:**
  - CRUD `/api/tracking/`
  - Ingesta GPS `/api/tracking/ingest/`

Todos los endpoints requieren autenticación JWT (excepto /api/token/).

### WebSockets (tracking en tiempo real)

- Implementados con Django Channels y Redis.
- URL de conexión: `ws://<host>/ws/tracking/<route_id>/`
- Cada cliente se suscribe a un grupo por ruta (`route_id`).
- Al enviar un mensaje, se retransmite a todos los clientes conectados a esa ruta.

**Ejemplo de conexión WebSocket:**

```js
const socket = new WebSocket('ws://localhost:8000/ws/tracking/1/');
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Actualiza el mapa o UI con la nueva ubicación
};
// Para enviar actualización:
socket.send(JSON.stringify({ latitude: 10.5, longitude: -66.9, status: 'picked' }));
```

**Notas:**

- Si defines `REDIS_URL` se usa Redis para Channels.
- Si no defines `REDIS_URL`, el backend usa canal en memoria (util para desarrollo local).
- El backend debe iniciarse con `daphne` o `python -m channels` para soporte ASGI/WebSockets.

### Simular transmision de coordenadas al mapa

Puedes emitir coordenadas en vivo para una ruta usando:

```bash
python manage.py transmitir_tracking --route 3 --interval 2 --cycles 0
```

- `--route`: ID de ruta a transmitir.
- `--interval`: segundos entre puntos.
- `--cycles`: cantidad de vueltas del recorrido demo (`0` = infinito).

El comando crea registros en `Tracking` y los publica por WebSocket al grupo:

`ws://localhost:8000/ws/tracking/<route_id>/`

### Ingesta desde GPS real o servicio productor

Para conectar un GPS real, una app del conductor o un servicio productor permanente, publica coordenadas en:

`POST /api/tracking/ingest/`

Autenticación admitida:

- JWT de admin o conductor asignado a la ruta.
- Token de servicio en el header `X-Tracking-Token` usando la variable `TRACKING_INGEST_TOKEN` en `backend/.env`.

Payload mínimo:

```json
{
  "route": 3,
  "latitude": 3.8891,
  "longitude": -77.0284
}
```

Payload recomendado:

```json
{
  "route": 3,
  "latitude": 3.8891,
  "longitude": -77.0284,
  "timestamp": "2026-04-13T19:10:00Z",
  "speed_kmh": 31.4,
  "status": "picked",
  "source": "gps-device-001"
}
```

Ejemplo con token de servicio:

```bash
curl -X POST http://localhost:8000/api/tracking/ingest/ \
  -H "Content-Type: application/json" \
  -H "X-Tracking-Token: tu-token-seguro" \
  -d '{"route":3,"latitude":3.8891,"longitude":-77.0284,"speed_kmh":31.4,"source":"gps-device-001"}'
```

Cada coordenada:

- se guarda en la base de datos,
- queda disponible para el fallback REST del frontend,
- y se publica en vivo al grupo WebSocket de la ruta.

### Productor permanente desde API externa

Si ya tienes un proveedor GPS que expone una API JSON, puedes dejar un productor corriendo con:

```bash
python manage.py consumir_gps_api \
  --source-url http://proveedor-gps.local/position \
  --route 3 \
  --token tu-token-seguro \
  --poll 5 \
  --lat-path latitude \
  --lng-path longitude \
  --speed-path speed_kmh \
  --timestamp-path timestamp
```

Si la API externa devuelve campos anidados, usa rutas con punto, por ejemplo:

- `--lat-path data.position.lat`
- `--lng-path data.position.lng`

### App del conductor desde celular

El frontend ahora incluye una vista para conductor en:

`/driver/location`

Esa pantalla:

- usa geolocalizacion del navegador del celular,
- toma una de las rutas asignadas al conductor,
- y envia coordenadas periodicamente a `/api/tracking/ingest/` con la sesion JWT actual.

Para que funcione bien en celular:

- abre la app con HTTPS o en localhost,
- concede permiso de ubicacion al navegador,
- y deja la pantalla activa mientras conduces.

---

Configura la base de datos PostgreSQL en `core/settings.py` antes de ejecutar migraciones.

# API REST y WebSocket

Referencia de las rutas registradas por `backend/core/urls.py` y
`backend/tracking/routing.py`. En desarrollo local, el backend escucha en
`http://localhost:8000`.

Los detalles de campos y validación se mantienen en los serializers y viewsets
de `backend/users/`. Si un contrato cambia, actualiza esta guía junto con el
código y sus pruebas.

## Autenticación

Los endpoints protegidos usan JWT en el encabezado:

```http
Authorization: Bearer <JWT access token>
```

| Método | Endpoint | Acceso |
| --- | --- | --- |
| `POST` | `/api/token/` | Público; valida usuario y contraseña y devuelve tokens `access` y `refresh`. |
| `POST` | `/api/token/refresh/` | Público; recibe un token `refresh` y devuelve un `access` nuevo. |
| `POST` | `/api/auth/forgot-password/` | Público; acepta `email` y responde de forma genérica. Requiere SMTP configurado para enviar correo. |
| `POST` | `/api/auth/reset-password/` | Público; acepta `token` y `new_password`. |

Las credenciales de administrador no se crean automáticamente. Usa
`python manage.py createsuperuser` dentro del backend para crear un superusuario
de Django. Este comando conserva `role=user`: para acceder a la API
administrativa, cambia el rol de esa cuenta a **Admin** desde el administrador
de Django. `is_staff` e `is_superuser` no sustituyen a `role=admin` en el permiso
`IsAdmin`. Sigue el [procedimiento de inicio rápido](../README.md#instalar-y-ejecutar)
y vuelve a iniciar sesión en el frontend después de cambiar el rol.

## Rutas REST

Los viewsets se registran bajo `/api/`. Los métodos CRUD estándar son los de
Django REST Framework; el acceso se limita por rol y por el queryset de cada
recurso.

| Recurso | Endpoints | Acceso general |
| --- | --- | --- |
| Usuarios | `/api/users/`, `/api/users/{id}/` | Admin para CRUD; `me` y estadísticas requieren usuario autenticado. |
| Conductores | `/api/drivers/`, `/api/drivers/{id}/` | Admin. |
| Pasajeros | `/api/passengers/`, `/api/passengers/{id}/` | Admin. |
| Rutas | `/api/routes/`, `/api/routes/{id}/` | Admin; el conductor asignado también puede completar su ruta. |
| Tracking | `/api/tracking/`, `/api/tracking/{id}/` | Usuario autenticado; resultados limitados por rol y ruta. |
| Notificaciones | `/api/notifications/` | Usuario autenticado; solo sus notificaciones. |
| Calificaciones | `/api/route-ratings/` | Usuario autenticado; el conductor accede a sus calificaciones y Admin puede consultar por ruta. |

### Acciones de usuarios

| Método | Endpoint | Acceso |
| --- | --- | --- |
| `GET`, `PATCH` | `/api/users/me/` | Usuario autenticado; consulta o actualiza su perfil. |
| `GET` | `/api/users/dashboard_stats/` | Usuario autenticado. |
| `GET` | `/api/users/weekly-activity/` | Usuario autenticado. |
| `GET` | `/api/users/recent-activity/` | Usuario autenticado. |
| `GET` | `/api/users/assigned_users/` | Driver. |
| `GET` | `/api/users/assigned_routes/` | Driver. |
| `GET` | `/api/users/my_conductor/` | Pasajero (`role=user`). |

### Acciones de rutas

| Método | Endpoint | Acceso |
| --- | --- | --- |
| `GET` | `/api/routes/monitoring-summary/` | Admin. |
| `POST` | `/api/routes/{id}/assign_driver/` | Admin; body con `driver_id`. |
| `POST` | `/api/routes/{id}/assign_passenger/` | Admin; body con `passenger_id`. |
| `POST` | `/api/routes/{id}/remove_passenger/` | Admin; body con `passenger_id`. |
| `POST` | `/api/routes/{id}/complete/` | Admin o conductor asignado. |

### Acciones de tracking

| Método | Endpoint | Acceso |
| --- | --- | --- |
| `GET` | `/api/tracking/` | Usuario autenticado; filtra por rol, acepta `route` y `window` (minutos), limita a 100 registros recientes. |
| `POST`, `PUT` | `/api/tracking/{id}/update_status/` | Driver; estados admitidos: `picked`, `not_picked`, `dropped_off`. |
| `POST` | `/api/tracking/update_status_by_passenger/` | Driver; recibe `route_id`, `passenger_id` y `status`. |
| `POST` | `/api/tracking/ingest/` | Endpoint de ingesta; autoriza Admin, el Driver asignado o token de ingesta configurado. |

Para token de ingesta de dispositivo, configura `TRACKING_INGEST_TOKEN` en el
backend y envía el valor en `X-Tracking-Token`. En modo debug existe además un
token de desarrollo definido por la aplicación; no lo uses fuera de un entorno
local.

### Acciones de notificaciones y calificaciones

| Método | Endpoint | Acceso |
| --- | --- | --- |
| `GET` | `/api/notifications/` | Usuario autenticado; lista sus notificaciones. |
| `GET` | `/api/notifications/unread_count/` | Usuario autenticado. |
| `POST` | `/api/notifications/{id}/mark_read/` | Usuario autenticado; solo afecta su notificación. |
| `POST` | `/api/notifications/mark_all_read/` | Usuario autenticado. |
| `POST` | `/api/notifications/{id}/send_message/` | Usuario autenticado; envía un mensaje al conductor de la ruta asociada. |
| `GET`, `POST` | `/api/route-ratings/` | Usuario autenticado; el POST crea o actualiza la calificación del conductor. |

## WebSocket

La URL base local es `ws://localhost:8000/ws/`. En sitios servidos con HTTPS,
configura el frontend para usar `wss://`.

| Ruta | Uso | Autenticación / alcance |
| --- | --- | --- |
| `/ws/tracking/{route_id}/` | Actualizaciones de ubicación para una ruta. | Actualmente el consumer no valida identidad al conectar; restringe su exposición antes de usarlo en un entorno público. |
| `/ws/monitoring/` | Eventos de monitoreo. | Acepta conexiones; usuarios no staff reciben un payload limitado. |
| `/ws/notifications/` | Notificaciones en tiempo real del usuario. | Requiere JWT enviado como query param `?token=<access_token>`. |

El mensaje de tracking emitido por el backend incluye un evento
`position_update` y los datos serializados del registro. Los campos concretos
dependen de la operación que produjo la actualización.

## Códigos HTTP comunes

| Código | Significado |
| --- | --- |
| `200` | Solicitud correcta. |
| `201` | Recurso creado. |
| `204` | Recurso eliminado sin cuerpo de respuesta. |
| `400` | Datos inválidos o parámetros requeridos ausentes. |
| `401` | Falta autenticación o el token no es válido. |
| `403` | El usuario autenticado no tiene el rol o permiso requerido. |
| `404` | Recurso o ruta no encontrada. |

Para ejecutar el API localmente, consulta el [README](../README.md) y
[Variables de entorno](variables-entorno.md).

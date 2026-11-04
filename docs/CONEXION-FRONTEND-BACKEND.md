# Conexión entre frontend y backend

## 1. Objetivo

Documentar cómo la aplicación React se conecta con el backend Django dentro del entorno Docker de Vialtros: las solicitudes HTTP de la API, las conexiones WebSocket y la configuración que permite al navegador acceder a ambos servicios.

## 2. Descripción general

Docker Compose ejecuta el frontend en el puerto `3000` y el backend Django/Daphne en el puerto `8000`. PostgreSQL es utilizado por el backend, pero no participa directamente en la conexión del navegador con React.

El navegador carga la aplicación React desde `http://localhost:3000`. Las solicitudes de API y WebSocket se hacen al backend mediante las direcciones configuradas para el frontend, que por defecto apuntan a `localhost:8000`. En la red Docker, los servicios también pueden resolverse por el nombre del servicio; por ejemplo, el backend usa `db:5432` para conectarse a PostgreSQL. Las URLs de frontend configuradas aquí son para las conexiones que inicia el navegador, no para la comunicación interna entre contenedores.

## 3. Configuración de Axios

El cliente centralizado de Axios está en `frontend/src/services/api.js`. Lee `REACT_APP_API_URL`, elimina las barras finales y la utiliza como `baseURL` de las llamadas HTTP. Si la variable no está definida, el cliente usa `/api`.

El Dockerfile del frontend declara `REACT_APP_API_URL` como argumento de construcción. Compose entrega como valor predeterminado:

```text
http://localhost:8000/api
```

La URL queda incluida en la compilación de React; no se configura en tiempo de ejecución del contenedor. Cambiarla requiere reconstruir la imagen del frontend. Las llamadas REST usan esta base para acceder, entre otros, a los endpoints de autenticación y datos.

## 4. Configuración de WebSocket

El servicio compartido de WebSocket en `frontend/src/services/ws.js` resuelve la URL base en este orden:

1. Utiliza `REACT_APP_WS_URL` si está definida.
2. Si no está definida, deriva el host y el protocolo de `REACT_APP_API_URL` (`https` produce `wss`; de lo contrario, `ws`) y usa la ruta `/ws`.
3. En el navegador, como alternativa, usa el host actual y el protocolo correspondiente.
4. Si no hay contexto de navegador, usa `ws://localhost/ws`.

Compose entrega al build el valor predeterminado `ws://localhost:8000/ws`. Desde esa base, el frontend abre conexiones de tracking en `/tracking/<routeId>/`, de monitoreo administrativo en `/monitoring/` y de notificaciones en `/notifications/`. El servicio de notificaciones añade el token JWT existente como parámetro `token` en la URL de conexión.

## 5. Configuración CORS del backend

Django incluye `corsheaders` y coloca `CorsMiddleware` antes de `CommonMiddleware`. En `backend/core/settings.py`, cuando `DEBUG` es verdadero, se permite cualquier origen mediante `CORS_ALLOW_ALL_ORIGINS = True`. Cuando `DEBUG` es falso, la lista `CORS_ALLOWED_ORIGINS` se construye a partir de orígenes separados por comas en la variable de entorno homónima, descartando entradas vacías.

CORS es necesario para que un navegador permita que una página servida desde `http://localhost:3000` haga solicitudes HTTP a un origen distinto, como `http://localhost:8000`. No sustituye la autenticación ni la autorización del backend. La configuración CORS observada corresponde a HTTP; no se observó en la configuración revisada un ajuste separado de validación de origen para los handshakes WebSocket.

## 6. Variables de entorno relacionadas

| Variable | Uso en la conexión |
| --- | --- |
| `REACT_APP_API_URL` | URL base de Axios. Compose la pasa como argumento de build y usa `http://localhost:8000/api` si no se proporciona. |
| `REACT_APP_WS_URL` | URL base para los WebSockets. Compose la pasa como argumento de build y usa `ws://localhost:8000/ws` si no se proporciona. |
| `CORS_ALLOWED_ORIGINS` | Lista de orígenes HTTP separados por comas que Django permite cuando `DEBUG` es falso. Compose usa `http://localhost:3000` como valor predeterminado. |
| `DJANGO_DEBUG` | Django la utiliza para decidir el modo de depuración; también determina si la configuración actual permite todos los orígenes CORS o usa la lista permitida. Compose la recibe del entorno sin un valor predeterminado declarado en el archivo. |
| `DJANGO_ALLOWED_HOSTS` | Lista de hosts aceptados por Django. Es una comprobación de host del backend, distinta de CORS; Compose la recibe del entorno sin un valor predeterminado declarado en el archivo. |

Las variables `REACT_APP_*` se incorporan a los archivos JavaScript generados durante el build y son visibles para los usuarios del frontend. No deben contener credenciales, tokens secretos ni claves privadas.

## 7. Configuración de Docker Compose

Los servicios `frontend` y `backend` están conectados a la red bridge `vialtros-network`. Compose publica `3000:3000` para el frontend y `8000:8000` para el backend. El frontend espera al servicio backend para el orden de inicio, aunque no hay una comprobación de salud del backend configurada en esa dependencia.

La compilación del frontend recibe `REACT_APP_API_URL` y `REACT_APP_WS_URL` mediante `build.args`. Los valores predeterminados con `localhost` permiten al navegador, que está fuera de la red Docker, acceder al puerto publicado del backend. La comunicación backend–PostgreSQL es interna y utiliza el nombre de servicio `db`; no se debe confundir con las URLs de API y WebSocket usadas por el navegador.

## 8. Criterios de aceptación

- React se sirve desde el puerto publicado `3000`.
- Axios usa `REACT_APP_API_URL` como base de las solicitudes HTTP; en la configuración predeterminada, la API está en `http://localhost:8000/api`.
- Los servicios WebSocket usan la base configurada en `REACT_APP_WS_URL` y rutas compatibles con tracking, monitoreo y notificaciones.
- Django recibe solicitudes HTTP desde el origen del frontend cuando ese origen está permitido por la configuración CORS correspondiente al modo de ejecución.
- Cuando `DEBUG` está desactivado, `CORS_ALLOWED_ORIGINS` contiene el origen correcto del frontend.
- El hostname y puerto de backend en las URLs del frontend son accesibles desde el navegador del usuario.
- Las variables de frontend que se compilan en los recursos cliente no incluyen secretos.

Estos son requisitos esperados de la integración; este documento no afirma que se hayan ejecutado pruebas para verificarlos.

## 9. Conclusión

La integración conecta React con Django a través de URLs HTTP y WebSocket configuradas durante la compilación del frontend. Docker Compose publica los puertos para el acceso del navegador y conecta los contenedores a una red compartida; Django configura CORS para las solicitudes HTTP según el modo de ejecución. Las direcciones del navegador y los nombres internos de Docker cumplen propósitos diferentes y deben configurarse de acuerdo con el origen desde el que se inicia cada conexión.

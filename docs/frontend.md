# Frontend

El frontend de Vialtros es una SPA construida con React 19 y Create React App
(`react-scripts`). Se ejecuta en desarrollo con el servidor de CRA o se compila
como recursos estáticos para servirlos con el contenedor Node `serve`.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `frontend/src/App.js` | Inicializa los proveedores de aplicación y las rutas de la SPA. |
| `frontend/src/pages/` | Pantallas de acceso, dashboard, administración, rutas, tracking y soporte. |
| `frontend/src/components/` | Logo, navegación, formularios, notificaciones y componentes de mapa. |
| `frontend/src/services/` | Acceso al API REST, sesión, administración, dashboard y WebSocket. |
| `frontend/src/context/` | Contextos compartidos, incluido el proveedor de Google Maps. |
| `frontend/src/store/` | Estado global compartido cuando lo usan las pantallas. |

El frontend usa React Router, Axios, Redux Toolkit, Tailwind CSS y bibliotecas de
mapas. Las dependencias y sus rangos de versión están definidos en
[`package.json`](../frontend/package.json).

## Comunicación con el backend

- `src/services/api.js` crea el cliente Axios y resuelve `REACT_APP_API_URL`;
  por defecto usa `/api` en el código de cliente.
- `src/services/ws.js` resuelve `REACT_APP_WS_URL` y, si falta, deriva el host
  desde la URL de API o del navegador.
- La autenticación utiliza los endpoints JWT del backend. Los detalles de
  rutas y payloads están en [API](api.md).
- El navegador necesita acceder a las URLs publicadas del backend; el nombre
  interno `backend` de Docker solo se usa entre contenedores.

## Mapas

El proyecto tiene más de una integración de mapa:

- `MapView.js` integra Google Maps JavaScript API mediante
  `@react-google-maps/api`.
- `TrackingMap.js` usa `react-map-gl` y Mapbox GL; cuando no hay configuración
  de Mapbox, el código selecciona el estilo CartoDB.
- `services/googleRoutesApi.js` solicita cálculo de rutas a Google Routes API.

Las claves cliente se configuran antes de iniciar o compilar el frontend y
quedan visibles en el bundle. Consulta [Mapas y rutas](mapas.md) y
[Variables de entorno](variables-entorno.md).

## Desarrollo local

Requiere Node.js y npm. Desde `frontend/`:

```bash
npm ci
npm start
```

El servidor de desarrollo utiliza `http://localhost:3000`. Crea `frontend/.env`
a partir de [la plantilla](../frontend/.env.example) para establecer el API,
WebSocket o servicios de mapas.

## Pruebas y build

Desde `frontend/`:

```bash
npm test -- --watchAll=false --passWithNoTests
npm run build
```

Jest es ejecutado por el script `test` de Create React App. `--passWithNoTests`
permite que CI pase cuando no hay pruebas frontend. El build se genera en
`frontend/build/`.

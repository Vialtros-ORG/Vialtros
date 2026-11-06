# Frontend Vialtros

Frontend React de Vialtros. Las guías de configuración compartidas están en la
[documentación del proyecto](../docs/README.md).

## Requisitos e instalación

```bash
npm ci
```

## Ejecución

```bash
npm start
```

## Organización

- `src/pages/`: páginas de la aplicación.
- `src/components/`: componentes reutilizables.
- `src/context/`: contextos compartidos, incluido el cargador de Google Maps.
- `src/services/`: clientes para API REST, WebSocket, geocodificación y rutas.

## Mapas y tracking

- `src/components/MapView.js` dibuja el mapa principal con Google Maps.
- `src/components/LocationAutocomplete.js` consulta Google Places para sugerir
  direcciones.
- `src/pages/TrackingPage.js` consume actualizaciones de tracking y las muestra
  en el mapa.
- `src/services/routing.js` coordina geocodificación y rutas; Google Routes y
  OSRM son proveedores de rutas.
- `src/components/TrackingMap.js` es un componente alternativo que actualmente
  no se usa en las páginas principales.

Consulta [Mapas y rutas](../docs/mapas.md) para crear claves propias,
configurarlas en local, aplicar restricciones y conocer fallbacks y costos.
Para el resto de variables, consulta [Variables de entorno](../docs/variables-entorno.md).

## Autenticación

El login se realiza en `/login` y guarda tokens JWT en `localStorage`. Las rutas
protegidas usan `PrivateRoute`; el cliente de API adjunta el token a las
solicitudes.

## WebSocket

`src/services/ws.js` contiene el cliente WebSocket utilizado para recibir
actualizaciones de tracking. La configuración de URL se describe en
[Variables de entorno](../docs/variables-entorno.md).

Ejemplo:

```js
import { connectTrackingWS } from "./services/ws";

const socket = connectTrackingWS(1, (data) => console.log(data));
```

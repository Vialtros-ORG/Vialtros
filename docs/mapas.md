# Mapas y cálculo de rutas

El frontend contiene componentes de mapa con proveedores y configuración
distintos. Las claves de servicios de mapas se usan desde el navegador y no son
secretos de servidor.

## Proveedores usados

| Funcionalidad | Implementación | Configuración |
| --- | --- | --- |
| Mapa de `MapView` | Google Maps JavaScript API mediante `@react-google-maps/api`. | `REACT_APP_GOOGLE_MAPS_API_KEY`; `REACT_APP_GOOGLE_MAPS_MAP_ID` es opcional. |
| Cálculo de rutas | Google Routes API desde el frontend. | `REACT_APP_GOOGLE_ROUTES_API_KEY`; el código usa `REACT_APP_GOOGLE_MAPS_API_KEY` como alternativa. |
| Mapa de tracking | `react-map-gl` / Mapbox GL. | `REACT_APP_MAPBOX_TOKEN` y estilo opcionales; el código selecciona estilo CartoDB si no hay configuración de Mapbox. |

No todos los componentes usan el mismo proveedor. Para conocer las páginas y
componentes que integran los mapas, consulta [Frontend](frontend.md).

## Configuración en desarrollo manual

Desde Google Cloud, crea una clave para el navegador, habilita Maps JavaScript
API y, si vas a calcular rutas por calles, Google Routes API. Configura límites
de cuota y restricciones por dominio/API en la consola del proveedor. Un Map ID
solo se necesita para las funciones de mapa que lo utilicen.

Copia [frontend/.env.example](../frontend/.env.example) como `frontend/.env` y
completa únicamente las claves necesarias:

```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_GOOGLE_MAPS_API_KEY=
REACT_APP_GOOGLE_MAPS_MAP_ID=
REACT_APP_GOOGLE_ROUTES_API_KEY=
REACT_APP_MAPBOX_TOKEN=
```

Reinicia `npm start` después de cambiar estas variables, ya que Create React
App las lee al iniciar o compilar.

## Configuración con Docker Compose

Copia la plantilla de raíz y añade las claves públicas que necesites a
`.env`:

```powershell
Copy-Item .env.example .env
```

Compose entrega las variables de Maps y Mapbox al build de frontend. Reconstruye
el servicio después de cambiar su configuración:

```bash
docker compose up --build -d frontend
```

No pongas claves privadas, contraseñas ni tokens de servidor en estas variables:
los valores `REACT_APP_*` forman parte de los archivos JavaScript públicos.
Consulta [Variables de entorno](variables-entorno.md) para distinguir la
configuración de frontend y backend.

## Comportamiento sin claves

- Google Maps y el cálculo de rutas dependen de sus claves y permisos de API.
- Google Routes devuelve una ruta nula cuando no hay clave configurada; el
  servicio de frontend puede aplicar una alternativa según el flujo que lo
  invoque.
- El mapa de tracking selecciona un estilo CartoDB cuando no se configura
  Mapbox. La disponibilidad de mapas base externos depende de la conexión del
  navegador a dichos proveedores.
- Las credenciales y cuotas de terceros no se incluyen en el repositorio ni se
  crean automáticamente al iniciar Compose.

## Recomendaciones

1. Usa una clave distinta por entorno.
2. Limita la clave de navegador por HTTP referrer y por API habilitada.
3. Configura límites de uso y alertas de facturación en el proveedor.
4. No pegues claves reales en issues, documentación, capturas ni logs.
5. Si un mapa no carga, revisa la consola del navegador, la URL del proveedor y
   los permisos de la clave configurada.

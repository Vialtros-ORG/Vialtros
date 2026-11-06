# Mapas, geocodificación y rutas

Esta guía describe el mapa que usa Vialtros, sus proveedores, las claves que
cada integrante debe configurar y las limitaciones de los servicios externos.
Es la referencia principal de mapas para el [README](../README.md), la guía de
[variables de entorno](variables-entorno.md), la documentación del
[frontend](frontend.md) y la [arquitectura](arquitectura.md).

## Resumen de componentes

El mapa de seguimiento de las páginas se dibuja con Google Maps JavaScript API.
La posición del vehículo y la ruta llegan a la interfaz desde los datos de
tracking; el mapa no almacena ni calcula la ubicación del conductor por sí
mismo.

| Función | Componente o servicio | Proveedor y comportamiento |
| --- | --- | --- |
| Mapa de tracking, marcadores y líneas de ruta | [`MapView.js`](../frontend/src/components/MapView.js), usado por [`TrackingPage.js`](../frontend/src/pages/TrackingPage.js) | Google Maps JavaScript API. Muestra vehículos, origen, destino y tramos de ruta. Si la clave falta o no es válida, presenta un mensaje de configuración; este componente no cambia automáticamente a Mapbox. |
| Búsqueda y selección de direcciones | [`LocationAutocomplete.js`](../frontend/src/components/LocationAutocomplete.js) | Biblioteca Places de Google Maps JavaScript API: predicciones y detalles del lugar. Las búsquedas favorecen Buenaventura, sin impedir otros resultados. |
| Dirección a coordenadas | [`routing.js`](../frontend/src/services/routing.js) | Primero usa lugares conocidos de Buenaventura y luego Nominatim de OpenStreetMap. |
| Ruta por calles, ETA y paradas | [`googleRoutesApi.js`](../frontend/src/services/googleRoutesApi.js) y [`routing.js`](../frontend/src/services/routing.js) | Google Routes API cuando hay una clave válida; si no está disponible o falla, se intenta OSRM. La respuesta Google incluye rutas, distancia y duración; la ruta con tráfico depende de la disponibilidad de Routes API. |
| Ajuste GPS a una carretera | `snapPointToRoad` en `googleRoutesApi.js` | Actualmente devuelve las coordenadas recibidas; no llama a Google Roads API ni hace ajuste real a una calle. |
| Puntos de interés (escuelas, hospitales, parques, etc.) | `MapView.js` | Consulta Overpass API de OpenStreetMap; usa `frontend/public/pois.json` como alternativa local cuando está disponible. |
| Mapa alternativo basado en Mapbox GL | [`TrackingMap.js`](../frontend/src/components/TrackingMap.js) | Componente separado, actualmente sin usos en las páginas. Con token carga Mapbox GL y usa Carto Positron como estilo predeterminado; sin token delega a `MapView.js`. No es el mapa principal de tracking. |

El seguimiento GPS en el navegador también requiere permiso de ubicación. En
producción, el navegador debe tener un contexto seguro HTTPS; `localhost` se
considera seguro para desarrollo.

### Estilos visuales

`MapView.js` define estilos claros, un modo de navegación GPS y un modo noche.
El terreno, el agua, las carreteras, los marcadores y los tramos recorridos se
dibujan por separado. La paleta azul del mapa y de las rutas se mantiene en ese
componente. Si se configura un Map ID vectorial, los estilos administrados en
Google Cloud pueden prevalecer sobre los estilos locales.

## Claves y variables

Las variables `REACT_APP_*` se compilan en el frontend y el navegador puede
verlas. Una clave de mapa usada por un cliente web **no es un secreto**: la
protección real consiste en aplicar restricciones, usar claves distintas por
función/ambiente y vigilar cuotas y facturación. No subas valores reales al
repositorio, issues, capturas ni mensajes.

| Variable | Requerida | Función y ubicación |
| --- | --- | --- |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Sí para el mapa principal y el autocompletado | Clave de Google Maps JavaScript API y su biblioteca Places. Se define en `.env` de la raíz para Docker Compose o en `frontend/.env` para desarrollo manual. |
| `REACT_APP_GOOGLE_MAPS_MAP_ID` | No | Map ID opcional de Google Cloud para mapas vectoriales y estilos Cloud. No es una API key ni un secreto. |
| `REACT_APP_GOOGLE_ROUTES_API_KEY` | No, pero necesaria para usar Google Routes | Clave opcional de Routes API. Si se omite, el código intenta reutilizar `REACT_APP_GOOGLE_MAPS_API_KEY`; para mantener restricciones independientes, es preferible crear una clave distinta. |
| `REACT_APP_ROUTING_API_URL` | No | URL base de un servicio compatible con OSRM. Sin ella se usa el servidor público de demostración de OSRM, sujeto a sus límites y disponibilidad. |
| `REACT_APP_MAPBOX_TOKEN` | No | Token público opcional que solo consume el componente alternativo `TrackingMap.js`. No se necesita para las páginas actuales. |

Compose pasa estas opciones al build del frontend desde el `.env` de la raíz;
los nombres y valores predeterminados están en
[`docker-compose.yml`](../docker-compose.yml) y las plantillas
[`.env.example`](../.env.example) y
[`frontend/.env.example`](../frontend/.env.example). La referencia completa
de ambos modos de ejecución está en [Variables de entorno](variables-entorno.md).

## Crear claves de Google Maps propias

Cada compañero debe usar claves propias y no debe subirlas al repositorio ni
enviarlas entre sí. Para un proyecto nuevo e independiente, cada persona puede
crear su propio proyecto de Google Cloud, con facturación bajo su control.

**Limitación actual de Places:** `LocationAutocomplete.js` usa
`AutocompleteService` y `PlacesService`, que pertenecen a Places API (Legacy).
Google indica que, desde octubre de 2026, Places API (Legacy) ya no se puede
habilitar en proyectos nuevos; los proyectos que ya la tienen habilitada siguen
soportados. Por tanto, en un proyecto nuevo el mapa y Routes pueden funcionar,
pero el autocompletado actual no. Para probar hoy la aplicación completa, el
equipo debe usar un proyecto existente donde Places API (Legacy) ya esté
habilitada y crear una clave distinta para cada compañero. La solución a largo
plazo es migrar el autocompletado a Places API (New); esa migración de código
no está incluida en esta guía. Consulta la
[guía oficial de migración de Places](https://developers.google.com/maps/documentation/javascript/legacy/places-migration-overview).

### 1. Crear un proyecto y habilitar facturación

1. Inicia sesión en [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto o selecciona uno que tengas permiso para usar.
3. Vincula una cuenta de facturación y revisa los
   [precios de Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing).
   Los servicios pueden generar cargos según uso; una alerta de presupuesto
   avisa, pero no necesariamente detiene el gasto.

Consulta la guía oficial de [inicio con Google Maps Platform](https://developers.google.com/maps/get-started).

### 2. Habilitar solo las APIs necesarias

En **APIs y servicios → Biblioteca**, habilita:

- **Maps JavaScript API**: renderiza el mapa principal.
- **Places API (Legacy)**: necesaria para las predicciones y los detalles de
  lugares usados por el autocompletado actual. El código usa
  `AutocompleteService` y `PlacesService` de esta biblioteca; revisa la
  limitación de disponibilidad para proyectos nuevos descrita arriba.
- **Geocoding API**: habilítala para la geocodificación inversa al seleccionar
  un punto del mapa.
- **Routes API**: habilítala si quieres rutas por calles, tiempos y paradas
  calculados por Google. OSRM queda como alternativa cuando Google Routes no
  está configurada o no responde.

No habilites Roads API ni Route Optimization API solo por esta aplicación: el
ajuste a carreteras aún no invoca Roads API y el código no usa Route
Optimization API.

Guías oficiales: [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key),
[Places API (Legacy)](https://developers.google.com/maps/documentation/javascript/legacy/places),
[migración a Places API (New)](https://developers.google.com/maps/documentation/javascript/legacy/places-migration-overview)
y [configuración de Routes API](https://developers.google.com/maps/documentation/routes/get-api-key).

### 3. Crear y restringir claves

En **Google Maps Platform → Claves y credenciales**, crea claves separadas:

1. **Clave del mapa y Places**
   - Restricción de aplicación: **Sitios web**.
   - Para desarrollo, agrega `http://localhost:3000/*`; agrega por separado
     cualquier otro origen local que uses.
   - Para producción, agrega solo el origen HTTPS del sitio.
   - Restricción de API: **Maps JavaScript API**, **Geocoding API** y
     **Places API (Legacy)**, si ya está disponible y habilitada en el proyecto.
2. **Clave de Routes**
   - Restricción de API: solo **Routes API**.
   - La aplicación actual llama a Routes directamente desde el navegador
     ([`googleRoutesApi.js`](../frontend/src/services/googleRoutesApi.js)), por
     lo que esta clave también será visible en el bundle y en las solicitudes
     de red. Usa una clave propia, una cuota pequeña y revisa el uso con
     frecuencia.
   - Para producción, no trates esta variable como un secreto ni confíes en
     que `REACT_APP_*` la oculte. La opción recomendada es trasladar las
     llamadas de Routes a un endpoint backend con la clave guardada del lado
     servidor; ese proxy todavía no forma parte del flujo actual.

En ambas claves, aplica la restricción de API correspondiente, revisa las
restricciones de aplicación recomendadas por Google y configura cuotas,
presupuestos y alertas. Las restricciones disponibles dependen del tipo de
API; sigue la [guía de seguridad de claves de Google Maps](https://developers.google.com/maps/api-security-best-practices)
para elegirlas. Una restricción de API limita los servicios que pueden usar una
clave, pero no la convierte en un secreto.

### 4. Configurar el Map ID (opcional)

Para usar un mapa vectorial, crea un Map ID de tipo vector en Google Cloud,
asócialo a un estilo si corresponde y asigna su identificador a
`REACT_APP_GOOGLE_MAPS_MAP_ID`. No copies aquí la API key. Consulta
[cómo crear y usar un Map ID](https://developers.google.com/maps/documentation/javascript/map-ids/get-map-id).

### 5. Guardar la configuración local

**Con Docker Compose**, crea `.env` en la raíz y agrega tus propios valores:

```powershell
Copy-Item .env.example .env
```

```dotenv
REACT_APP_GOOGLE_MAPS_API_KEY=tu_clave_personal_de_maps
REACT_APP_GOOGLE_ROUTES_API_KEY=tu_clave_personal_de_routes
REACT_APP_GOOGLE_MAPS_MAP_ID=
REACT_APP_ROUTING_API_URL=
```

Edita el `.env` local; no reemplaces estos ejemplos en la plantilla
versionada. Reconstruye el frontend porque las variables se incorporan al
build:

```powershell
docker compose up --build -d frontend
docker compose ps
```

**Para ejecutar React manualmente**, configura las mismas variables en
`frontend/.env`, inicia o reinicia `npm start` desde `frontend/` y abre
`http://localhost:3000`. Create React App lee los valores al arrancar.
La plantilla [frontend/.env.example](../frontend/.env.example) incluye las
variables de mapas y la URL opcional de OSRM.

Cada desarrollador configura sus propios archivos locales. Antes de crear un
commit, confirma que no agregaste `.env` ni valores de claves:

```powershell
git status --short
```

## Mapbox (opcional)

Si en el futuro se usa `TrackingMap.js`, crea un token desde la
[página de tokens de Mapbox](https://console.mapbox.com/account/access-tokens/).
Usa un token **público** `pk...`, otorga solo los permisos públicos que necesita
la visualización del mapa y configura las restricciones de URL disponibles.
Nunca uses un token secreto `sk...` en `REACT_APP_MAPBOX_TOKEN`: cualquier valor
`REACT_APP_*` queda expuesto al navegador. Consulta la guía oficial de
[gestión de tokens](https://docs.mapbox.com/accounts/guides/tokens/).

Sin ese token, `TrackingMap.js` cae a `MapView.js`; esto no sustituye la clave
obligatoria de Google Maps que necesita `MapView.js`.

## Servicios de OpenStreetMap y proveedores alternativos

Estas funciones no requieren una API key de Vialtros:

- **Nominatim** geocodifica direcciones y `LocationAutocomplete` tiene su propia
  búsqueda Google Places. Nominatim es un servicio público compartido: respeta
  su [política de uso](https://operations.osmfoundation.org/policies/nominatim/),
  incluyendo límites de frecuencia y atribución; no lo uses como infraestructura
  de producción de alto volumen sin un proveedor propio.
- **Overpass API** consulta puntos de interés de OpenStreetMap. Es un servicio
  público con disponibilidad y límites compartidos; revisa sus
  [recomendaciones de uso](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).
- **OSRM** es el fallback de rutas cuando Google Routes no devuelve un recorrido.
  El valor por defecto es el endpoint público de demostración
  `https://router.project-osrm.org`; puedes configurar un servicio administrado
  propio con `REACT_APP_ROUTING_API_URL`. El proyecto de OSRM publica su
  [documentación de API](https://project-osrm.org/docs/).
- **`frontend/public/pois.json`** puede suministrar POIs locales cuando Overpass
  no está disponible; no contiene credenciales.

Los servicios públicos gratuitos pueden cambiar sus condiciones, limitar el
tráfico o dejar de responder. Para despliegues con tráfico real, revisa sus
políticas vigentes y considera operar o contratar proveedores adecuados.

## Solución de problemas

1. Comprueba que configuraste las variables en el archivo correspondiente al
   modo de ejecución: raíz para Compose, `frontend/.env` para `npm start`.
2. En Compose, reconstruye la imagen después de cambiar claves o variables del
   frontend: `docker compose up --build -d frontend`.
3. Revisa la consola del navegador y la pestaña **Network**. No compartas
   capturas que muestren una clave completa.
4. Comprueba que la facturación esté activa, que las APIs necesarias estén
   habilitadas, y que las restricciones de sitio permitan el origen exacto
   (`http`/`https`, host y puerto).
5. Si el mapa aparece pero no se calculan rutas, comprueba la clave y la
   habilitación de Routes API; si Google falla, se puede intentar el fallback
   OSRM, sujeto a disponibilidad.
6. Si falla el autocompletado, comprueba Places API, la biblioteca Places y la
   cuota de Google Cloud.
7. El error de Mapbox solo aplica al componente alternativo. Las páginas que
   usan `MapView.js` requieren una clave válida de Google Maps.

## Referencias de código

- [Mapa principal](../frontend/src/components/MapView.js)
- [Carga de Google Maps y Places](../frontend/src/context/GoogleMapsContext.js)
- [Autocompletado de lugares](../frontend/src/components/LocationAutocomplete.js)
- [Proveedor Google Routes](../frontend/src/services/googleRoutesApi.js)
- [Fallbacks de geocodificación y rutas](../frontend/src/services/routing.js)
- [Mapa alternativo Mapbox](../frontend/src/components/TrackingMap.js)
- [Configuración del build Compose](../docker-compose.yml) y [Dockerfile del frontend](../frontend/Dockerfile)

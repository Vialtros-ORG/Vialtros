// Servicio de enrutamiento real por calles usando Google Routes API
// y Nominatim para geocodificación
// NOTA: Valhalla/OSRM reemplazados por Google Routes API (mejor precisión en Buenaventura)

import {
  getStreetRoute as googleGetStreetRoute,
  getStreetRouteThroughPoints as googleGetStreetRouteThroughPoints,
  snapPointToRoad as googleSnapPointToRoad,
} from "./googleRoutesApi";


const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
// OSRM demo is a fallback for development/student deployments. Production should
// point this at an owned routing service to control availability and privacy.
let OSRM_BASE_URL =
  process.env.REACT_APP_ROUTING_API_URL || "https://router.project-osrm.org";
while (OSRM_BASE_URL.endsWith("/")) {
  OSRM_BASE_URL = OSRM_BASE_URL.slice(0, -1);
}
const OSRM_TIMEOUT_MS = 12000;
const OSRM_MAX_COORDINATES = 100;
const MAX_WAYPOINT_SNAP_DISTANCE_M = 1200;

// Buenaventura viewbox: minLng,minLat,maxLng,maxLat
const BVA_VIEWBOX = "-77.18,3.72,-76.85,4.02";
const BVA_CITY_SUFFIX = ", Buenaventura, Colombia";
const geocodeCache = new Map();
const TRACK_MAX_POINT_JUMP_KM = 1.4;
const snapCache = new Map();
const SNAP_CACHE_MAX = 400;
const streetRouteCache = new Map();
const STREET_ROUTE_CACHE_MAX = 100;
export const BUENAVENTURA_CENTER = [3.89243, -77.02824];
export const BUENAVENTURA_URBAN_BOUNDS = {
  minLat: 3.84,
  maxLat: 3.93,
  minLng: -77.09,
  maxLng: -76.99,
};

const REAL_BUENAVENTURA_PLACES = [
  {
    name: "Pueblo Nuevo",
    aliases: ["pueblo nuevo", "barrio pueblo nuevo"],
    coords: [3.88982, -77.07077],
  },
  {
    name: "Seminario San Buenaventura",
    aliases: [
      "seminario san buenaventura",
      "seminario",
      "seminario diocesan san buenaventura",
    ],
    coords: [3.90188, -77.02293],
  },
  {
    name: "Termarit",
    aliases: [
      "termarit",
      "institucion educativa termarit",
      "ie termarit",
      "terminal maritimo termarit",
      "terminal maritimo termarit",
    ],
    coords: [3.87851, -77.01242],
  },
  {
    name: "Centro, Buenaventura",
    aliases: [
      "centro buenaventura",
      "centro, buenaventura",
      "centro",
      "centro de buenaventura",
    ],
    coords: [3.87712, -77.02986],
  },
  {
    name: "Bellavista",
    aliases: ["bellavista", "barrio bellavista"],
    coords: [3.88291, -77.04041],
  },
  {
    name: "Cascajal",
    aliases: ["cascajal", "isla cascajal", "localidad isla cascajal"],
    coords: [3.88563, -77.03138],
  },
  {
    name: "San Luis",
    aliases: ["san luis", "barrio san luis"],
    coords: [3.87913, -77.03527],
  },
  {
    name: "Normal Superior Juan Ladrilleros",
    aliases: [
      "normal superior juan ladrilleros",
      "escuela normal superior juan ladrilleros",
      "institucion educativa normal superior juan ladrilleros",
      "normal juan ladrilleros",
      "juan ladrilleros",
      "normal superior",
    ],
    coords: [3.87829, -77.01886],
  },
  {
    name: "Pascual de Andagoya",
    aliases: [
      "pascual de andagoya",
      "institucion educativa pascual de andagoya",
      "colegio pascual de andagoya",
      "pascual",
    ],
    coords: [3.88129, -77.05968],
  },
  {
    name: "Terminal de Buenaventura",
    aliases: [
      "terminal",
      "terminal de transporte",
      "terminal de transportes",
      "terminal de buenaventura",
    ],
    coords: [3.89015, -77.07366],
  },
  {
    name: "Universidad del Valle sede Pacífico",
    aliases: [
      "universidad del valle",
      "univalle",
      "univalle pacifico",
      "universidad del valle sede pacifico",
      "sede pacifico",
    ],
    coords: [3.88126, -77.01018],
  },
  {
    name: "Institución educativa Termarit",
    aliases: ["institucion educativa termarit carrera 53"],
    coords: [3.87851, -77.01242],
  },
];

function normalizePlaceName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveKnownPlace(address) {
  const normalized = normalizePlaceName(address);
  if (!normalized) return null;

  const knownPlace = REAL_BUENAVENTURA_PLACES.find(({ aliases }) =>
    aliases.some(
      (alias) =>
        normalized === alias ||
        normalized.includes(alias) ||
        alias.includes(normalized),
    ),
  );

  return knownPlace?.coords || null;
}

export async function searchBuenaventuraPlaces(query) {
  const normalizedQuery = normalizePlaceName(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  const localMatches = REAL_BUENAVENTURA_PLACES.filter(({ aliases, name }) => {
    const normalizedName = normalizePlaceName(name);
    return (
      normalizedName.includes(normalizedQuery) ||
      aliases.some((alias) => alias.includes(normalizedQuery))
    );
  })
    .slice(0, 5)
    .map(({ name, coords }) => ({
      label: name,
      subtitle: "Lugar conocido en Buenaventura",
      coords,
      source: "local",
    }));

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set(
    "q",
    query.toLowerCase().includes("buenaventura")
      ? query
      : `${query}${BVA_CITY_SUFFIX}`,
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "es");
  url.searchParams.set("countrycodes", "co");
  url.searchParams.set("viewbox", BVA_VIEWBOX);

  const remoteMatches = [];
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Vialtros/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      (Array.isArray(data) ? data : []).forEach((item) => {
        const coords = sanitizeBuenaventuraCoords([
          parseFloat(item.lat),
          parseFloat(item.lon),
        ]);
        if (!Array.isArray(coords) || !isWithinBuenaventuraZone(coords)) return;
        remoteMatches.push({
          label: String(item.display_name || "")
            .split(",")
            .slice(0, 2)
            .join(", "),
          subtitle: "Sugerencia del mapa",
          coords,
          source: "nominatim",
        });
      });
    }
  } catch {
    // Si falla Nominatim, devolvemos solo coincidencias locales.
  }

  const seen = new Set();
  return [...localMatches, ...remoteMatches]
    .filter((item) => {
      const key = normalizePlaceName(item.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

export function isWithinBuenaventuraZone(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lat, lng] = coords;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BUENAVENTURA_URBAN_BOUNDS.minLat &&
    lat <= BUENAVENTURA_URBAN_BOUNDS.maxLat &&
    lng >= BUENAVENTURA_URBAN_BOUNDS.minLng &&
    lng <= BUENAVENTURA_URBAN_BOUNDS.maxLng
  );
}

export function sortStopsByRouteOrder(stops) {
  return (Array.isArray(stops) ? stops : [])
    .map((stop, index) => {
      const rawOrder = stop?.order ?? stop?.sequence ?? stop?.stop_order ?? stop?.position;
      const parsedOrder = rawOrder == null || rawOrder === "" ? index : Number(rawOrder);
      return {
        stop,
        index,
        order: Number.isFinite(parsedOrder) ? parsedOrder : index,
      };
    })
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ stop }) => stop);
}

function sanitizeBuenaventuraCoords(coords, fallbackCoords = null) {
  if (isWithinBuenaventuraZone(coords)) return coords;
  if (isWithinBuenaventuraZone(fallbackCoords)) return fallbackCoords;
  return null;
}

function normalizeTrackMatchPoints(points) {
  return (Array.isArray(points) ? points : [])
    .map((point) => {
      if (Array.isArray(point) && point.length === 2) {
        const lat = Number(point[0]);
        const lng = Number(point[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          coords: [lat, lng],
          speedKmh: null,
          timestampMs: null,
        };
      }

      if (!point || typeof point !== "object") return null;

      const lat = Number(point.latitude ?? point.lat ?? point.coords?.[0]);
      const lng = Number(point.longitude ?? point.lng ?? point.coords?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const speedRaw = Number(point.speed ?? point.speed_kmh ?? point.velocity);
      const timestampMs = point.timestamp
        ? new Date(point.timestamp).getTime()
        : Number.NaN;

      return {
        coords: [lat, lng],
        speedKmh: Number.isFinite(speedRaw) ? speedRaw : null,
        timestampMs: Number.isFinite(timestampMs) ? timestampMs : null,
      };
    })
    .filter(Boolean);
}

function dedupeConsecutiveTrackMatchPoints(points) {
  return (Array.isArray(points) ? points : []).reduce((acc, point) => {
    const last = acc[acc.length - 1];
    if (
      last &&
      last.coords[0] === point.coords[0] &&
      last.coords[1] === point.coords[1]
    ) {
      return acc;
    }
    acc.push(point);
    return acc;
  }, []);
}

function sampleTrackMatchPoints(points, maxPoints = 12) {
  if (points.length <= maxPoints) return points;

  const sampled = [];
  const lastIndex = points.length - 1;
  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    sampled.push(points[pointIndex]);
  }

  return dedupeConsecutiveTrackMatchPoints(sampled);
}

function filterAbruptPathJumps(points, maxJumpKm = TRACK_MAX_POINT_JUMP_KM) {
  return (Array.isArray(points) ? points : []).reduce((acc, point) => {
    const last = acc[acc.length - 1];
    if (!last) {
      acc.push(point);
      return acc;
    }

    if (haversineKm(last.coords, point.coords) <= maxJumpKm) {
      acc.push(point);
    }

    return acc;
  }, []);
}

function mergePolylineSegments(segments) {
  const merged = [];

  segments.forEach((segment) => {
    (segment || []).forEach((point) => {
      const last = merged[merged.length - 1];
      if (last && last[0] === point[0] && last[1] === point[1]) return;
      merged.push(point);
    });
  });

  return merged;
}




function validCoordinatePair(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    point[0] >= -90 && point[0] <= 90 &&
    point[1] >= -180 && point[1] <= 180
  );
}

function routeCacheKey(points) {
  return points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";");
}

function rememberStreetRoute(key, route) {
  if (streetRouteCache.size >= STREET_ROUTE_CACHE_MAX) {
    streetRouteCache.delete(streetRouteCache.keys().next().value);
  }
  streetRouteCache.set(key, route);
}

function osrmInstruction(maneuver = {}, roadName = "") {
  const turnNames = {
    "sharp left": "a la izquierda cerrada",
    left: "a la izquierda",
    "slight left": "ligeramente a la izquierda",
    straight: "de frente",
    "slight right": "ligeramente a la derecha",
    right: "a la derecha",
    "sharp right": "a la derecha cerrada",
    "uturn": "en U",
  };
  const typeNames = {
    depart: "Inicia el recorrido",
    arrive: "Llegaste a tu destino",
    turn: "Gira",
    "new name": "Continúa",
    "continue": "Continúa",
    merge: "Incorpórate",
    "on ramp": "Toma la entrada",
    "off ramp": "Toma la salida",
    fork: "En la bifurcación, continúa",
    "end of road": "Al final de la vía, gira",
    roundabout: "En la rotonda, toma la salida",
    rotary: "En la rotonda, toma la salida",
    notification: "Continúa por la vía",
  };
  const type = String(maneuver.type || "continue").toLowerCase();
  const modifier = turnNames[String(maneuver.modifier || "").toLowerCase()];
  const base = typeNames[type] || "Continúa";
  const direction = ["turn", "end of road", "fork"].includes(type) && modifier
    ? ` ${modifier}`
    : "";
  const road = roadName ? ` por ${roadName}` : "";
  return `${base}${direction}${road}`.trim();
}

async function requestOSRM(service, points, params = {}) {
  if (points.length < 2 || points.length > OSRM_MAX_COORDINATES) return null;
  const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = new URL(`${OSRM_BASE_URL}/${service}/v1/driving/${coordinates}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeOSRMRoute(route, waypoints = []) {
  const rawCoordinates = route?.geometry?.coordinates;
  if (!Array.isArray(rawCoordinates) || rawCoordinates.length < 2) return null;

  // Reject routes that silently snap a stop to a distant road or skip a stop.
  if (
    waypoints.some((waypoint) =>
      Number.isFinite(waypoint?.distance) &&
      waypoint.distance > MAX_WAYPOINT_SNAP_DISTANCE_M,
    )
  ) return null;

  const coordinates = rawCoordinates
    .map((point) => Array.isArray(point) ? [Number(point[1]), Number(point[0])] : null)
    .filter(validCoordinatePair);
  if (coordinates.length < 2) return null;

  const steps = (route.legs || []).flatMap((leg) => leg.steps || [])
    .map((step) => {
      const location = step.maneuver?.location;
      if (!Array.isArray(location) || location.length < 2) return null;
      return {
        location: [Number(location[1]), Number(location[0])],
        instruction: osrmInstruction(step.maneuver, step.name),
        distance: Number(step.distance) || 0,
        duration: (Number(step.duration) || 0) * 1000,
      };
    })
    .filter((step) => step && validCoordinatePair(step.location));

  return {
    coordinates,
    duration: (Number(route.duration) || 0) * 1000,
    distance: Number(route.distance) || 0,
    steps: steps.length ? steps : null,
    provider: "osrm",
    trafficAware: false,
    isStraightLine: false,
  };
}

async function getOSRMStreetRouteThroughPoints(points) {
  const key = routeCacheKey(points);
  const cached = streetRouteCache.get(key);
  if (cached) return cached;

  const data = await requestOSRM("route", points, {
    overview: "full",
    geometries: "geojson",
    steps: "true",
    alternatives: "false",
    continue_straight: "true",
  });
  if (data?.code !== "Ok") return null;

  const route = normalizeOSRMRoute(data.routes?.[0], data.waypoints);
  if (!route) return null;
  rememberStreetRoute(key, route);
  return route;
}

async function getOSRMMatch(points, timestamps = []) {
  if (points.length < 2 || points.length > OSRM_MAX_COORDINATES) return null;
  const params = {
    overview: "full",
    geometries: "geojson",
    steps: "false",
    gaps: "split",
    radiuses: points.map(() => 50).join(";"),
  };
  if (
    timestamps.length === points.length &&
    timestamps.every((timestamp, index) =>
      Number.isFinite(timestamp) && (index === 0 || timestamp > timestamps[index - 1]),
    )
  ) {
    params.timestamps = timestamps.join(";");
  }

  const data = await requestOSRM("match", points, params);
  // Never connect separate traces with a fabricated straight segment.
  if (data?.code !== "Ok" || data.matchings?.length !== 1) return null;
  const tracepoints = Array.isArray(data.tracepoints) ? data.tracepoints : [];
  const matchedTracepoints = tracepoints.filter(Boolean);
  if (matchedTracepoints.length < Math.max(2, Math.ceil(points.length * 0.75))) {
    return null;
  }
  if (matchedTracepoints.some((point) => point.distance > 150)) return null;
  return normalizeOSRMRoute(data.matchings[0]);
}

async function getOSRMNearestPoint(coords, maxDistanceMeters = 250) {
  if (!validCoordinatePair(coords)) return null;
  const [lat, lng] = coords;
  const url = new URL(`${OSRM_BASE_URL}/nearest/v1/driving/${lng},${lat}`);
  url.searchParams.set("number", "1");
  url.searchParams.set("radiuses", String(maxDistanceMeters));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    const waypoint = data?.code === "Ok" ? data.waypoints?.[0] : null;
    const snapped = waypoint?.location;
    if (
      !Array.isArray(snapped) || snapped.length < 2 ||
      !Number.isFinite(waypoint.distance) ||
      waypoint.distance > maxDistanceMeters
    ) return null;
    return [Number(snapped[1]), Number(snapped[0])];
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getStreetRouteThroughPoints(points, options = {}) {
  const validPoints = dedupeConsecutivePoints(
    (Array.isArray(points) ? points : [])
      .map((point) => {
        if (!Array.isArray(point) || point.length !== 2) return null;
        const lat = Number(point[0]);
        const lng = Number(point[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return sanitizeBuenaventuraCoords([lat, lng]) || [lat, lng];
      })
      .filter(Boolean),
  );

  if (validPoints.length < 2) {
    return validPoints.length === 1
      ? { coordinates: validPoints, duration: 0, distance: 0 }
      : null;
  }

  const maxDistance = Number.isFinite(options.maxDistance)
    ? Number(options.maxDistance)
    : 60000 * Math.max(1, validPoints.length - 1);

  try {
    // Usar Google Routes API para múltiples puntos
    const googleRoute = await googleGetStreetRouteThroughPoints(validPoints, {
      maxDistance,
    });
    if (googleRoute?.coordinates?.length > 1) {
      return googleRoute;
    }
  } catch (error) {
    console.warn("Google Routes API multi-point failed, using segments:", error.message);
  }

  // Fallback: construir ruta por segmentos
  const segmentRoutes = await Promise.all(
    validPoints.slice(1).map(async (to, index) => {
      const from = validPoints[index];
      try {
        const segment = await googleGetStreetRoute(from, to);
        if (segment?.coordinates?.length > 1) {
          return {
            ...segment,
          };
        }
      } catch (error) {
        console.warn(`Segment route failed from ${from} to ${to}:`, error.message);
      }
      return null;
    }),
  );

  if (segmentRoutes.every((segment) => segment?.coordinates?.length > 1)) {
    const mergedCoordinates = mergePolylineSegments(
      segmentRoutes.map((segment) => segment.coordinates),
    );
    if (mergedCoordinates.length > 1) {
      return {
        coordinates: mergedCoordinates,
        duration: segmentRoutes.reduce((sum, segment) => sum + (segment.duration || 0), 0),
        distance: segmentRoutes.reduce((sum, segment) => sum + (segment.distance || 0), 0),
        steps: segmentRoutes.flatMap((segment) => segment.steps || []),
        provider: "google",
        trafficAware: true,
        isStraightLine: false,
      };
    }
  }

  return getOSRMStreetRouteThroughPoints(validPoints);
}

/**
 * Convierte una dirección de texto a coordenadas [lat, lng].
 * Prioriza resultados dentro del viewbox de Buenaventura.
 * @param {string} address
 * @returns {Promise<[number, number] | null>}
 */
export async function geocodeAddress(address, options = {}) {
  if (!address?.trim()) return null;
  const clean = address.trim();
  const { fallbackCoords = null } = options;
  const cacheKey = `${normalizePlaceName(clean)}|${Array.isArray(fallbackCoords) ? fallbackCoords.join(",") : "no-fallback"}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const knownCoords = resolveKnownPlace(clean);
  if (knownCoords) {
    const resolved = sanitizeBuenaventuraCoords(knownCoords, fallbackCoords);
    geocodeCache.set(cacheKey, resolved);
    return resolved;
  }

  const trySearch = async (query, fallback) => {
    const url = new URL(`${NOMINATIM_BASE}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("accept-language", "es");
    if (fallback && Array.isArray(fallback) && fallback.length === 2) {
      const [lat, lng] = fallback;
      const d = 0.5;
      url.searchParams.set("viewbox", `${lng - d},${lat - d},${lng + d},${lat + d}`);
    }
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Vialtros/1.0" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    } catch {
      return null;
    }
  };

  // 1. Con bias de ubicacion conocida si esta disponible
  let result = await trySearch(clean, fallbackCoords);

  // 2. Fallback sin restriccion geografica
  if (!result) result = await trySearch(clean, null);

  const resolved = result || (Array.isArray(fallbackCoords) && fallbackCoords.length === 2 ? fallbackCoords : null);

  // Snap geocoded coordinate to a reachable road for precise pickup/drop-off.
  if (resolved) {
    try {
      const snapped = await snapPointToRoad(resolved);
      if (snapped) {
        geocodeCache.set(cacheKey, snapped);
        return snapped;
      }
    } catch {
      // Use un-snapped coordinate
    }
  }

  geocodeCache.set(cacheKey, resolved);
  return resolved;
}

/** Haversine: distancia en km entre dos puntos [lat, lng]. */
function haversineKm(from, to) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(to[0] - from[0]);
  const dLng = toRad(to[1] - from[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from[0])) * Math.cos(toRad(to[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Obtiene una ruta real por calles entre dos puntos, con fallback de proveedor.
 * @param {[number, number]} from  - [lat, lng]
 * @param {[number, number]} to    - [lat, lng]
 * @returns {Promise<{ coordinates: [number, number][], duration: number, distance: number, isStraightLine?: boolean }>}
 */
export async function getStreetRoute(from, to) {
  if (!validCoordinatePair(from) || !validCoordinatePair(to)) return null;

  const safeFrom = sanitizeBuenaventuraCoords(from) || from;
  const safeTo = sanitizeBuenaventuraCoords(to, safeFrom) || to;

  // Usar Google Routes API
  try {
    const googleRoute = await googleGetStreetRoute(safeFrom, safeTo);
    if (googleRoute?.coordinates?.length > 1) {
      return googleRoute;
    }
  } catch {
    // Fall through to the road-routing provider.
  }

  return getOSRMStreetRouteThroughPoints([safeFrom, safeTo]);
}

/**
 * Ajusta una secuencia de puntos GPS a un recorrido mas cercano a calles reales.
 * Primero intenta OSRM Match y, si falla, arma una ruta pasando por waypoints.
 * @param {[number, number][]} points
 * @returns {Promise<{ coordinates: [number, number][], duration: number, distance: number, isStraightLine?: boolean } | null>}
 */
export async function getTrackedStreetRoute(points) {
  const normalized = filterAbruptPathJumps(
    dedupeConsecutiveTrackMatchPoints(normalizeTrackMatchPoints(points)),
  );
  if (normalized.length < 2) return null;

  const sampled = sampleTrackMatchPoints(normalized, 12);
  const sampledCoords = sampled.map((p) => p.coords);

  // 1. Primary: Google Routes API multi-point route
  try {
    const googleResult = await googleGetStreetRouteThroughPoints(sampledCoords);
    if (googleResult?.coordinates?.length > 1) return googleResult;
  } catch {
    // Fall through to OSRM map matching.
  }

  const sampledTrace = sampleTrackMatchPoints(normalized, 80);
  const match = await getOSRMMatch(
    sampledTrace.map((point) => point.coords),
    sampledTrace.map((point) =>
      Number.isFinite(point.timestampMs)
        ? Math.floor(point.timestampMs / 1000)
        : null,
    ),
  );
  if (match?.coordinates?.length > 1) return match;
  return getOSRMStreetRouteThroughPoints(
    sampledTrace.map((point) => point.coords),
  );
}

/**
 * Calcula el ETA en minutos desde una posición hasta el destino.
 * @param {[number, number]} from
 * @param {[number, number]} to
 * @returns {Promise<number | null>}
 */
export async function getETAMinutes(from, to) {
  const result = await getStreetRoute(from, to);
  if (!result) return null;
  return Math.ceil(result.duration / 60000);
}

/**
 * Ajusta un punto GPS individual a la vía más cercana.
 * Usa caché para evitar llamadas repetidas a puntos cercanos.
 * @param {[number, number]} coords [lat, lng]
 * @returns {Promise<[number, number]>}
 */
export async function snapPointToRoad(coords) {
  if (!validCoordinatePair(coords)) return coords;
  const [lat, lng] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return coords;

  // Cuantizar a ~11 metros para aprovechar caché
  const keyLat = (Math.round(lat * 10000) / 10000).toFixed(4);
  const keyLng = (Math.round(lng * 10000) / 10000).toFixed(4);
  const cacheKey = `${keyLat},${keyLng}`;
  if (snapCache.has(cacheKey)) return snapCache.get(cacheKey);

  let snapped = null;
  try {
    // Google Roads snapping is optional; this app may not have that API enabled.
    snapped = await googleSnapPointToRoad(coords);
  } catch {
    // Try the configured road service below.
  }
  const googleSnapIsMeaningful =
    validCoordinatePair(snapped) && haversineKm(coords, snapped) > 0.001;
  const result = googleSnapIsMeaningful
    ? snapped
    : (await getOSRMNearestPoint(coords)) || coords;
  if (result === coords) return coords;
  if (snapCache.size >= SNAP_CACHE_MAX) {
    const firstKey = snapCache.keys().next().value;
    snapCache.delete(firstKey);
  }
  snapCache.set(cacheKey, result);
  return result;
}

/**
 * Construye una polilínea por calles entre puntos GPS dispersos.
 * En lugar de líneas rectas, usa Google Routes API entre cada par consecutivo.
 * @param {[number, number][]} points Array de [lat, lng]
 * @returns {Promise<[number, number][]>}
 */
export async function buildRoadPathBetweenPoints(points) {
  const validPoints = (Array.isArray(points) ? points : []).filter(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );
  if (validPoints.length < 2) return [];

  const routed = await getStreetRouteThroughPoints(validPoints, {
    maxDistance: 60000 * Math.max(1, validPoints.length - 1),
  });
  return routed?.coordinates || [];
}

function dedupeConsecutivePoints(points) {
  return (Array.isArray(points) ? points : []).reduce((acc, point) => {
    if (!Array.isArray(point) || point.length !== 2) return acc;
    const last = acc[acc.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return acc;
    acc.push(point);
    return acc;
  }, []);
}

// Route and GPS helpers are kept separate from the page so their behavior can
// be tested without loading the map, router, or browser-only integrations.
const LIVE_WINDOW_MINUTES = 20;
const GUIDED_ROUTE_MAX_POINTS = 2000;
const BUENAVENTURA_BOUNDS = {
  minLat: 3.65,
  maxLat: 4.05,
  minLng: -77.25,
  maxLng: -76.75,
};

function dedupeConsecutivePoints(points) {
  return (Array.isArray(points) ? points : []).reduce((acc, point) => {
    if (!Array.isArray(point) || point.length !== 2) return acc;
    const last = acc[acc.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return acc;
    acc.push(point);
    return acc;
  }, []);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidLatLng(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function formatAdminRouteName(name, routeId) {
  const label = String(name || "").trim() || `Ruta ${routeId}`;
  if (!label || label !== label.toLocaleUpperCase("es-CO")) return label;
  return `${label.charAt(0)}${label.slice(1).toLocaleLowerCase("es-CO")}`;
}

function getAdminRouteSignalTone(route) {
  if (route.is_live) return "live";
  const state = String(route.state_label || "").toLocaleLowerCase("es-CO");
  if (state.includes("desactualizada")) return "stale";
  if (state.includes("detenido")) return "stopped";
  return "idle";
}

function sampleGuidedRoute(points, maxPoints = GUIDED_ROUTE_MAX_POINTS) {
  if (!Array.isArray(points) || points.length <= maxPoints)
    return Array.isArray(points) ? points : [];

  const sampled = [];
  const lastIndex = points.length - 1;
  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    const point = points[pointIndex];
    const previous = sampled[sampled.length - 1];
    if (
      point &&
      (!previous || previous[0] !== point[0] || previous[1] !== point[1])
    ) {
      sampled.push(point);
    }
  }
  return sampled;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthKm * c;
}

function projectPointOnSegment(point, start, end) {
  const startX = start[1];
  const startY = start[0];
  const endX = end[1];
  const endY = end[0];
  const pointX = point[1];
  const pointY = point[0];
  const dx = endX - startX;
  const dy = endY - startY;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    const distanceSquared = (pointX - startX) ** 2 + (pointY - startY) ** 2;
    return { t: 0, distanceSquared };
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((pointX - startX) * dx + (pointY - startY) * dy) / segmentLengthSquared,
    ),
  );
  const projectedX = startX + dx * t;
  const projectedY = startY + dy * t;
  const distanceSquared =
    (pointX - projectedX) ** 2 + (pointY - projectedY) ** 2;

  return { t, distanceSquared };
}

function remainingRouteDistanceKm(routeCoordinates, vehiclePoint) {
  if (
    !Array.isArray(routeCoordinates) ||
    routeCoordinates.length < 2 ||
    !Array.isArray(vehiclePoint)
  ) {
    return null;
  }

  let closestSegmentIndex = 0;
  let closestProjection = { t: 0, distanceSquared: Number.POSITIVE_INFINITY };

  for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
    const start = routeCoordinates[index];
    const end = routeCoordinates[index + 1];
    if (!start || !end) continue;

    const projection = projectPointOnSegment(vehiclePoint, start, end);
    if (projection.distanceSquared < closestProjection.distanceSquared) {
      closestProjection = projection;
      closestSegmentIndex = index;
    }
  }

  const start = routeCoordinates[closestSegmentIndex];
  const end = routeCoordinates[closestSegmentIndex + 1];
  const projectedPoint = [
    start[0] + (end[0] - start[0]) * closestProjection.t,
    start[1] + (end[1] - start[1]) * closestProjection.t,
  ];

  let totalKm = distanceKm(
    projectedPoint[0],
    projectedPoint[1],
    end[0],
    end[1],
  );
  for (
    let index = closestSegmentIndex + 2;
    index < routeCoordinates.length;
    index += 1
  ) {
    const previous = routeCoordinates[index - 1];
    const current = routeCoordinates[index];
    totalKm += distanceKm(previous[0], previous[1], current[0], current[1]);
  }

  return totalKm;
}

function splitRouteByVehiclePoint(routeCoordinates, vehiclePoint) {
  if (
    !Array.isArray(routeCoordinates) ||
    routeCoordinates.length < 2 ||
    !Array.isArray(vehiclePoint)
  ) {
    return {
      traveled: [],
      remaining: Array.isArray(routeCoordinates) ? routeCoordinates : [],
      projectedPoint: Array.isArray(vehiclePoint) ? vehiclePoint : null,
    };
  }

  let closestSegmentIndex = 0;
  let closestProjection = { t: 0, distanceSquared: Number.POSITIVE_INFINITY };

  for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
    const start = routeCoordinates[index];
    const end = routeCoordinates[index + 1];
    if (!start || !end) continue;

    const projection = projectPointOnSegment(vehiclePoint, start, end);
    if (projection.distanceSquared < closestProjection.distanceSquared) {
      closestProjection = projection;
      closestSegmentIndex = index;
    }
  }

  const start = routeCoordinates[closestSegmentIndex];
  const end = routeCoordinates[closestSegmentIndex + 1];
  const projectedPoint = [
    start[0] + (end[0] - start[0]) * closestProjection.t,
    start[1] + (end[1] - start[1]) * closestProjection.t,
  ];

  const traveled = [
    ...routeCoordinates.slice(0, closestSegmentIndex + 1),
    projectedPoint,
  ];
  const remaining = [
    projectedPoint,
    ...routeCoordinates.slice(closestSegmentIndex + 1),
  ];

  return {
    traveled: dedupeConsecutivePoints(traveled),
    remaining: dedupeConsecutivePoints(remaining),
    projectedPoint,
  };
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function formatElapsedDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0 s";
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

function polylineDistanceKm(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return 0;

  let totalKm = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const previous = coordinates[i - 1];
    const current = coordinates[i];
    if (!previous || !current) continue;
    totalKm += distanceKm(previous[0], previous[1], current[0], current[1]);
  }
  return totalKm;
}

function normalizeTracking(raw, fallbackTimestamp) {
  const latitude = toNumber(raw.latitude ?? raw.lat);
  const longitude = toNumber(raw.longitude ?? raw.lng);
  if (!isValidLatLng(latitude, longitude)) {
    return null;
  }
  return {
    ...raw,
    latitude,
    longitude,
    timestamp: raw.timestamp || fallbackTimestamp,
  };
}

function trackingKey(t) {
  if (t?.id != null) return `id:${t.id}`;
  return `geo:${t?.latitude}:${t?.longitude}:${t?.timestamp}`;
}

function normalizeIntermediateStops(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, idx) => {
      const lat = toNumber(s?.latitude ?? s?.lat ?? s?.coords?.[0]);
      const lng = toNumber(s?.longitude ?? s?.lng ?? s?.coords?.[1]);
      const coords = isValidLatLng(lat, lng) ? [lat, lng] : null;
      return {
        id: s?.id ?? `stop-${idx}`,
        passenger_id: s?.passenger_id ?? null,
        label: s?.label ?? s?.address ?? `Parada ${idx + 1}`,
        address: s?.address ?? s?.label ?? null,
        latitude: coords ? coords[0] : null,
        longitude: coords ? coords[1] : null,
        coords,
      };
    })
    .filter(Boolean);
}

function buildRouteWaypointCoordinates(from, to, intermediateStops) {
  const waypoints = [];
  if (Array.isArray(from) && from.length === 2 && isValidLatLng(from[0], from[1])) waypoints.push(from);
  const stops = normalizeIntermediateStops(intermediateStops || []);
  stops.forEach((s) => {
    if (Array.isArray(s.coords) && s.coords.length === 2) waypoints.push(s.coords);
  });
  if (Array.isArray(to) && to.length === 2 && isValidLatLng(to[0], to[1])) waypoints.push(to);
  return dedupeConsecutivePoints(waypoints);
}

function buildRouteSignature(route) {
  if (!route) return "";
  const origin = Number.isFinite(route.origin_lat) && Number.isFinite(route.origin_lng)
    ? `${route.origin_lat},${route.origin_lng}`
    : String(route.origin || "");
  const destination = Number.isFinite(route.destination_lat) && Number.isFinite(route.destination_lng)
    ? `${route.destination_lat},${route.destination_lng}`
    : String(route.destination || "");
  const stops = (Array.isArray(route.intermediate_stops) ? route.intermediate_stops : [])
    .map((s) => {
      const lat = s?.latitude ?? s?.lat ?? (s?.coords ? s.coords[0] : "");
      const lng = s?.longitude ?? s?.lng ?? (s?.coords ? s.coords[1] : "");
      return `${lat ?? ""},${lng ?? ""},${s?.address || s?.label || ""}`;
    })
    .join("|");
  return `${origin}->${destination}|${stops}`;
}

function mergeTrackings(prev, incoming) {
  const map = new Map(prev.map((t) => [trackingKey(t), t]));
  incoming.forEach((t) => {
    map.set(trackingKey(t), t);
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return ta - tb;
  });
}

const initialTrackingState = {
  trackings: [],
  vehiclePosition: null,
  liveRouteHistory: [],
};

function trackingReducer(state, action) {
  switch (action.type) {
    case "SET_TRACKINGS":
      return { ...state, trackings: action.payload };
    case "MERGE_TRACKINGS":
      return {
        ...state,
        trackings: mergeTrackings(state.trackings, action.payload),
      };
    case "SET_VEHICLE_POSITION":
      return { ...state, vehiclePosition: action.payload };
    case "SET_ROUTE_HISTORY":
      return { ...state, liveRouteHistory: action.payload };
    case "APPEND_ROUTE_POINT":
      return {
        ...state,
        liveRouteHistory: appendHistoryPoint(
          state.liveRouteHistory,
          action.payload,
        ),
      };
    case "BATCH_POSITION_UPDATE": {
      const { tracking, vehiclePosition, routePoint } = action.payload;
      return {
        ...state,
        trackings: mergeTrackings(state.trackings, [tracking]),
        vehiclePosition,
        liveRouteHistory: appendHistoryPoint(state.liveRouteHistory, routePoint),
      };
    }
    default:
      return state;
  }
}

function appendHistoryPoint(prev, point) {
  if (!Array.isArray(point) || point.length !== 2) return prev;
  const [lat, lng] = point;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return prev;

  const last = prev[prev.length - 1];
  if (last && last[0] === lat && last[1] === lng) {
    return prev;
  }
  return [...prev, [lat, lng]];
}

function extractPositionPayload(rawData) {
  if (!rawData || typeof rawData !== "object") return rawData;

  const eventName = String(
    rawData.event || rawData.type || rawData.action || "",
  ).toLowerCase();
  if (!eventName) return rawData;

  if (eventName === "position_update") {
    return rawData.data || rawData.payload || rawData.position || rawData;
  }

  return null;
}

function isRecentTimestamp(timestamp, minutes = LIVE_WINDOW_MINUTES) {
  const t = new Date(timestamp).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= minutes * 60 * 1000;
}

function isWithinBuenaventura(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BUENAVENTURA_BOUNDS.minLat &&
    lat <= BUENAVENTURA_BOUNDS.maxLat &&
    lng >= BUENAVENTURA_BOUNDS.minLng &&
    lng <= BUENAVENTURA_BOUNDS.maxLng
  );
}

export {
  appendHistoryPoint,
  buildRouteSignature,
  buildRouteWaypointCoordinates,
  clampPercent,
  dedupeConsecutivePoints,
  distanceKm,
  extractPositionPayload,
  formatAdminRouteName,
  formatElapsedDuration,
  getAdminRouteSignalTone,
  GUIDED_ROUTE_MAX_POINTS,
  initialTrackingState,
  isRecentTimestamp,
  isValidLatLng,
  isWithinBuenaventura,
  mergeTrackings,
  normalizeIntermediateStops,
  normalizeTracking,
  polylineDistanceKm,
  projectPointOnSegment,
  remainingRouteDistanceKm,
  sampleGuidedRoute,
  splitRouteByVehiclePoint,
  toNumber,
  trackingKey,
  trackingReducer,
};

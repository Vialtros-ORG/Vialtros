import {
  appendHistoryPoint,
  buildRouteSignature,
  buildRouteWaypointCoordinates,
  clampPercent,
  dedupeConsecutivePoints,
  extractPositionPayload,
  formatAdminRouteName,
  formatElapsedDuration,
  getAdminRouteSignalTone,
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
} from "./TrackingPage.utils";

describe("TrackingPage route and GPS helpers", () => {
  it("validates and normalizes geographic values without accepting zero defaults for invalid data", () => {
    expect(toNumber("3.89")).toBe(3.89);
    expect(toNumber("unknown")).toBeNull();
    expect(isValidLatLng(3.89, -77.02)).toBe(true);
    expect(isValidLatLng(91, -77.02)).toBe(false);
    expect(normalizeTracking({ lat: "3.89", lng: "-77.02" }, "now")).toMatchObject({
      latitude: 3.89,
      longitude: -77.02,
      timestamp: "now",
    });
    expect(normalizeTracking({ latitude: 91, longitude: 10 }, "now")).toBeNull();
  });

  it("normalizes stops and builds a deduplicated route through valid waypoints", () => {
    expect(normalizeIntermediateStops(null)).toEqual([]);
    expect(normalizeIntermediateStops([
      { passenger_id: 8, address: "Parada", coords: [3.9, -77.1] },
      { latitude: 120, longitude: 5 },
    ])).toEqual([
      {
        id: "stop-0",
        passenger_id: 8,
        label: "Parada",
        address: "Parada",
        latitude: 3.9,
        longitude: -77.1,
        coords: [3.9, -77.1],
      },
      {
        id: "stop-1",
        passenger_id: null,
        label: "Parada 2",
        address: null,
        latitude: null,
        longitude: null,
        coords: null,
      },
    ]);
    expect(buildRouteWaypointCoordinates(
      [3.8, -77.2],
      [4, -77],
      [{ coords: [3.9, -77.1] }, { coords: [3.9, -77.1] }],
    )).toEqual([[3.8, -77.2], [3.9, -77.1], [4, -77]]);
    expect(buildRouteWaypointCoordinates(null, [3.9, -77.1], [
      { lat: 3.85, lng: -77.15 },
      { latitude: 120, longitude: 0 },
    ])).toEqual([[3.85, -77.15], [3.9, -77.1]]);
    expect(buildRouteWaypointCoordinates([91, 0], [0, 181], [{ latitude: 95, longitude: 0 }])).toEqual([]);
  });

  it("keeps route signatures stable and distinguishes route stops", () => {
    expect(buildRouteSignature(null)).toBe("");
    expect(buildRouteSignature({ origin: "Centro", destination: "Colegio" })).toBe("Centro->Colegio|");
    expect(buildRouteSignature({
      origin_lat: 3.8,
      origin_lng: -77.2,
      destination_lat: 3.9,
      destination_lng: -77.1,
      intermediate_stops: [{ coords: [3.85, -77.15], label: "Parada" }],
    })).toBe("3.8,-77.2->3.9,-77.1|3.85,-77.15,Parada");
    expect(buildRouteSignature({
      origin_lat: 3.8,
      origin: "Centro",
      destination: "Colegio",
      intermediate_stops: [
        { latitude: 3.85, longitude: -77.15, address: "Dirección" },
        { lat: 3.86, lng: -77.16, label: "Etiqueta" },
        {},
      ],
    })).toBe("Centro->Colegio|3.85,-77.15,Dirección|3.86,-77.16,Etiqueta|,,");
  });

  it("splits a planned route at the nearest vehicle projection and calculates remaining distance", () => {
    const route = [[3.8, -77.2], [3.9, -77.1], [4, -77]];
    const split = splitRouteByVehiclePoint(route, [3.9, -77.1]);
    expect(split.projectedPoint).toEqual([3.9, -77.1]);
    expect(split.traveled).toEqual([[3.8, -77.2], [3.9, -77.1]]);
    expect(split.remaining).toEqual([[3.9, -77.1], [4, -77]]);
    expect(remainingRouteDistanceKm(route, [3.9, -77.1])).toBeGreaterThan(0);
    expect(remainingRouteDistanceKm(route, [3.85, -77.15])).toBeGreaterThan(0);
    expect(remainingRouteDistanceKm([], [3.9, -77.1])).toBeNull();
    expect(splitRouteByVehiclePoint([[3.8, -77.2]], null).remaining).toEqual([[3.8, -77.2]]);
    expect(projectPointOnSegment([3, 4], [3, 4], [3, 4])).toEqual({
      t: 0,
      distanceSquared: 0,
    });
    expect(projectPointOnSegment([4, 6], [3, 4], [3, 4]).distanceSquared).toBe(5);
    expect(remainingRouteDistanceKm(null, [3.9, -77.1])).toBeNull();
    expect(splitRouteByVehiclePoint(null, [3.9, -77.1])).toEqual({
      traveled: [],
      remaining: [],
      projectedPoint: [3.9, -77.1],
    });
  });

  it("calculates route lengths and handles empty, duplicate, and invalid points", () => {
    expect(polylineDistanceKm(null)).toBe(0);
    expect(polylineDistanceKm([[3.8, -77.2]])).toBe(0);
    expect(polylineDistanceKm([[3.8, -77.2], [3.9, -77.1]])).toBeGreaterThan(0);
    expect(dedupeConsecutivePoints([[3, 4], [3, 4], ["bad"], [4, 5]])).toEqual([[3, 4], [4, 5]]);
    expect(appendHistoryPoint([[3, 4]], [3, 4])).toEqual([[3, 4]]);
    expect(appendHistoryPoint([[3, 4]], [3, 5])).toEqual([[3, 4], [3, 5]]);
    expect(appendHistoryPoint([[3, 4]], ["bad", 5])).toEqual([[3, 4]]);
    expect(dedupeConsecutivePoints(null)).toEqual([]);
  });

  it("bounds route sampling and progress values", () => {
    const points = Array.from({ length: 11 }, (_, i) => [3 + i / 100, -77]);
    expect(sampleGuidedRoute(null)).toEqual([]);
    expect(sampleGuidedRoute(points, 3)).toEqual([points[0], points[5], points[10]]);
    expect(sampleGuidedRoute(points, 20)).toBe(points);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(100.36)).toBe(100);
    expect(clampPercent(44.44)).toBe(44.4);
  });

  it("formats durations and administrator route states consistently", () => {
    expect(formatElapsedDuration(-1)).toBe("0 s");
    expect(formatElapsedDuration(45)).toBe("45 s");
    expect(formatElapsedDuration(120)).toBe("2 min");
    expect(formatElapsedDuration(125)).toBe("2 min 5 s");
    expect(formatAdminRouteName("RUTA ESCOLAR", 2)).toBe("Ruta escolar");
    expect(formatAdminRouteName("Ruta escolar", 2)).toBe("Ruta escolar");
    expect(formatAdminRouteName("", 2)).toBe("Ruta 2");
    expect(getAdminRouteSignalTone({ is_live: true })).toBe("live");
    expect(getAdminRouteSignalTone({ state_label: "Señal desactualizada" })).toBe("stale");
    expect(getAdminRouteSignalTone({ state_label: "Detenido" })).toBe("stopped");
    expect(getAdminRouteSignalTone({})).toBe("idle");
  });

  it("extracts only position update payloads and checks timestamps and map bounds", () => {
    const payload = { latitude: 3.89, longitude: -77.02 };
    expect(extractPositionPayload(null)).toBeNull();
    expect(extractPositionPayload(payload)).toBe(payload);
    expect(extractPositionPayload({ event: "POSITION_UPDATE", data: payload })).toBe(payload);
    expect(extractPositionPayload({ event: "position_update", payload })).toBe(payload);
    expect(extractPositionPayload({ type: "position_update", position: payload })).toBe(payload);
    expect(extractPositionPayload({ type: "other", data: payload })).toBeNull();
    expect(extractPositionPayload({ action: "position_update", position: payload })).toBe(payload);
    expect(normalizeTracking({ latitude: "3.89", longitude: "-77.02", timestamp: "recorded" }, "fallback")).toMatchObject({
      latitude: 3.89,
      longitude: -77.02,
      timestamp: "recorded",
    });
    expect(isRecentTimestamp("invalid")).toBe(false);
    expect(isRecentTimestamp(new Date().toISOString())).toBe(true);
    expect(isWithinBuenaventura(3.89, -77.02)).toBe(true);
    expect(isWithinBuenaventura(3.65, -77.25)).toBe(true);
    expect(isWithinBuenaventura(4.05, -76.75)).toBe(true);
    expect(isWithinBuenaventura(3.64, -77.02)).toBe(false);
    expect(isWithinBuenaventura(5, -77.02)).toBe(false);
    expect(isWithinBuenaventura(3.89, -77.26)).toBe(false);
    expect(isWithinBuenaventura(3.89, -76.74)).toBe(false);
  });

  it("merges GPS events by identity and reduces route state transitions", () => {
    const first = { id: 1, latitude: 3.8, longitude: -77.2, timestamp: "2026-01-01T10:00:00Z" };
    const update = { ...first, latitude: 3.9, timestamp: "2026-01-01T10:01:00Z" };
    expect(trackingKey(first)).toBe("id:1");
    expect(trackingKey({ latitude: 3.8, longitude: -77.2, timestamp: "x" })).toBe("geo:3.8:-77.2:x");
    expect(mergeTrackings([first], [update])).toEqual([update]);
    const newer = { id: 2, latitude: 3.7, longitude: -77.1, timestamp: "2026-01-01T10:02:00Z" };
    expect(mergeTrackings([], [newer, first])).toEqual([first, newer]);
    const initial = { trackings: [first], vehiclePosition: null, liveRouteHistory: [] };
    expect(trackingReducer(initial, { type: "SET_TRACKINGS", payload: [newer] }).trackings).toEqual([newer]);
    expect(trackingReducer(initial, { type: "MERGE_TRACKINGS", payload: [newer] }).trackings).toEqual([first, newer]);
    expect(trackingReducer(initial, { type: "SET_VEHICLE_POSITION", payload: update }).vehiclePosition).toBe(update);
    expect(trackingReducer(initial, { type: "SET_ROUTE_HISTORY", payload: [[3.8, -77.2]] }).liveRouteHistory).toEqual([[3.8, -77.2]]);
    expect(trackingReducer(initial, { type: "APPEND_ROUTE_POINT", payload: [3.9, -77.1] }).liveRouteHistory).toEqual([[3.9, -77.1]]);
    expect(trackingReducer(initial, { type: "BATCH_POSITION_UPDATE", payload: { tracking: update, vehiclePosition: update, routePoint: [3.9, -77.1] } })).toMatchObject({ vehiclePosition: update, liveRouteHistory: [[3.9, -77.1]] });
    expect(trackingReducer(initial, { type: "UNKNOWN" })).toBe(initial);
  });
});

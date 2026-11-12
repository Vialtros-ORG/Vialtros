import api from "./api";

export async function getTrackingsByRoute(routeId) {
  const normalizedRouteId = Number(routeId);
  if (!Number.isSafeInteger(normalizedRouteId) || normalizedRouteId <= 0) {
    throw new TypeError("routeId debe ser un entero positivo");
  }

  const response = await api.get("/tracking/", {
    params: { route: normalizedRouteId },
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function getRouteHistoryPage(routeId, { limit = 250, offset = 0 } = {}) {
  const response = await api.get("/tracking/", {
    params: { route: routeId, history: 1, limit, offset },
  });
  return response.data;
}

export async function updateTrackingStatus(trackingId, status) {
  const response = await api.post(`/tracking/${trackingId}/update_status/`, {
    status,
  });
  return response.data;
}

export async function updateTrackingStatusByPassenger(
  routeId,
  passengerId,
  status,
) {
  const response = await api.post("/tracking/update_status_by_passenger/", {
    route_id: routeId,
    passenger_id: passengerId,
    status,
  });
  return response.data;
}

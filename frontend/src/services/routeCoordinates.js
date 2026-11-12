const ENDPOINTS = {
  origin: { latitude: "origin_lat", longitude: "origin_lng" },
  destination: { latitude: "destination_lat", longitude: "destination_lng" },
};

export function hasCoordinatePair(latitude, longitude) {
  return latitude != null && longitude != null;
}

export function resolveCoordinatePair(latitude, longitude, fallback) {
  if (hasCoordinatePair(latitude, longitude)) return [latitude, longitude];
  return Array.isArray(fallback) && fallback.length >= 2
    ? fallback.slice(0, 2)
    : null;
}

export function isValidCoordinatePair(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  const [latitude, longitude] = coordinates.map(Number);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function getStoredRouteCoordinates(route, endpoint) {
  const fields = ENDPOINTS[endpoint];
  if (!route || !fields) return null;
  const coordinates = [route[fields.latitude], route[fields.longitude]];
  if (!isValidCoordinatePair(coordinates)) return null;
  return coordinates.map(Number);
}

import React from "react";
import { FaUniversity, FaSchool, FaHospital, FaGasPump, FaTree, FaShoppingBag, FaMapMarkerAlt } from "react-icons/fa";

export function toLatLng(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lat, lng] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function toLatLngArray(coordsArray) {
  if (!Array.isArray(coordsArray)) return [];
  return coordsArray
    .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([lat, lng]) => ({ lat, lng }));
}

export function safeLatLngPath(coordsArray) {
  const path = toLatLngArray(coordsArray);
  return path.length > 1 ? path : null;
}

export function getArrowSvg(modifier, type, color = "#0b6e80") {
  const C = color;
  // Ícono de llegada — pin de destino
  if (type === "arrive") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 4C15.03 4 11 8.03 11 13c0 7.25 9 20 9 20s9-12.75 9-20c0-4.97-4.03-9-9-9z" fill={C}/>
        <circle cx="20" cy="13" r="4" fill="#ffffff"/>
      </svg>
    );
  }
  const mod = (modifier || "straight").toLowerCase();

  // Giro a la izquierda — flecha curva izquierda
  if (mod === "left" || mod === "sharp left") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="18" width="6" height="16" rx="3" fill={C}/>
        <path d="M20 18C20 12 10 12 10 18" stroke={C} strokeWidth="5.5" strokeLinecap="round" fill="none"/>
        <path d="M5 14l6-5 1 10z" fill={C}/>
      </svg>
    );
  }
  // Giro a la derecha — flecha curva derecha
  if (mod === "right" || mod === "sharp right") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="18" width="6" height="16" rx="3" fill={C}/>
        <path d="M20 18C20 12 30 12 30 18" stroke={C} strokeWidth="5.5" strokeLinecap="round" fill="none"/>
        <path d="M35 14l-6-5-1 10z" fill={C}/>
      </svg>
    );
  }
  // Giro leve a la izquierda
  if (mod === "slight left") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="18" width="6" height="16" rx="3" fill={C}/>
        <path d="M20 18C20 14 14 11 10 13" stroke={C} strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M5 9l6 1-1 8z" fill={C}/>
      </svg>
    );
  }
  // Giro leve a la derecha
  if (mod === "slight right") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="18" width="6" height="16" rx="3" fill={C}/>
        <path d="M20 18C20 14 26 11 30 13" stroke={C} strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M35 9l-6 1 1 8z" fill={C}/>
      </svg>
    );
  }
  // Media vuelta
  if (mod === "uturn") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 34V18a6 6 0 0 0-12 0v2" stroke={C} strokeWidth="5.5" strokeLinecap="round" fill="none"/>
        <path d="M9 24l5-6 5 6" fill={C}/>
      </svg>
    );
  }
  // Continuar recto — flecha arriba estándar
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="17" y="16" width="6" height="20" rx="3" fill={C}/>
      <path d="M20 4L9 17h22z" fill={C}/>
    </svg>
  );
}

export function buildVoiceInstruction(step) {
  const dirMap = {
    "left": "gire a la izquierda",
    "sharp left": "gire fuertemente a la izquierda",
    "slight left": "manténgase a la izquierda",
    "right": "gire a la derecha",
    "sharp right": "gire fuertemente a la derecha",
    "slight right": "manténgase a la derecha",
    "straight": "continúe recto",
    "uturn": "dé un giro en U",
  };
  if (step?.type === "arrive") return step.name ? `llegando al destino en ${step.name}` : "ha llegado al destino";
  const action = dirMap[(step?.modifier || "").toLowerCase()] || "continúe";
  return step?.name ? `${action} en ${step.name}` : action;
}

export function buildInstructionText(step) {
  const dirMap = {
    "left": "Gira a la izquierda",
    "sharp left": "Gira a la izquierda",
    "slight left": "Mantente a la izquierda",
    "right": "Gira a la derecha",
    "sharp right": "Gira a la derecha",
    "slight right": "Mantente a la derecha",
    "straight": "Continúa recto",
    "uturn": "Da un giro en U",
  };

  if (step?.type === "arrive") return "Llegaste al destino";
  return dirMap[(step?.modifier || "").toLowerCase()] || "Continúa recto";
}


export function projectPointOnSegment(point, start, end) {
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
    const distSquared = (pointX - startX) ** 2 + (pointY - startY) ** 2;
    return { t: 0, distanceSquared: distSquared };
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

export function getSegmentRotation(start, end) {
  const deltaLat = end[0] - start[0];
  const deltaLng = end[1] - start[1];
  if (
    !Number.isFinite(deltaLat) ||
    !Number.isFinite(deltaLng) ||
    (deltaLat === 0 && deltaLng === 0)
  ) {
    return 0;
  }
  return Math.atan2(-deltaLat, deltaLng) * (180 / Math.PI);
}

/**
 * Retorna los segmentos de la ruta planificada ADELANTE del vehículo
 * para calcular el bearing hacia donde va, no hacia donde fue.
 */
export function getAheadDirectionLine(plannedLine, vehiclePoint) {
  if (!Array.isArray(plannedLine) || plannedLine.length < 2 || !Array.isArray(vehiclePoint))
    return plannedLine;

  let closestIndex = 0;
  let closestDist = Infinity;
  for (let i = 0; i < plannedLine.length - 1; i++) {
    const { distanceSquared } = projectPointOnSegment(vehiclePoint, plannedLine[i], plannedLine[i + 1]);
    if (distanceSquared < closestDist) {
      closestDist = distanceSquared;
      closestIndex = i;
    }
  }
  // Toma los proximos 5 segmentos adelante para suavizar el bearing
  const slice = plannedLine.slice(closestIndex, closestIndex + 6);
  return slice;
}

export function getVehicleRotation(line, vehiclePoint) {
  if (!Array.isArray(line) || line.length < 2) return 0;

  if (!Array.isArray(vehiclePoint) || vehiclePoint.length !== 2) {
    return getSegmentRotation(line[line.length - 2], line[line.length - 1]);
  }

  let closestSegmentIndex = 0;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index];
    const end = line[index + 1];
    if (!start || !end) continue;

    const { distanceSquared } = projectPointOnSegment(vehiclePoint, start, end);
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestSegmentIndex = index;
    }
  }

  const start = line[closestSegmentIndex];
  const end = line[closestSegmentIndex + 1];
  if (!Array.isArray(start) || !Array.isArray(end)) return 0;
  return getSegmentRotation(start, end);
}

export function distanceBetweenPoints(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return 0;
  const deltaLat = to[0] - from[0];
  const deltaLng = to[1] - from[1];
  return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
}

export function interpolatePoint(from, to, progress) {
  return [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
  ];
}

export function buildAnimationPath(
  targetPoint,
  traveledLine,
  previousPoint,
  previousLineLength,
) {
  if (Array.isArray(traveledLine) && traveledLine.length > 1) {
    const startIndex =
      previousLineLength > 1 ? Math.max(previousLineLength - 1, 0) : 0;
    const nextPath = traveledLine.slice(startIndex);
    if (Array.isArray(previousPoint) && nextPath.length > 0) {
      if (distanceBetweenPoints(previousPoint, nextPath[0]) > 0.00001) {
        return [previousPoint, ...nextPath];
      }
    }
    return nextPath;
  }

  if (Array.isArray(previousPoint) && Array.isArray(targetPoint)) {
    return [previousPoint, targetPoint];
  }

  return Array.isArray(targetPoint) ? [targetPoint] : [];
}

export function totalPathDistance(path) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += distanceBetweenPoints(path[index - 1], path[index]);
  }
  return total;
}

export function getPointAtDistance(path, distance) {
  if (path.length === 0) return null;
  if (path.length === 1 || distance <= 0) return path[0];

  let traversed = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentDistance = distanceBetweenPoints(start, end);

    if (traversed + segmentDistance >= distance) {
      const localProgress =
        segmentDistance === 0 ? 1 : (distance - traversed) / segmentDistance;
      return interpolatePoint(start, end, localProgress);
    }

    traversed += segmentDistance;
  }

  return path[path.length - 1];
}

export function lineDistanceKm(line = []) {
  if (!Array.isArray(line) || line.length < 2) return 0;
  const toRad = (v) => (v * Math.PI) / 180;
  const earthKm = 6371;
  let total = 0;
  for (let i = 1; i < line.length; i += 1) {
    const [lat1, lng1] = line[i - 1];
    const [lat2, lng2] = line[i];
    if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) continue;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += earthKm * c;
  }
  return total;
}

export function getPoiIcon(tags = {}) {
  const amenity = (tags.amenity || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();

  if (amenity === "university") return <FaUniversity />;
  if (amenity === "school") return <FaSchool />;
  if (amenity === "hospital") return <FaHospital />;
  if (amenity === "fuel") return <FaGasPump />;
  if (leisure === "park") return <FaTree />;
  if (shop && /mall|supermarket|department_store/.test(shop)) return <FaShoppingBag />;

  return <FaMapMarkerAlt />;
}

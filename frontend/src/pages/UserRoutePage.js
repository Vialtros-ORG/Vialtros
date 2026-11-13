import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import { icons } from "../components/dashboard/icons";
import MapView from "../components/MapView";
import { getUserAssignedRoute, getDriverTrackings } from "../services/dashboard";
import { getTrackingsByRoute } from "../services/tracking";
import { geocodeAddress, getStreetRouteThroughPoints } from "../services/routing";
import { connectTrackingWS } from "../services/ws";
import { useAppTheme } from "../context/ThemeContext";
import "./UserRoutePage.css";

const DEFAULT_SPEED_KMH = 18;
const NEAR_DISTANCE_KM = 0.8;

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizeTracking(raw) {
  const latitude = Number(raw?.latitude ?? raw?.lat);
  const longitude = Number(raw?.longitude ?? raw?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { ...raw, latitude, longitude };
}


export default function UserRoutePage({ role, onLogout }) {
  const { resolvedTheme } = useAppTheme();
  const [data, setData] = useState(null);
  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Coords geocodificadas
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [myPickupCoords, setMyPickupCoords] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);

  // Live tracking vía WebSocket
  const [livePosition, setLivePosition] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const wsStatusRef = useRef(wsStatus);


  // Carga inicial
  useEffect(() => {
    Promise.all([getUserAssignedRoute(), getDriverTrackings()])
      .then(([routeData, trackingData]) => {
        setData(routeData);
        setTrackings(
          (trackingData || []).map(normalizeTracking).filter(Boolean),
        );
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setError("Todavía no tienes una ruta asignada.");
          return;
        }
        setError("No se pudo cargar tu ruta en este momento.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    wsStatusRef.current = wsStatus;
  }, [wsStatus]);

  // Geocodificar origen, destino y parada del usuario
  useEffect(() => {
    const route = data?.route;
    if (!route) return;

    if (
      route.origin_lat != null &&
      route.origin_lng != null &&
      Number.isFinite(Number(route.origin_lat)) &&
      Number.isFinite(Number(route.origin_lng))
    ) {
      setOriginCoords([Number(route.origin_lat), Number(route.origin_lng)]);
    } else if (route.origin) {
      geocodeAddress(route.origin).then((coords) => {
        if (Array.isArray(coords) && coords.length === 2) setOriginCoords(coords);
      }).catch(() => {});
    }

    if (
      route.destination_lat != null &&
      route.destination_lng != null &&
      Number.isFinite(Number(route.destination_lat)) &&
      Number.isFinite(Number(route.destination_lng))
    ) {
      setDestinationCoords([Number(route.destination_lat), Number(route.destination_lng)]);
    } else if (route.destination) {
      geocodeAddress(route.destination).then((coords) => {
        if (Array.isArray(coords) && coords.length === 2) setDestinationCoords(coords);
      }).catch(() => {});
    }

    // Identificar la parada del usuario actual
    const currentUsername = localStorage.getItem("username");
    if (currentUsername && Array.isArray(route.passenger_details)) {
      const myPassenger = route.passenger_details.find(
        (p) => p.user_detail?.username === currentUsername,
      );
      if (
        myPassenger?.pickup_lat != null &&
        myPassenger?.pickup_lng != null &&
        Number.isFinite(Number(myPassenger.pickup_lat)) &&
        Number.isFinite(Number(myPassenger.pickup_lng))
      ) {
        setMyPickupCoords([Number(myPassenger.pickup_lat), Number(myPassenger.pickup_lng)]);
      }
    }
  }, [data]);

  // Construir polilínea de ruta por calles
  useEffect(() => {
    if (!originCoords || !destinationCoords) return;
    const stops = data?.route?.intermediate_stops || [];
    const points = [
      originCoords,
      ...stops
      .filter((s) =>
        Number.isFinite(Number(s.latitude)) &&
        Number.isFinite(Number(s.longitude)) &&
        s.latitude != null &&
        s.longitude != null,
      )
        .map((s) => [Number(s.latitude), Number(s.longitude)]),
      destinationCoords,
    ];
    getStreetRouteThroughPoints(points)
      .then((result) => {
        if (result?.coordinates?.length > 1) setRoutePolyline(result.coordinates);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originCoords, destinationCoords, data?.route?.intermediate_stops]);

  // Conectar WebSocket cuando la ruta esté disponible
  useEffect(() => {
    const routeId = data?.route?.id;
    if (!routeId) return;

    setWsStatus("connecting");
    let opened = false;

    const ws = connectTrackingWS(
      routeId,
      (payload) => {
        const lat = Number(payload?.latitude ?? payload?.lat);
        const lng = Number(payload?.longitude ?? payload?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const newPos = { latitude: lat, longitude: lng, speed_kmh: payload?.speed_kmh ?? null };
        setLivePosition(newPos);
        setIsPollingFallback(false);
        setTrackings((prev) => {
          const next = [...prev, { ...newPos, route: routeId }];
          return next.slice(-60);
        });
      },
      {
        onOpen: () => { opened = true; setWsStatus("connected"); },
        onClose: () => setWsStatus(opened ? "connecting" : "disconnected"),
        onError: () => setWsStatus("disconnected"),
        reconnectDelayMs: 3000,
        maxReconnectAttempts: 30,
      },
    );

    return () => { ws.close(); };
  }, [data?.route?.id]);

  // Polling fallback: cuando el WS no está activo, consulta REST cada 5s
  useEffect(() => {
    const routeId = data?.route?.id;
    if (!routeId) return undefined;

    let cancelled = false;

    const poll = async () => {
      try {
        const latest = await getTrackingsByRoute(routeId).catch(() => []);
        if (cancelled || !Array.isArray(latest) || latest.length === 0) return;
        const normalized = latest.map(normalizeTracking).filter(Boolean);
        if (normalized.length === 0) return;
        setTrackings((prev) => {
          const existing = new Set(prev.map((t) => `${t.latitude},${t.longitude}`));
          const fresh = normalized.filter((t) => !existing.has(`${t.latitude},${t.longitude}`));
          return fresh.length > 0 ? [...prev, ...fresh].slice(-60) : prev;
        });
        const last = normalized[normalized.length - 1];
        setLivePosition({ latitude: last.latitude, longitude: last.longitude, speed_kmh: last.speed_kmh ?? null });
        if (wsStatusRef.current !== "connected") setIsPollingFallback(true);
      } catch {
        // ignorar errores transitorios
      }
    };

    const intervalMs = wsStatusRef.current === "connected" ? 10000 : 5000;
    poll();
    const id = setInterval(poll, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [data?.route?.id]);

  const route = data?.route;
  const driver = data?.driver;
  const assignedPassengers = route?.passenger_details || [];
  const passengerCount = route?.passenger_count ?? assignedPassengers.length;
  const currentUsername = localStorage.getItem("username");
  const myPassenger = assignedPassengers.find(
    (passenger) => passenger.user_detail?.username === currentUsername,
  );

  const latestTracking = useMemo(() => {
    if (livePosition) return livePosition;
    if (!trackings.length) return null;
    return trackings[trackings.length - 1];
  }, [livePosition, trackings]);

  const vehiclePosition = useMemo(() => {
    if (!latestTracking) return null;
    return [latestTracking.latitude, latestTracking.longitude];
  }, [latestTracking]);

  const etaMinutes = useMemo(() => {
    if (!livePosition || !myPickupCoords) return null;
    const speed = livePosition.speed_kmh > 2 ? livePosition.speed_kmh : DEFAULT_SPEED_KMH;
    const km = distanceKm(
      livePosition.latitude, livePosition.longitude,
      myPickupCoords[0], myPickupCoords[1],
    );
    return Math.max(1, Math.round((km / speed) * 60));
  }, [livePosition, myPickupCoords]);

  const isVehicleNearby = useMemo(() => {
    if (!latestTracking || !destinationCoords) return false;
    const km = distanceKm(
      latestTracking.latitude,
      latestTracking.longitude,
      destinationCoords[0],
      destinationCoords[1],
    );
    return km <= NEAR_DISTANCE_KM;
  }, [latestTracking, destinationCoords]);

  const pickupStatus = useMemo(() => {
    const t = trackings.find((t) => Number(t.route) === Number(route?.id));
    return t?.status || "not_picked";
  }, [trackings, route?.id]);

  const pickupState = pickupStatus === "picked"
    ? { label: "Recogida confirmada", detail: "El conductor confirmó que ya estás a bordo.", tone: "picked" }
    : pickupStatus === "dropped_off"
      ? { label: "Llegada confirmada", detail: "El conductor registró tu llegada a la parada.", tone: "complete" }
      : { label: "Pendiente de recogida", detail: "Espera en tu parada; el conductor actualizará este estado.", tone: "pending" };

  const journeySummary = pickupStatus === "dropped_off"
    ? "Recorrido completado"
    : vehiclePosition
      ? "Bus en movimiento"
      : "Esperando al conductor";

  const WS_UI = {
    connecting:  { label: "Conectando..." },
    connected:   { label: "En vivo" },
    fallback:    { label: "En vivo (respaldo)" },
    disconnected:{ label: "Sin conexión" },
  };
  const wsUiKey = isPollingFallback && wsStatus !== "connected" ? "fallback" : wsStatus;
  const { label: wsLabel } = WS_UI[wsUiKey] ?? WS_UI.disconnected;

  return (
    <div className="vt-passenger-route-page min-h-screen flex">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="vt-passenger-route-main">
        <header className="vt-passenger-route-heading">
          <div>
            <span className={`vt-passenger-connection is-${wsUiKey}`}><i aria-hidden="true" />{wsLabel}</span>
            <h1>Mi ruta</h1>
            <p>{route?.name ? `Seguimiento de ${route.name}` : "Consulta el estado de tu recorrido asignado."}</p>
          </div>
          {route && <span className="vt-passenger-count">{passengerCount} {passengerCount === 1 ? "pasajero" : "pasajeros"}</span>}
        </header>

        {loading ? (
          <section className="vt-passenger-state-card" role="status">
            <span className="vt-passenger-state-mark is-loading" aria-hidden="true" />
            <h2>Cargando tu ruta</h2>
            <p>Estamos buscando la información más reciente del recorrido.</p>
          </section>
        ) : error ? (
          <section className="vt-passenger-state-card is-empty" role="status">
            <span className="vt-passenger-state-mark" aria-hidden="true">{icons.routes({ size: 23 })}</span>
            <h2>Aún no hay una ruta asignada</h2>
            <p>{error} Cuando un administrador te asigne una ruta, la verás aquí.</p>
            <Link to="/dashboard" className="vt-passenger-state-link">Volver al inicio</Link>
          </section>
        ) : (
          <div className="vt-passenger-route-grid">
            <section className="vt-passenger-map-section" aria-labelledby="vt-passenger-map-title">
              <header className="vt-passenger-map-heading">
                <div>
                  <h2 id="vt-passenger-map-title">Seguimiento en vivo</h2>
                  <p>
                    {etaMinutes && myPickupCoords
                      ? `El bus llegará a tu parada en unos ${etaMinutes} min.`
                      : vehiclePosition
                        ? "El vehículo está compartiendo su ubicación."
                        : "La ubicación aparecerá cuando el conductor inicie la ruta."}
                  </p>
                </div>
                {isVehicleNearby && <span className="vt-passenger-nearby">Cerca del destino</span>}
              </header>
              <div className="vt-passenger-map-wrap">
                <MapView
                  trackings={trackings}
                  vehiclePosition={vehiclePosition}
                  routePolyline={routePolyline}
                  originCoords={originCoords}
                  destinationCoords={destinationCoords}
                  originName={route?.origin}
                  destinationName={route?.destination}
                  intermediateStops={route?.intermediate_stops || []}
                  userCoords={myPickupCoords}
                  darkMode={resolvedTheme === "dark"}
                  mapHeight="min(66vh, 590px)"
                />
                <div className="vt-passenger-map-legend" aria-label="Elementos del mapa">
                  <span><i className="is-origin" />Origen</span>
                  <span><i className="is-bus" />Ubicación del bus</span>
                  <span><i className="is-stop" />Tu parada</span>
                </div>
              </div>
            </section>

            <aside className="vt-passenger-route-details">
              <section className="vt-passenger-journey-status" aria-live="polite">
                <div className={`vt-passenger-status-dot is-${pickupState.tone}`} aria-hidden="true" />
                <div>
                  <span>Estado de tu recorrido</span>
                  <strong>{pickupState.label}</strong>
                  <p>{pickupState.detail}</p>
                </div>
              </section>

              <section className="vt-passenger-detail-section">
                <div className="vt-passenger-detail-title">
                  <span className="vt-passenger-detail-icon">{icons.users({ size: 18, strokeWidth: 1.9 })}</span>
                  <h2>Tu conductor</h2>
                </div>
                <div className="vt-passenger-driver">
                  <span className="vt-passenger-driver-avatar" aria-hidden="true">
                    {(driver?.user_detail?.username || "C").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{driver?.user_detail?.username || "Sin conductor asignado"}</strong>
                    <span>{driver?.user_detail?.email || "Los datos aparecerán cuando haya un conductor asignado."}</span>
                  </div>
                </div>
                {driver?.license_number && (
                  <div className="vt-passenger-license"><span>Licencia</span><strong>{driver.license_number}</strong></div>
                )}
                {route?.id && (
                  <Link to={`/tracking/${route.id}`} className="vt-passenger-tracking-link">
                    Ver tracking completo {icons.arrowRight({ size: 15, strokeWidth: 2.2 })}
                  </Link>
                )}
              </section>

              <section className="vt-passenger-detail-section vt-passenger-stops" aria-labelledby="vt-passenger-stops-title">
                <div className="vt-passenger-detail-title">
                  <span className="vt-passenger-detail-icon">{icons.mapPin({ size: 18, strokeWidth: 1.9 })}</span>
                  <h2 id="vt-passenger-stops-title">Tu trayecto</h2>
                </div>
                <div className="vt-passenger-stop-row is-origin">
                  <span className="vt-passenger-stop-marker" aria-hidden="true" />
                  <div><span>Origen</span><strong>{route?.origin || "Origen sin registrar"}</strong></div>
                </div>
                {myPassenger?.pickup_address && (
                  <div className="vt-passenger-stop-row is-personal">
                    <span className="vt-passenger-stop-marker" aria-hidden="true" />
                    <div><span>Tu parada</span><strong>{myPassenger.pickup_address}</strong></div>
                  </div>
                )}
                {route?.intermediate_stops?.map((stop, index) => (
                  <div className="vt-passenger-stop-row" key={stop.id || `${stop.name}-${index}`}>
                    <span className="vt-passenger-stop-marker" aria-hidden="true" />
                    <div><span>Parada intermedia</span><strong>{stop.name || stop.address || `Parada ${index + 1}`}</strong></div>
                  </div>
                ))}
                <div className="vt-passenger-stop-row is-destination">
                  <span className="vt-passenger-stop-marker" aria-hidden="true" />
                  <div><span>Destino</span><strong>{route?.destination || "Destino sin registrar"}</strong></div>
                </div>
              </section>

              <section className="vt-passenger-classmates" aria-labelledby="vt-passenger-classmates-title">
                <div className="vt-passenger-classmates-heading">
                  <h2 id="vt-passenger-classmates-title">Compañeros de ruta</h2>
                  <span>{assignedPassengers.length}</span>
                </div>
                {assignedPassengers.length > 0 ? (
                  <ul>
                    {assignedPassengers.map((passenger) => (
                      <li key={passenger.id}>
                        <span className="vt-passenger-classmate-avatar" aria-hidden="true">
                          {(passenger.user_detail?.username || "P").slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>{passenger.user_detail?.username || `Pasajero ${passenger.id}`}</strong>
                          <span>{passenger.phone || passenger.user_detail?.phone_number || "Pasajero asignado"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="vt-passenger-no-classmates">No hay otros pasajeros registrados en esta ruta.</p>
                )}
              </section>
            </aside>
          </div>
        )}

        {!loading && !error && (
          <footer className="vt-passenger-route-footer">
            <span>{journeySummary}</span>
            <span>{wsUiKey === "connected" ? "Actualización en tiempo real" : wsUiKey === "fallback" ? "Actualización de respaldo" : wsUiKey === "connecting" ? "Conectando al seguimiento" : "La conexión se reintentará automáticamente"}</span>
          </footer>
        )}
      </main>
    </div>
  );
}

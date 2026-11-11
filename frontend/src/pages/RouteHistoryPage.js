import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import { getDriverAssignedRoutes, getUserAssignedRoute } from "../services/dashboard";
import { getRoutes } from "../services/admin";
import { getRouteHistoryPage } from "../services/tracking";

const PAGE_SIZE = 250;

function dateTime(value) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin registro"
    : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function eventLabel(status) {
  return ({ picked: "Recogida", dropped_off: "Llegada", not_picked: "No recogido" })[status] || "Actividad";
}

export default function RouteHistoryPage({ role, onLogout }) {
  const [routes, setRoutes] = useState([]);
  const [routeId, setRouteId] = useState("");
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingRoutes(true);
    const request = role === "admin"
      ? getRoutes()
      : role === "driver"
        ? getDriverAssignedRoutes()
        : getUserAssignedRoute().then((result) => result?.route ? [result.route] : []);

    request.then((data) => {
      if (!active) return;
      const ordered = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
        const aDate = new Date(a.completed_at || 0).getTime();
        const bDate = new Date(b.completed_at || 0).getTime();
        return bDate - aDate || Number(b.id) - Number(a.id);
      });
      setRoutes(ordered);
      setRouteId((current) => current || String(ordered[0]?.id || ""));
    }).catch(() => {
      if (active) setError("No se pudieron cargar las rutas disponibles para tu cuenta.");
    }).finally(() => { if (active) setLoadingRoutes(false); });
    return () => { active = false; };
  }, [role]);

  const selectedRoute = useMemo(() => routes.find((route) => String(route.id) === routeId), [routes, routeId]);

  const loadPage = useCallback(async (offset, append) => {
    if (!routeId) return;
    setLoadingEvents(true);
    setError("");
    try {
      const page = await getRouteHistoryPage(routeId, { limit: PAGE_SIZE, offset });
      setEvents((current) => append ? [...current, ...(page.results || [])] : (page.results || []));
      if (page.summary) setSummary(page.summary);
      setTotal(page.total || 0);
      setHasMore(Boolean(page.has_more));
    } catch (requestError) {
      setError(requestError?.response?.status === 403
        ? "Tu cuenta no tiene permiso para consultar esta ruta."
        : "No se pudo cargar el historial. Revisa tu conexión e inténtalo de nuevo.");
      if (!append) { setEvents([]); setSummary(null); setTotal(0); }
    } finally {
      setLoadingEvents(false);
    }
  }, [routeId]);

  useEffect(() => {
    setEvents([]);
    setSummary(null);
    setTotal(0);
    setHasMore(false);
    if (routeId) void loadPage(0, false);
  }, [routeId, loadPage]);

  const isPassenger = role === "user" || role === "passenger";
  const completed = selectedRoute?.status === "completed";
  const routeState = completed
    ? "Finalizada"
    : isPassenger
      ? total > 0 ? "Actividad registrada" : "Esperando al conductor"
      : summary?.first_seen ? "Con señales GPS" : "Pendiente de inicio";
  const noTelemetry = !isPassenger && !summary?.gps_points;

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="vt-history-page">
        <header className="vt-history-heading">
          <div>
            <h1>{isPassenger ? "Mi actividad de ruta" : "Historial de rutas"}</h1>
            <p>{isPassenger ? "Tus recogidas y llegadas registradas." : "Tiempos, señales GPS y actividad por recorrido."}</p>
          </div>
          <div className="vt-history-controls">
            {routes.length > 0 && (
              <label className="vt-history-select-wrap">
                <span>Ruta</span>
                <select aria-label="Seleccionar ruta" value={routeId} onChange={(event) => setRouteId(event.target.value)}>
                  {routes.map((route) => <option value={route.id} key={route.id}>{route.name || `Ruta #${route.id}`}</option>)}
                </select>
              </label>
            )}
            {selectedRoute && <Link className="vt-history-map-link" to={`/tracking/${selectedRoute.id}`}>Abrir mapa en vivo</Link>}
          </div>
        </header>

        {loadingRoutes ? <p className="vt-history-message" role="status">Cargando rutas…</p> : routes.length === 0 ? (
          <div className="vt-history-empty"><strong>No tienes rutas para consultar.</strong><span>Las rutas asignadas aparecerán aquí con sus registros.</span></div>
        ) : (
          <>
            <section className="vt-history-facts" aria-label="Resumen de la ruta">
              <div className="vt-history-state"><span className={`vt-history-state-dot${completed ? " is-complete" : ""}`} />{routeState}</div>
              {isPassenger ? (
                <div className="vt-history-fact"><span>Mis registros</span><strong>{total.toLocaleString("es-CO")}</strong></div>
              ) : (
                <>
                  <div className="vt-history-fact"><span>Inicio</span><strong>{summary?.first_seen ? dateTime(summary.first_seen) : "Sin señal GPS"}</strong></div>
                  <div className="vt-history-fact"><span>Cierre</span><strong>{selectedRoute?.completed_at ? dateTime(selectedRoute.completed_at) : summary?.last_seen ? dateTime(summary.last_seen) : "Sin registro"}</strong></div>
                  <div className="vt-history-fact"><span>Distancia recorrida</span><strong>{summary?.distance_km != null && summary.gps_points ? `${Number(summary.distance_km).toFixed(2)} km` : "Sin señal GPS"}</strong></div>
                  <div className="vt-history-fact"><span>Velocidad media</span><strong>{summary?.average_speed_kmh != null ? `${summary.average_speed_kmh} km/h` : "Sin datos"}</strong></div>
                </>
              )}
            </section>

            <section className="vt-history-route-overview" aria-label="Trayecto asignado">
              <div><span>Origen</span><strong>{selectedRoute?.origin || "No definido"}</strong></div>
              <span className="vt-history-to" aria-label="hacia" role="img">→</span>
              <div><span>Destino</span><strong>{selectedRoute?.destination || "No definido"}</strong></div>
              {!isPassenger && <p>{(selectedRoute?.passenger_count ?? selectedRoute?.passengers?.length ?? 0).toLocaleString("es-CO")} pasajeros · {summary?.gps_points || 0} posiciones GPS · velocidad máxima {summary?.peak_speed_kmh != null ? `${summary.peak_speed_kmh} km/h` : "sin datos"}</p>}
            </section>

            <section className="vt-history-log" aria-labelledby="vt-history-log-title">
              <header className="vt-history-log-head">
                <div><h2 id="vt-history-log-title">{isPassenger ? "Mis eventos" : "Registros del recorrido"}</h2><p>{isPassenger ? "Actividad vinculada a tu cuenta." : "Puntos de ubicación y eventos de paradas en orden cronológico."}</p></div>
                <span>{events.length} / {total.toLocaleString("es-CO")}</span>
              </header>
              {error && <p className="vt-history-error" role="alert">{error}</p>}
              {!loadingEvents && events.length === 0 ? (
                <div className="vt-history-empty-inline">{noTelemetry ? "Aún no hay posiciones GPS para esta ruta." : "Aún no hay eventos registrados para esta ruta."}</div>
              ) : (
                <>
                  <div className="vt-history-table-head" aria-hidden="true"><span>Fecha y hora</span><span>Registro</span><span>Detalle</span><span>Velocidad</span></div>
                  <ol className="vt-history-events">
                    {events.map((event, index) => {
                      const isPassengerEvent = Boolean(event.passenger);
                      const coordinates = Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))
                        ? `${Number(event.latitude).toFixed(5)}, ${Number(event.longitude).toFixed(5)}`
                        : "Ubicación no disponible";
                      return <li key={event.id || `${event.timestamp}-${index}`}>
                        <time dateTime={event.timestamp}>{dateTime(event.timestamp)}</time>
                        <strong>{isPassengerEvent ? eventLabel(event.status) : "Posición del vehículo"}</strong>
                        <span>{isPassengerEvent ? (isPassenger ? "Actividad registrada" : `Pasajero #${event.passenger}`) : coordinates}</span>
                        <span className="vt-history-speed">{event.speed_kmh != null ? `${Number(event.speed_kmh).toFixed(0)} km/h` : "—"}</span>
                      </li>;
                    })}
                  </ol>
                </>
              )}
              {loadingEvents && <p className="vt-history-message" role="status">Cargando registros…</p>}
              {hasMore && !loadingEvents && <button className="vt-history-more" type="button" onClick={() => void loadPage(events.length, true)}>Cargar más registros</button>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

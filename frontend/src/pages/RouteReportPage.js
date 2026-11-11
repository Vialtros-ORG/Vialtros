import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import { getRouteAccessibleToRole } from "../services/routeAccess";
import { getRouteHistoryPage } from "../services/tracking";

const PAGE_SIZE = 250;

function formatDate(value) {
  if (!value) return "Sin registro";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Sin registro" : parsed.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function eventName(event) {
  if (!event.passenger) return "Señal GPS";
  return ({ picked: "Pasajero recogido", dropped_off: "Pasajero llegó", not_picked: "Pasajero no recogido" })[event.status] || "Actividad de pasajero";
}

export default function RouteReportPage({ role, onLogout }) {
  const { routeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [route, setRoute] = useState(location.state?.route || null);
  const [reportSummary, setReportSummary] = useState(location.state?.summary || null);
  const [events, setEvents] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadPage = useCallback(async (offset, append) => {
    if (!routeId) return;
    append ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const page = await getRouteHistoryPage(routeId, { limit: PAGE_SIZE, offset });
      setEvents((current) => append ? [...current, ...(page.results || [])] : (page.results || []));
      if (page.summary) setReportSummary((current) => ({ ...current, ...page.summary }));
      setHasMore(Boolean(page.has_more));
    } catch (requestError) {
      setError(requestError?.response?.status === 403
        ? "Tu cuenta no tiene permiso para consultar este reporte."
        : "No se pudieron cargar los registros de la ruta. Comprueba tu conexión e inténtalo de nuevo.");
      if (!append) setEvents([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [routeId]);

  useEffect(() => {
    let active = true;
    setRoute(location.state?.route || null);
    getRouteAccessibleToRole(routeId, role).then((data) => {
      if (!active) return;
      if (!data) throw new Error("La ruta no está asignada a esta cuenta.");
      setRoute(data);
    }).catch(() => {
      if (active && !location.state?.route) {
        setError("No se pudo cargar la información de la ruta para esta cuenta.");
      }
    });
    void loadPage(0, false);
    return () => { active = false; };
  }, [routeId, role, loadPage, location.state]);

  const reportStats = location.state?.report || {};
  const distance = reportSummary?.distance_km > 0 ? `${Number(reportSummary.distance_km).toFixed(2)} km`
    : reportStats.distanceKm != null ? `${Number(reportStats.distanceKm).toFixed(1)} km` : "Sin datos GPS";
  const averageSpeed = reportSummary?.average_speed_kmh != null
    ? `${Number(reportSummary.average_speed_kmh).toFixed(1)} km/h`
    : reportStats.speedKmh > 0 ? `${reportStats.speedKmh} km/h` : "Sin datos";
  const passengerCount = route?.passenger_count ?? route?.passengers?.length ?? route?.passenger_details?.length ?? 0;
  const routeName = route?.name || reportStats.routeName || `Ruta ${routeId}`;
  const isPassenger = role === "user" || role === "passenger";

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="vt-report-page">
        <header className="vt-report-heading">
          <div>
            <p className="vt-settings-eyebrow">Trazabilidad del recorrido</p>
            <h1>Reporte de ruta</h1>
            <p>{routeName} · {route?.status === "completed" || reportStats.finishedAt ? "Recorrido finalizado" : "Actividad registrada"}</p>
          </div>
          <div className="vt-report-actions no-print">
            <button type="button" className="vt-report-print" onClick={() => window.print()}>Imprimir reporte</button>
            <button type="button" className="vt-settings-back" onClick={() => navigate(-1)}><span aria-hidden="true">←</span> Volver</button>
          </div>
        </header>

        <section className="vt-report-route" aria-label="Trayecto de la ruta">
          <div className="vt-report-endpoint"><span className="vt-report-origin-mark" aria-hidden="true"/><div><small>Origen</small><strong>{route?.origin || reportStats.origin || "No definido"}</strong></div></div>
          <span className="vt-report-route-line" aria-hidden="true"><i /></span>
          <div className="vt-report-endpoint"><span className="vt-report-destination-mark" aria-hidden="true"/><div><small>Destino</small><strong>{route?.destination || reportStats.destination || "No definido"}</strong></div></div>
          <span className="vt-report-state">{route?.status === "completed" || reportStats.finishedAt ? "Finalizada" : "En seguimiento"}</span>
        </section>

        <section className="vt-report-metrics" aria-label="Resumen del reporte">
          <div><span>Distancia GPS</span><strong>{distance}</strong></div>
          <div><span>Duración</span><strong>{reportStats.durationMinutes != null ? `${reportStats.durationMinutes} min` : reportSummary?.first_seen && reportSummary?.last_seen ? elapsedLabel(reportSummary.first_seen, reportSummary.last_seen) : "Sin registro"}</strong></div>
          <div><span>Velocidad media</span><strong>{averageSpeed}</strong></div>
          <div><span>Pasajeros asignados</span><strong>{passengerCount}</strong></div>
          <div><span>Señales GPS</span><strong>{reportSummary?.gps_points ?? events.filter((event) => !event.passenger).length}</strong></div>
        </section>

        <section className="vt-report-log" aria-labelledby="vt-report-log-title">
          <header><div><h2 id="vt-report-log-title">Registros del recorrido</h2><p>Señales del vehículo y actividad en orden cronológico.</p></div><span>{events.length}{hasMore ? "+" : ""} registros</span></header>
          {error && <p className="vt-report-error" role="alert">{error}</p>}
          {loading && events.length === 0 ? <p className="vt-report-empty" role="status">Cargando registros del recorrido…</p>
            : events.length === 0 ? <div className="vt-report-empty"><strong>Aún no hay registros GPS para esta ruta.</strong><span>El resumen muestra los datos disponibles al momento de finalizarla.</span></div>
              : <ol className="vt-report-events">
                {events.map((event, index) => {
                  const hasCoordinates = event.latitude != null && event.longitude != null;
                  const detail = event.passenger
                    ? (isPassenger ? "Actividad vinculada a tu cuenta" : `Pasajero ${typeof event.passenger === "object" ? event.passenger.id || "asignado" : `#${event.passenger}`}`)
                    : hasCoordinates ? `${Number(event.latitude).toFixed(5)}, ${Number(event.longitude).toFixed(5)}` : "Ubicación no disponible";
                  return <li key={event.id || `${event.timestamp}-${index}`}>
                    <span className={`vt-report-event-mark${event.passenger ? " is-passenger" : ""}`} aria-hidden="true" />
                    <time dateTime={event.timestamp}>{formatDate(event.timestamp)}</time>
                    <div><strong>{eventName(event)}</strong><span>{detail}</span></div>
                    <span className="vt-report-event-speed">{event.speed_kmh != null ? `${Number(event.speed_kmh).toFixed(0)} km/h` : "—"}</span>
                  </li>;
                })}
              </ol>}
          {hasMore && <button type="button" className="vt-report-more no-print" disabled={loadingMore} onClick={() => void loadPage(events.length, true)}>{loadingMore ? "Cargando…" : "Cargar más registros"}</button>}
        </section>
        <div className="vt-report-footer no-print"><Link to="/history">Abrir historial de rutas</Link><Link to={role === "admin" ? "/admin/routes" : isPassenger ? "/user/route" : "/driver/routes"}>{isPassenger ? "Volver a mi recorrido" : role === "admin" ? "Volver a rutas" : "Volver a mis rutas"}</Link></div>
      </main>
    </div>
  );
}

function elapsedLabel(start, end) {
  const duration = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 60000));
  if (!Number.isFinite(duration)) return "Sin registro";
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

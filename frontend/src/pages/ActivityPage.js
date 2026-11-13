import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentActivity } from "../services/dashboard";
import Sidebar from "../components/dashboard/Sidebar";

function getActivityKind(title = "") {
  const text = title.toLocaleLowerCase("es-CO");
  if (text.includes("usuario")) return "account";
  if (text.includes("ruta")) return "route";
  if (text.includes("tracking") || text.includes("ubicación")) return "signal";
  return "general";
}

function ActivityIcon({ kind }) {
  if (kind === "account") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c2-4 14-4 16 0"/></svg>;
  if (kind === "route") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h2a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4"/></svg>;
  if (kind === "signal") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>;
}

function formatActivityTime(item) {
  if (!item.created_at) return item.time || "Reciente";
  const date = new Date(item.created_at);
  return Number.isNaN(date.getTime()) ? item.time || "Reciente" : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export default function ActivityPage({ role, onLogout }) {
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    getRecentActivity()
      .then((data) => { if (active) setActivities(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) { setActivities([]); setLoadError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredActivities = useMemo(() => [...activities]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .filter((item) => `${item.title || ""} ${item.action || ""} ${item.description || ""} ${item.detail || ""}`
      .toLocaleLowerCase("es-CO").includes(search.trim().toLocaleLowerCase("es-CO"))), [activities, search]);

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="vt-activity-page">
        <div className="vt-activity-content">
          <header className="vt-activity-heading">
            <div><p className="vt-activity-eyebrow">Actividad de la plataforma</p><h1>Historial de actividad</h1><p>Revisa los movimientos recientes registrados en Vialtros.</p></div>
            <Link to="/dashboard" className="vt-activity-back">Volver al panel</Link>
          </header>

          <label className="vt-activity-search-wrap">
            <span aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></span>
            <input type="search" placeholder="Buscar por ruta, usuario o movimiento" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar actividad" />
          </label>

          <section className="vt-activity-list" aria-labelledby="vt-activity-list-title">
            <header className="vt-activity-list-heading"><div><h2 id="vt-activity-list-title">Movimientos recientes</h2><p>Eventos ordenados desde el más reciente.</p></div><span>{filteredActivities.length} registros</span></header>
            {loading ? <p className="vt-activity-empty" role="status">Cargando actividad…</p>
              : loadError ? <p className="vt-activity-empty" role="alert">No se pudo cargar la actividad. Comprueba tu conexión y vuelve a intentarlo.</p>
                : filteredActivities.length === 0 ? <p className="vt-activity-empty">{search ? "No encontramos movimientos con ese criterio." : "Aún no hay movimientos registrados."}</p>
                  : <ol className="vt-activity-rows">
                    {filteredActivities.map((item, index) => {
                      const kind = getActivityKind(item.title || item.action || "");
                      return <li className="vt-activity-row" key={item.id || `${item.created_at || "activity"}-${index}`}>
                        <span className={`vt-activity-icon is-${kind}`}><ActivityIcon kind={kind} /></span>
                        <div className="vt-activity-copy"><h3>{item.title || item.action || "Actividad registrada"}</h3><p>{item.description || item.detail || "Movimiento del sistema"}</p></div>
                        <time dateTime={item.created_at || undefined}>{formatActivityTime(item)}</time>
                      </li>;
                    })}
                  </ol>}
          </section>
        </div>
      </main>
    </div>
  );
}

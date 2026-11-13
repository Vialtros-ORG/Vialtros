import React from "react";
import { icons } from "./icons";
import { Link } from "react-router-dom";
import "./dashboard-activity.css";

const colorMap = {
  emerald: "live",
  blue: "route",
  orange: "attention",
  red: "attention",
};

function formatRelativeTime(value) {
  if (!value) return "Sin hora";

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Sin hora";

  const diffMs = Date.now() - timestamp.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return timestamp.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
}

function getEmptyMessage(role) {
  if (role === "admin")
    return "Aún no hay actividad reciente del sistema para mostrar.";
  if (role === "driver")
    return "Aún no hay novedades recientes en tus rutas asignadas.";
  return "Aún no hay novedades recientes en tu ruta asignada.";
}

export default function ActivityFeed({
  activities = [],
  loading = false,
  role = "user",
}) {
  return (
    <section
      className="vt-dashboard-activity"
      aria-labelledby="vt-dashboard-activity-title"
    >
      <div className="vt-dashboard-activity-head">
        <div>
          <h3 id="vt-dashboard-activity-title">
            Actividad reciente
          </h3>
          <p>
            Movimientos destacados de la jornada
          </p>
        </div>
        <span className="vt-dashboard-activity-today">Hoy</span>
      </div>

      <div className="vt-dashboard-activity-list">
        {loading ? (
          <div className="vt-dashboard-activity-message" role="status">
            Cargando actividad reciente...
          </div>
        ) : activities.length === 0 ? (
          <div className="vt-dashboard-activity-message">
            {getEmptyMessage(role)}
          </div>
        ) : (
          activities.map((activity) => {
            const tone = colorMap[activity.tone] || "route";
            const Icon = icons[activity.icon] || icons.activity;
            return (
              <div
                key={activity.id}
                className="vt-dashboard-activity-row"
              >
                <span className={`vt-dashboard-activity-icon is-${tone}`}>
                  <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <div className="vt-dashboard-activity-copy">
                  <p className="vt-dashboard-activity-title">{activity.title}</p>
                  <p className="vt-dashboard-activity-subtitle">{activity.subtitle}</p>
                </div>
                <span className="vt-dashboard-activity-time">
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="vt-dashboard-activity-footer">
        <Link
          to="/activity"
          className="vt-dashboard-activity-link"
        >
          Ver todo el historial
          {icons.arrowRight({ size: 13, strokeWidth: 2.4 })}
        </Link>
    </div>
    </section>
  );
}

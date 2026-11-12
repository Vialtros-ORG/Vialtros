import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import StatCard from "../components/dashboard/StatCard";
import HeroCard from "../components/dashboard/HeroCard";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import {
  getDashboardStats,
  getDriverAssignedRoutes,
  getRecentActivity,
  getWeeklyActivity,
} from "../services/dashboard";
import { icons } from "../components/dashboard/icons";
import "../components/dashboard/dashboard-home.css";

const EMPTY_WEEKLY_ACTIVITY = [
  { day: "L", value: 0 },
  { day: "M", value: 0 },
  { day: "X", value: 0 },
  { day: "J", value: 0 },
  { day: "V", value: 0 },
  { day: "S", value: 0 },
  { day: "D", value: 0 },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function DashboardReveal({ children, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.12, rootMargin: "0px 0px -28px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`vt-dashboard-reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}>{children}</div>;
}

// Funciones eliminadas: formatDate, getInitials, getPassengerStatusConfig no se utilizan actualmente


function buildDashboardContent({
  role,
  loading,
  stats,
  driverRoutesCount,
  totalAssignedStudents,
}) {
  if (role === "admin") {
    return {
      metricCards: [
        {
          icon: icons.routes,
          value: loading ? "—" : (stats?.routes ?? 0),
          label: "Rutas activas",
          color: "blue",
          trend: "up",
          trendLabel: "Operativas",
        },
        {
          icon: icons.drivers,
          value: loading ? "—" : (stats?.vehicles ?? 0),
          label: "Vehículos",
          color: "green",
          trendLabel: "Disponibles",
        },
        {
          icon: icons.tracking,
          value: loading ? "—" : (stats?.trackings ?? 0),
          label: "Tracking activos",
          color: "purple",
          trend: "up",
          trendLabel: "En vivo",
        },
      ],
    };
  }

  if (role === "driver") {
    return {
      metricCards: [
        { icon: icons.routes, value: driverRoutesCount, label: "Rutas asignadas", color: "blue", trend: "up", trendLabel: "Tu jornada" },
        { icon: icons.clipboard, value: totalAssignedStudents, label: "Estudiantes asignados", color: "green", trendLabel: "Lista actual" },
        { icon: icons.tracking, value: loading ? "—" : (stats?.trackings ?? 0), label: "Tracking activos", color: "purple", trend: "up", trendLabel: "En vivo" },
      ],
    };
  }

  return {
    metricCards: [
      { icon: icons.routes, value: loading ? "—" : (stats?.routes ?? 0), label: "Rutas activas", color: "blue", trend: "up", trendLabel: "+2 hoy" },
      { icon: icons.users, value: loading ? "—" : (stats?.users ?? 0), label: "Usuarios registrados", color: "green" },
      { icon: icons.tracking, value: loading ? "—" : "1", label: "Ruta vinculada", color: "purple", trend: "up", trendLabel: "Asignada" },
    ],
  };
}

export default function DashboardPage({ role, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverRoutes, setDriverRoutes] = useState([]);
  const [weeklyActivity, setWeeklyActivity] = useState(EMPTY_WEEKLY_ACTIVITY);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(true);

  const usernameRaw = localStorage.getItem("username") || "Usuario";
  const username =
    usernameRaw.charAt(0).toUpperCase() + usernameRaw.slice(1).toLowerCase();
  const roleLabel = { admin: "Administrador", driver: "Conductor", user: "Pasajero" }[role] || "Usuario";

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshWeeklyActivity = useCallback(async () => {
    try {
      const activity = await getWeeklyActivity();
      setWeeklyActivity(
        Array.isArray(activity) && activity.length > 0
          ? activity
          : EMPTY_WEEKLY_ACTIVITY,
      );
      return activity;
    } catch {
      setWeeklyActivity(EMPTY_WEEKLY_ACTIVITY);
      return [];
    }
  }, []);

  const refreshRecentActivity = useCallback(async () => {
    setRecentActivityLoading(true);
    try {
      const activity = await getRecentActivity();
      setRecentActivity(Array.isArray(activity) ? activity : []);
      return activity;
    } catch {
      setRecentActivity([]);
      return [];
    } finally {
      setRecentActivityLoading(false);
    }
  }, []);


  useEffect(() => {
    void refreshWeeklyActivity();
  }, [refreshWeeklyActivity, role]);

  useEffect(() => {
    void refreshRecentActivity();
  }, [refreshRecentActivity, role]);

  useEffect(() => {
    if (role !== "driver") return;

    getDriverAssignedRoutes()
      .then(setDriverRoutes)
      .catch(() => setDriverRoutes([]))
      .finally(() => {}); // Removed driverRoutesLoading
  }, [role]);



  const totalAssignedStudents = driverRoutes.reduce(
    (total, route) =>
      total + (route.passenger_count ?? route.passenger_details?.length ?? 0),
    0,
  );

  const maxWeeklyValue = Math.max(
    ...weeklyActivity.map((item) => item.value),
    1,
  );
  const { metricCards } = useMemo(
    () =>
      buildDashboardContent({
        role,
        loading,
        stats,
        driverRoutesCount: driverRoutes.length,
        totalAssignedStudents,
      }),
    [
      role,
      loading,
      stats,
      driverRoutes.length,
      totalAssignedStudents,
    ],
  );

  return (
  <div className="vt-dashboard-page min-h-screen flex">
    <Sidebar role={role} onLogout={onLogout} />

    <main className="vt-dashboard-main">
      <section className="vt-dashboard-heading">
        <h1>
          {getGreeting()}, <span>{username}</span>
        </h1>
        <p>Panel de control <span aria-hidden="true">·</span> {roleLabel}</p>
      </section>

      <DashboardReveal className="vt-dashboard-stats-reveal">
        <div className="vt-dashboard-stats-grid">
          {metricCards.map((card) => (
            <StatCard
              key={card.label}
              icon={card.icon}
              value={card.value}
              label={card.label}
              color={card.color}
              trend={card.trend}
              trendLabel={card.trendLabel}
            />
          ))}
        </div>
      </DashboardReveal>

      <div className="vt-dashboard-content-grid">
        <div className="vt-dashboard-primary-column">
          <DashboardReveal className="vt-dashboard-reveal--panel">
            <HeroCard role={role} />
          </DashboardReveal>

          <DashboardReveal className="vt-dashboard-reveal--panel">
            <section className="vt-dashboard-weekly" aria-labelledby="vt-dashboard-weekly-title">
              <div className="vt-dashboard-weekly-heading">
                <div>
                  <h3 id="vt-dashboard-weekly-title">
                    Actividad semanal
                  </h3>
                  <p>
                    Últimos 7 días de seguimiento registrado
                  </p>
                </div>

                <span className="vt-dashboard-weekly-chip">
                  Datos reales
                </span>
              </div>

              <div className="vt-dashboard-weekly-chart" role="list" aria-label="Señales de seguimiento durante los últimos siete días">
                {weeklyActivity.map((item) => {
                  const value = Math.max(0, Number(item.value) || 0);
                  const height = `${(value / maxWeeklyValue) * 100}%`;

                  return (
                    <div key={item.day} className="vt-dashboard-weekly-day" role="listitem">
                      <span className="vt-dashboard-weekly-value">
                        {value}
                      </span>
                      <div className="vt-dashboard-weekly-track" role="img" aria-label={`${item.day}: ${value} señales`}>
                        <div
                          className={`vt-dashboard-weekly-fill${value === 0 ? " is-zero" : ""}`}
                          style={{ height: value === 0 ? "2px" : height }}
                        />
                      </div>
                      <span className="vt-dashboard-weekly-day-label">
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </DashboardReveal>
        </div>

        <DashboardReveal className="vt-dashboard-feed-column">
          <ActivityFeed activities={recentActivity} loading={recentActivityLoading} role={role} />
        </DashboardReveal>
      </div>
    </main>
  </div>
);
}

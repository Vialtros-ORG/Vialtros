import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { icons } from "./icons";
import { Logo } from "../Logo";
import useTrackingRoute from "./useTrackingRoute";
import { useAppTheme } from "../../context/ThemeContext";

export default function Sidebar({ role, onLogout }) {
  const location = useLocation();
  const { resolvedTheme } = useAppTheme();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const { trackingLink, trackingEnabled } = useTrackingRoute(role);
  const username = localStorage.getItem("username") || "Usuario";
  const roleLabel = { admin: "Administrador", driver: "Conductor", user: "Pasajero" }[role] || "Usuario";

  const navItems = [
    { to: "/dashboard", icon: icons.dashboard, label: "Inicio" },
    ...(role === "admin" ? [
      { to: "/admin/routes", icon: icons.routes, label: "Rutas" },
      { to: "/admin/drivers", icon: icons.drivers, label: "Conductores" },
      { to: "/admin/passengers", icon: icons.clipboard, label: "Estudiantes" },
      { to: "/admin/users", icon: icons.users, label: "Usuarios" },
    ] : []),
    ...(role === "driver" ? [{ to: "/driver/routes", icon: icons.routes, label: "Mis rutas" }] : []),
    ...(role === "user" ? [{ to: "/user/route", icon: icons.routes, label: "Mi recorrido" }] : []),
    ...(trackingEnabled ? [{ to: trackingLink, icon: icons.tracking, label: "Mapa en vivo" }] : []),
    { to: "/history", icon: icons.activity, label: "Historial" },
  ];

  const isActive = (to) => to.startsWith("/tracking")
    ? location.pathname.startsWith("/tracking")
    : location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(`${to}/`));

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeOutside = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  return (
    <>
      <aside className="vt-sidebar">
        <Link to="/dashboard" className="vt-sidebar-brand" aria-label="Ir al inicio del panel">
          <Logo variant={resolvedTheme === "dark" ? "light" : "default"} iconSize={31} />
        </Link>
        <nav className="vt-sidebar-nav" aria-label="Navegación principal">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = isActive(to);
            return (
              <Link key={to} to={to} aria-current={active ? "page" : undefined} className={`vt-nav-link${active ? " is-active" : ""}`}>
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                <span>{label}</span>
                {active && <span className="vt-nav-indicator" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>
        <div className="vt-sidebar-account" ref={accountMenuRef}>
          <button type="button" className="vt-account-settings" aria-controls="vt-account-menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}>
            <span className="vt-account-avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span>
            <span className="vt-account-copy"><strong>{username}</strong><small>{roleLabel}</small></span>
            <span className="vt-account-menu-caret" aria-hidden="true">⌃</span>
          </button>
          {accountMenuOpen && <nav id="vt-account-menu" className="vt-account-menu" aria-label="Opciones de cuenta">
            <div className="vt-account-menu-profile">
              <span className="vt-account-avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span>
              <span><strong>{username}</strong><small>{roleLabel}</small></span>
            </div>
            <Link to="/profile" aria-current={location.pathname === "/profile" ? "page" : undefined} onClick={() => setAccountMenuOpen(false)}><icons.profile size={17} aria-hidden="true"/><span>Ver perfil</span></Link>
            <Link to="/settings" onClick={() => setAccountMenuOpen(false)}><icons.settings size={17} aria-hidden="true"/><span>Configuración</span></Link>
            <button type="button" className="vt-account-logout" onClick={() => { setAccountMenuOpen(false); onLogout?.(); }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg><span>Cerrar sesión</span></button>
          </nav>}
        </div>
      </aside>
      <nav className="vt-mobile-nav" aria-label="Navegación móvil">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = isActive(to);
          return <Link key={to} to={to} aria-current={active ? "page" : undefined} className={`vt-mobile-nav-link${active ? " is-active" : ""}`}><Icon size={19} strokeWidth={1.9} aria-hidden="true"/><span>{label === "Inicio" ? "Inicio" : label === "Mapa en vivo" ? "Mapa" : label === "Compartir ubicación" ? "Ubicación" : label}</span></Link>;
        })}
        <Link to="/settings" aria-current={location.pathname.startsWith("/settings") ? "page" : undefined} className={`vt-mobile-nav-link${location.pathname.startsWith("/settings") ? " is-active" : ""}`}><icons.settings size={19} strokeWidth={1.9} aria-hidden="true"/><span>Ajustes</span></Link>
        <button type="button" className="vt-mobile-nav-link" onClick={onLogout} aria-label="Cerrar sesión"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg><span>Salir</span></button>
      </nav>
    </>
  );
}

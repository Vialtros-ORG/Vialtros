import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdLocationOn, MdNotificationsActive } from "react-icons/md";
import Sidebar from "../components/dashboard/Sidebar";
import { useAppTheme } from "../context/ThemeContext";

const THEME_OPTIONS = [
  { id: "light", label: "Claro", detail: "Fondo luminoso" },
  { id: "dark", label: "Oscuro", detail: "Menos luz en pantalla" },
  { id: "system", label: "Sistema", detail: "Sigue tu dispositivo" },
];

function permissionLabel(permission) {
  if (permission === "granted") return "Permitido en este sitio";
  if (permission === "denied") return "Bloqueado por el navegador";
  if (permission === "unsupported") return "No disponible en este navegador";
  if (permission === "checking") return "Consultando estado…";
  return "Aún no solicitado";
}

export default function SettingsScreen({ role, onLogout }) {
  const navigate = useNavigate();
  const { preference, setTheme } = useAppTheme();
  const [locationPermission, setLocationPermission] = useState("checking");
  const [notificationPermission, setNotificationPermission] = useState("checking");
  const [permissionMessage, setPermissionMessage] = useState("");
  const [requestingLocation, setRequestingLocation] = useState(false);

  useEffect(() => {
    let active = true;
    let locationStatus;
    const handleStatusChange = () => {
      if (active && locationStatus) setLocationPermission(locationStatus.state);
    };
    if (!navigator.geolocation) setLocationPermission("unsupported");
    else if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "geolocation" }).then((status) => {
        if (!active) return;
        locationStatus = status;
        setLocationPermission(status.state);
        status.addEventListener?.("change", handleStatusChange);
      }).catch(() => { if (active) setLocationPermission("prompt"); });
    } else setLocationPermission("prompt");

    setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
    return () => {
      active = false;
      locationStatus?.removeEventListener?.("change", handleStatusChange);
    };
  }, []);

  const requestLocationPermission = () => {
    if (!navigator.geolocation) return setLocationPermission("unsupported");
    setPermissionMessage("");
    setRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      () => { setLocationPermission("granted"); setRequestingLocation(false); },
      (error) => {
        const denied = error.code === 1;
        setLocationPermission(denied ? "denied" : "prompt");
        setPermissionMessage(denied
          ? "El navegador bloqueó el acceso. Cámbialo desde los permisos del sitio en tu navegador."
          : "No se pudo obtener la ubicación. Revisa los permisos y vuelve a intentarlo.");
        setRequestingLocation(false);
      },
      { maximumAge: 0, timeout: 10000, enableHighAccuracy: false },
    );
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return setNotificationPermission("unsupported");
    setPermissionMessage("");
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "denied") setPermissionMessage("El navegador bloqueó los avisos. Puedes habilitarlos desde los permisos del sitio.");
    } catch {
      setPermissionMessage("No se pudo solicitar este permiso en el navegador actual.");
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="vt-settings-page">
        <header className="vt-settings-heading">
          <div>
            <p className="vt-settings-eyebrow">Preferencias de la aplicación</p>
            <h1>Ajustes</h1>
            <p>Configura la apariencia y los permisos de este dispositivo.</p>
          </div>
          <button className="vt-settings-back" type="button" onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/dashboard")}>
            <span aria-hidden="true">←</span> Volver
          </button>
        </header>

        <div className="vt-settings-layout">
          <section className="vt-settings-section vt-theme-section" id="apariencia" aria-labelledby="vt-theme-title">
            <div className="vt-settings-section-heading">
              <div><h2 id="vt-theme-title">Apariencia</h2><p>Elige cómo quieres ver Vialtros.</p></div>
            </div>
            <div className="vt-theme-options" role="group" aria-label="Tema de la aplicación">
              {THEME_OPTIONS.map((option) => (
                <button key={option.id} type="button" className={`vt-theme-option${preference === option.id ? " is-selected" : ""}`} aria-pressed={preference === option.id} onClick={() => setTheme(option.id)}>
                  <span className={`vt-theme-preview theme-${option.id}`} aria-hidden="true"><i /><i /><i /></span>
                  <span className="vt-theme-option-copy"><strong>{option.label}</strong><small>{option.detail}</small></span>
                  <span className="vt-theme-radio" aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="vt-theme-note">La opción Sistema se actualiza cuando cambia el tema de tu dispositivo.</p>
          </section>

          <section className="vt-settings-section vt-permissions-section" id="permisos" aria-labelledby="vt-permissions-title">
            <div className="vt-settings-section-heading">
              <div><h2 id="vt-permissions-title">Permisos del dispositivo</h2><p>Vialtros solo los solicita cuando usas una función que los necesita.</p></div>
            </div>
            <div className="vt-permission-row">
              <div className="vt-permission-icon" aria-hidden="true"><MdLocationOn /></div>
              <div className="vt-permission-copy"><strong>Ubicación</strong><span>{permissionLabel(locationPermission)}</span></div>
              <button className="vt-settings-edit" type="button" onClick={requestLocationPermission} disabled={requestingLocation || locationPermission === "unsupported"}>{requestingLocation ? "Solicitando…" : locationPermission === "granted" ? "Comprobar acceso" : "Permitir ubicación"}</button>
            </div>
            <div className="vt-permission-row">
              <div className="vt-permission-icon" aria-hidden="true"><MdNotificationsActive /></div>
              <div className="vt-permission-copy"><strong>Notificaciones</strong><span>{permissionLabel(notificationPermission)}</span></div>
              <button className="vt-settings-edit" type="button" onClick={requestNotificationPermission} disabled={notificationPermission === "unsupported" || notificationPermission === "granted"}>{notificationPermission === "granted" ? "Activadas" : "Permitir avisos"}</button>
            </div>
            {permissionMessage && <p className="vt-settings-message" role="status">{permissionMessage}</p>}
            <p className="vt-theme-note">Si el navegador ya bloqueó un permiso, cámbialo desde la información del sitio en la barra de direcciones.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

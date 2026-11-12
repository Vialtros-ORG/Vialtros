// Página de login con JWT
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogoIcon } from "../components/Logo";
import "./LoginPage.css";
import api from "../services/api";
import {
  ensureLocalAccessSession,
  isLocalAccessEnabled,
  isAuthenticated,
  getCurrentUser,
  saveUserCache,
} from "../services/auth";

const LOGIN_FEATURES = [
  "Ubicación en tiempo real del vehículo",
  "Notificaciones de llegada y salida",
  "Historial de rutas completadas",
];

/* ── Iconos inline ── */
const IconUser = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconLock = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconEye = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  const finishLogin = useCallback(
    (nextUsername) => {
      if (nextUsername) {
        localStorage.setItem("username", nextUsername);
      }

      if (onLogin) {
        onLogin();
      }

      navigate("/dashboard", { replace: true });
    },
    [navigate, onLogin],
  );

  useEffect(() => {
    if (isAuthenticated()) {
      if (onLogin) {
        onLogin();
      }
      navigate("/dashboard", { replace: true });
      return;
    }

    if (!isLocalAccessEnabled()) return;

    ensureLocalAccessSession();
    const localUsername = localStorage.getItem("username") || "Invitado";
    localStorage.setItem("username", localUsername);

    if (onLogin) {
      onLogin();
    }

    navigate("/dashboard", { replace: true });
  }, [navigate, onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
  setError("Ingresa tu nombre de usuario");
  setLoading(false);
  return;
}
    try {
      const res = await api.post("/token/", {
        username: normalizedUsername,
        password,
      });
      localStorage.setItem("access", res.data.access);
      localStorage.setItem("refresh", res.data.refresh);
      localStorage.removeItem("role");
      // Pre-cargar datos del usuario en caché para que el perfil cargue instantáneo
      getCurrentUser().then((u) => { if (u) saveUserCache(u); });
      finishLogin(normalizedUsername);
    } catch (err) {
      if (isLocalAccessEnabled()) {
        ensureLocalAccessSession({
          username: normalizedUsername || username || "Invitado",
        });
        finishLogin(normalizedUsername || username || "Invitado");
        return;
      }

      if (err?.response?.status === 401) {
        setError("Usuario o contraseña incorrectos");
      } else {
        setError(
          "No se pudo conectar con el servidor. Verifica que el backend esté iniciado.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vt-login">
      {/* ── Panel izquierdo: branding ── */}
      <section className="vt-login-story" aria-label="Seguimiento de rutas">
        <svg className="vt-login-route" viewBox="0 0 900 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path className="vt-login-route-glow" d="M-80 590 C130 530 155 390 350 410 S545 525 620 340 760 190 980 110" />
          <path className="vt-login-route-line" d="M-80 590 C130 530 155 390 350 410 S545 525 620 340 760 190 980 110" />
          <circle cx="350" cy="410" r="9" />
          <circle cx="620" cy="340" r="9" />
          <circle cx="760" cy="190" r="13" />
        </svg>

        {/* Logo */}
        <Link to="/" className="vt-login-brand" aria-label="Ir al inicio de Vialtros" title="Ir al inicio">
          <LogoIcon size={46} color="#3FB3C2" />
          <span>Vialtros</span>
        </Link>

        {/* Copy central */}
        <div className="vt-login-story-copy">
          <p className="vt-login-kicker">Vialtros · transporte escolar</p>
          <h1>
            Cada ruta,<br />
            <span>siempre a la vista.</span>
          </h1>
          <p className="vt-login-description">
            Consulta dónde va el vehículo y cuándo llegará, desde cualquier dispositivo.
          </p>

          {/* Feature chips */}
          <ul className="vt-login-features">
            {LOGIN_FEATURES.map((feature) => (
              <li key={feature}>
                <span className="vt-login-check">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <span className="vt-login-story-foot">Seguimiento claro para cada trayecto.</span>
      </section>

      {/* ── Panel derecho: formulario ── */}
      <main className="vt-login-panel">
        {/* Logo solo en móvil */}
        <Link to="/" className="vt-login-mobile-brand" aria-label="Ir al inicio de Vialtros" title="Ir al inicio">
          <LogoIcon size={38} color="#0B6E80" />
          <span>Vialtros</span>
        </Link>

        <div className="vt-login-form-wrap">
          <Link to="/" className="vt-login-back">
            <span aria-hidden="true">←</span> Volver al inicio
          </Link>
          {resetSuccess && (
            <div className="vt-login-notice">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Contraseña actualizada correctamente. Inicia sesión.
            </div>
          )}

          <h2>
            Iniciar sesión
          </h2>
          <p className="vt-login-form-hint">
            Ingresa tus credenciales para continuar.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Campo usuario */}
            <div className="vt-login-field">
              <label htmlFor="login-username">
                Usuario
              </label>
              <div className="vt-login-input-wrap">
                <span className="vt-login-input-icon" aria-hidden="true">
                  <IconUser />
                </span>
                <input
                  id="login-username"
                  className="vt-login-input"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) => {
  setUsername(e.target.value);
  setError("");
}}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Campo contraseña */}
            <div className="vt-login-field">
              <label htmlFor="login-password">
                Contraseña
              </label>
              <div className="vt-login-input-wrap">
                <span className="vt-login-input-icon" aria-hidden="true">
                  <IconLock />
                </span>
                <input
                  id="login-password"
                  className="vt-login-input vt-login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
  setPassword(e.target.value);
  setError("");
}}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="vt-login-eye"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
  role="alert"
  aria-live="polite"
  className="vt-login-error"
>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="vt-login-submit"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-2a8 8 0 01-8-8z"
                    />
                  </svg>
                  Verificando...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </form>

          <div className="text-center mt-4">
            <Link
              to="/forgot-password"
              className="vt-login-forgot"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

// App principal con rutas protegidas y flujo de login/logout
import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import "./App.css";
import {
  getCurrentUser,
  clearSession,
  ensureLocalAccessSession,
  isLocalAccessEnabled,
} from "./services/auth";
import { NotificationProvider } from "./context/NotificationContext";
import { GoogleMapsProvider } from "./context/GoogleMapsContext";
import NotificationToast from "./components/notifications/NotificationToast";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import TrackingPage from "./pages/TrackingPage";
import DashboardPage from "./pages/DashboardPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminDriversPage from "./pages/AdminDriversPage";
import AdminRoutesPage from "./pages/AdminRoutesPage";
import AdminPassengersPage from "./pages/AdminPassengersPage";
import UserRoutePage from "./pages/UserRoutePage";
import DriverRoutesPage from "./pages/DriverRoutesPage";
import DriverLocationPage from "./pages/DriverLocationPage";
import LandingPage from "./pages/LandingPage";
import PrivateRoute from "./components/PrivateRoute";
import ActivityPage from "./pages/ActivityPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import SupportPage from "./pages/SupportPage";
import ProfileScreen from "./pages/ProfileScreen";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useAppTheme } from "./context/ThemeContext";
import RouteHistoryPage from "./pages/RouteHistoryPage";
import SettingsScreen from "./pages/SettingsScreen";
import RouteReportPage from "./pages/RouteReportPage";

const PANEL_ROUTE_PATTERN = /^\/(dashboard|admin|user|driver|tracking|history|activity|settings|profile|routes)(\/|$)/;

function PanelRouteTransition({ children }) {
  const { pathname } = useLocation();
  const containerRef = useRef(null);
  const previousPathRef = useRef(pathname);

  useLayoutEffect(() => {
    const previousPath = previousPathRef.current;
    previousPathRef.current = pathname;

    if (previousPath === pathname || !PANEL_ROUTE_PATTERN.test(previousPath) || !PANEL_ROUTE_PATTERN.test(pathname)) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    container.classList.remove("is-entering");
    const frameId = window.requestAnimationFrame(() => container.classList.add("is-entering"));
    const timeoutId = window.setTimeout(() => container.classList.remove("is-entering"), 280);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [pathname]);

  return <div ref={containerRef} className="vt-panel-route-transition">{children}</div>;
}

function App() {
  const { resolvedTheme } = useAppTheme();
  const [isAuth, setIsAuth] = useState(() => {
    const token = localStorage.getItem("access");
    if (token) return true;
    return ensureLocalAccessSession();
  });
  const [role, setRole] = useState(
    () =>
      localStorage.getItem("role") || (isLocalAccessEnabled() ? "admin" : null),
  );

  useEffect(() => {
    if (isAuth) {
      getCurrentUser()
        .then((user) => {
          if (user && user.role) {
            setRole(user.role);
            localStorage.setItem("role", user.role);
          } else {
            clearSession();
            setIsAuth(false);
            setRole(null);
          }
        })
        .catch(() => {
          clearSession();
          setIsAuth(false);
          setRole(null);
        });
    } else {
      setRole(null);
      localStorage.removeItem("role");
    }
  }, [isAuth]);

  const handleLogin = useCallback(() => setIsAuth(true), []);

  const handleLogout = () => {
    clearSession();

    if (ensureLocalAccessSession()) {
      setIsAuth(true);
      setRole(localStorage.getItem("role") || "admin");
      return;
    }

    setIsAuth(false);
    setRole(null);
  };

  return (
    <GoogleMapsProvider>
    <NotificationProvider isAuth={isAuth} role={role}>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="vialtros-app" data-theme={resolvedTheme}>
        <div className="vialtros-app-content">
          <div className="flex-1">
          <PanelRouteTransition>
          <Routes>
            <Route
              path="/activity"
              element={
                <PrivateRoute>
                  <ActivityPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/history"
              element={
                <PrivateRoute>
                  <RouteHistoryPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/login"
              element={
                isAuth ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LoginPage onLogin={handleLogin} />
                )
              }
            />
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/tracking"
              element={
                <PrivateRoute>
                  <TrackingPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/tracking/:routeId"
              element={
                <PrivateRoute>
                  <TrackingPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <PrivateRoute>
                  <AdminUsersPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/drivers"
              element={
                <PrivateRoute>
                  <AdminDriversPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/routes"
              element={
                <PrivateRoute>
                  <AdminRoutesPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/passengers"
              element={
                <PrivateRoute>
                  <AdminPassengersPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/user/route"
              element={
                <PrivateRoute>
                  <UserRoutePage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/driver/routes"
              element={
                <PrivateRoute>
                  <DriverRoutesPage onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/driver/location"
              element={
                <PrivateRoute>
                  <DriverLocationPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/settings" element={<PrivateRoute><SettingsScreen role={role} onLogout={handleLogout} /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfileScreen role={role} onLogout={handleLogout} /></PrivateRoute>} />
            <Route path="/routes/:routeId/report" element={<PrivateRoute><RouteReportPage role={role} onLogout={handleLogout} /></PrivateRoute>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route
              path="*"
              element={<Navigate to={isAuth ? "/dashboard" : "/"} />}
            />
          </Routes>
          </PanelRouteTransition>
          </div>
        </div>
      </div>
    </Router>
    {role !== "admin" && <NotificationToast />}
    </NotificationProvider>
    </GoogleMapsProvider>
  );
}

export default App;

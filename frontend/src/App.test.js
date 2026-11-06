import React, { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import {
  clearSession,
  ensureLocalAccessSession,
  getCurrentUser,
} from "./services/auth";

jest.mock("./services/auth", () => ({
  clearSession: jest.fn(),
  ensureLocalAccessSession: jest.fn(() => false),
  getCurrentUser: jest.fn(),
  isLocalAccessEnabled: jest.fn(() => false),
}));
jest.mock("./context/NotificationContext", () => ({
  NotificationProvider: ({ children }) => children,
}));
jest.mock("./context/GoogleMapsContext", () => ({
  GoogleMapsProvider: ({ children }) => children,
}));
jest.mock("./components/notifications/NotificationToast", () => () => (
  <div>Notificaciones</div>
));
jest.mock("./components/Logo", () => ({ Logo: () => <span>Vialtros</span> }));
jest.mock("./components/Footer", () => () => <footer>Footer</footer>);
jest.mock("./components/PrivateRoute", () => ({ children }) => children);
jest.mock("./pages/LoginPage", () => ({ onLogin }) => (
  <button onClick={onLogin}>Iniciar sesión</button>
));
jest.mock("./pages/LandingPage", () => () => <div>Inicio público</div>);
jest.mock("./pages/TrackingPage", () => () => <div>Tracking</div>);
jest.mock("./pages/DashboardPage", () => () => <div>Dashboard</div>);
jest.mock("./pages/AdminUsersPage", () => () => <div>Usuarios</div>);
jest.mock("./pages/AdminDriversPage", () => () => <div>Conductores</div>);
jest.mock("./pages/AdminRoutesPage", () => () => <div>Rutas</div>);
jest.mock("./pages/AdminPassengersPage", () => () => <div>Estudiantes</div>);
jest.mock("./pages/UserRoutePage", () => () => <div>Ruta personal</div>);
jest.mock("./pages/DriverRoutesPage", () => () => <div>Rutas del conductor</div>);
jest.mock("./pages/DriverLocationPage", () => () => <div>Ubicación del conductor</div>);
jest.mock("./pages/ActivityPage", () => () => <div>Actividad</div>);
jest.mock("./pages/PrivacyPage", () => () => <div>Privacidad</div>);
jest.mock("./pages/TermsPage", () => () => <div>Términos</div>);
jest.mock("./pages/SupportPage", () => () => <div>Soporte</div>);
jest.mock("./pages/ProfileScreen", () => () => <div>Perfil</div>);
jest.mock("./pages/ForgotPasswordPage", () => () => <div>Recuperar contraseña</div>);
jest.mock("./pages/ResetPasswordPage", () => () => <div>Restablecer contraseña</div>);
jest.mock("react-router-dom", () => {
  const ReactModule = require("react");
  function Route() {
    return null;
  }
  function Routes({ children }) {
    const routes = ReactModule.Children.toArray(children);
    const pathname = globalThis.window.location.pathname;
    const route = routes.find(({ props }) =>
      props.path === pathname || props.path === "*",
    );
    return route?.props.element || null;
  }
  return {
    BrowserRouter: ({ children }) => children,
    Link: ({ to, children }) => <a href={to}>{children}</a>,
    Navigate: () => <div>Redirigiendo</div>,
    Route,
    Routes,
  };
}, { virtual: true });

describe("App authentication gate", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    getCurrentUser.mockResolvedValue({ role: "user" });
    clearSession.mockImplementation(() => {
      localStorage.clear();
    });
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    jest.clearAllMocks();
  });

  async function render() {
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  test("shows the public landing page without a session", async () => {
    await render();
    expect(container.textContent).toContain("Inicio público");
    expect(container.textContent).toContain("Footer");
    expect(container.textContent).not.toContain("Validando sesión");
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  test("waits for the current user before rendering authenticated routes", async () => {
    localStorage.setItem("access", "valid-token");
    let resolveUser;
    getCurrentUser.mockReturnValueOnce(new Promise((resolve) => {
      resolveUser = resolve;
    }));

    await render();
    expect(container.textContent).toContain("Validando sesión...");
    expect(container.textContent).toContain("Cerrar sesión");
    expect(container.textContent).not.toContain("Notificaciones");

    await act(async () => {
      resolveUser({ role: "driver" });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Inicio público");
    expect(container.textContent).toContain("Notificaciones");
    expect(localStorage.getItem("role")).toBe("driver");
  });

  test("clears an invalid session and resolves the gate after an API error", async () => {
    localStorage.setItem("access", "expired-token");
    getCurrentUser.mockRejectedValueOnce(new Error("unauthorized"));
    await render();

    expect(clearSession).toHaveBeenCalled();
    expect(container.textContent).toContain("Inicio público");
    expect(container.textContent).not.toContain("Validando sesión");
  });

  test("starts authentication from the login page and shows the pending gate", async () => {
    window.history.replaceState({}, "", "/login");
    let resolveUser;
    getCurrentUser.mockReturnValueOnce(new Promise((resolve) => {
      resolveUser = resolve;
    }));
    await render();

    act(() => {
      [...container.querySelectorAll("button")].find((button) =>
        button.textContent.includes("Iniciar sesión"),
      ).click();
    });
    expect(container.textContent).toContain("Validando sesión...");

    await act(async () => {
      resolveUser({ role: "user" });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Redirigiendo");
    expect(container.textContent).toContain("Notificaciones");
  });

  test("keeps local access enabled when closing an authenticated session", async () => {
    localStorage.setItem("access", "local-token");
    ensureLocalAccessSession.mockReturnValueOnce(true);
    getCurrentUser.mockReturnValueOnce(new Promise(() => {}));
    await render();

    act(() => {
      [...container.querySelectorAll("button")].find((button) =>
        button.textContent.includes("Cerrar sesión"),
      ).click();
    });

    expect(clearSession).toHaveBeenCalled();
    expect(ensureLocalAccessSession).toHaveBeenCalled();
    expect(container.textContent).toContain("Validando sesión...");
  });
});

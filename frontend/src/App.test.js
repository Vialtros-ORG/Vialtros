import React, { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { clearSession, ensureLocalAccessSession, getCurrentUser, isLocalAccessEnabled } from "./services/auth";

let mockInitialEntries = ["/"];
jest.mock("./services/auth", () => ({
  getCurrentUser: jest.fn(), clearSession: jest.fn(() => localStorage.clear()), ensureLocalAccessSession: jest.fn(), isLocalAccessEnabled: jest.fn(),
}));
jest.mock("./context/NotificationContext", () => ({ NotificationProvider: ({ children }) => <>{children}</> }));
jest.mock("./context/GoogleMapsContext", () => ({ GoogleMapsProvider: ({ children }) => <>{children}</> }));
jest.mock("./context/ThemeContext", () => ({ useAppTheme: () => ({ resolvedTheme: "light" }) }));
jest.mock("./components/notifications/NotificationToast", () => () => <div>Notificaciones</div>);
jest.mock("./pages/LandingPage", () => () => <main><h1>Landing</h1><a href="/login">Acceder</a></main>);
jest.mock("./pages/LoginPage", () => ({ onLogin }) => <main><h1>Login</h1><button type="button" onClick={() => { localStorage.setItem("access", "test-token"); onLogin(); }}>Autenticar</button></main>);
jest.mock("./pages/DashboardPage", () => ({ role }) => <main><h1>Dashboard {role}</h1><a href="/profile">Perfil</a></main>);
jest.mock("./pages/TrackingPage", () => () => <main>Tracking</main>);
jest.mock("./pages/AdminUsersPage", () => () => <main>Usuarios</main>);
jest.mock("./pages/AdminDriversPage", () => () => <main>Conductores</main>);
jest.mock("./pages/AdminRoutesPage", () => () => <main>Rutas</main>);
jest.mock("./pages/AdminPassengersPage", () => () => <main>Estudiantes</main>);
jest.mock("./pages/UserRoutePage", () => () => <main>Recorrido</main>);
jest.mock("./pages/DriverRoutesPage", () => () => <main>Rutas de conductor</main>);
jest.mock("./pages/DriverLocationPage", () => () => <main>Ubicación</main>);
jest.mock("./pages/ActivityPage", () => () => <main>Actividad</main>);
jest.mock("./pages/PrivacyPage", () => () => <main>Privacidad</main>);
jest.mock("./pages/TermsPage", () => () => <main>Términos</main>);
jest.mock("./pages/SupportPage", () => () => <main>Soporte</main>);
jest.mock("./pages/ProfileScreen", () => () => <main>Perfil</main>);
jest.mock("./pages/ForgotPasswordPage", () => () => <main>Recuperar</main>);
jest.mock("./pages/ResetPasswordPage", () => () => <main>Restablecer</main>);
jest.mock("./pages/RouteHistoryPage", () => () => <main>Historial</main>);
jest.mock("./pages/SettingsScreen", () => () => <main>Ajustes</main>);
jest.mock("./pages/RouteReportPage", () => () => <main>Reporte</main>);
jest.mock("./components/PrivateRoute", () => ({ children }) => {
  const { Navigate } = jest.requireMock("react-router-dom");
  return localStorage.getItem("access") ? <>{children}</> : <Navigate to="/login" replace />;
});
jest.mock("react-router-dom", () => {
  const React = require("react");
  const RouterContext = React.createContext(null);
  const useRouter = () => React.useContext(RouterContext);
  const Router = ({ children }) => {
    const [pathname, setPathname] = React.useState(mockInitialEntries[0]);
    return <RouterContext.Provider value={{ pathname, setPathname }}>{children}</RouterContext.Provider>;
  };
  const Routes = ({ children }) => {
    const { pathname } = useRouter();
    const routes = React.Children.toArray(children);
    const match = routes.find(({ props }) => props.path === pathname)
      || routes.find(({ props }) => props.path && props.path !== "*" && props.path.includes(":") && new RegExp(`^${props.path.replace(/:[^/]+/g, "[^/]+")}$`).test(pathname))
      || routes.find(({ props }) => props.path === "*");
    return match ? match.props.element : null;
  };
  const Navigate = ({ to }) => {
    const { setPathname } = useRouter();
    React.useEffect(() => setPathname(to), [setPathname, to]);
    return null;
  };
  return {
    BrowserRouter: Router,
    Routes,
    Route: () => null,
    Navigate,
    useLocation: () => ({ pathname: useRouter().pathname }),
    useParams: () => ({ routeId: useRouter().pathname.split("/").at(-1) }),
    Link: ({ to, children, ...props }) => {
      const { setPathname } = useRouter();
      return <a href={to} {...props} onClick={(event) => { event.preventDefault(); setPathname(to); }}>{children}</a>;
    },
  };
}, { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderApp(path = "/") {
  mockInitialEntries = [path];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<App />));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("App routing and session lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockInitialEntries = ["/"];
    ensureLocalAccessSession.mockReturnValue(false);
    isLocalAccessEnabled.mockReturnValue(false);
    getCurrentUser.mockResolvedValue({ role: "driver" });
    window.matchMedia = jest.fn(() => ({ matches: true }));
  });

  it("renders login and navigates to the authenticated dashboard", async () => {
    const view = await renderApp("/login");
    expect(view.container.textContent).toContain("Login");
    await act(async () => view.container.querySelector("button").click());
    await act(async () => { for (let index = 0; index < 6; index += 1) await Promise.resolve(); });
    expect(view.container.textContent).toContain("Dashboard driver");
    expect(localStorage.getItem("role")).toBe("driver");
    await view.unmount();
  });

  it("redirects an unauthenticated protected route to login", async () => {
    const view = await renderApp("/dashboard");
    expect(view.container.textContent).toContain("Login");
    await view.unmount();
  });

  it("loads the stored session role before rendering the protected dashboard", async () => {
    localStorage.setItem("access", "valid-token");
    const view = await renderApp("/dashboard");
    await act(async () => { for (let index = 0; index < 6; index += 1) await Promise.resolve(); });
    expect(clearSession).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("Dashboard driver");
    expect(localStorage.getItem("role")).toBe("driver");
    await view.unmount();
  });

  it("redirects unknown paths to the public home when unauthenticated", async () => {
    const view = await renderApp("/not-a-route");
    expect(view.container.textContent).toContain("Landing");
    await view.unmount();
  });
});

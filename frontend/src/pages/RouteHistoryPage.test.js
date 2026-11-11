import React, { act } from "react";
import { createRoot } from "react-dom/client";
import RouteHistoryPage from "./RouteHistoryPage";
import { getDriverAssignedRoutes, getUserAssignedRoute } from "../services/dashboard";
import { getRoutes } from "../services/admin";
import { getRouteHistoryPage } from "../services/tracking";

jest.mock("../services/dashboard", () => ({
  getDriverAssignedRoutes: jest.fn(),
  getUserAssignedRoute: jest.fn(),
}));
jest.mock("../services/admin", () => ({ getRoutes: jest.fn() }));
jest.mock("../services/tracking", () => ({ getRouteHistoryPage: jest.fn() }));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Menú</aside>);
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderPage(role = "admin") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<RouteHistoryPage role={role} />);
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
  return {
    container,
    flush: async () => act(async () => {
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    }),
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const routes = [
  { id: 1, name: "Ruta antigua", origin: "Puerto", destination: "Centro", completed_at: "2026-11-01T10:00:00Z", passenger_count: 2 },
  { id: 2, name: "Ruta reciente", origin: "Norte", destination: "Sur", status: "completed", completed_at: "2026-11-10T10:00:00Z", passengers: [{ id: 9 }] },
];

describe("RouteHistoryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRoutes.mockResolvedValue(routes);
    getDriverAssignedRoutes.mockResolvedValue(routes);
    getUserAssignedRoute.mockResolvedValue({ route: routes[1] });
    getRouteHistoryPage.mockResolvedValue({ results: [], total: 0, has_more: false, summary: null });
  });

  it("shows an administrator route summary, formats telemetry, labels events and paginates", async () => {
    getRouteHistoryPage
      .mockResolvedValueOnce({
        results: [
          { id: 1, timestamp: "2026-11-10T12:00:00Z", latitude: 3.86812, longitude: -77.02729, speed_kmh: 24 },
          { id: 2, timestamp: "fecha-inválida", passenger: 7, status: "picked", speed_kmh: null },
          { id: 3, timestamp: null, latitude: "x", longitude: null, speed_kmh: 11 },
          { id: 4, timestamp: null, passenger: 8, status: "unknown", speed_kmh: 11 },
        ],
        total: 5,
        has_more: true,
        summary: { first_seen: "2026-11-10T11:00:00Z", last_seen: "2026-11-10T12:00:00Z", distance_km: 4.5, gps_points: 8, average_speed_kmh: 22, peak_speed_kmh: 48 },
      })
      .mockResolvedValueOnce({ results: [{ id: 5, timestamp: "2026-11-10T13:00:00Z", passenger: 9, status: "dropped_off" }], total: 5, has_more: false });

    const view = await renderPage();
    expect(getRoutes).toHaveBeenCalledTimes(1);
    expect(getRouteHistoryPage).toHaveBeenCalledWith("2", { limit: 250, offset: 0 });
    expect(view.container.textContent).toContain("Finalizada");
    expect(view.container.textContent).toContain("4.50 km");
    expect(view.container.textContent).toContain("48 km/h");
    expect(view.container.textContent).toContain("3.86812, -77.02729");
    expect(view.container.textContent).toContain("Pasajero #7");
    expect(view.container.textContent).toContain("Ubicación no disponible");
    expect(view.container.textContent).toContain("Recogida");
    expect(view.container.textContent).toContain("Actividad");
    expect(view.container.querySelector('a[href="/tracking/2"]')).not.toBeNull();

    await act(async () => view.container.querySelector(".vt-history-more").click());
    await view.flush();
    expect(getRouteHistoryPage).toHaveBeenLastCalledWith("2", { limit: 250, offset: 4 });
    expect(view.container.textContent).toContain("Llegada");
    expect(view.container.querySelectorAll(".vt-history-events li")).toHaveLength(5);
    await view.unmount();
  });

  it("loads the passenger assignment and only presents that passenger's events", async () => {
    getRouteHistoryPage.mockResolvedValue({ results: [{ id: 11, timestamp: "2026-11-10T12:00:00Z", passenger: 11, status: "not_picked" }], total: 1 });
    const view = await renderPage("passenger");
    expect(getUserAssignedRoute).toHaveBeenCalledTimes(1);
    expect(getRoutes).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("Mi actividad de ruta");
    expect(view.container.textContent).toContain("Actividad registrada");
    expect(view.container.textContent).toContain("No recogido");
    expect(view.container.textContent).toContain("Actividad registrada");
    expect(view.container.textContent).not.toContain("pasajeros ·");
    await view.unmount();
  });

  it("handles missing routes and route-loading failures", async () => {
    getRoutes.mockResolvedValueOnce(null);
    const empty = await renderPage();
    expect(empty.container.textContent).toContain("No tienes rutas para consultar");
    expect(getRouteHistoryPage).not.toHaveBeenCalled();
    await empty.unmount();

    getRoutes.mockRejectedValueOnce(new Error("offline"));
    const failed = await renderPage();
    expect(failed.container.querySelector('[role="status"]')).toBeNull();
    expect(failed.container.textContent).toContain("No tienes rutas para consultar");
    await failed.unmount();
  });

  it.each([
    [403, "Tu cuenta no tiene permiso"],
    [500, "No se pudo cargar el historial"],
  ])("shows a useful message when history returns HTTP %s", async (status, message) => {
    getRouteHistoryPage.mockRejectedValue({ response: { status } });
    const view = await renderPage("driver");
    expect(getDriverAssignedRoutes).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('[role="alert"]').textContent).toContain(message);
    await view.unmount();
  });

  it("loads a selected route and reports telemetry-free routes", async () => {
    const view = await renderPage("driver");
    const select = view.container.querySelector('select[aria-label="Seleccionar ruta"]');
    await act(async () => {
      select.value = "1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });
    expect(getRouteHistoryPage).toHaveBeenLastCalledWith("1", { limit: 250, offset: 0 });
    expect(view.container.textContent).toContain("Pendiente de inicio");
    expect(view.container.textContent).toContain("Aún no hay posiciones GPS");
    await view.unmount();
  });
});

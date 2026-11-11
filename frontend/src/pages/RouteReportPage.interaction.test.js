import React, { act } from "react";
import { createRoot } from "react-dom/client";
import RouteReportPage from "./RouteReportPage";
import { getRouteAccessibleToRole } from "../services/routeAccess";
import { getRouteHistoryPage } from "../services/tracking";
import { useNavigate } from "react-router-dom";

jest.mock("../services/routeAccess", () => ({ getRouteAccessibleToRole: jest.fn() }));
jest.mock("../services/tracking", () => ({ getRouteHistoryPage: jest.fn() }));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Menú</aside>);
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}), { virtual: true });

const navigate = jest.fn();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderReport(role = "admin") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<RouteReportPage role={role} />);
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

describe("RouteReportPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNavigate.mockReturnValue(navigate);
    require("react-router-dom").useParams.mockReturnValue({ routeId: "42" });
    require("react-router-dom").useLocation.mockReturnValue({
      state: {
        route: { id: 42, name: "Ruta escolar", origin: "Buenaventura", destination: "Centro", status: "completed", passengers: [{ id: 5 }] },
        summary: { distance_km: 5.25, average_speed_kmh: 21.4, gps_points: 3, first_seen: "2026-11-10T10:00:00Z", last_seen: "2026-11-10T11:35:00Z" },
        report: { durationMinutes: 95, finishedAt: "2026-11-10T11:35:00Z" },
      },
    });
    getRouteAccessibleToRole.mockResolvedValue({ id: 42, name: "Ruta escolar", origin: "Buenaventura", destination: "Centro", status: "completed", passengers: [{ id: 5 }] });
    getRouteHistoryPage.mockResolvedValue({ results: [], has_more: false });
    window.print = jest.fn();
  });

  it("renders route metrics and classifies GPS and passenger events", async () => {
    getRouteHistoryPage.mockResolvedValue({
      results: [
        { id: 1, timestamp: "2026-11-10T10:00:00Z", latitude: 3.86812, longitude: -77.02729, speed_kmh: 23 },
        { id: 2, timestamp: "invalid", passenger: 7, status: "picked", speed_kmh: null },
        { id: 3, timestamp: null, passenger: { id: 9 }, status: "dropped_off", latitude: null, longitude: null },
        { id: 4, timestamp: null, passenger: 8, status: "other" },
      ],
      has_more: false,
      summary: { gps_points: 5 },
    });
    const view = await renderReport("admin");
    expect(getRouteAccessibleToRole).toHaveBeenCalledWith("42", "admin");
    expect(getRouteHistoryPage).toHaveBeenCalledWith("42", { limit: 250, offset: 0 });
    expect(view.container.textContent).toContain("Ruta escolar · Recorrido finalizado");
    expect(view.container.textContent).toContain("5.25 km");
    expect(view.container.textContent).toContain("95 min");
    expect(view.container.textContent).toContain("21.4 km/h");
    expect(view.container.textContent).toContain("Pasajero recogido");
    expect(view.container.textContent).toContain("Pasajero #7");
    expect(view.container.textContent).toContain("Pasajero llegó");
    expect(view.container.textContent).toContain("Pasajero 9");
    expect(view.container.textContent).toContain("Actividad de pasajero");
    expect(view.container.querySelector('a[href="/admin/routes"]')).not.toBeNull();
    await view.unmount();
  });

  it("loads additional history and prints or returns using page actions", async () => {
    getRouteHistoryPage
      .mockResolvedValueOnce({ results: [{ id: 1, timestamp: "2026-11-10T10:00:00Z", passenger: 1, status: "not_picked" }], has_more: true })
      .mockResolvedValueOnce({ results: [{ id: 2, timestamp: "2026-11-10T11:00:00Z" }], has_more: false });
    const view = await renderReport("driver");
    await act(async () => view.container.querySelector(".vt-report-more").click());
    await view.flush();
    expect(getRouteHistoryPage).toHaveBeenLastCalledWith("42", { limit: 250, offset: 1 });
    expect(view.container.querySelectorAll(".vt-report-events li")).toHaveLength(2);
    await act(async () => view.container.querySelector(".vt-report-print").click());
    await act(async () => view.container.querySelector(".vt-settings-back").click());
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(-1);
    expect(view.container.querySelector('a[href="/driver/routes"]')).not.toBeNull();
    await view.unmount();
  });

  it.each([[403, "Tu cuenta no tiene permiso"], [500, "No se pudieron cargar los registros"]])(
    "reports history request errors (%s)", async (status, message) => {
      getRouteHistoryPage.mockRejectedValue({ response: { status } });
      const view = await renderReport("user");
      expect(view.container.querySelector('[role="alert"]').textContent).toContain(message);
      expect(view.container.querySelector('a[href="/user/route"]')).not.toBeNull();
      await view.unmount();
    },
  );

  it("uses report state as a fallback and handles missing route access", async () => {
    require("react-router-dom").useLocation.mockReturnValue({ state: { report: { routeName: "Ruta 77", origin: "Punto A", destination: "Punto B", distanceKm: 3.2, speedKmh: 18 } } });
    getRouteAccessibleToRole.mockResolvedValue(null);
    const view = await renderReport("unknown");
    expect(view.container.textContent).toContain("Ruta 77");
    expect(view.container.textContent).toContain("3.2 km");
    expect(view.container.textContent).toContain("18 km/h");
    expect(view.container.textContent).toContain("No se pudo cargar la información de la ruta");
    expect(view.container.textContent).toContain("Aún no hay registros GPS");
    expect(view.container.querySelector('a[href="/driver/routes"]')).not.toBeNull();
    await view.unmount();
  });
});

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import DashboardPage from "./DashboardPage";
import {
  getDashboardStats,
  getDriverAssignedRoutes,
  getRecentActivity,
  getWeeklyActivity,
} from "../services/dashboard";

jest.mock("../services/dashboard", () => ({
  getDashboardStats: jest.fn(),
  getDriverAssignedRoutes: jest.fn(),
  getRecentActivity: jest.fn(),
  getWeeklyActivity: jest.fn(),
}));
jest.mock("../services/tracking", () => ({
  updateTrackingStatus: jest.fn(),
  updateTrackingStatusByPassenger: jest.fn(),
}));
jest.mock("react-router-dom", () => ({}), { virtual: true });
jest.mock("../components/dashboard/useTrackingRoute", () =>
  jest.fn(() => ({ trackingLink: "/tracking/1", trackingEnabled: true })),
);
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Sidebar</aside>);
jest.mock("../components/dashboard/HeroCard", () => () => <div>Hero</div>);
jest.mock("../components/dashboard/ActivityFeed", () => ({ activities, loading }) => (
  <div>{loading ? "Cargando actividad" : `${activities.length} actividades`}</div>
));
jest.mock("../components/dashboard/StatCard", () => ({ label, value }) => (
  <div>{label}: {value}</div>
));

describe("DashboardPage", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("username", "ana.rojas");
    getDashboardStats.mockResolvedValue({
      routes: 4,
      vehicles: 3,
      trackings: 2,
      users: 8,
    });
    getDriverAssignedRoutes.mockResolvedValue([
      { id: 1, passenger_count: 2 },
      { id: 2, passenger_details: [{ id: 3 }] },
    ]);
    getWeeklyActivity.mockResolvedValue([{ day: "L", value: 3 }]);
    getRecentActivity.mockResolvedValue([{ id: 1 }]);
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

  async function render(role) {
    await act(async () => {
      root.render(<DashboardPage role={role} />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  test.each([
    ["admin", "Rutas activas: 4"],
    ["user", "Rutas asignadas: 4"],
    ["driver", "Rutas asignadas: 2"],
  ])("loads summary metrics for %s", async (role, expectedMetric) => {
    await render(role);

    expect(container.textContent).toContain(expectedMetric);
    expect(container.textContent).toContain("1 actividades");
    expect(container.textContent).toContain("Ana Rojas");
    expect(getDashboardStats).toHaveBeenCalledTimes(1);
    expect(getWeeklyActivity).toHaveBeenCalledTimes(1);
    expect(getRecentActivity).toHaveBeenCalledTimes(1);
    expect(getDriverAssignedRoutes).toHaveBeenCalledTimes(role === "driver" ? 1 : 0);
  });

  test("uses empty activity defaults when the activity requests fail", async () => {
    getWeeklyActivity.mockRejectedValueOnce(new Error("offline"));
    getRecentActivity.mockRejectedValueOnce(new Error("offline"));
    getDashboardStats.mockRejectedValueOnce(new Error("offline"));

    await render("user");

    expect(container.textContent).toContain("0 actividades");
    expect(container.textContent).toContain("Rutas asignadas: 0");
  });

  test("uses the fallback dashboard content for unrecognized roles", async () => {
    await render("staff");

    expect(container.textContent).toContain("Rol: Usuario");
    expect(container.textContent).toContain("Rutas activas: 4");
    expect(container.textContent).toContain("Usuarios registrados: 8");
    expect(getDriverAssignedRoutes).not.toHaveBeenCalled();
  });

  test.each([
    ["admin", "Rutas activas: —"],
    ["user", "Rutas asignadas: —"],
    ["driver", "Tracking activos: —"],
  ])("shows loading metrics for %s", async (role, expectedMetric) => {
    getDashboardStats.mockImplementation(() => new Promise(() => {}));

    await render(role);

    expect(container.textContent).toContain(expectedMetric);
  });

  test("uses the empty weekly chart when the activity response has no days", async () => {
    getWeeklyActivity.mockResolvedValueOnce([]);

    await render("user");

    expect(container.querySelectorAll(".h-28")).toHaveLength(7);
  });

  test("defaults missing tracking statistics to zero", async () => {
    getDashboardStats.mockResolvedValueOnce({
      routes: 1,
      vehicles: 1,
      users: 1,
    });

    await render("driver");

    expect(container.textContent).toContain("Tracking activos: 0");
  });
});

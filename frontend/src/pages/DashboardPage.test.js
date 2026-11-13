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
jest.mock("../components/dashboard/Sidebar", () => ({ role }) => <aside>{role} menu</aside>);
jest.mock("../components/dashboard/HeroCard", () => ({ role }) => <section>Hero {role}</section>);
jest.mock("../components/dashboard/ActivityFeed", () => ({ activities, loading, role }) => (
  <section data-testid="activity-feed" data-count={activities.length} data-loading={loading} data-role={role}>Feed</section>
));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderDashboard(role) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<DashboardPage role={role} />);
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("username", "aDMin_Vialtros");
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    getDashboardStats.mockResolvedValue({ routes: 5, vehicles: 3, trackings: 2, users: 21 });
    getWeeklyActivity.mockResolvedValue([{ day: "L", value: 0 }, { day: "M", value: 8 }]);
    getRecentActivity.mockResolvedValue([{ id: 1, title: "Ruta iniciada" }]);
    getDriverAssignedRoutes.mockResolvedValue([{ passenger_count: 2 }, { passenger_details: [{ id: 1 }, { id: 2 }] }]);
  });

  afterEach(() => {
    localStorage.removeItem("username");
    delete window.IntersectionObserver;
  });

  it("renders administrator metrics, weekly activity and recent activity", async () => {
    const view = await renderDashboard("admin");
    expect(view.container.textContent).toContain("Administrador");
    expect(view.container.textContent).toContain("Admin_vialtros");
    expect(view.container.textContent).toContain("Rutas activas");
    expect(view.container.textContent).toContain("Vehículos");
    expect(view.container.querySelectorAll(".vt-dashboard-stat-value").length).toBe(3);
    expect(view.container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(view.container.querySelector('[aria-label="M: 8 señales"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="activity-feed"]').dataset.count).toBe("1");
    expect(getDriverAssignedRoutes).not.toHaveBeenCalled();
    await view.unmount();
  });

  it("summarizes assigned driver routes and student counts", async () => {
    const view = await renderDashboard("driver");
    expect(getDriverAssignedRoutes).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).toContain("Conductor");
    expect(view.container.textContent).toContain("Rutas asignadas");
    expect(view.container.textContent).toContain("Estudiantes asignados");
    expect(view.container.textContent).toContain("4");
    expect(view.container.querySelector('[data-testid="activity-feed"]').dataset.role).toBe("driver");
    await view.unmount();
  });

  it.each([["user", "Pasajero"], ["guest", "Usuario"]])("uses the passenger metrics for role %s", async (role, label) => {
    const view = await renderDashboard(role);
    expect(view.container.textContent).toContain(label);
    expect(view.container.textContent).toContain("Usuarios registrados");
    expect(view.container.textContent).toContain("Ruta vinculada");
    await view.unmount();
  });

  it("falls back to empty metrics when service responses fail or have unexpected shapes", async () => {
    getDashboardStats.mockRejectedValue(new Error("offline"));
    getWeeklyActivity.mockResolvedValue({ results: [] });
    getRecentActivity.mockRejectedValue(new Error("offline"));
    getDriverAssignedRoutes.mockRejectedValue(new Error("offline"));
    const view = await renderDashboard("driver");
    expect(view.container.textContent).toContain("0");
    expect(view.container.querySelectorAll('[role="listitem"]')).toHaveLength(7);
    expect(view.container.querySelector('[data-testid="activity-feed"]').dataset.count).toBe("0");
    expect(view.container.querySelector('[data-testid="activity-feed"]').dataset.loading).toBe("false");
    await view.unmount();
  });

  it("reveals panels once they enter view and disconnects their observers", async () => {
    const disconnect = jest.fn();
    const callbacks = [];
    window.IntersectionObserver = jest.fn((callback) => {
      callbacks.push(callback);
      return { observe: jest.fn(), disconnect };
    });
    const view = await renderDashboard("admin");
    expect(view.container.querySelectorAll(".vt-dashboard-reveal.is-visible")).toHaveLength(0);
    await act(async () => callbacks.forEach((callback) => callback([{ isIntersecting: true }])));
    expect(view.container.querySelectorAll(".vt-dashboard-reveal.is-visible")).toHaveLength(4);
    await view.unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});

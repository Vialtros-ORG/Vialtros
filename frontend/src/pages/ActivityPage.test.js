import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ActivityPage from "./ActivityPage";
import { getRecentActivity } from "../services/dashboard";

jest.mock("../services/dashboard", () => ({ getRecentActivity: jest.fn() }));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Menú</aside>);
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderPage(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ActivityPage role="admin" {...props} />);
  });
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("ActivityPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("loads, sorts and filters recent activity across event types", async () => {
    let resolveActivity;
    getRecentActivity.mockReturnValue(new Promise((resolve) => { resolveActivity = resolve; }));
    const view = await renderPage();
    expect(view.container.querySelector('[role="status"]').textContent).toContain("Cargando");

    await act(async () => {
      resolveActivity([
        { id: 1, title: "Usuario creado", description: "Cuenta nueva", created_at: "2026-11-09T10:00:00Z" },
        { id: 2, title: "Ruta iniciada", description: "Ruta 2", created_at: "2026-11-10T10:00:00Z" },
        { id: 3, title: "Tracking actualizado", description: "Nueva ubicación", created_at: "2026-11-10T11:00:00Z" },
        { id: 4, action: "Cambio", detail: "Sin fecha", created_at: "fecha-inválida" },
      ]);
    });

    const rows = [...view.container.querySelectorAll(".vt-activity-row")];
    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain("Tracking actualizado");
    expect(view.container.textContent).toContain("Cuenta nueva");
    expect(view.container.textContent).toContain("Sin fecha");
    expect(view.container.querySelector('a[href="/dashboard"]')).not.toBeNull();

    const search = view.container.querySelector('input[type="search"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(search, "ruta 2");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(view.container.querySelectorAll(".vt-activity-row")).toHaveLength(1);
    expect(view.container.textContent).toContain("Ruta iniciada");
    await view.unmount();
  });

  it("shows an actionable error when the activity request fails", async () => {
    getRecentActivity.mockRejectedValue(new Error("offline"));
    const view = await renderPage({ role: "driver" });
    await act(async () => { await Promise.resolve(); });
    expect(view.container.querySelector('[role="alert"]').textContent).toContain("Comprueba tu conexión");
    await view.unmount();
  });

  it("handles an empty or unexpected response without rendering stale rows", async () => {
    getRecentActivity.mockResolvedValue({ results: [] });
    const view = await renderPage({ role: "user" });
    await act(async () => { await Promise.resolve(); });
    expect(view.container.textContent).toContain("Aún no hay movimientos registrados");
    expect(view.container.querySelectorAll(".vt-activity-row")).toHaveLength(0);
    await view.unmount();
  });
});

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "./Sidebar";
import { useLocation } from "react-router-dom";
import useTrackingRoute from "./useTrackingRoute";
import { useAppTheme } from "../../context/ThemeContext";

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: jest.fn(),
}), { virtual: true });
jest.mock("./useTrackingRoute", () => jest.fn());
jest.mock("../../context/ThemeContext", () => ({ useAppTheme: jest.fn() }));
jest.mock("../Logo", () => ({ Logo: () => <span>Vialtros</span> }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderSidebar(role = "admin", onLogout = jest.fn()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<Sidebar role={role} onLogout={onLogout} />));
  return {
    container,
    onLogout,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("username", "ana");
    useLocation.mockReturnValue({ pathname: "/admin/routes/4" });
    useTrackingRoute.mockReturnValue({ trackingEnabled: true, trackingLink: "/tracking" });
    useAppTheme.mockReturnValue({ resolvedTheme: "dark" });
  });

  it("renders role-specific links and highlights nested active pages", async () => {
    const view = await renderSidebar("admin");
    expect(view.container.querySelectorAll(".vt-sidebar-nav a")).toHaveLength(7);
    expect(view.container.querySelector('.vt-sidebar-nav a[href="/admin/routes"]').getAttribute("aria-current")).toBe("page");
    expect(view.container.querySelector('.vt-sidebar-nav a[href="/tracking"]')).not.toBeNull();
    await view.unmount();
  });

  it("shows only the assigned-route link for driver and passenger roles", async () => {
    useTrackingRoute.mockReturnValue({ trackingEnabled: false, trackingLink: null });
    const driver = await renderSidebar("driver");
    expect(driver.container.querySelector('.vt-sidebar-nav a[href="/driver/routes"]')).not.toBeNull();
    expect(driver.container.querySelector('.vt-sidebar-nav a[href="/admin/routes"]')).toBeNull();
    await driver.unmount();
    const passenger = await renderSidebar("user");
    expect(passenger.container.querySelector('.vt-sidebar-nav a[href="/user/route"]')).not.toBeNull();
    expect(passenger.container.querySelector('.vt-sidebar-nav a[href="/driver/routes"]')).toBeNull();
    await passenger.unmount();
  });

  it("opens account actions and logs out after selecting the account action", async () => {
    const view = await renderSidebar("admin");
    const accountButton = view.container.querySelector(".vt-account-settings");
    await act(async () => accountButton.click());
    expect(accountButton.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.querySelector('[aria-label="Opciones de cuenta"]')).not.toBeNull();
    await act(async () => view.container.querySelector(".vt-account-logout").click());
    expect(view.onLogout).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('[aria-label="Opciones de cuenta"]')).toBeNull();
    await view.unmount();
  });

  it("closes the account menu on Escape and outside pointer interaction", async () => {
    const view = await renderSidebar();
    const accountButton = view.container.querySelector(".vt-account-settings");
    await act(async () => accountButton.click());
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(view.container.querySelector('[aria-label="Opciones de cuenta"]')).toBeNull();
    await act(async () => accountButton.click());
    await act(async () => document.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(view.container.querySelector('[aria-label="Opciones de cuenta"]')).toBeNull();
    await view.unmount();
  });
});

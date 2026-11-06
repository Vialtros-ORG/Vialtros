import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "./Sidebar";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: "/dashboard" }),
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock("../Logo", () => ({ Logo: () => <span>Logo</span> }));
jest.mock("./useTrackingRoute", () =>
  jest.fn(() => ({ trackingLink: "/tracking/1", trackingEnabled: false })),
);

describe("Sidebar", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
    mockNavigate.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  test("filters navigation by role and disables tracking without an assigned route", () => {
    act(() => {
      root.render(
        <Sidebar
          role="user"
          trackingState={{ trackingLink: "/tracking/1", trackingEnabled: false }}
        />,
      );
    });

    const nav = container.querySelector('nav[aria-label="Navegación principal"]');
    expect(nav.textContent).toContain("Inicio");
    expect(nav.textContent).toContain("Mi Perfil");
    expect(nav.textContent).toContain("Tracking (sin ruta)");
    expect(nav.textContent).not.toContain("Conductores");
    const tracking = [...nav.querySelectorAll("a")].find((link) =>
      link.textContent.includes("Tracking"),
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => tracking.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
  });

  test("shows admin and driver routes and navigates to the dashboard from the logo", () => {
    act(() => {
      root.render(
        <Sidebar
          role="admin"
          trackingState={{ trackingLink: "/tracking/9", trackingEnabled: true }}
        />,
      );
    });
    expect(container.textContent).toContain("Usuarios");
    expect(container.textContent).toContain("Estudiantes");
    expect(container.querySelector('a[href="/tracking/9"]')).toBeTruthy();

    act(() => container.querySelector("aside > button").click());
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});

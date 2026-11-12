import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LandingPage from "./LandingPage";
import { isAuthenticated } from "../services/auth";

jest.mock("../services/auth", () => ({ isAuthenticated: jest.fn() }));
jest.mock("../components/Logo", () => ({ Logo: ({ to }) => <a href={to}>Vialtros</a> }));
jest.mock("../assets/landing-operations.mp4", () => "landing.mp4");
jest.mock("../assets/landing-operations-poster.jpg", () => "poster.jpg");
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderLanding() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<LandingPage />));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("LandingPage", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    isAuthenticated.mockReturnValue(false);
    window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  });

  afterAll(() => { window.matchMedia = originalMatchMedia; });

  it("renders the landing sections, public links, and unauthenticated access actions", async () => {
    const view = await renderLanding();
    expect(view.container.querySelector("#inicio h1").textContent).toContain("siempre a la vista");
    expect(view.container.querySelectorAll(".vt-lp-sector")).toHaveLength(3);
    expect(view.container.querySelectorAll(".vt-lp-tile")).toHaveLength(4);
    expect(view.container.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(view.container.querySelector('a[href="/login"]').textContent).toContain("Acceder al sistema");
    expect(view.container.querySelector('a[href="/privacy"]')).not.toBeNull();
    await view.unmount();
  });

  it("changes role by click and wraps keyboard navigation across tabs", async () => {
    const view = await renderLanding();
    const tabs = view.container.querySelectorAll('[role="tab"]');
    await act(async () => tabs[1].click());
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(view.container.querySelector('[role="tabpanel"] h3').textContent).toBe("Operación simple y eficiente");
    await act(async () => tabs[2].click());
    await act(async () => tabs[2].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })));
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    await act(async () => tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true })));
    expect(tabs[2].getAttribute("aria-selected")).toBe("true");
    await view.unmount();
  });

  it("routes authenticated users to the dashboard and keeps the mobile menu operable", async () => {
    isAuthenticated.mockReturnValue(true);
    const view = await renderLanding();
    expect(view.container.querySelector('a[href="/dashboard"]').textContent).toContain("Ir al panel");
    const menu = view.container.querySelector(".vt-lp-menu");
    await act(async () => menu.click());
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    await act(async () => view.container.querySelector('.vt-lp-navlinks a[href="#roles"]').click());
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    await view.unmount();
  });

  it("falls back to the poster on video errors and honors reduced-motion preference", async () => {
    const view = await renderLanding();
    const video = view.container.querySelector("video");
    expect(video).not.toBeNull();
    await act(async () => video.dispatchEvent(new Event("error")));
    expect(view.container.querySelector("video")).toBeNull();
    await view.unmount();

    window.matchMedia.mockImplementation(() => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
    const reducedMotionView = await renderLanding();
    expect(reducedMotionView.container.querySelector("video")).toBeNull();
    await reducedMotionView.unmount();
  });
});

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import RouteMapBackground from "./RouteMapBackground";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderMap() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<RouteMapBackground variant="preview" />));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("RouteMapBackground", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  });

  afterAll(() => { window.matchMedia = originalMatchMedia; });

  it("renders route geometry and highlights the selected route", async () => {
    const view = await renderMap();
    expect(view.container.querySelectorAll(".vt-route-line")).toHaveLength(2);
    const route = view.container.querySelector('[aria-label="Seleccionar Ruta secundaria"]');
    await act(async () => route.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(route.getAttribute("aria-pressed")).toBe("true");
    expect(view.container.querySelector(".vt-route-map-status").textContent).toContain("Ruta secundaria");
    expect(view.container.querySelectorAll(".vt-route-stop.is-active")).toHaveLength(2);
    await view.unmount();
  });

  it("supports keyboard route selection and reduced motion", async () => {
    const view = await renderMap();
    const route = view.container.querySelector('[aria-label="Seleccionar Ruta secundaria"]');
    await act(async () => route.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
    expect(route.getAttribute("aria-pressed")).toBe("true");
    await act(async () => route.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })));
    expect(route.getAttribute("aria-pressed")).toBe("true");
    await view.unmount();

    window.matchMedia.mockImplementation(() => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
    const reducedMotionView = await renderMap();
    expect(reducedMotionView.container.querySelector("animateMotion")).toBeNull();
    await reducedMotionView.unmount();
  });
});

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import HeroCard from "./HeroCard";

jest.mock("./useTrackingRoute", () =>
  jest.fn(() => ({ trackingLink: "/tracking/1", trackingEnabled: false })),
);
jest.mock("react-router-dom", () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });

describe("HeroCard", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  test("uses supplied tracking state to enable the map link", () => {
    act(() => {
      root.render(
        <HeroCard
          role="admin"
          trackingState={{ trackingLink: "/tracking/22", trackingEnabled: true }}
        />,
      );
    });

    expect(container.querySelector('a[href="/tracking/22"]').textContent).toContain(
      "Abrir mapa",
    );
    expect(container.textContent).toContain("Tracking en tiempo real");
  });

  test("disables map navigation when no route is assigned", () => {
    act(() => {
      root.render(
        <HeroCard
          role="user"
          trackingState={{ trackingLink: "/tracking/1", trackingEnabled: false }}
        />,
      );
    });

    expect(container.querySelector("button").disabled).toBe(true);
    expect(container.textContent).toContain("Sin ruta asignada");
  });
});

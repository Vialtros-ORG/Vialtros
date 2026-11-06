import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AdminRoutesPage from "./AdminRoutesPage";
import {
  createRoute,
  deleteRoute,
  getDrivers,
  getPassengers,
  getRoutes,
  updateRoute,
} from "../services/admin";
import { geocodeAddress, snapPointToRoad } from "../services/routing";

jest.mock("../services/admin", () => ({
  createRoute: jest.fn(),
  deleteRoute: jest.fn(),
  getDrivers: jest.fn(),
  getPassengers: jest.fn(),
  getRoutes: jest.fn(),
  updateRoute: jest.fn(),
}));
jest.mock("../services/routing", () => ({
  geocodeAddress: jest.fn(),
  snapPointToRoad: jest.fn(),
}));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Sidebar</aside>);
jest.mock("../components/LocationAutocomplete", () => ({ label, value, onChange }) => (
  <label>
    {label}
    <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });

describe("AdminRoutesPage", () => {
  let container;
  let root;
  const routes = [
    { id: 8, name: "Ruta Z", origin: "Norte", destination: "Colegio", driver: null, passengers: [], passenger_count: 0, origin_lat: 3.7, origin_lng: -77.0, destination_lat: 3.9, destination_lng: -77.2 },
    { id: 9, name: "Ruta A", origin: "Sur", destination: "Colegio", driver: 2, driver_detail: { user_detail: { username: "Luis" } }, passengers: [4], passenger_count: 1 },
  ];

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    getRoutes.mockResolvedValue(routes);
    getDrivers.mockResolvedValue([{ id: 2, user_detail: { username: "Luis" }, license_number: "LIC-22" }]);
    getPassengers.mockResolvedValue([{ id: 4, user_detail: { username: "Ana", email: "ana@example.com" } }]);
    createRoute.mockResolvedValue({});
    updateRoute.mockResolvedValue({});
    deleteRoute.mockResolvedValue({});
    geocodeAddress.mockResolvedValueOnce([3.8, -77.1]).mockResolvedValueOnce([3.9, -77.2]);
    snapPointToRoad.mockImplementation(async (point) => point);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    jest.clearAllMocks();
  });

  async function render() {
    await act(async () => {
      root.render(<AdminRoutesPage role="admin" />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function clickButton(label) {
    const button = [...container.querySelectorAll("button")].find((item) =>
      item.textContent.includes(label),
    );
    expect(button).toBeTruthy();
    act(() => button.click());
  }

  function setValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  test("loads, sorts and links routes to tracking", async () => {
    await render();

    expect(container.textContent).toContain("2 rutas en total");
    const trackingLink = container.querySelector('a[href="/tracking/8"]');
    expect(trackingLink.textContent).toBe("Tracking");
    act(() => container.querySelector("th").click());
    expect(container.textContent.indexOf("Ruta A")).toBeLessThan(
      container.textContent.indexOf("Ruta Z"),
    );
  });

  test("validates and creates a geocoded route", async () => {
    await render();
    clickButton("Nueva ruta");
    clickButton("Guardar");
    expect(container.textContent).toContain("El nombre es obligatorio");

    const name = container.querySelector('input[placeholder^="ej. Ruta"]');
    setValue(name, "  Ruta Centro ");
    const origin = container.querySelector('input[aria-label="Origen"]');
    const destination = container.querySelector('input[aria-label="Destino"]');
    setValue(origin, " Origen ");
    clickButton("Guardar");
    expect(container.textContent).toContain("El destino es obligatorio");
    setValue(destination, " Destino ");
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(geocodeAddress).toHaveBeenNthCalledWith(1, "Origen");
    expect(geocodeAddress).toHaveBeenNthCalledWith(2, "Destino");
    expect(snapPointToRoad).toHaveBeenCalledTimes(2);
    expect(createRoute).toHaveBeenCalledWith(expect.objectContaining({
      name: "  Ruta Centro ",
      origin: " Origen ",
      destination: " Destino ",
      driver: null,
      origin_lat: 3.8,
      origin_lng: -77.1,
      destination_lat: 3.9,
      destination_lng: -77.2,
    }));
  });

  test("keeps stored coordinates when updating an existing route and deletes it", async () => {
    await render();
    const firstRow = [...container.querySelectorAll("tr")].find((row) =>
      row.textContent.includes("Ruta Z"),
    );
    act(() => {
      [...firstRow.querySelectorAll("button")].find((button) =>
        button.textContent.includes("Editar"),
      ).click();
    });
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(updateRoute).toHaveBeenCalledWith(8, expect.objectContaining({
      origin_lat: 3.7,
      origin_lng: -77.0,
      destination_lat: 3.9,
      destination_lng: -77.2,
    }));
    expect(geocodeAddress).not.toHaveBeenCalled();

    const row = [...container.querySelectorAll("tr")].find((item) =>
      item.textContent.includes("Ruta Z"),
    );
    act(() => {
      [...row.querySelectorAll("button")].find((button) =>
        button.textContent.includes("Eliminar"),
      ).click();
    });
    await act(async () => {
      clickButton("Sí, eliminar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(deleteRoute).toHaveBeenCalledWith(8);
  });
});

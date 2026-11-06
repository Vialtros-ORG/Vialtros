import React, { act } from "react";
import { createRoot } from "react-dom/client";
import DriverLocationPage from "./DriverLocationPage";
import { getRoutes } from "../services/admin";
import { getDriverAssignedRoutes } from "../services/dashboard";
import { sendDriverLocation } from "../services/driverLocation";
import {
  geocodeAddress,
  getStreetRouteThroughPoints,
  snapPointToRoad,
  sortStopsByRouteOrder,
} from "../services/routing";

jest.mock("../services/admin", () => ({ getRoutes: jest.fn() }));
jest.mock("../services/dashboard", () => ({ getDriverAssignedRoutes: jest.fn() }));
jest.mock("../services/driverLocation", () => ({ sendDriverLocation: jest.fn() }));
jest.mock("../services/routing", () => ({
  geocodeAddress: jest.fn(),
  getStreetRouteThroughPoints: jest.fn(),
  snapPointToRoad: jest.fn(),
  sortStopsByRouteOrder: jest.fn((stops) => stops || []),
}));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });

describe("DriverLocationPage", () => {
  let container;
  let root;
  const route = {
    id: 7,
    name: "Ruta escolar",
    origin: "Origen",
    origin_lat: 3.8,
    origin_lng: -77.1,
    destination: "Destino",
    destination_lat: 3.9,
    destination_lng: -77.2,
    intermediate_stops: [
      { order: 1, latitude: 3.85, longitude: -77.15 },
    ],
  };
  let watchSuccess;
  let watchError;
  let geolocation;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    getRoutes.mockResolvedValue([route]);
    getDriverAssignedRoutes.mockResolvedValue([route]);
    sendDriverLocation.mockResolvedValue({});
    snapPointToRoad.mockImplementation(async (point) => point);
    geocodeAddress.mockResolvedValue([3.85, -77.15]);
    getStreetRouteThroughPoints.mockResolvedValue({
      coordinates: [
        [3.8, -77.1],
        [3.85, -77.15],
        [3.9, -77.2],
      ],
      duration: 180000,
    });
    sortStopsByRouteOrder.mockImplementation((stops) => stops || []);
    watchSuccess = null;
    watchError = null;
    geolocation = {
      watchPosition: jest.fn((success, error) => {
        watchSuccess = success;
        watchError = error;
        return 42;
      }),
      clearWatch: jest.fn(),
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: geolocation,
    });
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    delete navigator.geolocation;
    jest.clearAllMocks();
  });

  async function render(role = "driver") {
    await act(async () => {
      root.render(<DriverLocationPage role={role} />);
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

  test("loads driver routes and starts a guided route using stored coordinates", async () => {
    await render();

    expect(getDriverAssignedRoutes).toHaveBeenCalled();
    expect(container.textContent).toContain("Ruta escolar");
    await act(async () => {
      clickButton("Iniciar ruta guiada");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sortStopsByRouteOrder).toHaveBeenCalledWith(route.intermediate_stops);
    expect(getStreetRouteThroughPoints).toHaveBeenCalledWith([
      [3.8, -77.1],
      [3.85, -77.15],
      [3.9, -77.2],
    ]);
    expect(sendDriverLocation).toHaveBeenCalledWith(expect.objectContaining({
      route: 7,
      latitude: 3.8,
      longitude: -77.1,
      source: "guided-route",
      status: "picked",
    }));
    expect(container.textContent).toContain("Recorriendo ruta guiada");
  });

  test("geocodes unlocated stops and reports an invalid guided route", async () => {
    const routeWithoutStopCoords = {
      ...route,
      intermediate_stops: [{ order: 1, address: "Parada central" }],
    };
    getDriverAssignedRoutes.mockResolvedValueOnce([routeWithoutStopCoords]);
    getStreetRouteThroughPoints.mockResolvedValueOnce({
      coordinates: [[3.8, -77.1]],
      duration: 1000,
    });
    await render();

    await act(async () => {
      clickButton("Iniciar ruta guiada");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(geocodeAddress).toHaveBeenCalledWith("Parada central");
    expect(sendDriverLocation).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "No se pudo iniciar el recorrido guiado con la ruta real.",
    );
  });

  test("stops GPS sharing after a browser location error", async () => {
    await render("admin");
    expect(getRoutes).toHaveBeenCalled();
    clickButton("Iniciar transmision");
    expect(geolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );

    await act(async () => {
      watchError({ message: "Permiso denegado" });
      await Promise.resolve();
    });
    expect(geolocation.clearWatch).toHaveBeenCalledWith(42);
    expect(container.textContent).toContain("Permiso denegado");
    expect(container.textContent).toContain("En espera");
  });

  test("does not transmit low-accuracy GPS fixes", async () => {
    await render();
    clickButton("Iniciar transmision");

    await act(async () => {
      watchSuccess({ coords: { latitude: 3.8, longitude: -77.1, accuracy: 80, speed: null } });
      await Promise.resolve();
    });
    expect(sendDriverLocation).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Precision insuficiente (80 m)");
  });
});

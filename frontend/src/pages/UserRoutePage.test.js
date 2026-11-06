import React, { act } from "react";
import { createRoot } from "react-dom/client";
import UserRoutePage from "./UserRoutePage";
import {
  getDriverTrackings,
  getUserAssignedRoute,
} from "../services/dashboard";
import { getTrackingsByRoute } from "../services/tracking";
import {
  geocodeAddress,
  getStreetRouteThroughPoints,
  sortStopsByRouteOrder,
} from "../services/routing";
import { connectTrackingWS } from "../services/ws";

jest.mock("../services/dashboard", () => ({
  getDriverTrackings: jest.fn(),
  getUserAssignedRoute: jest.fn(),
}));
jest.mock("../services/tracking", () => ({
  getTrackingsByRoute: jest.fn(),
}));
jest.mock("../services/routing", () => ({
  geocodeAddress: jest.fn(),
  getStreetRouteThroughPoints: jest.fn(),
  sortStopsByRouteOrder: jest.fn((stops) => stops || []),
}));
jest.mock("../services/ws", () => ({
  connectTrackingWS: jest.fn(),
}));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Sidebar</aside>);
jest.mock("../components/tracking/TrackingHero", () => ({ subtitle, meta }) => (
  <header>{subtitle}{meta}</header>
));
jest.mock("../components/MapView", () => ({ trackings, vehiclePosition, routePolyline }) => (
  <div data-testid="map">
    {trackings.length}:{vehiclePosition?.join(",") || "no-position"}:{routePolyline?.length || 0}
  </div>
));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });

describe("UserRoutePage", () => {
  let container;
  let root;
  let onMessage;
  let socketOptions;
  const routeData = {
    route: {
      id: 5,
      name: "Ruta Buenaventura",
      origin: "Origen",
      origin_lat: 0,
      origin_lng: 0,
      destination: "Destino",
      destination_lat: 0.1,
      destination_lng: 0.1,
      intermediate_stops: [
        { order: 2, coords: [0.05, 0.05] },
        { order: 1, latitude: 0.02, longitude: 0.02 },
      ],
      passenger_count: 2,
      passenger_details: [
        { id: 14, pickup_lat: 0, pickup_lng: 0.01, user_detail: { username: "ana" } },
        { id: 15, user_detail: { username: "luis" } },
      ],
    },
    driver: {
      user_detail: { username: "Carlos", email: "carlos@example.com" },
      license_number: "LIC-55",
    },
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("username", "ana");
    getUserAssignedRoute.mockResolvedValue(routeData);
    getDriverTrackings.mockResolvedValue([
      { route: 5, latitude: 0.02, longitude: 0.03, status: "picked" },
      { route: 6, latitude: 0.8, longitude: 0.8, status: "dropped_off" },
      { route: 5, latitude: "invalid", longitude: 0.1 },
    ]);
    getTrackingsByRoute.mockResolvedValue([]);
    getStreetRouteThroughPoints.mockResolvedValue({
      coordinates: [[0, 0], [0.05, 0.05], [0.1, 0.1]],
    });
    sortStopsByRouteOrder.mockImplementation((stops) =>
      [...(stops || [])].sort((a, b) => a.order - b.order),
    );
    connectTrackingWS.mockImplementation((routeId, onPosition, options) => {
      onMessage = onPosition;
      socketOptions = options;
      return { close: jest.fn() };
    });
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

  async function render(role = "user") {
    await act(async () => {
      root.render(<UserRoutePage role={role} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  test("waits for a role before loading passenger data", async () => {
    await render(null);

    expect(getUserAssignedRoute).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Cargando tu ruta...");
  });

  test("rejects roles other than passenger accounts", async () => {
    await render("driver");
    expect(container.textContent).toContain(
      "Esta vista está disponible únicamente para cuentas de pasajero.",
    );
    expect(getUserAssignedRoute).not.toHaveBeenCalled();
  });

  test("loads only the assigned route's valid trackings and handles WebSocket updates", async () => {
    await render();

    expect(getUserAssignedRoute).toHaveBeenCalledTimes(1);
    expect(sortStopsByRouteOrder).toHaveBeenCalledWith(
      routeData.route.intermediate_stops,
    );
    expect(getStreetRouteThroughPoints).toHaveBeenCalledWith([
      [0, 0],
      [0.02, 0.02],
      [0.05, 0.05],
      [0.1, 0.1],
    ]);
    expect(connectTrackingWS).toHaveBeenCalledWith(
      5,
      expect.any(Function),
      expect.objectContaining({ reconnectDelayMs: 3000 }),
    );
    expect(container.textContent).toContain("Ya fuiste recogido");
    expect(container.textContent).toContain("Carlos");
    expect(container.textContent).toContain("luis");
    expect(container.querySelector('[data-testid="map"]').textContent).toContain(
      "1:0.02,0.03:3",
    );

    await act(async () => {
      socketOptions.onOpen();
      onMessage({ latitude: "bad", longitude: 0.03 });
      onMessage({ lat: 0.03, lng: 0.04, speed_kmh: 20 });
      await Promise.resolve();
    });
    expect(container.textContent).toContain("En vivo");
    expect(container.querySelector('[data-testid="map"]').textContent).toContain(
      "2:0.03,0.04:3",
    );

    act(() => socketOptions.onError());
    expect(container.textContent).toContain("Sin conexión");
    act(() => socketOptions.onClose());
    expect(container.textContent).toContain("Conectando...");
  });

  test("shows disconnected state when the WebSocket closes before opening", async () => {
    await render();

    act(() => socketOptions.onClose());

    expect(container.textContent).toContain("Sin conexión");
  });

  test("shows when the vehicle is close to the route destination", async () => {
    getUserAssignedRoute.mockResolvedValueOnce({
      ...routeData,
      route: {
        ...routeData.route,
        destination_lat: 0.02,
        destination_lng: 0.03,
      },
    });

    await render();

    expect(container.textContent).toContain("Cerca del destino");
  });

  test("does not construct a partial route when a stop cannot be geocoded", async () => {
    getUserAssignedRoute.mockResolvedValueOnce({
      ...routeData,
      route: {
        ...routeData.route,
        intermediate_stops: [{ order: 1, address: "Parada sin coordenadas" }],
      },
    });
    geocodeAddress.mockResolvedValueOnce(null);

    await render();

    expect(geocodeAddress).toHaveBeenCalledWith("Parada sin coordenadas");
    expect(getStreetRouteThroughPoints).not.toHaveBeenCalled();
  });

  test("geocodes missing endpoint and stop coordinates before drawing the route", async () => {
    getUserAssignedRoute.mockResolvedValueOnce({
      ...routeData,
      route: {
        ...routeData.route,
        origin_lat: null,
        origin_lng: null,
        destination_lat: null,
        destination_lng: null,
        intermediate_stops: [{ order: 1, address: "Parada geocodificada" }],
        passenger_details: [],
      },
    });
    geocodeAddress.mockImplementation((address) =>
      Promise.resolve({
        Origen: [1, 2],
        Destino: [5, 6],
        "Parada geocodificada": [3, 4],
      }[address]),
    );

    await render();

    expect(geocodeAddress).toHaveBeenCalledWith("Origen");
    expect(geocodeAddress).toHaveBeenCalledWith("Destino");
    expect(geocodeAddress).toHaveBeenCalledWith("Parada geocodificada");
    expect(getStreetRouteThroughPoints).toHaveBeenCalledWith([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  test("keeps the map usable when street-route lookup fails", async () => {
    getStreetRouteThroughPoints.mockRejectedValueOnce(new Error("offline"));

    await render();

    expect(container.querySelector('[data-testid="map"]').textContent).toContain(
      "1:0.02,0.03:0",
    );
    expect(container.textContent).toContain("Ruta Buenaventura");
  });

  test.each([
    ["dropped_off", "Dejado en tu parada"],
    ["not_picked", "Aun no has sido recogido"],
  ])("shows the passenger pickup state %s", async (status, label) => {
    getDriverTrackings.mockResolvedValueOnce([
      { route: 5, latitude: 0.02, longitude: 0.03, status },
    ]);

    await render();

    expect(container.textContent).toContain(label);
  });

  test.each([
    [404, "Todavía no tienes una ruta asignada."],
    [409, "Tu cuenta no tiene un perfil de pasajero."],
    [403, "El servidor no reconoce esta sesión como pasajero."],
    [500, "No se pudo cargar tu ruta en este momento."],
  ])("shows the passenger guidance for API status %s", async (status, message) => {
    getUserAssignedRoute.mockRejectedValueOnce({ response: { status } });
    await render();
    expect(container.textContent).toContain(message);
  });
});

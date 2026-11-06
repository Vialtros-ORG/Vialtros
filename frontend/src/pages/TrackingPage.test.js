import React, { act } from "react";
import { createRoot } from "react-dom/client";
import TrackingPage from "./TrackingPage";
import {
  getRoute,
  getRouteMonitoringSummary,
  completeRoute,
} from "../services/admin";
import {
  getDriverAssignedRoutes,
  getUserAssignedRoute,
} from "../services/dashboard";
import { getTrackingsByRoute } from "../services/tracking";
import { connectTrackingWS } from "../services/ws";
import { connectAdminMonitoring } from "../services/adminWs";
import { sendDriverLocation } from "../services/driverLocation";
import {
  geocodeAddress,
  getETAMinutes,
  getTrackedStreetRoute,
  getStreetRouteThroughPoints,
  snapPointToRoad,
  sortStopsByRouteOrder,
} from "../services/routing";
import { useNotifications } from "../context/NotificationContext";

jest.mock("react-router-dom", () => ({
  useNavigate: jest.fn(() => jest.fn()),
  useParams: jest.fn(() => ({})),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });
jest.mock("../services/admin", () => ({
  completeRoute: jest.fn(),
  getRoute: jest.fn(),
  getRouteMonitoringSummary: jest.fn(),
}));
jest.mock("../services/dashboard", () => ({
  getDriverAssignedRoutes: jest.fn(),
  getUserAssignedRoute: jest.fn(),
}));
jest.mock("../services/tracking", () => ({
  getTrackingsByRoute: jest.fn(),
}));
jest.mock("../services/ws", () => ({ connectTrackingWS: jest.fn() }));
jest.mock("../services/adminWs", () => ({ connectAdminMonitoring: jest.fn() }));
jest.mock("../services/driverLocation", () => ({ sendDriverLocation: jest.fn() }));
jest.mock("../services/routing", () => ({
  geocodeAddress: jest.fn(),
  getETAMinutes: jest.fn(),
  getTrackedStreetRoute: jest.fn(),
  getStreetRouteThroughPoints: jest.fn(),
  snapPointToRoad: jest.fn(),
  sortStopsByRouteOrder: jest.fn((stops) => [...(stops || [])].sort((a, b) => a.order - b.order)),
}));
jest.mock("../context/NotificationContext", () => ({
  useNotifications: jest.fn(),
}));
jest.mock("../components/MapView", () => ({ trackings, plannedRoutePolyline, intermediateStops, activeVehicles }) => (
  <div data-testid="tracking-map">
    {trackings.length}|{plannedRoutePolyline?.length || 0}|{intermediateStops.map((stop) => stop.label).join(",")}|{(activeVehicles || []).map((vehicle) => vehicle.label).join(",")}
  </div>
));
jest.mock("../components/notifications/NotificationCenter", () => () => (
  <div>Notification center</div>
));

describe("TrackingPage", () => {
  let container;
  let root;
  let wsMessage;
  let wsOptions;
  let adminMessage;
  const route = {
    id: 5,
    name: "Ruta de prueba",
    origin: "Origen",
    origin_lat: 3.8,
    origin_lng: -77.1,
    destination: "Destino",
    destination_lat: 3.9,
    destination_lng: -77.2,
    intermediate_stops: [
      { order: 2, address: "Parada dos" },
      { order: 1, address: "Parada uno" },
    ],
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("role", "user");
    getRoute.mockResolvedValue(route);
    getUserAssignedRoute.mockResolvedValue({ route });
    getDriverAssignedRoutes.mockResolvedValue([]);
    getRouteMonitoringSummary.mockResolvedValue(null);
    getTrackingsByRoute.mockResolvedValue([]);
    connectTrackingWS.mockImplementation((id, callback, options) => {
      wsMessage = callback;
      wsOptions = options;
      return { close: jest.fn() };
    });
    connectAdminMonitoring.mockImplementation((callback) => {
      adminMessage = callback;
      return { close: jest.fn() };
    });
    sendDriverLocation.mockResolvedValue({});
    geocodeAddress.mockResolvedValue([3.8, -77.1]);
    getStreetRouteThroughPoints.mockResolvedValue({
      coordinates: [[3.8, -77.1], [3.85, -77.15], [3.9, -77.2]],
      steps: [{ instruction: "Continúa" }],
      duration: 600000,
    });
    getETAMinutes.mockResolvedValue(10);
    getTrackedStreetRoute.mockResolvedValue(null);
    snapPointToRoad.mockImplementation(async (point) => point);
    sortStopsByRouteOrder.mockImplementation((stops) =>
      [...(stops || [])].sort((a, b) => a.order - b.order),
    );
    useNotifications.mockReturnValue({
      registerProximityListener: jest.fn(),
      unregisterProximityListener: jest.fn(),
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
    localStorage.setItem("role", role);
    await act(async () => {
      root.render(<TrackingPage routeId={5} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  test("loads the ordered route and builds a verified street route with duration", async () => {
    await render();

    expect(getUserAssignedRoute).toHaveBeenCalled();
    expect(sortStopsByRouteOrder).toHaveBeenCalledWith(route.intermediate_stops);
    expect(getStreetRouteThroughPoints).toHaveBeenCalledWith([
      [3.8, -77.1],
      [3.9, -77.2],
    ]);
    expect(container.textContent).toContain("Ruta de prueba");
    expect(container.querySelector('[data-testid="tracking-map"]').textContent).toContain(
      "0|3|Parada uno,Parada dos",
    );

    await act(async () => {
      wsOptions.onOpen();
      wsMessage({ latitude: 3.85, longitude: -77.15, timestamp: new Date().toISOString() });
      await Promise.resolve();
    });
    expect(container.textContent).toContain("En vivo");
    expect(container.querySelector('[data-testid="tracking-map"]').textContent).toContain(
      "1|3|Parada uno,Parada dos",
    );

    act(() => container.querySelector('[aria-label="Minimizar panel de seguimiento"]').click());
    expect(container.querySelector('[aria-label="Ampliar panel de seguimiento"]')).not.toBeNull();
  });

  test("uses the direct route endpoint for admins", async () => {
    localStorage.setItem("role", "admin");
    getRouteMonitoringSummary.mockResolvedValue({
      routes: [{ id: 5, name: "Ruta admin", is_live: true }],
      active_vehicles: [
        { route: 5, latitude: 3.8, longitude: -77.1 },
        { route: { id: 8 }, latitude: 3.9, longitude: -77.2 },
      ],
      stats: {},
      alerts: [],
    });
    await render("admin");
    expect(getRoute).toHaveBeenCalledWith(5);
    expect(getRouteMonitoringSummary).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="tracking-map"]').textContent).toContain(
      "Ruta admin,Ruta #8",
    );

    act(() => {
      adminMessage({
        event: "route_state",
        data: { id: 9, name: "Nueva ruta", is_live: true },
      });
      adminMessage({
        event: "route_state",
        data: { id: 9, name: "Nueva ruta actualizada", is_live: true },
      });
      adminMessage({
        event: "position_update",
        data: {
          route: 9,
          driver: "driver-9",
          latitude: 3.85,
          longitude: -77.15,
        },
      });
      adminMessage({
        event: "position_update",
        data: {
          route: 9,
          driver: "driver-9",
          latitude: 3.86,
          longitude: -77.16,
        },
      });
    });
    expect(container.querySelector('[data-testid="tracking-map"]').textContent).toContain(
      "Nueva ruta actualizada",
    );
  });

  test("starts guided navigation for an assigned driver route", async () => {
    getDriverAssignedRoutes.mockResolvedValueOnce([route]);
    await render("driver");

    const startButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Iniciar Ruta"),
    );
    expect(startButton).toBeDefined();

    await act(async () => {
      startButton.click();
      for (let index = 0; index < 6; index += 1) {
        await Promise.resolve();
      }
    });

    expect(sendDriverLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 5,
        latitude: 3.8,
        longitude: -77.1,
        source: "route-start",
      }),
    );
    expect(container.textContent).toContain("Ruta en curso");
  });

  test("explains when street geometry is unavailable to start guided navigation", async () => {
    getDriverAssignedRoutes.mockResolvedValueOnce([route]);
    getStreetRouteThroughPoints.mockResolvedValue({ coordinates: [] });
    await render("driver");

    const startButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Iniciar Ruta"),
    );
    expect(startButton).toBeDefined();

    await act(async () => {
      startButton.click();
      for (let index = 0; index < 6; index += 1) {
        await Promise.resolve();
      }
    });

    expect(container.textContent).toContain(
      "No se encontró un recorrido por calles para esta ruta.",
    );
    expect(sendDriverLocation).not.toHaveBeenCalled();
  });

  test("does not claim a street route when route geometry is unavailable", async () => {
    getStreetRouteThroughPoints.mockResolvedValueOnce({ coordinates: [] });
    await render();

    expect(container.querySelector('[data-testid="tracking-map"]').textContent).toContain(
      "0|0|Parada uno,Parada dos",
    );
    expect(container.textContent).toContain("Ruta de prueba");
  });

  test("does not invent a demo route when geocoding cannot resolve both endpoints", async () => {
    getUserAssignedRoute.mockResolvedValueOnce({
      route: {
        ...route,
        origin_lat: null,
        origin_lng: null,
        destination_lat: null,
        destination_lng: null,
      },
    });
    geocodeAddress.mockResolvedValue(null);
    await render();

    expect(geocodeAddress).toHaveBeenCalledTimes(2);
    expect(getStreetRouteThroughPoints).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="tracking-map"]').textContent).toContain(
      "0|0|",
    );
  });
});

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import UserRoutePage from "./UserRoutePage";
import { getUserAssignedRoute, getDriverTrackings } from "../services/dashboard";
import { getTrackingsByRoute } from "../services/tracking";
import { geocodeAddress, getStreetRouteThroughPoints } from "../services/routing";
import { connectTrackingWS } from "../services/ws";
import { useAppTheme } from "../context/ThemeContext";

jest.mock("../services/dashboard", () => ({ getUserAssignedRoute: jest.fn(), getDriverTrackings: jest.fn() }));
jest.mock("../services/tracking", () => ({ getTrackingsByRoute: jest.fn() }));
jest.mock("../services/routing", () => ({ geocodeAddress: jest.fn(), getStreetRouteThroughPoints: jest.fn() }));
jest.mock("../services/ws", () => ({ connectTrackingWS: jest.fn() }));
jest.mock("../context/ThemeContext", () => ({ useAppTheme: jest.fn() }));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Menú</aside>);
jest.mock("../components/MapView", () => (props) => (
  <div data-testid="map" data-position={JSON.stringify(props.vehiclePosition)} data-count={props.trackings.length} data-dark={props.darkMode} />
));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let socketCallbacks;
const closeSocket = jest.fn();

async function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<UserRoutePage role="user" />);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const route = {
  id: 9,
  name: "Ruta Norte",
  origin: "Origen",
  destination: "Destino",
  origin_lat: 3.868,
  origin_lng: -77.027,
  destination_lat: 3.87,
  destination_lng: -77.03,
  intermediate_stops: [{ id: 1, name: "Parada central", latitude: 3.869, longitude: -77.028 }, { id: 2, name: "Sin coordenadas", latitude: null, longitude: null }],
  passenger_details: [{ id: 5, pickup_address: "Mi parada", pickup_lat: 3.869, pickup_lng: -77.028, user_detail: { username: "pasajero", phone_number: "3001234567" } }],
};

describe("UserRoutePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("username", "pasajero");
    useAppTheme.mockReturnValue({ resolvedTheme: "dark" });
    getUserAssignedRoute.mockResolvedValue({ route, driver: { user_detail: { username: "conductor", email: "conductor@example.com" }, license_number: "LIC-42" } });
    getDriverTrackings.mockResolvedValue([{ route: 9, latitude: "3.868", longitude: "-77.027", status: "picked" }, { route: 9, latitude: "inválida", longitude: -77 }]);
    getTrackingsByRoute.mockResolvedValue([]);
    geocodeAddress.mockResolvedValue(null);
    getStreetRouteThroughPoints.mockResolvedValue({ coordinates: [[3.868, -77.027], [3.87, -77.03]] });
    connectTrackingWS.mockImplementation((routeId, onMessage, callbacks) => {
      socketCallbacks = { routeId, onMessage, ...callbacks };
      return { close: closeSocket };
    });
  });

  afterEach(() => localStorage.clear());

  it("renders assigned route data and updates the passenger view from live GPS", async () => {
    const view = await renderPage();
    expect(view.container.textContent).toContain("Seguimiento de Ruta Norte");
    expect(view.container.textContent).toContain("Recogida confirmada");
    expect(view.container.textContent).toContain("conductor@example.com");
    expect(view.container.textContent).toContain("LIC-42");
    expect(view.container.textContent).toContain("Mi parada");
    expect(view.container.textContent).toContain("Parada central");
    expect(view.container.querySelector('a[href="/tracking/9"]')).not.toBeNull();
    expect(connectTrackingWS).toHaveBeenCalledWith(9, expect.any(Function), expect.objectContaining({ maxReconnectAttempts: 30, reconnectDelayMs: 3000 }));
    expect(getStreetRouteThroughPoints).toHaveBeenCalledWith([[3.868, -77.027], [3.869, -77.028], [3.87, -77.03]]);
    expect(view.container.querySelector('[data-testid="map"]').dataset.dark).toBe("true");
    expect(view.container.querySelector('[data-testid="map"]').dataset.count).toBe("1");

    await act(async () => socketCallbacks.onOpen());
    expect(view.container.textContent).toContain("En vivo");
    await act(async () => socketCallbacks.onMessage({ lat: 3.87, lng: -77.03, speed_kmh: 25 }));
    expect(view.container.querySelector('[data-testid="map"]').dataset.position).toBe("[3.87,-77.03]");
    expect(view.container.textContent).toContain("Cerca del destino");
    expect(view.container.textContent).toContain("El bus llegará a tu parada en unos");
    await view.unmount();
    expect(closeSocket).toHaveBeenCalledTimes(1);
  });

  it("geocodes missing endpoints and uses REST tracking as a fallback", async () => {
    getUserAssignedRoute.mockResolvedValue({ route: { ...route, origin_lat: null, origin_lng: null, destination_lat: null, destination_lng: null, intermediate_stops: [] } });
    geocodeAddress.mockImplementation(async (address) => address === "Origen" ? [3.8, -77.1] : [3.81, -77.11]);
    getTrackingsByRoute.mockResolvedValue([{ lat: 3.805, lng: -77.105, speed_kmh: 0 }, { latitude: "bad", longitude: 0 }]);
    const view = await renderPage();
    expect(geocodeAddress).toHaveBeenCalledWith("Origen");
    expect(geocodeAddress).toHaveBeenCalledWith("Destino");
    expect(view.container.querySelector('[data-testid="map"]').dataset.position).toBe("[3.805,-77.105]");
    expect(view.container.textContent).toContain("En vivo (respaldo)");
    expect(view.container.textContent).toContain("Bus en movimiento");
    await act(async () => socketCallbacks.onError());
    expect(view.container.textContent).toContain("En vivo (respaldo)");
    await view.unmount();
  });

  it("shows the assigned-route empty state for not found and general errors", async () => {
    getUserAssignedRoute.mockRejectedValueOnce({ response: { status: 404 } });
    const missing = await renderPage();
    expect(missing.container.textContent).toContain("Todavía no tienes una ruta asignada");
    expect(missing.container.querySelector('a[href="/dashboard"]')).not.toBeNull();
    await missing.unmount();

    getUserAssignedRoute.mockRejectedValueOnce(new Error("offline"));
    const failed = await renderPage();
    expect(failed.container.textContent).toContain("No se pudo cargar tu ruta en este momento");
    await failed.unmount();
  });
});

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MapView, { getRouteDirectionIcons, RouteStroke } from "./MapView";
import { useGoogleMaps } from "../context/GoogleMapsContext";

jest.mock("../context/GoogleMapsContext", () => ({ useGoogleMaps: jest.fn() }));
jest.mock("@react-google-maps/api", () => {
  const React = require("react");
  const map = {
    addListener: () => ({ remove: () => {} }),
    fitBounds: jest.fn(),
    getCenter: () => ({ lat: 3.88, lng: -77.02 }),
    getRenderingType: jest.fn(),
    getZoom: jest.fn(() => 14),
    panTo: jest.fn(),
    setCenter: jest.fn(),
    setZoom: jest.fn(),
  };
  globalThis.__mapViewMap = map;
  const GoogleMap = ({ children, onClick, onLoad }) => {
    React.useEffect(() => {
      onLoad?.(map);
    }, [onLoad]);
    return React.createElement(
      "div",
      {
        "data-testid": "google-map",
        onClick: () =>
          onClick?.({ latLng: { lat: () => 3.88, lng: () => -77.02 } }),
      },
      children,
    );
  };
  const OverlayView = ({ children }) => React.createElement("div", null, children);
  OverlayView.OVERLAY_MOUSE_TARGET = "overlay-mouse-target";
  return {
    GoogleMap,
    OverlayView,
    Polyline: () => null,
  };
}, { virtual: true });

describe("MapView map status and route strokes", () => {
  let container;
  let root;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;
  let originalSpeechSynthesis;
  let originalSpeechSynthesisUtterance;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    originalSpeechSynthesis = window.speechSynthesis;
    originalSpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
    useGoogleMaps.mockReturnValue({
      isLoaded: false,
      loadError: null,
      authError: false,
      missingApiKey: true,
    });
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    if (originalRequestAnimationFrame === undefined) {
      delete window.requestAnimationFrame;
    } else {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
    if (originalCancelAnimationFrame === undefined) {
      delete window.cancelAnimationFrame;
    } else {
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
    if (originalSpeechSynthesis === undefined) {
      delete window.speechSynthesis;
    } else {
      window.speechSynthesis = originalSpeechSynthesis;
    }
    if (originalSpeechSynthesisUtterance === undefined) {
      delete window.SpeechSynthesisUtterance;
    } else {
      window.SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
    }
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    delete window.google;
    jest.clearAllMocks();
  });

  test("shows a configuration message and filters malformed map inputs", () => {
    act(() => {
      root.render(
        <MapView
          trackings={[
            { latitude: "3.88", longitude: "-77.02" },
            { latitude: "invalid", longitude: "-77.03" },
          ]}
          routePolyline={[[3.88, -77.02], [3.89, -77.03]]}
          intermediateStops={[
            { id: "valid", order: 2, coords: [3.885, -77.025] },
            { id: "invalid-lat", order: 1, coords: [91, -77.02] },
            { id: "missing", order: 3, coords: [null, -77.04] },
          ]}
          activeVehicles={[
            { id: 1, latitude: 3.88, longitude: -77.02 },
            { id: 2, latitude: Number.NaN, longitude: -77.02 },
          ]}
        />,
      );
    });

    expect(container.textContent).toContain("Google Maps no está configurado");
  });

  test("shows a load error when the API key exists but Maps cannot load", () => {
    useGoogleMaps.mockReturnValue({
      isLoaded: false,
      loadError: new Error("Google unavailable"),
      authError: false,
      missingApiKey: false,
    });
    act(() => root.render(<MapView />));

    expect(container.textContent).toContain("No se pudo cargar Google Maps");
  });

  test("builds route casing and direction symbols for loaded Maps", () => {
    expect(getRouteDirectionIcons("#2563EB", false)).toEqual([]);
    window.google = { maps: { SymbolPath: { FORWARD_CLOSED_ARROW: 42 } } };
    expect(getRouteDirectionIcons("#2563EB", true)[0]).toEqual(expect.objectContaining({
      icon: expect.objectContaining({ path: 42, scale: 2.8, strokeColor: "#2563EB" }),
      repeat: "150px",
    }));
    expect(getRouteDirectionIcons("#2563EB", false)[0]).toEqual(expect.objectContaining({
      icon: expect.objectContaining({ path: 42, scale: 2.2, strokeColor: "#2563EB" }),
      repeat: "190px",
    }));

    const stroke = RouteStroke({ path: [{ lat: 3.88, lng: -77.02 }], direction: true });
    const layers = React.Children.toArray(stroke.props.children);
    expect(layers).toHaveLength(2);
    expect(layers[0].props.options.strokeColor).toBe("#FFFFFF");
    expect(layers[1].props.options.icons).toHaveLength(1);
    const plainStroke = RouteStroke({ path: [{ lat: 3.88, lng: -77.02 }] });
    expect(React.Children.toArray(plainStroke.props.children)[1].props.options.icons).toEqual([]);
    expect(RouteStroke({ path: null })).toBeNull();
  });

  test("renders route markers, supports selection, and handles map clicks", () => {
    useGoogleMaps.mockReturnValue({
      isLoaded: true,
      loadError: null,
      authError: false,
      missingApiKey: false,
    });
    window.google = {
      maps: {
        LatLngBounds: class {
          extend = jest.fn();
        },
      },
    };

    act(() => {
      root.render(
        <MapView
          plannedRoutePolyline={[[3.88, -77.02], [3.89, -77.03]]}
          remainingRoutePolyline={[[3.885, -77.025], [3.89, -77.03]]}
          traveledRoutePolyline={[[3.88, -77.02], [3.885, -77.025]]}
          originCoords={[3.88, -77.02]}
          destinationCoords={[3.89, -77.03]}
          intermediateStops={[
            { id: "stop-1", order: 1, label: "Parada central", address: "Calle 1", coords: [3.885, -77.025] },
          ]}
          activeVehicles={[
            { id: 1, latitude: 3.88, longitude: -77.02, label: "ABC123", status: "En ruta" },
            { id: 2, latitude: 3.89, longitude: -77.03, label: "XYZ789", status: "Detenido" },
            { id: 3, latitude: Number.NaN, longitude: -77.03, label: "Invalid" },
          ]}
          pois={[
            { id: "fuel", lat: 3.88, lon: -77.02, tags: { amenity: "fuel" } },
            { id: "invalid", lat: "bad", lon: -77.02 },
          ]}
          mobileMapSheet={<span>Resumen móvil</span>}
        />,
      );
    });

    expect(container.querySelector('[aria-label="Origen: inicio de la ruta"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Destino: fin de la ruta"]')).not.toBeNull();
    expect(container.textContent).toContain("Resumen móvil");
    expect(container.querySelector(".vt-poi-marker")).not.toBeNull();
    expect(globalThis.__mapViewMap.fitBounds).toHaveBeenCalledTimes(1);

    const stop = container.querySelector('[aria-label="Parada central, ver detalles"]');
    act(() => stop.click());
    expect(container.querySelector('[aria-label="Parada central, seleccionada"]')).not.toBeNull();
    expect(container.textContent).toContain("Calle 1");

    const primary = container.querySelector('[aria-label="ABC123: En ruta"]');
    act(() => {
      primary.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(container.textContent).toContain("ABC123");

    const secondary = container.querySelector('[aria-label="XYZ789: Detenido"]');
    act(() => secondary.click());
    expect(container.textContent).toContain("XYZ789");

    act(() => container.querySelector('[data-testid="google-map"]').click());
    expect(container.textContent).toContain("3.88000, -77.02000");
    act(() => container.querySelector('[aria-label="Cerrar"]').click());
    expect(container.textContent).not.toContain("3.88000, -77.02000");

    const handle = container.querySelector('[aria-label="Ampliar detalles de ruta"]');
    act(() => handle.click());
    expect(container.querySelector('[aria-label="Minimizar detalles de ruta"]')).not.toBeNull();
  });

  test("fits a single vehicle, falls back to stop labels, and renders fleet markers", () => {
    useGoogleMaps.mockReturnValue({
      isLoaded: true,
      loadError: null,
      authError: false,
      missingApiKey: false,
    });
    window.google = {
      maps: {
        LatLngBounds: class {
          extend = jest.fn();
        },
      },
    };

    act(() => {
      root.render(
        <MapView
          isAdmin
          focusAllVehicles
          activeVehicles={[
            { id: 7, latitude: 3.88, longitude: -77.02 },
            { id: 8, latitude: Number.NaN, longitude: -77.02 },
          ]}
          intermediateStops={[{ latitude: 3.885, longitude: -77.025 }]}
        />,
      );
    });

    expect(globalThis.__mapViewMap.setCenter).toHaveBeenCalledWith({
      lat: 3.88,
      lng: -77.02,
    });
    expect(globalThis.__mapViewMap.setZoom).toHaveBeenCalledWith(15);
    expect(container.querySelector(".vt-marker-root-fleet")).not.toBeNull();

    const stop = container.querySelector('[aria-label="Parada 1, ver detalles"]');
    act(() => stop.click());
    expect(container.querySelector(".vt-stop-tooltip-name").textContent).toBe("Parada 1");
    expect(container.querySelector(".vt-stop-tooltip-addr")).toBeNull();
  });

  test("renders GPS controls and handles navigation actions", () => {
    useGoogleMaps.mockReturnValue({
      isLoaded: true,
      loadError: null,
      authError: false,
      missingApiKey: false,
    });
    window.google = {
      maps: {
        LatLngBounds: class {
          extend = jest.fn();
        },
      },
    };
    const onExitGps = jest.fn();
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    window.speechSynthesis = { cancel: jest.fn(), speak: jest.fn() };
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = jest.fn(() => 1);
    window.cancelAnimationFrame = jest.fn();

    act(() => {
      root.render(
        <MapView
          gpsMode
          eta={12}
          nearDestination
          destinationName="Terminal"
          plannedRoutePolyline={[[3.88, -77.02], [3.89, -77.03]]}
          remainingRoutePolyline={[[3.885, -77.025], [3.89, -77.03]]}
          traveledRoutePolyline={[[3.88, -77.02], [3.885, -77.025]]}
          vehiclePosition={{ latitude: 3.88, longitude: -77.02 }}
          activeVehicles={[{
            id: 9,
            latitude: 3.88,
            longitude: -77.02,
            label: "GPS-99",
            status: "En ruta",
            speedKmh: 38,
          }]}
          navigationSteps={[{
            location: [3.883, -77.02],
            instruction: "Gira a la izquierda",
            type: "turn",
            modifier: "left",
            name: "Calle 2",
          }]}
          onExitGps={onExitGps}
        />,
      );
    });

    expect(container.textContent).toContain("Navegación");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("0.8 km");
    expect(container.textContent).toContain("38");
    expect(container.textContent).toContain("GPS-99");
    expect(container.textContent).toContain("Calle 2");

    act(() => container.querySelector('[aria-label="Más opciones"]').click());
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    act(() => {
      [...container.querySelectorAll(".gps-menu-item")].find((button) =>
        button.textContent.includes("Centrar en vehículo"),
      ).click();
    });
    expect(globalThis.__mapViewMap.panTo).toHaveBeenCalledWith({
      lat: 3.88,
      lng: -77.02,
    });

    act(() => container.querySelector('[aria-label="Más opciones"]').click());
    act(() => {
      [...container.querySelectorAll(".gps-menu-item")].find((button) =>
        button.textContent.includes("Silenciar voz"),
      ).click();
    });
    expect(container.querySelector('[aria-label="Activar voz"]')).not.toBeNull();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();

    act(() => container.querySelector('[aria-label="Más opciones"]').click());
    act(() => {
      [...container.querySelectorAll(".gps-menu-item")].find((button) =>
        button.textContent.includes("Modo noche"),
      ).click();
    });

    act(() => container.querySelector('[aria-label="Acercar"]').click());
    act(() => container.querySelector('[aria-label="Alejar"]').click());
    act(() => container.querySelector('[aria-label="Volver al seguimiento"]').click());
    expect(onExitGps).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".vt-gps-shell")).not.toBeNull();
  });

  test("uses safe GPS labels when route and vehicle details are unavailable", () => {
    useGoogleMaps.mockReturnValue({
      isLoaded: true,
      loadError: null,
      authError: false,
      missingApiKey: false,
    });
    window.google = {
      maps: {
        LatLngBounds: class {
          extend = jest.fn();
        },
      },
    };
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = jest.fn(() => 1);
    window.cancelAnimationFrame = jest.fn();

    act(() => root.render(<MapView gpsMode />));

    expect(container.textContent).toContain("Hacia el destino");
    expect(container.textContent).toContain("0");
    expect(container.querySelector("#eta-panel").textContent).toContain("—");
    expect(container.querySelector("#lic-tag")).toBeNull();
    expect(container.querySelector(".vt-gps-shell")).not.toBeNull();

    const historyBack = jest.spyOn(window.history, "back").mockImplementation(() => {});
    act(() => container.querySelector('[aria-label="Volver al seguimiento"]').click());
    expect(historyBack).toHaveBeenCalledTimes(1);

    act(() => container.querySelector('[aria-label="Más opciones"]').click());
    act(() => {
      [...container.querySelectorAll(".gps-menu-item")].find((button) =>
        button.textContent.includes("Centrar en vehículo"),
      ).click();
    });
    expect(globalThis.__mapViewMap.panTo).not.toHaveBeenCalled();

    act(() => container.querySelector('[aria-label="Más opciones"]').click());
    act(() => {
      [...container.querySelectorAll(".gps-menu-item")].find((button) =>
        button.textContent.includes("Silenciar voz"),
      ).click();
    });
    expect(container.querySelector('[aria-label="Activar voz"]')).not.toBeNull();

    act(() => container.querySelector('[aria-label="Más opciones"]').click());
    act(() => {
      [...container.querySelectorAll(".gps-menu-item")].find((button) =>
        button.textContent.includes("Modo noche"),
      ).click();
    });

    act(() => container.querySelector('[aria-label="Más opciones"]').click());
    expect(container.textContent).toContain("Modo claro");

    act(() => {
      [...container.querySelectorAll(".gps-menu-item")].find((button) =>
        button.textContent.includes("Cerrar navegación"),
      ).click();
    });
    expect(historyBack).toHaveBeenCalledTimes(2);
    historyBack.mockRestore();
  });
});

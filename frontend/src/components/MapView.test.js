import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MapView, { getRouteDirectionIcons, RouteStroke } from "./MapView";
import { useGoogleMaps } from "../context/GoogleMapsContext";

jest.mock("../context/GoogleMapsContext", () => ({ useGoogleMaps: jest.fn() }));
jest.mock("@react-google-maps/api", () => {
  const React = require("react");
  const MapContainer = ({ children }) => React.createElement("div", null, children);
  MapContainer.OVERLAY_MOUSE_TARGET = "overlay-mouse-target";
  return {
    GoogleMap: MapContainer,
    OverlayView: MapContainer,
    Polyline: () => null,
  };
}, { virtual: true });

describe("MapView map status and route strokes", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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

    const stroke = RouteStroke({ path: [{ lat: 3.88, lng: -77.02 }], direction: true });
    const layers = React.Children.toArray(stroke.props.children);
    expect(layers).toHaveLength(2);
    expect(layers[0].props.options.strokeColor).toBe("#FFFFFF");
    expect(layers[1].props.options.icons).toHaveLength(1);
    expect(RouteStroke({ path: null })).toBeNull();
  });
});

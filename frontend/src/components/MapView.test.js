import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useGoogleMaps } from "../context/GoogleMapsContext";
import MapView from "./MapView";

jest.mock("../context/GoogleMapsContext", () => ({
  useGoogleMaps: jest.fn(),
}));

jest.mock("@react-google-maps/api", () => {
  const ReactRuntime = require("react");
  const GoogleMap = ({ children, options }) =>
    ReactRuntime.createElement(
      "section",
      {
        "data-map": "ready",
        "data-map-id": Boolean(options?.mapId),
        "data-map-styles": JSON.stringify(options?.styles || []),
      },
      children,
    );
  const Polyline = ({ options, path }) =>
    ReactRuntime.createElement("i", {
      "data-line": options?.strokeColor,
      "data-points": path?.length || 0,
    });
  const OverlayView = ({ children }) =>
    ReactRuntime.createElement("div", { "data-overlay": "route-point" }, children);
  OverlayView.OVERLAY_MOUSE_TARGET = "overlayMouseTarget";
  return { GoogleMap, Polyline, OverlayView };
});

const plannedPath = [
  [3.88, -77.03],
  [3.89, -77.02],
  [3.9, -77.01],
];

describe("MapView route presentation", () => {
  beforeEach(() => {
    useGoogleMaps.mockReturnValue({ isLoaded: true, loadError: null, authError: null });
  });

  it("styles a dark live route and renders origin, destination, stops, and vehicle", () => {
    const markup = renderToStaticMarkup(
      <MapView
        darkMode
        routeActive
        highlightedRouteIds={[4]}
        routeOverlays={[{ id: 4, polyline: plannedPath }]}
        plannedRoutePolyline={plannedPath}
        remainingRoutePolyline={plannedPath.slice(1)}
        traveledRoutePolyline={plannedPath.slice(0, 2)}
        originCoords={plannedPath[0]}
        destinationCoords={plannedPath[2]}
        intermediateStops={[{ id: "school", coords: plannedPath[1], label: "Colegio" }]}
        vehiclePosition={{ latitude: 3.89, longitude: -77.02 }}
      />,
    );

    expect(markup).toContain('data-map="ready"');
    expect(markup).toContain('data-map-id="false"');
    expect(markup).toContain('&quot;elementType&quot;:&quot;geometry&quot;');
    expect(markup).toContain('data-line="#62d5df"');
    expect(markup).toContain('data-line="#669da2"');
    expect(markup).toContain('data-line="#82d6dd"');
    expect(markup).toContain("vt-route-point-start");
    expect(markup).toContain("vt-dest-pin");
    expect(markup).toContain("vt-route-stop-marker");
    expect(markup).toContain("vt-marker-root");
  });

  it("renders the planned light route and distinguishes highlighted overlays", () => {
    const markup = renderToStaticMarkup(
      <MapView
        plannedRoutePolyline={plannedPath}
        highlightedRouteIds={[2]}
        routeOverlays={[
          { id: 2, polyline: plannedPath },
          { id: 3, polyline: plannedPath.slice(1) },
        ]}
      />,
    );

    expect(markup).toContain('data-line="#0b6e80"');
    expect(markup).toContain('data-line="#075765"');
    expect(markup).toContain('data-line="#0b8290"');
  });

  it("ignores malformed route geometry and stops", () => {
    const markup = renderToStaticMarkup(
      <MapView
        plannedRoutePolyline={[["bad", 10], [3.9, -77]]}
        remainingRoutePolyline={[[3.8, null], [3.9, -77]]}
        intermediateStops={[{ id: "invalid", coords: [NaN, -77] }]}
      />,
    );

    expect(markup).toContain('data-map="ready"');
    expect(markup).not.toContain("data-line=");
    expect(markup).not.toContain('data-overlay="route-point"');
  });

  it("shows loading and configuration states before the map is ready", () => {
    useGoogleMaps.mockReturnValueOnce({ isLoaded: false, loadError: null, authError: null });
    const loadingMarkup = renderToStaticMarkup(<MapView />);
    expect(loadingMarkup).toContain("map-loading-placeholder");

    useGoogleMaps.mockReturnValueOnce({
      isLoaded: false,
      loadError: new Error("Maps unavailable"),
      authError: null,
    });
    const errorMarkup = renderToStaticMarkup(<MapView />);
    expect(errorMarkup).toContain("map-error-placeholder");
    expect(errorMarkup).toContain("No se pudo cargar Google Maps");
  });

  it("limits the live legend and ETA to the active user's role", () => {
    const driverWaitingMarkup = renderToStaticMarkup(
      <MapView isDriver gpsMode={false} routeActive={false} eta={8} />,
    );
    expect(driverWaitingMarkup).not.toContain('class="map-legend');
    expect(driverWaitingMarkup).not.toContain('class="floating-eta ');

    const passengerMarkup = renderToStaticMarkup(
      <MapView isDriver={false} routeActive={false} eta={8} />,
    );
    expect(passengerMarkup).toContain('class="map-legend');
    expect(passengerMarkup).toContain('class="floating-eta ');
    expect(passengerMarkup).toContain('class="floating-eta-number">8');
  });

  it("renders highlighted overlays for admins without passenger navigation UI", () => {
    const markup = renderToStaticMarkup(
      <MapView
        isAdmin
        darkMode
        eta={5}
        highlightedRouteIds={[4]}
        routeOverlays={[
          { id: 4, polyline: plannedPath },
          { id: 5, polyline: plannedPath.slice(1) },
          { id: 6, polyline: [["invalid", 0], [3.9, -77]] },
        ]}
      />,
    );

    expect(markup).toContain('data-line="#42aeb8"');
    expect(markup).toContain('data-line="#64c7cf"');
    expect(markup).not.toContain('class="map-legend');
    expect(markup).not.toContain('class="floating-eta ');
  });
});

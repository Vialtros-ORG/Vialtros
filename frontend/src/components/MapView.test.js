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
});

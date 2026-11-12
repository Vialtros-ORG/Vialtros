import {
  getStoredRouteCoordinates,
  hasCoordinatePair,
  isValidCoordinatePair,
  resolveCoordinatePair,
} from "./routeCoordinates";

describe("route coordinate resolution", () => {
  it("recognizes complete stored coordinates and rejects partial pairs", () => {
    expect(hasCoordinatePair(3.88, -77.03)).toBe(true);
    expect(hasCoordinatePair(3.88, null)).toBe(false);
    expect(hasCoordinatePair(undefined, -77.03)).toBe(false);
  });

  it("keeps selected coordinates or resolves a geocoded fallback", () => {
    expect(resolveCoordinatePair("3.88", "-77.03", [4, -78])).toEqual([
      "3.88",
      "-77.03",
    ]);
    expect(resolveCoordinatePair(3.88, null, [4, -78])).toEqual([4, -78]);
    expect(resolveCoordinatePair(null, null, null)).toBeNull();
    expect(resolveCoordinatePair(null, null, [4])).toBeNull();
  });

  it.each([
    [[3.88, -77.03], true],
    [["90", "180"], true],
    [["-90", "-180"], true],
    [[90.01, 0], false],
    [[0, -180.01], false],
    [["latitud", -77], false],
    [[3.88], false],
    [null, false],
  ])("validates coordinate pair %p as %p", (coordinates, expected) => {
    expect(isValidCoordinatePair(coordinates)).toBe(expected);
  });

  it("returns numeric coordinates for each valid stored route endpoint", () => {
    const route = {
      origin_lat: "3.88",
      origin_lng: "-77.03",
      destination_lat: 3.91,
      destination_lng: -77.06,
    };

    expect(getStoredRouteCoordinates(route, "origin")).toEqual([3.88, -77.03]);
    expect(getStoredRouteCoordinates(route, "destination")).toEqual([
      3.91,
      -77.06,
    ]);
  });

  it("falls back for missing, invalid, or unknown route endpoints", () => {
    expect(getStoredRouteCoordinates({}, "origin")).toBeNull();
    expect(getStoredRouteCoordinates({ origin_lat: 91, origin_lng: 0 }, "origin"))
      .toBeNull();
    expect(getStoredRouteCoordinates(null, "origin")).toBeNull();
    expect(getStoredRouteCoordinates({ origin_lat: 3, origin_lng: 4 }, "stop"))
      .toBeNull();
  });
});

import {
  BUENAVENTURA_CENTER,
  buildRoadPathBetweenPoints,
  getETAMinutes,
  getStreetRoute,
  getStreetRouteThroughPoints,
  getTrackedStreetRoute,
  geocodeAddress,
  isWithinBuenaventuraZone,
  searchBuenaventuraPlaces,
  snapPointToRoad,
} from "./routing";
import { getStreetRoute as googleRoute, getStreetRouteThroughPoints as googleRouteThroughPoints } from "./googleRoutesApi";

jest.mock("./googleRoutesApi", () => ({
  getStreetRoute: jest.fn(),
  getStreetRouteThroughPoints: jest.fn(),
}));

describe("routing service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("validates the Buenaventura bounds and resolves local place aliases", async () => {
    expect(isWithinBuenaventuraZone(BUENAVENTURA_CENTER)).toBe(true);
    expect(isWithinBuenaventuraZone([0, 0])).toBe(false);
    expect(isWithinBuenaventuraZone(["x", -77])).toBe(false);
    await expect(geocodeAddress("  Bellavista ")).resolves.toEqual([3.88291, -77.04041]);
    await expect(geocodeAddress(" ")).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("combines local and valid remote place suggestions and tolerates lookup errors", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { lat: "3.88", lon: "-77.03", display_name: "Centro, Buenaventura, Colombia" },
        { lat: "40.7", lon: "-74", display_name: "Fuera de Colombia" },
      ],
    });
    const results = await searchBuenaventuraPlaces("Centro");
    expect(results.some((item) => item.source === "local")).toBe(true);
    expect(results.some((item) => item.label === "Centro, Buenaventura")).toBe(true);
    expect(results.every((item) => item.coords[0] >= 3.84)).toBe(true);

    global.fetch.mockRejectedValueOnce(new Error("sin conexión"));
    await expect(searchBuenaventuraPlaces("sitio desconocido")).resolves.toEqual([]);
  });

  it("does not substitute the GPS fallback when geocoding fails", async () => {
    global.fetch.mockResolvedValue({ ok: false, json: async () => [] });
    await expect(geocodeAddress("Dirección sin resultado", { fallbackCoords: BUENAVENTURA_CENTER })).resolves.toBeNull();
  });

  it("uses Google multipoint routes and returns trivial waypoint sets directly", async () => {
    const googleResult = { coordinates: [[3.88, -77.03], [3.89, -77.02]], distance: 900 };
    googleRouteThroughPoints.mockResolvedValue(googleResult);
    await expect(getStreetRouteThroughPoints([[3.88, -77.03], [3.89, -77.02]])).resolves.toBe(googleResult);
    await expect(getStreetRouteThroughPoints([[3.88, -77.03]])).resolves.toMatchObject({ distance: 0 });
    await expect(getStreetRouteThroughPoints([])).resolves.toBeNull();
  });

  it("anchors fallback segments and uses a straight line when Google is unavailable", async () => {
    googleRouteThroughPoints.mockResolvedValue(null);
    googleRoute.mockResolvedValueOnce({ coordinates: [[0, 0], [1, 1]], distance: 100, duration: 1000 });
    const result = await getStreetRouteThroughPoints([[3.88, -77.03], [3.89, -77.02]]);
    expect(result.coordinates[0]).toEqual([3.88, -77.03]);
    expect(result.coordinates.at(-1)).toEqual([3.89, -77.02]);

    googleRoute.mockRejectedValueOnce(new Error("sin señal"));
    const fallback = await getStreetRoute([3.88, -77.03], [3.89, -77.02]);
    expect(fallback.isStraightLine).toBe(true);
    expect(fallback.coordinates.length).toBe(11);
    await expect(getStreetRoute([999, 0], [0, 0])).resolves.toBeNull();
  });

  it("filters invalid, duplicate, and abrupt GPS points before matching", async () => {
    const route = { coordinates: [[3.88, -77.03], [3.881, -77.029]], distance: 12, duration: 60000 };
    googleRouteThroughPoints.mockResolvedValue(route);
    await expect(getTrackedStreetRoute([
      { lat: 3.88, lng: -77.03 },
      { latitude: 3.88, longitude: -77.03 },
      { latitude: 3.881, longitude: -77.029 },
      { latitude: 20, longitude: -77 },
      { latitude: "bad", longitude: -77 },
    ])).resolves.toBe(route);
    await expect(getTrackedStreetRoute([[3.88, -77.03]])).resolves.toBeNull();
  });

  it("calculates ETA, preserves GPS points, and builds paths from valid coordinates", async () => {
    googleRoute.mockResolvedValue({ coordinates: [[1, 1], [1.1, 1.1]], duration: 61000 });
    await expect(getETAMinutes([3.88, -77.03], [3.89, -77.02])).resolves.toBe(2);
    await expect(snapPointToRoad(["3.88", "-77.03"])).resolves.toEqual([3.88, -77.03]);
    await expect(snapPointToRoad([null, ""])).resolves.toEqual([null, ""]);

    googleRouteThroughPoints.mockResolvedValue({ coordinates: [[3.88, -77.03], [3.89, -77.02]] });
    await expect(buildRoadPathBetweenPoints([[3.88, -77.03], [3.89, -77.02], [100, 0]])).resolves.toHaveLength(2);
    await expect(buildRoadPathBetweenPoints([[3.88, -77.03]])).resolves.toEqual([[3.88, -77.03]]);
  });
});

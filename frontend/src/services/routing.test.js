jest.mock("./googleRoutesApi", () => ({
  getStreetRoute: jest.fn().mockResolvedValue(null),
  getStreetRouteThroughPoints: jest.fn().mockResolvedValue(null),
  snapPointToRoad: jest.fn(async (coords) => coords),
}));

import {
  getStreetRouteThroughPoints,
  getStreetRoute,
  getTrackedStreetRoute,
  getETAMinutes,
  snapPointToRoad,
  sortStopsByRouteOrder,
  buildRoadPathBetweenPoints,
  searchBuenaventuraPlaces,
  geocodeAddress,
  isWithinBuenaventuraZone,
} from "./routing";
import {
  getStreetRoute as googleGetStreetRoute,
  getStreetRouteThroughPoints as googleGetStreetRouteThroughPoints,
  snapPointToRoad as googleSnapPointToRoad,
} from "./googleRoutesApi";

test("orders route stops by saved sequence while keeping equal and missing orders stable", () => {
  const stops = [
    { id: "last", order: 3 },
    { id: "first", sequence: 1 },
    { id: "middle-a", stop_order: 2 },
    { id: "middle-b", order: 2 },
  ];

  expect(sortStopsByRouteOrder(stops).map(({ id }) => id)).toEqual([
    "first",
    "middle-a",
    "middle-b",
    "last",
  ]);
});

test("uses supported order aliases and stable fallback for invalid values", () => {
  const stops = [
    { id: "fallback", order: "not-a-number" },
    { id: "position", position: 0 },
    { id: "missing" },
    { id: "empty", order: "" },
  ];

  expect(sortStopsByRouteOrder(stops).map(({ id }) => id)).toEqual([
    "fallback",
    "position",
    "missing",
    "empty",
  ]);
  expect(sortStopsByRouteOrder(null)).toEqual([]);
});

describe("Buenaventura place lookup", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("validates the city bounds and merges local and remote place suggestions", async () => {
    expect(isWithinBuenaventuraZone([3.89, -77.03])).toBe(true);
    expect(isWithinBuenaventuraZone([4.5, -77.03])).toBe(false);
    expect(isWithinBuenaventuraZone([3.89])).toBe(false);
    expect(await searchBuenaventuraPlaces(" ")).toEqual([]);
    expect(await searchBuenaventuraPlaces("a")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: "Centro, Buenaventura, Colombia", lat: "3.87712", lon: "-77.02986" },
        { display_name: "Biblioteca nueva, Buenaventura", lat: "3.89", lon: "-77.03" },
        { display_name: "Lugar lejano, Colombia", lat: "4.5", lon: "-77.03" },
        { display_name: "Lugar inválido, Buenaventura", lat: "NaN", lon: "-77" },
      ],
    });

    const suggestions = await searchBuenaventuraPlaces("centro");

    expect(suggestions.map(({ label }) => label)).toEqual([
      "Centro, Buenaventura",
      "Biblioteca nueva, Buenaventura",
    ]);
    expect(new URL(global.fetch.mock.calls[0][0]).searchParams.get("q")).toBe(
      "centro, Buenaventura, Colombia",
    );
  });

  test("returns local suggestions if Nominatim is unavailable", async () => {
    global.fetch.mockRejectedValue(new Error("Nominatim unavailable"));

    const suggestions = await searchBuenaventuraPlaces("Bellavista");

    expect(suggestions[0]).toEqual(expect.objectContaining({
      label: "Bellavista",
      source: "local",
    }));
  });

  test("geocodes known places, uses a fallback search, and caches successful results", async () => {
    expect(await geocodeAddress("Terminal de transporte")).toEqual([3.89015, -77.07366]);
    expect(global.fetch).not.toHaveBeenCalled();

    global.fetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: "3.89", lon: "-77.03" }],
      });
    googleSnapPointToRoad.mockResolvedValueOnce([3.8901, -77.03]);
    const location = await geocodeAddress("Biblioteca del puerto", {
      fallbackCoords: [3.89, -77.03],
    });

    expect(location).toEqual([3.8901, -77.03]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(new URL(global.fetch.mock.calls[0][0]).searchParams.has("viewbox")).toBe(true);
    expect(new URL(global.fetch.mock.calls[1][0]).searchParams.has("viewbox")).toBe(false);
    expect(await geocodeAddress("Biblioteca del puerto", {
      fallbackCoords: [3.89, -77.03],
    })).toEqual(location);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("returns fallback coordinates after both geocoding searches fail", async () => {
    global.fetch.mockResolvedValue({ ok: false });
    googleSnapPointToRoad.mockResolvedValueOnce([3.9001, -77.02]);

    const location = await geocodeAddress("Muelle de prueba", {
      fallbackCoords: [3.9, -77.02],
    });

    expect(location).toEqual([3.9001, -77.02]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

const routeGeometry = {
  code: "Ok",
  waypoints: [
    { distance: 9 },
    { distance: 12 },
    { distance: 7 },
  ],
  routes: [
    {
      distance: 1850,
      duration: 420,
      geometry: {
        type: "LineString",
        coordinates: [
          [-77.07, 3.88],
          [-77.065, 3.885],
          [-77.06, 3.89],
        ],
      },
      legs: [
        {
          steps: [
            {
              distance: 500,
              duration: 120,
              name: "Calle 1",
              maneuver: {
                type: "turn",
                modifier: "right",
                location: [-77.065, 3.885],
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("street routing fallback", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("rejects malformed or oversized routes without making a network request", async () => {
    expect(await getStreetRouteThroughPoints([[3.88, -77.07]])).toEqual({
      coordinates: [[3.88, -77.07]],
      duration: 0,
      distance: 0,
    });
    expect(await getStreetRouteThroughPoints([[91, -77.07], [3.89, -77.06]])).toEqual({
      coordinates: [[3.89, -77.06]],
      duration: 0,
      distance: 0,
    });
    const tooManyPoints = Array.from({ length: 101 }, (_, index) => [3.88, -77 + index / 1000]);
    expect(await getStreetRouteThroughPoints(tooManyPoints)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("routes through every ordered stop and converts OSRM coordinates to [lat, lng]", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => routeGeometry,
    });

    const route = await getStreetRouteThroughPoints([
      [3.88, -77.07],
      [3.885, -77.065],
      [3.89, -77.06],
    ]);

    expect(route.provider).toBe("osrm");
    expect(route.isStraightLine).toBe(false);
    expect(route.coordinates).toEqual([
      [3.88, -77.07],
      [3.885, -77.065],
      [3.89, -77.06],
    ]);
    expect(route.duration).toBe(420000);
    expect(route.steps[0].instruction).toContain("a la derecha");
    expect(global.fetch.mock.calls[0][0]).toContain(
      "-77.07,3.88;-77.065,3.885;-77.06,3.89",
    );
  });

  test("returns no route rather than pretending a straight line is drivable", async () => {
    global.fetch.mockRejectedValue(new Error("router unavailable"));

    const route = await getStreetRouteThroughPoints([
      [3.88, -77.07],
      [3.89, -77.06],
    ]);

    expect(route).toBeNull();
  });

  test("rejects routes with invalid geometry and waypoints snapped too far away", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [{ geometry: { coordinates: [[-77, 3.88]] } }],
      }),
    });
    expect(await getStreetRouteThroughPoints([[3.88, -77], [3.89, -77.01]])).toBeNull();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...routeGeometry,
        waypoints: [{ distance: 1400 }, { distance: 0 }],
      }),
    });
    expect(await getStreetRouteThroughPoints([[3.88, -77], [3.89, -77.01]])).toBeNull();
  });

  test("returns null for HTTP errors and malformed OSRM responses", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, json: async () => routeGeometry });
    expect(await getStreetRouteThroughPoints([[3.88, -77], [3.89, -77.01]])).toBeNull();

    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ code: "NoRoute" }) });
    expect(await getStreetRouteThroughPoints([[3.88, -77], [3.89, -77.01]])).toBeNull();
  });

  test("converts provider duration to minutes for the displayed ETA", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => routeGeometry,
    });

    const etaMinutes = await getETAMinutes([3.88, -77.07], [3.89, -77.06]);

    expect(etaMinutes).toBe(7);
  });

  test("map matches a live GPS trace onto streets", async () => {
    const matchResponse = {
      code: "Ok",
      tracepoints: [
        { distance: 8 },
        { distance: 12 },
        { distance: 10 },
      ],
      matchings: [
        {
          distance: 650,
          duration: 100,
          geometry: {
            type: "LineString",
            coordinates: [
              [-77.07, 3.88],
              [-77.065, 3.885],
              [-77.06, 3.89],
            ],
          },
        },
      ],
    };
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => matchResponse,
    });

    const route = await getTrackedStreetRoute([
      { latitude: 3.88, longitude: -77.07, timestamp: "2026-11-05T12:00:00Z" },
      { latitude: 3.885, longitude: -77.065, timestamp: "2026-11-05T12:00:20Z" },
      { latitude: 3.89, longitude: -77.06, timestamp: "2026-11-05T12:00:40Z" },
    ]);

    expect(route.provider).toBe("osrm");
    expect(route.coordinates).toHaveLength(3);
    expect(global.fetch.mock.calls[0][0]).toContain("/match/v1/driving/");
  });

  test("returns null for incomplete GPS traces and falls back when map matching splits", async () => {
    expect(await getTrackedStreetRoute([])).toBeNull();
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: "Ok",
          tracepoints: [null, { distance: 10 }],
          matchings: [{ geometry: { coordinates: [[-77, 3.88], [-77.01, 3.89]] } }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => routeGeometry });

    const route = await getTrackedStreetRoute([
      { latitude: 3.88, longitude: -77, timestamp: "2026-11-05T12:00:00Z" },
      { latitude: 3.881, longitude: -77.001, timestamp: "2026-11-05T12:00:20Z" },
    ]);

    expect(route.provider).toBe("osrm");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toContain("/match/v1/driving/");
    expect(global.fetch.mock.calls[1][0]).toContain("/route/v1/driving/");
  });

  test("samples valid GPS points, removes duplicates and abrupt jumps, then matches them", async () => {
    expect(await getTrackedStreetRoute([[91, -77], null])).toBeNull();

    const points = Array.from({ length: 13 }, (_, index) => ({
      latitude: 3.88 + index * 0.0001,
      longitude: -77.07 + index * 0.0001,
      speed_kmh: 20,
      timestamp: new Date(Date.UTC(2026, 10, 5, 12, 0, index)).toISOString(),
    }));
    points.splice(5, 0, { ...points[4] });
    points.push({
      latitude: 4.5,
      longitude: -77,
      timestamp: new Date(Date.UTC(2026, 10, 5, 12, 1, 0)).toISOString(),
    });

    const matchResponse = {
      code: "Ok",
      tracepoints: Array.from({ length: 13 }, () => ({ distance: 10 })),
      matchings: [{
        geometry: {
          type: "LineString",
          coordinates: [[-77.07, 3.88], [-77.06, 3.89]],
        },
        duration: 120,
        distance: 600,
      }],
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => matchResponse,
    });

    const route = await getTrackedStreetRoute(points);

    expect(route.provider).toBe("osrm");
    expect(route.coordinates).toEqual([[3.88, -77.07], [3.89, -77.06]]);
    expect(global.fetch.mock.calls[0][0]).toContain("/match/v1/driving/");
    expect(new URL(global.fetch.mock.calls[0][0]).searchParams.has("timestamps")).toBe(true);
  });

  test("uses Google route results first and falls back to OSRM when Google has no route", async () => {
    const googleRoute = { coordinates: [[3.88, -77], [3.89, -77.01]], duration: 60 };
    googleGetStreetRoute.mockResolvedValueOnce(googleRoute);
    expect(await getStreetRoute([3.88, -77], [3.89, -77.01])).toBe(googleRoute);
    expect(global.fetch).not.toHaveBeenCalled();

    googleGetStreetRoute.mockRejectedValueOnce(new Error("Google unavailable"));
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => routeGeometry });
    expect((await getStreetRoute([3.88, -77], [3.89, -77.01])).provider).toBe("osrm");
  });

  test("uses a multi-point Google route and merges successful Google segments", async () => {
    const points = [[3.88, -77.07], [3.885, -77.065], [3.89, -77.06]];
    const googleRoute = { coordinates: points, duration: 120, provider: "google" };
    googleGetStreetRouteThroughPoints.mockResolvedValueOnce(googleRoute);
    await expect(getStreetRouteThroughPoints(points)).resolves.toBe(googleRoute);

    googleGetStreetRouteThroughPoints.mockResolvedValueOnce(null);
    googleGetStreetRoute
      .mockResolvedValueOnce({
        coordinates: [points[0], points[1]],
        duration: 100,
        distance: 500,
      })
      .mockResolvedValueOnce({
        coordinates: [points[1], points[2]],
        duration: 200,
        distance: 700,
      });

    await expect(getStreetRouteThroughPoints(points)).resolves.toEqual(
      expect.objectContaining({
        coordinates: points,
        duration: 300,
        distance: 1200,
        provider: "google",
        trafficAware: true,
        isStraightLine: false,
      }),
    );
  });

  test("keeps malformed coordinates unchanged and builds road paths only from routed segments", async () => {
    expect(await snapPointToRoad([91, -77])).toEqual([91, -77]);
    expect(await buildRoadPathBetweenPoints([[3.88, -77]])).toEqual([]);

    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => routeGeometry });
    const path = await buildRoadPathBetweenPoints([
      [3.881, -77.001],
      [Number.NaN, -77],
      [3.882, -77.002],
    ]);
    expect(path).toHaveLength(3);
  });

  test("snaps a GPS point to its nearest road when Google Roads is a no-op", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        waypoints: [
          { distance: 18, location: [-77.0701, 3.8801] },
        ],
      }),
    });

    const snapped = await snapPointToRoad([3.88, -77.07]);

    expect(snapped).toEqual([3.8801, -77.0701]);
    expect(global.fetch.mock.calls[0][0]).toContain("/nearest/v1/driving/");
  });
});

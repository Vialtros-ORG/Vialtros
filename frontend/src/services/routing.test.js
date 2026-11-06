jest.mock("./googleRoutesApi", () => ({
  getStreetRoute: jest.fn().mockResolvedValue(null),
  getStreetRouteThroughPoints: jest.fn().mockResolvedValue(null),
  snapPointToRoad: jest.fn(async (coords) => coords),
}));

import {
  getStreetRouteThroughPoints,
  getTrackedStreetRoute,
  getETAMinutes,
  snapPointToRoad,
  sortStopsByRouteOrder,
} from "./routing";

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

import { parseDurationMilliseconds } from "./googleRoutesApi";

const GOOGLE_KEY_ENV = "REACT_APP_GOOGLE_ROUTES_API_KEY";

describe("Google Routes duration parsing", () => {
  test("parses the REST Duration string format", () => {
    expect(parseDurationMilliseconds("420s")).toBe(420000);
    expect(parseDurationMilliseconds("3.5s")).toBe(3500);
  });

  test("supports protobuf duration objects and missing values", () => {
    expect(parseDurationMilliseconds({ seconds: "90", nanos: 500000000 })).toBe(90500);
    expect(parseDurationMilliseconds(null)).toBe(0);
    expect(parseDurationMilliseconds("invalid")).toBe(0);
  });
});

describe("Google Routes API duration handling", () => {
  const originalApiKey = process.env[GOOGLE_KEY_ENV];

  beforeEach(() => {
    process.env[GOOGLE_KEY_ENV] = "test-google-routes-key";
    localStorage.clear();
    jest.resetModules();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env[GOOGLE_KEY_ENV];
    else process.env[GOOGLE_KEY_ENV] = originalApiKey;
    jest.restoreAllMocks();
  });

  test("uses REST duration values for a route and its navigation steps", async () => {
    const { getStreetRoute } = require("./googleRoutesApi");
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{
          polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
          duration: "420s",
          distanceMeters: 1850,
          legs: [{ steps: [{
            startLocation: { latLng: { latitude: 38.5, longitude: -120.2 } },
            navigationInstruction: { instructions: "Gira a la derecha" },
            staticDuration: { seconds: "30", nanos: 500000000 },
            distanceMeters: 100,
          }] }],
        }],
      }),
    });

    const route = await getStreetRoute([38.5, -120.2], [43.252, -126.453]);

    expect(route.duration).toBe(420000);
    expect(route.steps[0].duration).toBe(30500);
    expect(route.distance).toBe(1850);
    expect(global.fetch.mock.calls[0][1].headers["X-Goog-Api-Key"]).toBe("test-google-routes-key");
  });

  test("converts duration values on multi-stop routes and tolerates an empty response", async () => {
    const { getStreetRouteThroughPoints } = require("./googleRoutesApi");
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [{
            polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
            duration: { seconds: 90, nanos: 250000000 },
            distanceMeters: 250,
          }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ routes: [] }) });

    const route = await getStreetRouteThroughPoints([[38.5, -120.2], [43.252, -126.453]]);
    expect(route.duration).toBe(90250);
    expect(await getStreetRouteThroughPoints([[38.5, -120.2], [43.252, -126.453], [40, -121]])).toBeNull();
  });
});

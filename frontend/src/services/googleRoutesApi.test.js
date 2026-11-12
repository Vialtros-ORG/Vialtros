const CACHE_KEY = "google_routes_cache_v2";
const ENCODED_THREE_POINT_ROUTE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

function loadApi(apiKey = "local-test-key", mapsKey = "") {
  if (apiKey) {
    process.env.REACT_APP_GOOGLE_ROUTES_API_KEY = apiKey;
  } else {
    delete process.env.REACT_APP_GOOGLE_ROUTES_API_KEY;
  }
  if (mapsKey) process.env.REACT_APP_GOOGLE_MAPS_API_KEY = mapsKey;
  else delete process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  let api;
  jest.isolateModules(() => {
    api = require("./googleRoutesApi");
  });
  return api;
}

function jsonResponse(body, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(options.text ?? ""),
  };
}

describe("Google Routes API", () => {
  const originalRoutesKey = process.env.REACT_APP_GOOGLE_ROUTES_API_KEY;
  const originalMapsKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalRoutesKey === undefined) delete process.env.REACT_APP_GOOGLE_ROUTES_API_KEY;
    else process.env.REACT_APP_GOOGLE_ROUTES_API_KEY = originalRoutesKey;
    if (originalMapsKey === undefined) delete process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    else process.env.REACT_APP_GOOGLE_MAPS_API_KEY = originalMapsKey;
  });

  it("returns null without a configured key or route endpoints", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const noKeyApi = loadApi("");
    expect(await noKeyApi.getStreetRoute([1, 2], [3, 4])).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "Google Routes API key not configured. Set REACT_APP_GOOGLE_ROUTES_API_KEY",
    );

    const api = loadApi();
    expect(await api.getStreetRoute(null, [3, 4])).toBeNull();
    expect(await api.getStreetRoute([1, 2], undefined)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("decodes a street route, extracts navigation steps, and persists it", async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      routes: [{
        polyline: { encodedPolyline: ENCODED_THREE_POINT_ROUTE },
        duration: { seconds: 120 },
        distanceMeters: 1500,
        legs: [{ steps: [{
          startLocation: { latLng: { latitude: 38.5, longitude: -120.2 } },
          navigationInstruction: { instructions: "Gira a la derecha" },
          distanceMeters: 400,
          staticDuration: { seconds: 30 },
        }] }],
      }],
    }));
    const api = loadApi();

    const result = await api.getStreetRoute([38.5, -120.2], [40.7, -120.95]);

    expect(result).toEqual({
      coordinates: [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]],
      duration: 120000,
      distance: 1500,
      steps: [{
        location: [38.5, -120.2],
        instruction: "Gira a la derecha",
        distance: 400,
        duration: 30000,
      }],
      trafficAware: true,
    });
    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    expect(request.headers["X-Goog-Api-Key"]).toBe("local-test-key");
    expect(request.headers["X-Goog-FieldMask"]).toContain("routes.legs.steps");
    expect(JSON.parse(request.body).origin.location.latLng).toEqual({
      latitude: 38.5,
      longitude: -120.2,
    });
    expect(JSON.parse(localStorage.getItem(CACHE_KEY))).toHaveLength(1);

    await expect(api.getStreetRoute([38.5, -120.2], [40.7, -120.95])).resolves.toBe(result);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the Maps key as a fallback and ignores corrupt persisted cache", async () => {
    localStorage.setItem(CACHE_KEY, "{invalid json");
    global.fetch.mockResolvedValue(jsonResponse({ routes: [{
      polyline: { encodedPolyline: ENCODED_THREE_POINT_ROUTE },
    }] }));
    const api = loadApi("", "local-maps-test-key");

    const result = await api.getStreetRoute([1, 2], [3, 4]);

    expect(result.steps).toBeNull();
    expect(result.duration).toBe(0);
    expect(result.distance).toBe(0);
    expect(global.fetch.mock.calls[0][1].headers["X-Goog-Api-Key"]).toBe("local-maps-test-key");
  });

  it("returns null for unsuccessful responses, empty route results, and missing polylines", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const api = loadApi();
    global.fetch
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 403, text: "denied" }))
      .mockResolvedValueOnce(jsonResponse({ routes: [] }))
      .mockResolvedValueOnce(jsonResponse({ routes: [{}] }));

    await expect(api.getStreetRoute([1, 2], [3, 4])).resolves.toBeNull();
    await expect(api.getStreetRoute([2, 3], [4, 5])).resolves.toBeNull();
    await expect(api.getStreetRoute([3, 4], [5, 6])).resolves.toBeNull();

    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("No routes found from Google Routes API");
  });

  it("returns null when fetch rejects", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch.mockRejectedValue(new Error("network unavailable"));
    const api = loadApi();

    await expect(api.getStreetRoute([1, 2], [3, 4])).resolves.toBeNull();
  });

  it("requests a multi-waypoint route and reuses its cache", async () => {
    global.fetch.mockResolvedValue(jsonResponse({ routes: [{
      polyline: { encodedPolyline: ENCODED_THREE_POINT_ROUTE },
      duration: { seconds: 90 },
      distanceMeters: 800,
    }] }));
    const api = loadApi();
    const waypoints = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]];

    const result = await api.getStreetRouteThroughPoints(waypoints);

    expect(result).toEqual({
      coordinates: [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]],
      duration: 90000,
      distance: 800,
      trafficAware: true,
    });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.intermediates).toEqual([{
      location: { latLng: { latitude: 40.7, longitude: -120.95 } },
    }]);
    expect(global.fetch.mock.calls[0][1].headers["X-Goog-FieldMask"]).not.toContain("legs");
    await expect(api.getStreetRouteThroughPoints(waypoints)).resolves.toBe(result);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid multi-waypoint input and handles empty API results", async () => {
    const api = loadApi();
    expect(await api.getStreetRouteThroughPoints(null)).toBeNull();
    expect(await api.getStreetRouteThroughPoints([[1, 2]])).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();

    global.fetch.mockResolvedValue(jsonResponse({ routes: [] }));
    await expect(api.getStreetRouteThroughPoints([[1, 2], [3, 4]])).resolves.toBeNull();
  });

  it("keeps GPS coordinates unchanged and clears both in-memory and persistent cache", async () => {
    const api = loadApi();
    const point = [3.88, -77.03];
    expect(await api.snapPointToRoad(point)).toBe(point);
    expect(await api.snapPointToRoad(null)).toBeNull();
    expect(await api.snapPointToRoad([1])).toEqual([1]);

    global.fetch.mockResolvedValue(jsonResponse({ routes: [{
      polyline: { encodedPolyline: ENCODED_THREE_POINT_ROUTE },
    }] }));
    await api.getStreetRoute([1, 2], [3, 4]);
    expect(localStorage.getItem(CACHE_KEY)).not.toBeNull();
    api.clearCache();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    await api.getStreetRoute([1, 2], [3, 4]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

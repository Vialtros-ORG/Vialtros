import api from "./api";
import { getTrackingsByRoute } from "./tracking";

jest.mock("./api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe("getTrackingsByRoute", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("passes the route id through Axios query parameters", async () => {
    const trackings = [{ id: 1 }];
    api.get.mockResolvedValue({ data: trackings });

    await expect(getTrackingsByRoute("17")).resolves.toEqual(trackings);
    expect(api.get).toHaveBeenCalledWith("/tracking/", {
      params: { route: 17 },
    });
  });

  it("rejects invalid route ids before making a request", async () => {
    await expect(getTrackingsByRoute("17&admin=true")).rejects.toThrow(
      "routeId debe ser un entero positivo",
    );
    expect(api.get).not.toHaveBeenCalled();
  });

  it("returns an empty list when the response is not an array", async () => {
    api.get.mockResolvedValue({ data: { results: [] } });

    await expect(getTrackingsByRoute(17)).resolves.toEqual([]);
  });
});

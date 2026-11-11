import { getRouteAccessibleToRole } from "../services/routeAccess";
import { getRoute } from "../services/admin";
import { getDriverAssignedRoutes } from "../services/dashboard";

jest.mock("../services/admin", () => ({ getRoute: jest.fn() }));
jest.mock("../services/dashboard", () => ({
  getDriverAssignedRoutes: jest.fn(),
  getUserAssignedRoute: jest.fn(),
}));

describe("getRouteAccessibleToRole", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads a driver's assigned route without calling the admin-only route endpoint", async () => {
    const assignedRoute = {
      id: 7,
      name: "Ruta escolar",
      origin: "Origen",
      destination: "Destino",
      status: "completed",
      passenger_count: 2,
    };
    getDriverAssignedRoutes.mockResolvedValue([
      assignedRoute,
    ]);

    await expect(getRouteAccessibleToRole(7, "driver")).resolves.toEqual(assignedRoute);
    expect(getDriverAssignedRoutes).toHaveBeenCalledTimes(1);
    expect(getRoute).not.toHaveBeenCalled();
  });
});

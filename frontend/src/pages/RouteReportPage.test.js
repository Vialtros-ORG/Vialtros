import { getRouteAccessibleToRole } from "../services/routeAccess";
import { getRoute } from "../services/admin";
import { getDriverAssignedRoutes, getUserAssignedRoute } from "../services/dashboard";

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

  it("uses the admin endpoint only for administrators", async () => {
    const route = { id: 12, name: "Ruta Centro" };
    getRoute.mockResolvedValue(route);

    await expect(getRouteAccessibleToRole("12", "admin")).resolves.toEqual(route);
    expect(getRoute).toHaveBeenCalledWith("12");
    expect(getDriverAssignedRoutes).not.toHaveBeenCalled();
  });

  it.each(["user", "passenger"])("returns the assigned passenger route for role %s", async (role) => {
    const route = { id: 7, name: "Ruta Pasajero" };
    getUserAssignedRoute.mockResolvedValue({ route });

    await expect(getRouteAccessibleToRole(7, role)).resolves.toEqual(route);
    expect(getUserAssignedRoute).toHaveBeenCalledTimes(1);
  });

  it("returns null for unassigned, mismatched, and unknown-role requests", async () => {
    getDriverAssignedRoutes.mockResolvedValue([{ id: 8, name: "Otra ruta" }]);
    await expect(getRouteAccessibleToRole(7, "driver")).resolves.toBeNull();
    getUserAssignedRoute.mockResolvedValue(null);
    await expect(getRouteAccessibleToRole(7, "user")).resolves.toBeNull();
    await expect(getRouteAccessibleToRole(7, "guest")).resolves.toBeNull();
  });
});

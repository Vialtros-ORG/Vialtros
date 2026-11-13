import { getRoute } from "./admin";
import { getDriverAssignedRoutes, getUserAssignedRoute } from "./dashboard";

export async function getRouteAccessibleToRole(routeId, role) {
  let route = null;

  if (role === "admin") {
    route = await getRoute(routeId);
  } else if (role === "driver") {
    const routes = await getDriverAssignedRoutes();
    route = routes.find((assignedRoute) => String(assignedRoute.id) === String(routeId));
  } else if (role === "user" || role === "passenger") {
    const assignment = await getUserAssignedRoute();
    route = assignment?.route;
  }

  return String(route?.id) === String(routeId) ? route : null;
}

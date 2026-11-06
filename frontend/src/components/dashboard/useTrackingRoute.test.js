import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useTrackingRoute from "./useTrackingRoute";
import { getDriverAssignedRoutes, getUserAssignedRoute } from "../../services/dashboard";
import { getRoutes } from "../../services/admin";

jest.mock("../../services/dashboard", () => ({
  getDriverAssignedRoutes: jest.fn(),
  getUserAssignedRoute: jest.fn(),
}));
jest.mock("../../services/admin", () => ({ getRoutes: jest.fn() }));

function HookProbe({ role, onState }) {
  const state = useTrackingRoute(role);
  React.useEffect(() => onState(state), [onState, state]);
  return null;
}

describe("useTrackingRoute", () => {
  let container;
  let root;
  let onState;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
    onState = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  async function renderRole(role) {
    await act(async () => {
      root.render(<HookProbe role={role} onState={onState} />);
      await Promise.resolve();
    });
  }

  test.each([
    ["driver", () => getDriverAssignedRoutes.mockResolvedValue([{ id: 18 }])],
    ["user", () => getUserAssignedRoute.mockResolvedValue({ route: { id: 27 } })],
    ["admin", () => getRoutes.mockResolvedValue([{ id: 36 }])],
  ])("resolves the tracking link for the %s role", async (role, prepare) => {
    prepare();
    await renderRole(role);

    expect(onState).toHaveBeenLastCalledWith({
      trackingLink: expect.stringMatching(/^\/tracking\//),
      trackingEnabled: true,
      trackingResolved: true,
    });
  });

  test("marks the lookup resolved when no assigned route exists or role is unsupported", async () => {
    getDriverAssignedRoutes.mockResolvedValue([]);
    await renderRole("driver");
    expect(onState).toHaveBeenLastCalledWith({
      trackingLink: "/tracking/1",
      trackingEnabled: false,
      trackingResolved: true,
    });

    await renderRole("passenger");
    expect(onState).toHaveBeenLastCalledWith({
      trackingLink: "/tracking/1",
      trackingEnabled: false,
      trackingResolved: true,
    });
  });

  test("falls back to the default state when the route lookup rejects", async () => {
    getRoutes.mockRejectedValue(new Error("API unavailable"));
    await renderRole("admin");
    expect(onState).toHaveBeenLastCalledWith({
      trackingLink: "/tracking/1",
      trackingEnabled: false,
      trackingResolved: true,
    });
  });
});

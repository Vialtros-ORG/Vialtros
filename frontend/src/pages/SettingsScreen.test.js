import React, { act } from "react";
import { createRoot } from "react-dom/client";
import SettingsScreen from "./SettingsScreen";
import { useAppTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";

jest.mock("../context/ThemeContext", () => ({ useAppTheme: jest.fn() }));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Menú</aside>);
jest.mock("react-router-dom", () => ({ useNavigate: jest.fn() }), { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const navigate = jest.fn();

async function renderSettings() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SettingsScreen role="admin" />);
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function setNavigatorProperty(name, value) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNavigate.mockReturnValue(navigate);
    useAppTheme.mockReturnValue({ preference: "system", setTheme: jest.fn() });
    setNavigatorProperty("geolocation", { getCurrentPosition: jest.fn() });
    setNavigatorProperty("permissions", { query: jest.fn().mockResolvedValue({ state: "prompt", addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
    Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "default", requestPermission: jest.fn().mockResolvedValue("granted") } });
    window.history.replaceState({ idx: 1 }, "");
  });

  it("reads permission states, changes the theme and requests browser permissions", async () => {
    const theme = useAppTheme();
    const geo = navigator.geolocation;
    geo.getCurrentPosition.mockImplementation((success) => success({ coords: { latitude: 3.8, longitude: -77 } }));
    const view = await renderSettings();

    expect(navigator.permissions.query).toHaveBeenCalledWith({ name: "geolocation" });
    expect(view.container.textContent).toContain("Aún no solicitado");
    await act(async () => view.container.querySelector('button[aria-pressed="false"]').click());
    expect(theme.setTheme).toHaveBeenCalledWith("light");

    const locationButton = [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Permitir ubicación");
    await act(async () => locationButton.click());
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { maximumAge: 0, timeout: 10000, enableHighAccuracy: false });
    expect(view.container.textContent).toContain("Permitido en este sitio");

    const notificationButton = [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Permitir avisos");
    await act(async () => notificationButton.click());
    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).toContain("Activadas");
    await view.unmount();
  });

  it.each([
    [1, "El navegador bloqueó el acceso"],
    [2, "No se pudo obtener la ubicación"],
  ])("explains location error code %s", async (code, message) => {
    navigator.geolocation.getCurrentPosition.mockImplementation((success, failure) => failure({ code }));
    const view = await renderSettings();
    const button = [...view.container.querySelectorAll("button")].find((item) => item.textContent === "Permitir ubicación");
    await act(async () => button.click());
    expect(view.container.querySelector('[role="status"]').textContent).toContain(message);
    await view.unmount();
  });

  it("handles notification denial and request exceptions", async () => {
    window.Notification.requestPermission.mockResolvedValueOnce("denied");
    const view = await renderSettings();
    let button = [...view.container.querySelectorAll("button")].find((item) => item.textContent === "Permitir avisos");
    await act(async () => button.click());
    expect(view.container.querySelector('[role="status"]').textContent).toContain("bloqueó los avisos");
    window.Notification.requestPermission.mockRejectedValueOnce(new Error("unsupported"));
    button = [...view.container.querySelectorAll("button")].find((item) => item.textContent === "Permitir avisos");
    await act(async () => button.click());
    expect(view.container.querySelector('[role="status"]').textContent).toContain("No se pudo solicitar este permiso");
    await act(async () => view.container.querySelector(".vt-settings-back").click());
    expect(navigate).toHaveBeenCalledWith(-1);
    await view.unmount();
  });

  it("handles unsupported browser permissions and falls back to the dashboard", async () => {
    setNavigatorProperty("geolocation", undefined);
    setNavigatorProperty("permissions", undefined);
    delete window.Notification;
    window.history.replaceState({}, "");
    const view = await renderSettings();
    expect(view.container.textContent).toContain("No disponible en este navegador");
    expect([...view.container.querySelectorAll("button")].some((button) => button.textContent === "Permitir ubicación" && button.disabled)).toBe(true);
    await act(async () => view.container.querySelector(".vt-settings-back").click());
    expect(navigate).toHaveBeenCalledWith("/dashboard");
    await view.unmount();
  });
});

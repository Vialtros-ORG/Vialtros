import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LoginPage from "./LoginPage";
import api from "../services/api";
import { getCurrentUser, isAuthenticated, isLocalAccessEnabled } from "../services/auth";

const mockNavigate = jest.fn();
let mockSearchParams = new URLSearchParams();
jest.mock("../services/api", () => ({ post: jest.fn() }));
jest.mock("../services/auth", () => ({
  ensureLocalAccessSession: jest.fn(), isLocalAccessEnabled: jest.fn(), isAuthenticated: jest.fn(),
  getCurrentUser: jest.fn(), saveUserCache: jest.fn(),
}));
jest.mock("../components/Logo", () => ({ LogoIcon: () => <span aria-hidden="true">V</span> }));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}), { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderLogin(onLogin) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<LoginPage onLogin={onLogin} />));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function changeInput(input, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submit(view, username = "ana", password = "clave-segura") {
  await act(async () => {
    changeInput(view.container.querySelector("#login-username"), username);
    changeInput(view.container.querySelector("#login-password"), password);
    view.container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
}

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockSearchParams = new URLSearchParams();
    isAuthenticated.mockReturnValue(false);
    isLocalAccessEnabled.mockReturnValue(false);
    getCurrentUser.mockResolvedValue({ username: "ana" });
    api.post.mockResolvedValue({ data: { access: "access-token", refresh: "refresh-token" } });
  });

  it("authenticates, stores session details, calls the parent, and returns to dashboard", async () => {
    const onLogin = jest.fn();
    const view = await renderLogin(onLogin);
    expect(view.container.querySelector('a[aria-label="Ir al inicio de Vialtros"]').getAttribute("href")).toBe("/");
    await submit(view, " ana ", "clave-segura");
    expect(api.post).toHaveBeenCalledWith("/token/", { username: "ana", password: "clave-segura" });
    expect(localStorage.getItem("access")).toBe("access-token");
    expect(localStorage.getItem("username")).toBe("ana");
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    await view.unmount();
  });

  it("shows credential and connection errors and clears them when editing", async () => {
    api.post.mockRejectedValueOnce({ response: { status: 401 } }).mockRejectedValueOnce(new Error("offline"));
    const view = await renderLogin();
    await submit(view);
    expect(view.container.querySelector('[role="alert"]').textContent).toContain("Usuario o contraseña incorrectos");
    await submit(view, "ana", "otra-clave");
    expect(view.container.querySelector('[role="alert"]').textContent).toContain("No se pudo conectar con el servidor");
    await act(async () => changeInput(view.container.querySelector("#login-username"), "nuevo"));
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    await view.unmount();
  });

  it("supports password visibility and confirms a completed password reset", async () => {
    mockSearchParams = new URLSearchParams("reset=success");
    const view = await renderLogin();
    expect(view.container.textContent).toContain("Contraseña actualizada correctamente");
    const password = view.container.querySelector("#login-password");
    await act(async () => view.container.querySelector('[aria-label="Mostrar contraseña"]').click());
    expect(password.type).toBe("text");
    await act(async () => view.container.querySelector('[aria-label="Ocultar contraseña"]').click());
    expect(password.type).toBe("password");
    await view.unmount();
  });

  it("rejects an empty username before contacting the API", async () => {
    const view = await renderLogin();
    await submit(view, "   ", "some-password");
    expect(api.post).not.toHaveBeenCalled();
    expect(view.container.querySelector('[role="alert"]').textContent).toContain("Ingresa tu nombre de usuario");
    await view.unmount();
  });

  it("redirects an existing authenticated user without rendering a login request", async () => {
    isAuthenticated.mockReturnValue(true);
    const onLogin = jest.fn();
    const view = await renderLogin(onLogin);
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    expect(api.post).not.toHaveBeenCalled();
    await view.unmount();
  });
});

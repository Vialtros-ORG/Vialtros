import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ProfileScreen from "./ProfileScreen";
import {
  getCurrentUser,
  getUserCache,
  saveUserCache,
  updateCurrentUser,
} from "../services/auth";

jest.mock("../services/auth", () => ({
  getCurrentUser: jest.fn(),
  getUserCache: jest.fn(),
  saveUserCache: jest.fn(),
  updateCurrentUser: jest.fn(),
}));
jest.mock("react-router-dom", () => ({ useNavigate: jest.fn(() => jest.fn()) }), {
  virtual: true,
});

const initialUser = {
  id: 17,
  username: "camila",
  first_name: "Camila",
  last_name: "Rojas",
  email: "camila@example.com",
  phone_number: "+573001234567",
};

describe("ProfileScreen", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    localStorage.setItem("access", "test-access-token");
    localStorage.setItem("username", "camila");
    getUserCache.mockReturnValue(null);
    getCurrentUser.mockResolvedValue(initialUser);
    updateCurrentUser.mockResolvedValue(initialUser);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    jest.clearAllMocks();
  });

  async function mountProfile() {
    await act(async () => {
      root.render(<ProfileScreen />);
      await Promise.resolve();
    });
  }

  function changeInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function enterEditMode() {
    act(() => {
      [...container.querySelectorAll("button")].find((button) => button.textContent.includes("Editar perfil")).click();
    });
  }

  test("loads the user and renders initials when there is no saved photo", async () => {
    await mountProfile();

    expect(container.querySelector('[aria-label="Iniciales de Camila Rojas"]').textContent).toBe("CR");
    expect(saveUserCache).toHaveBeenCalledWith(initialUser);
  });

  test("rejects an invalid email before sending the profile update", async () => {
    await mountProfile();
    enterEditMode();
    const email = container.querySelector('input[type="email"]');
    changeInput(email, "correo-invalido");
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent.includes("Guardar cambios")).click();
    });

    expect(updateCurrentUser).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Ingresa un correo válido");
  });

  test("normalizes valid profile fields and updates the cache", async () => {
    await mountProfile();
    enterEditMode();
    const inputs = container.querySelectorAll("input:not([type=file])");
    changeInput(inputs[0], "  camila   maria ");
    changeInput(inputs[1], "  ROJAS ");
    changeInput(inputs[2], "  CAMILA@EXAMPLE.COM ");
    changeInput(inputs[3], "+57 (300) 123-4567");

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent.includes("Guardar cambios")).click();
    });

    expect(updateCurrentUser).toHaveBeenCalledWith({
      first_name: "Camila Maria",
      last_name: "Rojas",
      email: "camila@example.com",
      phone_number: "+573001234567",
    });
    expect(saveUserCache).toHaveBeenLastCalledWith(expect.objectContaining({
      first_name: "Camila Maria",
      last_name: "Rojas",
      email: "camila@example.com",
    }));
    expect(container.textContent).toContain("Cambios guardados correctamente.");
  });

  test("shows the API error and always re-enables saving", async () => {
    updateCurrentUser.mockRejectedValueOnce({
      response: { data: { email: ["Ya existe una cuenta con este correo."] } },
    });
    await mountProfile();
    enterEditMode();

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent.includes("Guardar cambios")).click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Correo: Ya existe una cuenta con este correo.");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent.includes("Guardar cambios"))).toBe(true);
  });
});

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AdminUsersPage from "./AdminUsersPage";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
} from "../services/admin";

jest.mock("../services/admin", () => ({
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  getUsers: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Sidebar</aside>);

describe("AdminUsersPage", () => {
  let container;
  let root;
  const users = [
    {
      id: 1,
      username: "admin",
      first_name: "Ana",
      last_name: "Rojas",
      email: "ana@example.com",
      role: "admin",
      is_active: true,
    },
    {
      id: 2,
      username: "driver.one",
      first_name: "Luis",
      last_name: "Perez",
      email: "luis@example.com",
      role: "driver",
      is_active: true,
    },
  ];

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    getUsers.mockResolvedValue(users);
    createUser.mockResolvedValue({});
    updateUser.mockResolvedValue({});
    deleteUser.mockResolvedValue({});
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    jest.clearAllMocks();
  });

  async function render() {
    await act(async () => {
      root.render(<AdminUsersPage role="admin" />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function clickButton(label) {
    const button = [...container.querySelectorAll("button")].find((item) =>
      item.textContent.includes(label),
    );
    expect(button).toBeTruthy();
    act(() => button.click());
  }

  function setValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function setSelectValue(select, value) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    ).set;
    act(() => {
      setter.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  test("loads users, protects the only admin, sorts and filters", async () => {
    await render();

    expect(container.textContent).toContain("2 usuarios en total");
    const adminRow = [...container.querySelectorAll("tr")].find((row) =>
      row.textContent.includes("admin"),
    );
    expect(adminRow.textContent).toContain("Único");
    expect([...adminRow.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Eliminar"),
    ).disabled).toBe(true);

    act(() => container.querySelectorAll("th")[1].click());
    expect(container.textContent.indexOf("admin")).toBeLessThan(
      container.textContent.indexOf("driver.one"),
    );
  });

  test("validates and creates a normalized user", async () => {
    await render();
    clickButton("Nuevo usuario");
    clickButton("Guardar");
    expect(container.textContent).toContain("El nombre de usuario es obligatorio.");

    setValue(container.querySelector('input[autocomplete="username"]'), "bad username");
    clickButton("Guardar");
    expect(container.textContent).toContain("El usuario debe tener");

    setValue(container.querySelector('input[autocomplete="username"]'), " Sofia.Ruiz ");
    setValue(container.querySelector('input[placeholder="ej. Juan"]'), "  soFia   Maria ");
    setValue(container.querySelector('input[placeholder="ej. Pérez"]'), " ruiz ");
    setValue(container.querySelector('input[type="email"]'), " SOFIA@EXAMPLE.COM ");
    setValue(container.querySelector('input[type="password"]'), "short");
    clickButton("Guardar");
    expect(container.textContent).toContain("La contraseña debe tener al menos 12 caracteres.");

    setValue(container.querySelector('input[type="password"]'), "VerySecurePass123");
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      username: "sofia.ruiz",
      first_name: "Sofia Maria",
      last_name: "Ruiz",
      email: "sofia@example.com",
      role: "user",
      password: "VerySecurePass123",
    }));
  });

  test("edits a user, toggles password visibility and displays save failures", async () => {
    await render();
    clickButton("Editar");
    expect(container.textContent).toContain("(dejar vacío para no cambiar)");
    expect(container.querySelector("select").disabled).toBe(true);

    const visibility = [...container.querySelectorAll("label")].find((label) =>
      label.textContent.includes("Mostrar contraseña"),
    ).querySelector("input");
    act(() => {
      visibility.checked = true;
      visibility.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector('input[type="text"]')).toBeTruthy();

    setValue(container.querySelector('input[type="email"]'), "ANa@EXAMPLE.COM");
    updateUser.mockRejectedValueOnce({
      response: { data: { email: ["Correo duplicado"] } },
    });
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(updateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      email: "ana@example.com",
    }));
    expect(container.textContent).toContain("Correo duplicado");
  });

  test("filters by dates and bulk deletes selected users", async () => {
    await render();
    const dateInputs = container.querySelectorAll('input[type="date"]');
    setValue(dateInputs[0], "2026-01-01");
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getUsers).toHaveBeenLastCalledWith({ date_from: "2026-01-01"     });
    const selectAll = container.querySelector('thead input[type="checkbox"]');
    act(() => selectAll.click());
    clickButton("Eliminar seleccionados");
    await act(async () => {
      clickButton("Sí, eliminar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(deleteUser).toHaveBeenCalledWith(1);
    expect(deleteUser).toHaveBeenCalledWith(2);
  });

  test("reports loading failures", async () => {
    getUsers.mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(container.textContent).toContain("No se pudo cargar la lista de usuarios");
  });

  test("confirms deletion of a non-admin user", async () => {
    await render();
    const driverRow = [...container.querySelectorAll("tr")].find((row) =>
      row.textContent.includes("driver.one"),
    );
    act(() => {
      [...driverRow.querySelectorAll("button")].find((button) =>
        button.textContent.includes("Eliminar"),
      ).click();
    });
    await act(async () => {
      clickButton("Sí, eliminar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(deleteUser).toHaveBeenCalledWith(2);
  });
});

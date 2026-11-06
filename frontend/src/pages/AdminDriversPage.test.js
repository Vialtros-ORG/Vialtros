import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AdminDriversPage from "./AdminDriversPage";
import {
  createDriver,
  deleteDriver,
  getDrivers,
  getUsers,
  updateDriver,
} from "../services/admin";

jest.mock("../services/admin", () => ({
  createDriver: jest.fn(),
  deleteDriver: jest.fn(),
  getDrivers: jest.fn(),
  getUsers: jest.fn(),
  updateDriver: jest.fn(),
}));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Sidebar</aside>);

describe("AdminDriversPage", () => {
  let container;
  let root;
  const drivers = [
    { id: 1, user: 2, license_number: "lic-1234", user_detail: { username: "Luis", email: "luis@example.com" } },
    { id: 2, user: 3, license_number: "LIC-5678", user_detail: { username: "Ana", email: "ana@example.com" } },
  ];

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    getDrivers.mockResolvedValue(drivers);
    getUsers.mockResolvedValue([
      { id: 2, role: "driver", username: "Luis" },
      { id: 3, role: "driver", username: "Ana" },
      { id: 4, role: "driver", username: "Sofia" },
    ]);
    createDriver.mockResolvedValue({});
    updateDriver.mockResolvedValue({});
    deleteDriver.mockResolvedValue({});
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
      root.render(<AdminDriversPage role="admin" />);
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

  test("loads, sorts, searches and clears the driver list", async () => {
    await render();

    expect(container.textContent).toContain("2 conductores en total");
    expect(container.textContent.indexOf("Luis")).toBeLessThan(container.textContent.indexOf("Ana"));
    act(() => container.querySelector("th").click());
    expect(container.textContent.indexOf("Ana")).toBeLessThan(container.textContent.indexOf("Luis"));

    setValue(container.querySelector('input[placeholder^="Buscar"]'), "  luis ");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 360)));
    await act(async () => {
      clickButton("Limpiar");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(getDrivers).toHaveBeenCalledWith({ search: "  luis " });
    expect(getDrivers).toHaveBeenLastCalledWith({});
  });

  test("validates and creates a driver with a normalized license", async () => {
    await render();
    clickButton("Nuevo conductor");
    clickButton("Guardar");
    expect(container.textContent).toContain("Selecciona un usuario");

    const selects = container.querySelectorAll("select");
    setSelectValue(selects[0], "4");
    setValue(container.querySelector('input[placeholder^="ej. LIC"]'), "bad!");
    clickButton("Guardar");
    expect(container.textContent).toContain("La licencia debe tener");

    setValue(container.querySelector('input[placeholder^="ej. LIC"]'), " lic-9000 ");
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(createDriver).toHaveBeenCalledWith({
      user: "4",
      license_number: "LIC-9000",
    });
  });

  test("updates and deletes a driver", async () => {
    await render();
    clickButton("Editar");
    setValue(container.querySelector('input[placeholder^="ej. LIC"]'), "abc-1234");
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(updateDriver).toHaveBeenCalledWith(1, {
      user: 2,
      license_number: "ABC-1234",
    });

    clickButton("Eliminar");
    await act(async () => {
      clickButton("Sí, eliminar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(deleteDriver).toHaveBeenCalledWith(1);
  });

  test("renders a load error", async () => {
    getDrivers.mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(container.textContent).toContain("No se pudo cargar los datos");
  });

  test("shows API save errors", async () => {
    await render();
    clickButton("Nuevo conductor");
    setSelectValue(container.querySelector("select"), "4");
    setValue(container.querySelector('input[placeholder^="ej. LIC"]'), "ABCD");
    createDriver.mockRejectedValueOnce(new Error("conflict"));
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("No se pudo guardar el conductor.");
  });
});

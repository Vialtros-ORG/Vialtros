import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AdminPassengersPage from "./AdminPassengersPage";
import {
  assignPassengerToRoute,
  createPassenger,
  deletePassenger,
  getPassengers,
  getRoutes,
  getUsers,
  removePassengerFromRoute,
  updatePassenger,
} from "../services/admin";
import { getDriverTrackings } from "../services/dashboard";
import { geocodeAddress, snapPointToRoad } from "../services/routing";

jest.mock("../services/admin", () => ({
  assignPassengerToRoute: jest.fn(),
  createPassenger: jest.fn(),
  deletePassenger: jest.fn(),
  getPassengers: jest.fn(),
  getRoutes: jest.fn(),
  getUsers: jest.fn(),
  removePassengerFromRoute: jest.fn(),
  updatePassenger: jest.fn(),
}));
jest.mock("../services/dashboard", () => ({
  getDriverTrackings: jest.fn(),
}));
jest.mock("../services/routing", () => ({
  geocodeAddress: jest.fn(),
  snapPointToRoad: jest.fn(),
}));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Sidebar</aside>);
jest.mock("../components/LocationAutocomplete", () => ({ label, value, onChange }) => (
  <label>
    {label}
    <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
));

describe("AdminPassengersPage", () => {
  let container;
  let root;
  const passengers = [
    { id: 10, user: 2, phone: "+573001234567", pickup_address: "Casa", pickup_lat: 3.8, pickup_lng: -77.1, user_detail: { username: "Ana", email: "ana@example.com" } },
    { id: 11, user: 3, phone: "+573009876543", user_detail: { username: "Luis", email: "luis@example.com" } },
  ];
  const routes = [
    { id: 8, name: "Ruta norte", passengers: [10], passenger_details: [passengers[0]] },
    { id: 9, name: "Ruta sur", passengers: [], passenger_details: [] },
  ];

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    getPassengers.mockResolvedValue(passengers);
    getUsers.mockResolvedValue([
      { id: 2, role: "user", username: "Ana" },
      { id: 3, role: "user", username: "Luis" },
      { id: 4, role: "user", username: "Sofia" },
    ]);
    getRoutes.mockResolvedValue(routes);
    getDriverTrackings.mockResolvedValue([{ passenger: 10, status: "picked" }]);
    createPassenger.mockResolvedValue({ id: 33 });
    updatePassenger.mockResolvedValue({});
    deletePassenger.mockResolvedValue({});
    assignPassengerToRoute.mockResolvedValue({});
    removePassengerFromRoute.mockResolvedValue({});
    geocodeAddress.mockResolvedValue([3.8, -77.1]);
    snapPointToRoad.mockResolvedValue([3.81, -77.11]);
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
      root.render(<AdminPassengersPage role="admin" />);
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

  test("shows passenger route, pickup and tracking status and sorts the table", async () => {
    await render();

    expect(container.textContent).toContain("Ruta norte");
    expect(container.textContent).toContain("Casa");
    expect(container.textContent).toContain("Recogido");
    act(() => container.querySelector("th").click());
    expect(container.textContent.indexOf("Ana")).toBeLessThan(
      container.textContent.indexOf("Luis"),
    );
  });

  test("validates and creates a passenger with a geocoded pickup and route", async () => {
    await render();
    clickButton("Nuevo estudiante");
    clickButton("Guardar");
    expect(container.textContent).toContain("El usuario es obligatorio");

    const selects = container.querySelectorAll("select");
    setSelectValue(selects[0], "4");
    setValue(container.querySelector('input[type="tel"]'), "300 123 4567");
    setSelectValue(selects[1], "9");
    setValue(container.querySelector('input[aria-label="Parada intermedia"]'), " Parque central ");
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(geocodeAddress).toHaveBeenCalledWith("Parque central");
    expect(snapPointToRoad).toHaveBeenCalledWith([3.8, -77.1]);
    expect(createPassenger).toHaveBeenCalledWith({
      user: "4",
      phone: "+573001234567",
      pickup_address: "Parque central",
      pickup_lat: 3.81,
      pickup_lng: -77.11,
    });
    expect(assignPassengerToRoute).toHaveBeenCalledWith("9", 33);
  });

  test("moves a passenger between routes and deletes a passenger", async () => {
    await render();
    const row = [...container.querySelectorAll("tr")].find((item) =>
      item.textContent.includes("Ana"),
    );
    act(() => {
      [...row.querySelectorAll("button")].find((button) =>
        button.textContent.includes("Editar"),
      ).click();
    });
    setSelectValue(container.querySelectorAll("select")[1], "9");
    await act(async () => {
      clickButton("Guardar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(updatePassenger).toHaveBeenCalledWith(10, expect.objectContaining({
      pickup_lat: 3.8,
      pickup_lng: -77.1,
    }));
    expect(removePassengerFromRoute).toHaveBeenCalledWith("8", 10);
    expect(assignPassengerToRoute).toHaveBeenCalledWith("9", 10);

    const updatedRow = [...container.querySelectorAll("tr")].find((item) =>
      item.textContent.includes("Ana"),
    );
    act(() => {
      [...updatedRow.querySelectorAll("button")].find((button) =>
        button.textContent.includes("Eliminar"),
      ).click();
    });
    await act(async () => {
      clickButton("Sí, eliminar");
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(deletePassenger).toHaveBeenCalledWith(10);
  });

  test("reports loading failures", async () => {
    getPassengers.mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(container.textContent).toContain("No se pudo cargar los datos");
  });

  test("rejects an invalid phone before making an API request", async () => {
    await render();
    clickButton("Nuevo estudiante");
    setSelectValue(container.querySelector("select"), "4");
    setValue(container.querySelector('input[type="tel"]'), "not a phone");
    clickButton("Guardar");
    expect(container.textContent).toContain("Ingresa un teléfono válido");
    expect(createPassenger).not.toHaveBeenCalled();
  });
});

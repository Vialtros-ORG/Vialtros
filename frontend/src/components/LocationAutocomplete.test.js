import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LocationAutocomplete from "./LocationAutocomplete";

jest.mock("../context/GoogleMapsContext", () => ({
  useGoogleMaps: () => ({ isLoaded: false }),
}));

describe("LocationAutocomplete", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  test("exposes a labeled combobox and forwards user input", () => {
    const onChange = jest.fn();
    act(() => {
      root.render(
        <LocationAutocomplete
          label="Origen"
          value=""
          required
          onChange={onChange}
          onSelect={jest.fn()}
        />,
      );
    });

    const input = container.querySelector('[role="combobox"]');
    expect(input.getAttribute("aria-haspopup")).toBe("listbox");
    expect(input.getAttribute("aria-controls")).toBeTruthy();
    expect(input.required).toBe(true);
    expect(container.textContent).toContain("Origen");

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    act(() => {
      setter.call(input, "Buenaventura");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("Buenaventura");
  });
});

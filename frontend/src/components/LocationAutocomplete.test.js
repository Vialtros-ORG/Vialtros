import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { useGoogleMaps } from "../context/GoogleMapsContext";
import LocationAutocomplete from "./LocationAutocomplete";

jest.mock("../context/GoogleMapsContext", () => ({
  useGoogleMaps: jest.fn(),
}));

describe("LocationAutocomplete accessibility markup", () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    useGoogleMaps.mockReturnValue({ isLoaded: false });
  });

  afterEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
    jest.useRealTimers();
    delete window.google;
  });

  it("connects the labeled combobox to its listbox and preserves field state", () => {
    const markup = renderToStaticMarkup(
      <LocationAutocomplete
        label="Destino"
        value="Buenaventura"
        onChange={() => {}}
        onSelect={() => {}}
        required
        disabled
      />,
    );
    const controls = markup.match(/aria-controls="([^"]+)"/);

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-autocomplete="list"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('required=""');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('value="Buenaventura"');
    expect(controls).not.toBeNull();
    expect(controls[1]).toBeTruthy();
    expect(markup).toContain(
      `id="${controls[1]}" class="lac-dropdown" role="listbox" hidden=""`,
    );
  });

  it("supports an optional unlabeled field without making it required", () => {
    const markup = renderToStaticMarkup(
      <LocationAutocomplete
        value=""
        onChange={() => {}}
        onSelect={() => {}}
        placeholder="Busca una dirección"
      />,
    );

    expect(markup).toContain('placeholder="Busca una dirección"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("aria-required");
    expect(markup).not.toContain('required=""');
  });

  it("exposes the listbox and predicted options while results are available", async () => {
    jest.useFakeTimers();
    const predictions = [{
      place_id: "place-buenaventura",
      description: "Buenaventura, Valle del Cauca",
      types: ["locality"],
      structured_formatting: {
        main_text: "Buenaventura",
        secondary_text: "Valle del Cauca",
      },
    }];
    const getPlacePredictions = jest.fn((request, callback) => callback(predictions, "OK"));
    window.google = {
      maps: {
        LatLng: jest.fn(),
        places: {
          AutocompleteService: jest.fn(() => ({ getPlacePredictions })),
          PlacesService: jest.fn(() => ({ getDetails: jest.fn() })),
          AutocompleteSessionToken: jest.fn(() => ({})),
          PlacesServiceStatus: { OK: "OK" },
        },
      },
    };
    useGoogleMaps.mockReturnValue({ isLoaded: true });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LocationAutocomplete
          label="Destino"
          value="Buenaventura"
          onChange={() => {}}
          onSelect={() => {}}
        />,
      );
    });
    const input = container.querySelector('[role="combobox"]');
    await act(async () => input.focus());
    await act(async () => jest.advanceTimersByTime(200));

    const listbox = container.querySelector('[role="listbox"]');
    expect(getPlacePredictions).toHaveBeenCalledTimes(1);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(listbox.hidden).toBe(false);
    expect(listbox.querySelector('[role="option"]').textContent).toContain("Buenaventura");

    await act(async () => root.unmount());
    container.remove();
  });
});

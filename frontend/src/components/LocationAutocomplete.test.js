import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useGoogleMaps } from "../context/GoogleMapsContext";
import LocationAutocomplete from "./LocationAutocomplete";

jest.mock("../context/GoogleMapsContext", () => ({
  useGoogleMaps: jest.fn(),
}));

describe("LocationAutocomplete accessibility markup", () => {
  beforeEach(() => {
    useGoogleMaps.mockReturnValue({ isLoaded: false });
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
});

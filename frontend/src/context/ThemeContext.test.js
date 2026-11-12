import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider, useAppTheme } from "./ThemeContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ThemeProbe() {
  const { preference, resolvedTheme, setTheme } = useAppTheme();
  return <div><span>{preference}</span><span>{resolvedTheme}</span><button onClick={() => setTheme("dark")}>Dark</button><button onClick={() => setTheme("invalid")}>Invalid</button></div>;
}

async function renderProvider() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<ThemeProvider><ThemeProbe /></ThemeProvider>));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  });

  afterEach(() => localStorage.clear());

  it("resolves the system preference and follows system theme changes", async () => {
    let change;
    window.matchMedia.mockReturnValue({ matches: false, addEventListener: (_type, listener) => { change = listener; }, removeEventListener: jest.fn() });
    const view = await renderProvider();
    expect(view.container.textContent).toContain("systemlight");
    await act(async () => change({ matches: true }));
    expect(view.container.textContent).toContain("systemdark");
    await view.unmount();
  });

  it("persists valid selections and ignores invalid themes", async () => {
    localStorage.setItem("vialtros-theme", "light");
    const view = await renderProvider();
    expect(view.container.textContent).toContain("lightlight");
    await act(async () => view.container.querySelector("button").click());
    expect(localStorage.getItem("vialtros-theme")).toBe("dark");
    expect(view.container.textContent).toContain("darkdark");
    await act(async () => view.container.querySelectorAll("button")[1].click());
    expect(localStorage.getItem("vialtros-theme")).toBe("dark");
    await view.unmount();
  });

  it("falls back safely when storage or matchMedia is unavailable", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("disabled"); });
    window.matchMedia = undefined;
    const view = await renderProvider();
    expect(view.container.textContent).toContain("systemlight");
    await view.unmount();
    Storage.prototype.getItem.mockRestore();
  });

  it("requires consumers to be rendered inside the provider", () => {
    expect(() => renderToStaticMarkup(<ThemeProbe />)).toThrow("useAppTheme debe usarse dentro de ThemeProvider");
  });
});

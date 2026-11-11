import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PrivacyPage from "./PrivacyPage";
import SupportPage from "./SupportPage";
import TermsPage from "./TermsPage";
import { useAppTheme } from "../context/ThemeContext";

const mockNavigate = jest.fn();
jest.mock("../context/ThemeContext", () => ({ useAppTheme: jest.fn() }));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock("../components/Logo", () => ({ Logo: () => <span>Logo</span> }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderPage(Page) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<Page />));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("informational pages", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useAppTheme.mockReturnValue({ resolvedTheme: "light" });
  });

  it("renders the privacy document, section navigation, and back action", async () => {
    const view = await renderPage(PrivacyPage);
    expect(view.container.querySelector("h1").textContent).toBe("Política de privacidad");
    expect(view.container.querySelectorAll(".vt-privacy-section")).toHaveLength(7);
    expect(view.container.querySelector('[href="mailto:contacto@vialtros.com"]')).not.toBeNull();
    expect(view.container.querySelector('[aria-current="location"]').textContent).toContain("Datos que recopilamos");
    await act(async () => view.container.querySelector(".vt-privacy-back").click());
    expect(mockNavigate).toHaveBeenCalledWith(-1);
    await view.unmount();
  });

  it("renders support channels and links to related help", async () => {
    const view = await renderPage(SupportPage);
    expect(view.container.querySelector("h1").textContent).toContain("Hablemos");
    expect(view.container.querySelectorAll('a[href^="mailto:"]').length).toBeGreaterThan(0);
    expect(view.container.querySelector('a[href="/terms"]')).not.toBeNull();
    await view.unmount();
  });

  it("renders the terms document and its role sections", async () => {
    const view = await renderPage(TermsPage);
    expect(view.container.querySelector("h1").textContent).toContain("Términos");
    expect(view.container.querySelectorAll(".vt-terms-section")).toHaveLength(7);
    expect(view.container.textContent).toContain("Administrador");
    expect(view.container.querySelector('a[href="/support"]')).not.toBeNull();
    await view.unmount();
  });

  it("updates the active section when an observed section enters view", async () => {
    let observerCallback;
    const observe = jest.fn();
    const disconnect = jest.fn();
    window.IntersectionObserver = jest.fn((callback) => {
      observerCallback = callback;
      return { observe, disconnect };
    });
    const view = await renderPage(PrivacyPage);
    const section = view.container.querySelector("#privacy-contacto");
    await act(async () => observerCallback([{ isIntersecting: true, boundingClientRect: { top: 10 }, target: section }]));
    expect(view.container.querySelector('.vt-privacy-toc a[aria-current="location"]').getAttribute("href")).toBe("#privacy-contacto");
    expect(observe).toHaveBeenCalledTimes(7);
    await view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    delete window.IntersectionObserver;
  });
});

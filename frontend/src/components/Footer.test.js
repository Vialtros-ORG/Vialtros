import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useLocation } from "react-router-dom";
import Footer from "./Footer";

jest.mock("react-router-dom", () => {
  const ReactModule = require("react");

  return {
    Link: ({ to, ...props }) => ReactModule.createElement("a", { ...props, href: to }),
    useLocation: jest.fn(),
  };
}, { virtual: true });

function renderFooter(pathname = "/support") {
  useLocation.mockReturnValue({ pathname });

  return renderToStaticMarkup(
    <Footer />,
  );
}

describe("Footer", () => {
  test("no se muestra en la página de inicio", () => {
    const markup = renderFooter("/");

    expect(markup).toBe("");
  });

  test("muestra información institucional y enlaces de navegación", () => {
    const markup = renderFooter();

    expect(markup).toContain('<footer');
    expect(markup).toMatch(/<a aria-label="Ir al inicio de Vialtros"[^>]*href="\/">/);
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('href="/terms"');
    expect(markup).toContain('href="/support"');
  });

  test("distingue enlaces externos, contacto y ubicación", () => {
    const markup = renderFooter();

    expect(markup).toContain('href="https://vialtros.com" target="_blank" rel="noopener noreferrer"');
    expect(markup).toContain('href="tel:6023212100"');
    expect(markup).toContain('href="mailto:contacto@vialtros.com"');
    expect(markup).toContain("Buenaventura, Valle del Cauca");
  });

  test("renderiza las redes sociales con nombres accesibles y enlaces seguros", () => {
    const markup = renderFooter();

    [
      ["Síguenos en YouTube", "https://youtube.com/@vialtros"],
      ["Síguenos en Facebook", "https://facebook.com/vialtros"],
      ["Síguenos en Twitter", "https://twitter.com/vialtros"],
      ["Síguenos en Instagram", "https://instagram.com/vialtros"],
    ].forEach(([label, href]) => {
      expect(markup).toContain(`aria-label="${label}"`);
      expect(markup).toContain(`href="${href}"`);
    });
    expect(markup).toContain('target="_blank" rel="noopener noreferrer"');
  });
});

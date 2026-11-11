import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ActivityFeed from "./ActivityFeed";
import StatCard from "./StatCard";
import HeroCard from "./HeroCard";
import { icons } from "./icons";
import useTrackingRoute from "./useTrackingRoute";

jest.mock("./useTrackingRoute", () => jest.fn());

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => require("react").createElement("a", { href: to, ...props }, children),
}), { virtual: true });

function renderMarkup(element) {
  return renderToStaticMarkup(element);
}

describe("dashboard visual components", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  it("shows role-specific journey labels and available tracking actions", () => {
    useTrackingRoute.mockReturnValue({ trackingLink: "/tracking/42", trackingEnabled: true });

    expect(renderMarkup(<HeroCard role="admin" />)).toContain("Centro de rutas");
    expect(renderMarkup(<HeroCard role="driver" />)).toContain("Tu jornada");
    expect(renderMarkup(<HeroCard role="user" />)).toContain("Tu recorrido");
    expect(renderMarkup(<HeroCard role="unknown" />)).toContain("Tu recorrido");

    const enabled = renderMarkup(<HeroCard role="driver" />);
    expect(enabled).toContain('href="/tracking/42"');
    expect(enabled).toContain("Abrir mapa");
  });

  it("explains why tracking cannot open when the role has no assigned route", () => {
    useTrackingRoute.mockReturnValue({ trackingLink: "/tracking/1", trackingEnabled: false });

    expect(renderMarkup(<HeroCard role="admin" />)).toContain("No hay rutas registradas");
    expect(renderMarkup(<HeroCard role="driver" />)).toContain("No tienes rutas asignadas");
    expect(renderMarkup(<HeroCard role="user" />)).toContain("No tienes ruta asignada");
    expect(renderMarkup(<HeroCard role="driver" />)).toContain("disabled=");
  });

  it("renders activity loading, empty states by role, and recent items", () => {
    const loading = renderMarkup(<ActivityFeed loading />);
    expect(loading).toContain("role=\"status\"");
    expect(loading).toContain("Cargando actividad reciente");
    expect(renderMarkup(<ActivityFeed role="admin" />)).toContain("del sistema");
    expect(renderMarkup(<ActivityFeed role="driver" />)).toContain("rutas asignadas");
    expect(renderMarkup(<ActivityFeed role="user" />)).toContain("ruta asignada");

    const feed = renderMarkup(<ActivityFeed activities={[
      { id: 1, icon: "tracking", tone: "blue", title: "Ruta activa", subtitle: "Conductor", timestamp: new Date().toISOString() },
      { id: 2, icon: "unknown", tone: "unknown", title: "Sin señal", subtitle: "Ruta 2", timestamp: "no-es-fecha" },
    ]} />);
    expect(feed).toContain("Ruta activa");
    expect(feed).toContain("Ahora");
    expect(feed).toContain("Sin hora");
    expect(feed).toContain("/activity");
  });

  it("maps metric tones and trend direction to readable labels", () => {
    const markup = renderMarkup(<>
      <StatCard icon={icons.routes} value={4} label="Rutas" color="green" trend="up" trendLabel="Activas" />
      <StatCard icon={icons.bus} value={2} label="Vehículos" color="unknown" trend="down" trendLabel="Disponibles" />
      <StatCard icon={icons.activity} value={0} label="Sin tendencia" />
    </>);
    expect(markup).toContain("vt-dashboard-stat--live");
    expect(markup).toContain("is-up");
    expect(markup).toContain("vt-dashboard-stat--route");
    expect(markup).toContain("is-down");
    expect(markup).toContain("Sin tendencia");
  });

  it("renders every dashboard icon as an SVG", () => {
    const markup = Object.values(icons).map((icon) => renderMarkup(icon({ size: 18 }))).join("");
    expect((markup.match(/<svg/g) || []).length).toBe(Object.keys(icons).length);
    expect(markup).toContain("stroke=\"currentColor\"");
  });

});

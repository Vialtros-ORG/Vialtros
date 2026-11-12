import React, { useEffect, useState } from "react";
import "./RouteMapBackground.css";

const ROUTES = [
  { id: "route-main", label: "Ruta principal", path: "M-120 720 H220 V540 H550 V360 H880 V270 H1210 H1700", color: "main" },
  { id: "route-secondary", label: "Ruta secundaria", path: "M330 1100 V810 H770 V540 H1100 V90 H1700", color: "secondary" },
];

function Vehicle({ route, reducedMotion }) {
  return (
    <g className={`vt-route-vehicle vt-route-vehicle--${route.color}`} aria-hidden="true">
      {!reducedMotion && <animateMotion dur={route.color === "main" ? "22s" : "27s"} repeatCount="indefinite" rotate="auto">
        <mpath href={`#${route.id}`} />
      </animateMotion>}
      <g transform="translate(-14 -9)">
        <rect x="1" y="3" width="25" height="13" rx="4" />
        <path d="M6 3 9 0h9l4 3" />
        <rect x="9" y="1.5" width="4" height="3" rx=".7" className="vt-route-window" />
        <rect x="15" y="1.5" width="4" height="3" rx=".7" className="vt-route-window" />
        <circle cx="7" cy="17" r="2.4" className="vt-route-wheel" />
        <circle cx="21" cy="17" r="2.4" className="vt-route-wheel" />
      </g>
    </g>
  );
}

export default function RouteMapBackground({ variant = "hero" }) {
  const [activeRoute, setActiveRoute] = useState(ROUTES[0].id);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const selectWithKeyboard = (event, routeId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveRoute(routeId);
    }
  };

  return (
    <div className={`vt-route-map vt-route-map--${variant}`} aria-label="Mapa ilustrativo con rutas interactivas">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" role="group" aria-label="Rutas demostrativas; activa una ruta o una parada para resaltarla">
        <g transform="rotate(-8 720 450)">
          {ROUTES.map((route) => (
            <g key={route.id} className={`vt-route-line vt-route-line--${route.color}${activeRoute === route.id ? " is-active" : ""}`}>
              <path id={route.id} className="vt-route-visible" d={route.path} />
              <path
                className="vt-route-hit"
                d={route.path}
                role="button"
                tabIndex="0"
                aria-label={`Seleccionar ${route.label}`}
                aria-pressed={activeRoute === route.id}
                onClick={() => setActiveRoute(route.id)}
                onKeyDown={(event) => selectWithKeyboard(event, route.id)}
              />
              <Vehicle route={route} reducedMotion={reducedMotion} />
            </g>
          ))}
          {[
            { x: 220, y: 630, route: ROUTES[0].id },
            { x: 550, y: 450, route: ROUTES[0].id },
            { x: 880, y: 315, route: ROUTES[0].id },
            { x: 770, y: 675, route: ROUTES[1].id },
            { x: 1100, y: 315, route: ROUTES[1].id },
          ].map((stop, index) => (
            <circle
              key={`${stop.x}-${stop.y}`}
              className={`vt-route-stop${activeRoute === stop.route ? " is-active" : ""}`}
              cx={stop.x}
              cy={stop.y}
              r="7"
              role="button"
              tabIndex="0"
              aria-label={`Seleccionar ${ROUTES.find((route) => route.id === stop.route).label}, parada ${index + 1}`}
              onClick={() => setActiveRoute(stop.route)}
              onKeyDown={(event) => selectWithKeyboard(event, stop.route)}
            />
          ))}
        </g>
      </svg>
      <span className="vt-route-map-status" aria-live="polite">
        Visualización demostrativa · {ROUTES.find((route) => route.id === activeRoute).label}
      </span>
    </div>
  );
}

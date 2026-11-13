import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaBusSimple,
  FaBuilding,
  FaFacebookF,
  FaGraduationCap,
  FaInstagram,
  FaLocationDot,
  FaMap,
  FaShieldHalved,
  FaSliders,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { Logo } from "../components/Logo";
import { isAuthenticated } from "../services/auth";
import landingVideo from "../assets/landing-operations.mp4";
import landingPoster from "../assets/landing-operations-poster.jpg";
import "./LandingPage.css";

const SECTORS = [
  {
    number: "01",
    Icon: FaGraduationCap,
    title: "Instituciones educativas",
    description:
      "Control de rutas escolares, asistencia de estudiantes y notificaciones a las familias.",
  },
  {
    number: "02",
    Icon: FaBuilding,
    title: "Empresas corporativas",
    description:
      "Transporte de empleados con visibilidad de la flota y reportes de operación.",
  },
  {
    number: "03",
    Icon: FaBusSimple,
    title: "Operadores de transporte",
    description:
      "Gestión de flotas, múltiples rutas y conductores desde un panel unificado.",
  },
];

const ROLES = [
  {
    name: "Administrador",
    subtitle: "Control de la operación",
    title: "Control total de la operación",
    description:
      "Visión completa del sistema: rutas, conductores, reportes y configuración global.",
    benefits: [
      "Panel de control y reportes",
      "Gestión de conductores y vehículos",
      "Configuración de rutas y paradas",
      "Analíticas y configuración del sistema",
    ],
  },
  {
    name: "Conductor",
    subtitle: "Operación en ruta",
    title: "Operación simple y eficiente",
    description:
      "Consulta la ruta asignada y registra la asistencia de pasajeros en cada parada.",
    benefits: [
      "Ver ruta y paradas del día",
      "Registro de asistencia por parada",
      "Reporte de incidencias",
      "Historial de viajes",
    ],
  },
  {
    name: "Pasajero",
    subtitle: "Seguimiento personal",
    title: "Seguimiento durante el recorrido",
    description:
      "Consulta la información de tu ruta y el avance compartido por el conductor.",
    benefits: [
      "Ubicación del vehículo en ruta",
      "Horarios y paradas asignadas",
      "Historial de asistencia personal",
      "Avisos asociados al recorrido",
    ],
  },
];

const SOCIAL_LINKS = [
  { name: "Instagram", href: "https://instagram.com/vialtros", Icon: FaInstagram },
  { name: "Facebook", href: "https://facebook.com/vialtros", Icon: FaFacebookF },
  { name: "TikTok", href: "https://www.tiktok.com/@vialtros", Icon: FaTiktok },
  { name: "YouTube", href: "https://youtube.com/@vialtros", Icon: FaYoutube },
];

const MARQUEE = [
  "Rutas conectadas",
  "Gestión de flotas",
  "Seguimiento GPS",
  "Información para cada perfil",
];

function RadarIllustration() {
  return (
    <svg className="vt-lp-radar-art" viewBox="0 0 220 220" role="img" aria-label="Ilustración de seguimiento de vehículos">
      {[30, 60, 90].map((radius) => <circle key={radius} cx="110" cy="110" r={radius} />)}
      <path d="M110 110V20A90 90 0 0 1 174 46Z" className="vt-lp-radar-sweep" />
      <line x1="110" y1="14" x2="110" y2="206" />
      <line x1="14" y1="110" x2="206" y2="110" />
      <circle cx="110" cy="110" r="6" className="vt-lp-radar-center" />
      <circle cx="150" cy="62" r="6" className="vt-lp-radar-dot" />
      <circle cx="68" cy="150" r="6" className="vt-lp-radar-dot vt-lp-radar-dot--amber" />
      <circle cx="164" cy="140" r="6" className="vt-lp-radar-dot vt-lp-radar-dot--green" />
    </svg>
  );
}

export default function LandingPage() {
  const [activeRole, setActiveRole] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [videoVisible, setVideoVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const authenticated = isAuthenticated();
  const actionPath = authenticated ? "/dashboard" : "/login";
  const actionLabel = authenticated ? "Ir al panel" : "Acceder al sistema";
  const role = ROLES[activeRole];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!videoReady || !videoAvailable || reduceMotion) return undefined;
    const rotation = window.setInterval(() => setVideoVisible((visible) => !visible), 9000);
    return () => window.clearInterval(rotation);
  }, [videoReady, videoAvailable, reduceMotion]);

  useEffect(() => {
    const titles = document.querySelectorAll(".vt-lp-reveal-title");
    const elements = document.querySelectorAll(
      ".vt-lp-scroll-reveal, .vt-lp-intro > .vt-lp-eyebrow, .vt-lp-intro > .vt-lp-lead, .vt-lp-marquee-track span, .vt-lp-trust span, .vt-lp-socials a, .vt-lp-footer-inner > *",
    );
    const revealAll = () => {
      [...titles, ...elements].forEach((element) => element.classList.add("is-visible"));
    };

    elements.forEach((element, index) => {
      element.classList.add("vt-lp-scroll-reveal");
      element.style.setProperty("--lp-reveal-delay", `${(index % 4) * 75}ms`);
    });

    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      revealAll();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -36px 0px" },
    );

    [...titles, ...elements].forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activeRole]);

  const changeRoleByKey = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextRole = (activeRole + delta + ROLES.length) % ROLES.length;
    setActiveRole(nextRole);
    document.getElementById(`vt-lp-tab-${nextRole}`)?.focus();
  };

  return (
    <div className="vt-lp">
      <a className="vt-lp-skip" href="#vt-lp-main">Saltar al contenido</a>

      <nav className="vt-lp-nav" aria-label="Navegación principal">
        <Logo to="/" variant="light" iconSize={30} />
        <button
          className="vt-lp-menu"
          type="button"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          aria-controls="vt-lp-nav-links"
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
        ><span /><span /><span /></button>
        <div className={`vt-lp-navlinks${menuOpen ? " is-open" : ""}`} id="vt-lp-nav-links">
          <a href="#sectores" onClick={() => setMenuOpen(false)}>Sectores</a>
          <a href="#caracteristicas" onClick={() => setMenuOpen(false)}>Características</a>
          <a href="#roles" onClick={() => setMenuOpen(false)}>Roles</a>
        </div>
        <Link className="vt-lp-button vt-lp-primary vt-lp-nav-action" to={actionPath}>{actionLabel}</Link>
      </nav>

      <main id="vt-lp-main">
        <header className="vt-lp-hero" id="inicio">
          <div className="vt-lp-hero-visual" aria-hidden="true">
            <img
              className={`vt-lp-hero-image${videoVisible ? " is-hidden" : ""}`}
              src={landingPoster}
              alt=""
            />
            {videoAvailable && !reduceMotion && (
              <video
                className={`vt-lp-hero-video${videoVisible ? " is-visible" : ""}`}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={landingPoster}
                aria-hidden="true"
                tabIndex={-1}
                onPlay={() => setVideoReady(true)}
                onPause={() => {
                  setVideoReady(false);
                  setVideoVisible(false);
                }}
                onError={() => setVideoAvailable(false)}
              >
                <source src={landingVideo} type="video/mp4" />
              </video>
            )}
            <span />
          </div>
          <div className="vt-lp-wrap vt-lp-hero-content">
            <div className="vt-lp-hero-copy">
              <span className="vt-lp-badge"><i /> Gestión de transporte</span>
              <h1 className="vt-lp-display vt-lp-title">
                <span>Cada trayecto,</span>
                <span className="vt-lp-title-accent">siempre a la vista.</span>
              </h1>
              <p className="vt-lp-lead">Coordina rutas, conductores y pasajeros. Sigue el avance de cada vehículo en tiempo real.</p>
              <div className="vt-lp-actions">
                <Link className="vt-lp-button vt-lp-primary vt-lp-big" to={actionPath}>{actionLabel}<FaArrowRight aria-hidden="true" /></Link>
                <a className="vt-lp-button vt-lp-ghost vt-lp-big" href="#caracteristicas">Ver características</a>
              </div>
              <div className="vt-lp-trust"><span>✓ Para empresas y colegios</span><span>✓ Seguimiento en tiempo real</span></div>
            </div>
          </div>
          <a className="vt-lp-scroll" href="#sectores" aria-label="Desplazarse a Sectores" />
        </header>

        <div className="vt-lp-marquee" aria-hidden="true">
          <div className="vt-lp-marquee-track">
            {[0, 1].map((copy) => (
              <div className="vt-lp-marquee-group" key={copy}>
                {MARQUEE.map((item) => <span key={item}>{item}</span>)}
              </div>
            ))}
          </div>
        </div>

        <section className="vt-lp-section" id="sectores" aria-labelledby="vt-lp-sectors-title">
          <div className="vt-lp-wrap">
            <div className="vt-lp-intro"><span className="vt-lp-eyebrow vt-lp-scroll-reveal">Sectores</span><h2 className="vt-lp-display vt-lp-reveal-title" id="vt-lp-sectors-title">Pensado para quien<br />mueve personas</h2><p className="vt-lp-lead vt-lp-scroll-reveal">Vialtros se adapta a las organizaciones que necesitan coordinar su flota y dar seguimiento a sus pasajeros.</p></div>
            <div className="vt-lp-sectors">{SECTORS.map(({ number, Icon, title, description }) => <article className="vt-lp-sector vt-lp-scroll-reveal" key={number}><div className="vt-lp-sector-inner"><span className="vt-lp-number" aria-hidden="true">{number}</span><span className="vt-lp-sector-icon"><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p></div></article>)}</div>
          </div>
        </section>

        <section className="vt-lp-section vt-lp-features" id="caracteristicas" aria-labelledby="vt-lp-features-title">
          <div className="vt-lp-wrap">
            <div className="vt-lp-intro"><span className="vt-lp-eyebrow vt-lp-scroll-reveal">Características</span><h2 className="vt-lp-display vt-lp-reveal-title" id="vt-lp-features-title">Todo en una sola<br />plataforma</h2><p className="vt-lp-lead vt-lp-scroll-reveal">Información útil para coordinar recorridos y dar seguimiento a cada etapa de la operación.</p></div>
            <div className="vt-lp-bento">
              <article className="vt-lp-tile vt-lp-tile-wide vt-lp-scroll-reveal"><div className="vt-lp-tile-copy"><span className="vt-lp-kicker"><FaLocationDot aria-hidden="true" /></span><h3>Seguimiento en ruta</h3><p>Consulta la ubicación compartida por el conductor y revisa el avance de los recorridos activos.</p></div><RadarIllustration /></article>
              <article className="vt-lp-tile vt-lp-scroll-reveal"><span className="vt-lp-kicker"><FaShieldHalved aria-hidden="true" /></span><h3>Acceso por roles</h3><p>Cada usuario encuentra las herramientas y la información correspondientes a su perfil.</p></article>
              <article className="vt-lp-tile vt-lp-tile-half vt-lp-scroll-reveal"><span className="vt-lp-kicker"><FaSliders aria-hidden="true" /></span><h3>Panel centralizado</h3><p>Administra rutas, horarios, conductores y pasajeros desde un mismo lugar.</p><div className="vt-lp-pills"><span>Rutas</span><span>Horarios</span><span>Conductores</span><span>Pasajeros</span></div></article>
              <article className="vt-lp-tile vt-lp-tile-half vt-lp-scroll-reveal"><span className="vt-lp-kicker"><FaMap aria-hidden="true" /></span><h3>Control de asistencia</h3><p>Consulta los registros de cada recorrido por ruta, conductor y fecha.</p><div className="vt-lp-checks">{[1, 2, 3, 4].map((stop) => <span key={stop}><i>✓</i>Parada {stop}</span>)}</div></article>
            </div>
          </div>
        </section>

        <section className="vt-lp-section" id="roles" aria-labelledby="vt-lp-roles-title">
          <div className="vt-lp-wrap">
            <div className="vt-lp-intro"><span className="vt-lp-eyebrow vt-lp-scroll-reveal">Roles</span><h2 className="vt-lp-display vt-lp-reveal-title" id="vt-lp-roles-title">Cada perfil tiene<br />su propio espacio</h2></div>
            <div className="vt-lp-role-grid">
              <div className="vt-lp-tabs" role="tablist" aria-label="Perfiles de usuario" aria-orientation="vertical">{ROLES.map(({ name, subtitle }, index) => <button className="vt-lp-scroll-reveal" key={name} id={`vt-lp-tab-${index}`} role="tab" aria-selected={activeRole === index} aria-controls="vt-lp-role-panel" tabIndex={activeRole === index ? 0 : -1} onClick={() => setActiveRole(index)} onKeyDown={changeRoleByKey}><strong>{name}</strong><span>{subtitle}</span></button>)}</div>
              <article className="vt-lp-role-panel vt-lp-scroll-reveal" id="vt-lp-role-panel" role="tabpanel" aria-labelledby={`vt-lp-tab-${activeRole}`} key={activeRole}><span className="vt-lp-role-badge">{role.name}</span><h3 className="vt-lp-display">{role.title}</h3><p>{role.description}</p><ul>{role.benefits.map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}</ul></article>
            </div>
          </div>
        </section>

        <section className="vt-lp-section vt-lp-cta-section" id="acceso" aria-labelledby="vt-lp-cta-title">
          <div className="vt-lp-wrap">
            <div className="vt-lp-cta vt-lp-scroll-reveal">
              <svg className="vt-lp-cta-map-art" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <defs>
                  <pattern id="vt-lp-cta-city" width="220" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
                    <rect width="220" height="180" fill="#0d1f25" />
                    <g fill="#183139" opacity=".6">
                      <path d="M8 8h72v48H8zM98 8h45v48H98zM160 8h52v48h-52z" />
                      <path d="M8 74h45v42H8zM70 74h73v42H70zM160 74h52v42h-52z" />
                      <path d="M8 134h72v38H8zM98 134h45v38H98zM160 134h52v38h-52z" />
                    </g>
                    <path d="M0 64h220M0 126h220M88 0v180M152 0v180" fill="none" stroke="rgba(145,184,191,.13)" strokeWidth="10" />
                  </pattern>
                  <radialGradient id="vt-lp-cta-radar">
                    <stop offset="0" stopColor="#3fb3c2" stopOpacity=".12" />
                    <stop offset="1" stopColor="#3fb3c2" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect width="1440" height="900" fill="url(#vt-lp-cta-city)" />
                <path d="M-100 835c165-90 220-35 370-98l92-43c112-51 216-49 316-99l150-74c127-63 266-60 690-210" fill="none" stroke="rgba(63,179,194,.12)" strokeWidth="30" />
                <g className="vt-lp-cta-radar" fill="none" stroke="rgba(145,184,191,.14)">
                  <circle cx="1120" cy="430" r="170" />
                  <circle cx="1120" cy="430" r="285" strokeDasharray="4 14" />
                  <circle cx="1120" cy="430" r="400" />
                  <circle cx="1120" cy="430" r="170" fill="url(#vt-lp-cta-radar)" stroke="none" />
                </g>
                <g className="vt-lp-cta-route" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M-80 710H220V540H550V360H880V270H1210H1510" stroke="rgba(63,179,194,.28)" strokeWidth="6" />
                  <path d="M330 960V810H770V540H1100V90H1510" stroke="rgba(190,157,94,.2)" strokeWidth="4" />
                </g>
                <circle className="vt-lp-cta-location" cx="1120" cy="430" r="20" />
                <circle className="vt-lp-cta-location vt-lp-cta-location-secondary" cx="930" cy="720" r="12" />
              </svg>
              <div className="vt-lp-cta-copy">
                <h2 className="vt-lp-display vt-lp-reveal-title" id="vt-lp-cta-title">Tu operación merece más visibilidad</h2>
                <p>Empieza hoy. Sin configuraciones complejas.</p>
                <Link className="vt-lp-button vt-lp-primary vt-lp-big" to={actionPath}>{actionLabel}<FaArrowRight aria-hidden="true" /></Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="vt-lp-footer"><div className="vt-lp-footer-inner"><Logo to="/" variant="light" iconSize={26} /><nav className="vt-lp-footer-links" aria-label="Enlaces informativos"><Link to="/privacy">Privacidad</Link><Link to="/terms">Términos</Link><Link to="/support">Soporte</Link></nav><div className="vt-lp-socials" role="group" aria-label="Redes sociales de Vialtros">{SOCIAL_LINKS.map(({ name, href, Icon }) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Vialtros en ${name}`}><Icon aria-hidden="true" /></a>)}</div></div></footer>
    </div>
  );
}

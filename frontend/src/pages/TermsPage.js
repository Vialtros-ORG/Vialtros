import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IoArrowBack, IoArrowForward } from "react-icons/io5";
import { Logo } from "../components/Logo";
import { useAppTheme } from "../context/ThemeContext";
import "./TermsPage.css";

const SECTIONS = [
  { id: "descripcion", title: "Descripción del servicio" },
  { id: "roles", title: "Roles y responsabilidades" },
  { id: "uso", title: "Uso aceptable" },
  { id: "gps", title: "Precisión del GPS y limitaciones" },
  { id: "suspension", title: "Suspensión del servicio" },
  { id: "modificaciones", title: "Modificaciones" },
  { id: "contacto", title: "Contacto" },
];

const ROLE_TERMS = [
  {
    title: "Administrador",
    points: [
      "Gestionar usuarios, conductores, pasajeros y rutas dentro de la plataforma.",
      "Monitorear el estado de las rutas y el seguimiento GPS en tiempo real.",
      "Es responsable de la veracidad de la información registrada (conductores, licencias, rutas).",
    ],
  },
  {
    title: "Conductor",
    points: [
      "Compartir su ubicación GPS durante rutas activas para permitir el seguimiento.",
      "Registrar correctamente el estado de cada pasajero: recogido, no recogido o dejado en destino.",
      "No falsificar su ubicación ni los estados de recogida o entrega.",
    ],
  },
  {
    title: "Pasajero / Usuario",
    points: [
      "Visualizar la ruta asignada y el tracking del vehículo en tiempo real.",
      "Recibir notificaciones automáticas sobre el estado de la ruta.",
      "Calificar el servicio del conductor al finalizar la ruta.",
    ],
  },
];

const ACCEPTABLE_USE = [
  "La plataforma es de uso exclusivo para la gestión de transporte autorizado.",
  "Queda prohibido compartir credenciales de acceso con terceros.",
  "Queda prohibido el acceso no autorizado a cuentas de otros usuarios.",
  "Queda prohibido el uso de la plataforma para fines distintos a la gestión de transporte.",
  "Queda prohibida cualquier manipulación de datos de ubicación, estados de recogida o calificaciones.",
];

function RouteMark() {
  return (
    <svg className="vt-terms-route" viewBox="0 0 420 720" fill="none" aria-hidden="true">
      <path d="M460-24C312 83 408 205 271 264S74 340 171 441 361 537 245 626 93 700 92 760" className="vt-terms-route-glow" />
      <path d="M460-24C312 83 408 205 271 264S74 340 171 441 361 537 245 626 93 700 92 760" className="vt-terms-route-line" />
      <circle cx="271" cy="264" r="6" className="vt-terms-route-stop" />
      <circle cx="171" cy="441" r="6" className="vt-terms-route-stop" />
      <circle cx="245" cy="626" r="7" className="vt-terms-route-destination" />
    </svg>
  );
}

function TermList({ items }) {
  return <ul className="vt-terms-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

export default function TermsPage() {
  const navigate = useNavigate();
  const { resolvedTheme } = useAppTheme();
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  useEffect(() => {
    const targets = SECTIONS.map(({ id }) => document.getElementById(`terms-${id}`)).filter(Boolean);
    if (!("IntersectionObserver" in window) || targets.length === 0) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id.replace("terms-", ""));
    }, { rootMargin: "-12% 0px -72% 0px", threshold: 0 });

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="vt-terms-page">
      <RouteMark />
      <header className="vt-terms-header">
        <Link to="/" className="vt-terms-brand" aria-label="Vialtros, ir al inicio">
          <Logo iconSize={27} variant={resolvedTheme === "dark" ? "light" : "default"} />
        </Link>
        <nav aria-label="Enlaces informativos">
          <Link to="/privacy">Privacidad</Link>
          <Link to="/support">Soporte</Link>
          <Link className="vt-terms-access" to="/login">Acceder al sistema</Link>
        </nav>
      </header>

      <div className="vt-terms-layout">
        <aside className="vt-terms-aside">
          <button className="vt-terms-back" type="button" onClick={() => navigate(-1)}>
            <IoArrowBack aria-hidden="true" /> Volver
          </button>
          <nav className="vt-terms-toc" aria-label="Contenido de términos y condiciones">
            <h2>En esta página</h2>
            {SECTIONS.map(({ id, title }, index) => (
              <a
                href={`#terms-${id}`}
                key={id}
                className={activeSection === id ? "is-active" : ""}
                aria-current={activeSection === id ? "location" : undefined}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>{title}
              </a>
            ))}
            <div className="vt-terms-toc-related">
              <h2>Información relacionada</h2>
              <Link to="/privacy">Política de privacidad</Link>
              <Link to="/support">Centro de soporte</Link>
            </div>
          </nav>
        </aside>

        <main className="vt-terms-document">
          <button className="vt-terms-mobile-back" type="button" onClick={() => navigate(-1)}>
            <IoArrowBack aria-hidden="true" /> Volver
          </button>
          <p className="vt-terms-kicker">Información legal</p>
          <h1>Términos y condiciones</h1>
          <p className="vt-terms-date">Vigentes desde junio de 2026</p>
          <p className="vt-terms-intro">
            Al registrarse y utilizar Vialtros, el usuario acepta estos términos en su totalidad. Si no está de acuerdo, debe abstenerse de usar la plataforma.
          </p>

          <section className="vt-terms-section" id="terms-descripcion" aria-labelledby="terms-title-descripcion">
            <h2 id="terms-title-descripcion"><span>01</span>{SECTIONS[0].title}</h2>
            <p>
              Vialtros es una plataforma SaaS de gestión de rutas y transporte que incluye seguimiento GPS en tiempo real, sistema de notificaciones automáticas, panel de administración y calificación del servicio. Está diseñada para instituciones y operadores de transporte en Colombia.
            </p>
          </section>

          <section className="vt-terms-section" id="terms-roles" aria-labelledby="terms-title-roles">
            <h2 id="terms-title-roles"><span>02</span>{SECTIONS[1].title}</h2>
            <div className="vt-terms-roles">
              {ROLE_TERMS.map(({ title, points }) => (
                <section className="vt-terms-role" key={title} aria-label={title}>
                  <h3>{title}</h3>
                  <TermList items={points} />
                </section>
              ))}
            </div>
          </section>

          <section className="vt-terms-section" id="terms-uso" aria-labelledby="terms-title-uso">
            <h2 id="terms-title-uso"><span>03</span>{SECTIONS[2].title}</h2>
            <TermList items={ACCEPTABLE_USE} />
          </section>

          <section className="vt-terms-section" id="terms-gps" aria-labelledby="terms-title-gps">
            <h2 id="terms-title-gps"><span>04</span>{SECTIONS[3].title}</h2>
            <p>
              El seguimiento GPS depende de la señal y las condiciones del dispositivo del conductor. Vialtros no garantiza una precisión absoluta en todo momento y no se responsabiliza por variaciones derivadas de condiciones técnicas externas (señal, hardware, conectividad).
            </p>
          </section>

          <section className="vt-terms-section" id="terms-suspension" aria-labelledby="terms-title-suspension">
            <h2 id="terms-title-suspension"><span>05</span>{SECTIONS[4].title}</h2>
            <p>
              Vialtros se reserva el derecho de suspender o eliminar cuentas que incumplan estos términos, sin previo aviso en casos de uso fraudulento o que comprometan la seguridad de otros usuarios.
            </p>
          </section>

          <section className="vt-terms-section" id="terms-modificaciones" aria-labelledby="terms-title-modificaciones">
            <h2 id="terms-title-modificaciones"><span>06</span>{SECTIONS[5].title}</h2>
            <p>
              Vialtros puede modificar estos términos en cualquier momento. Los cambios relevantes se notificarán a través de la plataforma o por correo electrónico con un plazo razonable de anticipación.
            </p>
          </section>

          <section className="vt-terms-section" id="terms-contacto" aria-labelledby="terms-title-contacto">
            <h2 id="terms-title-contacto"><span>07</span>{SECTIONS[6].title}</h2>
            <ul className="vt-terms-list vt-terms-contact-list">
              <li><strong>Correo</strong><a href="mailto:contacto@vialtros.com">contacto@vialtros.com</a></li>
              <li><strong>Teléfono</strong><a href="tel:+576023212100">602 321 2100 · Ext. 2649 o 2653</a></li>
              <li><strong>Dirección</strong><span>Buenaventura, Valle del Cauca, Colombia</span></li>
            </ul>
          </section>

          <footer className="vt-terms-footer">
            <span>Vialtros · Colombia</span>
            <Link to="/support">¿Tienes una pregunta? Contacta a soporte <IoArrowForward aria-hidden="true" /></Link>
          </footer>
        </main>
      </div>
    </div>
  );
}

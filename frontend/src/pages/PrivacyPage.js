import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IoArrowBack, IoArrowForward } from "react-icons/io5";
import { Logo } from "../components/Logo";
import { useAppTheme } from "../context/ThemeContext";
import "./PrivacyPage.css";

const SECTIONS = [
  { id: "recopilacion", title: "Datos que recopilamos" },
  { id: "uso", title: "Para qué usamos los datos" },
  { id: "proteccion", title: "Protección de los datos" },
  { id: "terceros", title: "Compartir información con terceros" },
  { id: "derechos", title: "Derechos del usuario" },
  { id: "cambios", title: "Cambios a esta política" },
  { id: "contacto", title: "Contacto" },
];

const DATA_TYPES = [
  ["Datos de identificación", "nombre, apellido, nombre de usuario, correo electrónico, número de teléfono y rol (administrador, conductor o pasajero)."],
  ["Datos de conductor", "número de licencia de conducción."],
  ["Datos de pasajero", "dirección de recogida y coordenadas GPS asociadas (latitud y longitud)."],
  ["Datos de ubicación en tiempo real", "coordenadas GPS, velocidad del vehículo y marca de tiempo, transmitidos durante rutas activas."],
  ["Datos de uso", "historial de rutas, estados de recogida y entrega, calificaciones del servicio (1 a 5 estrellas) y comentarios opcionales."],
  ["Datos técnicos", "tokens de sesión JWT (acceso y refresco) y tokens de recuperación de contraseña con expiración de 1 hora."],
];

const DATA_USES = [
  "Gestionar la asignación de rutas, conductores y pasajeros.",
  "Proveer el seguimiento GPS en tiempo real del vehículo durante rutas activas.",
  "Enviar notificaciones automáticas: inicio de ruta, recogida de pasajero, proximidad a parada y llegada al destino.",
  "Generar estadísticas de operación para administradores (rutas completadas, actividad semanal).",
  "Permitir la recuperación de contraseña por correo electrónico.",
  "Mejorar la seguridad y la calidad del servicio de transporte.",
];

const PROTECTIONS = [
  "La autenticación se gestiona mediante tokens JWT con tiempo de expiración definido.",
  "Cada rol (administrador, conductor, pasajero) tiene acceso únicamente a los datos que le corresponden.",
  "Las coordenadas GPS del conductor se transmiten exclusivamente durante rutas activas y no se almacenan de forma permanente en el dispositivo del usuario.",
  "Las contraseñas se almacenan con hash y nunca en texto plano.",
];

const USER_RIGHTS = [
  "Acceder a la información personal registrada.",
  "Solicitar la corrección de datos inexactos o desactualizados.",
  "Solicitar la eliminación de su cuenta y los datos asociados.",
];

function RouteMark() {
  return (
    <svg className="vt-privacy-route" viewBox="0 0 440 680" fill="none" aria-hidden="true">
      <path d="M482-22C329 79 412 194 282 251S78 324 173 421 358 508 244 598 89 668 91 720" className="vt-privacy-route-glow" />
      <path d="M482-22C329 79 412 194 282 251S78 324 173 421 358 508 244 598 89 668 91 720" className="vt-privacy-route-line" />
      <circle cx="282" cy="251" r="6" className="vt-privacy-route-stop" />
      <circle cx="173" cy="421" r="6" className="vt-privacy-route-stop" />
      <circle cx="244" cy="598" r="7" className="vt-privacy-route-destination" />
    </svg>
  );
}

function BulletList({ children, className = "" }) {
  return <ul className={`vt-privacy-list${className ? ` ${className}` : ""}`}>{children}</ul>;
}

function SectionHeading({ section, index }) {
  return <h2 id={`privacy-title-${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</h2>;
}

export default function PrivacyPage() {
  const navigate = useNavigate();
  const { resolvedTheme } = useAppTheme();
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  useEffect(() => {
    const targets = SECTIONS.map(({ id }) => document.getElementById(`privacy-${id}`)).filter(Boolean);
    if (!("IntersectionObserver" in window) || targets.length === 0) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id.replace("privacy-", ""));
    }, { rootMargin: "-12% 0px -72% 0px", threshold: 0 });

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="vt-privacy-page">
      <RouteMark />
      <header className="vt-privacy-header">
        <Link to="/" className="vt-privacy-brand" aria-label="Vialtros, ir al inicio">
          <Logo iconSize={27} variant={resolvedTheme === "dark" ? "light" : "default"} />
        </Link>
        <nav aria-label="Enlaces informativos">
          <Link to="/terms">Términos</Link>
          <Link to="/support">Soporte</Link>
          <Link className="vt-privacy-access" to="/login">Acceder al sistema</Link>
        </nav>
      </header>

      <div className="vt-privacy-layout">
        <aside className="vt-privacy-aside">
          <button className="vt-privacy-back" type="button" onClick={() => navigate(-1)}>
            <IoArrowBack aria-hidden="true" /> Volver
          </button>
          <nav className="vt-privacy-toc" aria-label="Contenido de la política de privacidad">
            <h2>En esta página</h2>
            {SECTIONS.map(({ id, title }, index) => (
              <a
                href={`#privacy-${id}`}
                key={id}
                className={activeSection === id ? "is-active" : ""}
                aria-current={activeSection === id ? "location" : undefined}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>{title}
              </a>
            ))}
            <div className="vt-privacy-toc-related">
              <h2>Información relacionada</h2>
              <Link to="/terms">Términos y condiciones</Link>
              <Link to="/support">Centro de soporte</Link>
            </div>
          </nav>
        </aside>

        <main className="vt-privacy-document">
          <button className="vt-privacy-mobile-back" type="button" onClick={() => navigate(-1)}>
            <IoArrowBack aria-hidden="true" /> Volver
          </button>
          <p className="vt-privacy-kicker">Información legal</p>
          <h1>Política de privacidad</h1>
          <p className="vt-privacy-date">Vigente desde junio de 2026</p>
          <p className="vt-privacy-intro">
            Vialtros es una plataforma de gestión de rutas y transporte operada desde Buenaventura, Valle del Cauca, Colombia. Esta política describe cómo recopilamos, usamos y protegemos la información de quienes utilizan nuestro sistema.
          </p>

          <section className="vt-privacy-section" id="privacy-recopilacion" aria-labelledby="privacy-title-recopilacion">
            <SectionHeading section={SECTIONS[0]} index={0} />
            <p>Según el rol del usuario, la plataforma puede recopilar:</p>
            <BulletList>
              {DATA_TYPES.map(([label, description]) => <li key={label}><strong>{label}:</strong> {description}</li>)}
            </BulletList>
          </section>

          <section className="vt-privacy-section" id="privacy-uso" aria-labelledby="privacy-title-uso">
            <SectionHeading section={SECTIONS[1]} index={1} />
            <BulletList>{DATA_USES.map((item) => <li key={item}>{item}</li>)}</BulletList>
          </section>

          <section className="vt-privacy-section" id="privacy-proteccion" aria-labelledby="privacy-title-proteccion">
            <SectionHeading section={SECTIONS[2]} index={2} />
            <BulletList>{PROTECTIONS.map((item) => <li key={item}>{item}</li>)}</BulletList>
          </section>

          <section className="vt-privacy-section" id="privacy-terceros" aria-labelledby="privacy-title-terceros">
            <SectionHeading section={SECTIONS[3]} index={3} />
            <p>
              Vialtros no vende ni cede datos personales a terceros. La información solo podrá compartirse cuando sea exigido por autoridad competente o requerimiento legal, y únicamente en la medida necesaria.
            </p>
          </section>

          <section className="vt-privacy-section" id="privacy-derechos" aria-labelledby="privacy-title-derechos">
            <SectionHeading section={SECTIONS[4]} index={4} />
            <p>Los usuarios pueden ejercer los siguientes derechos sobre sus datos:</p>
            <BulletList>{USER_RIGHTS.map((item) => <li key={item}>{item}</li>)}</BulletList>
            <p className="vt-privacy-contact-note">
              Para ejercer estos derechos, contacta a nuestro equipo a través de <a href="mailto:contacto@vialtros.com">contacto@vialtros.com</a>.
            </p>
          </section>

          <section className="vt-privacy-section" id="privacy-cambios" aria-labelledby="privacy-title-cambios">
            <SectionHeading section={SECTIONS[5]} index={5} />
            <p>
              Vialtros puede actualizar esta política cuando sea necesario. Los cambios significativos se comunicarán mediante notificación en la plataforma o por correo electrónico.
            </p>
          </section>

          <section className="vt-privacy-section" id="privacy-contacto" aria-labelledby="privacy-title-contacto">
            <SectionHeading section={SECTIONS[6]} index={6} />
            <BulletList className="vt-privacy-contact-list">
              <li><strong>Correo:</strong> <a href="mailto:contacto@vialtros.com">contacto@vialtros.com</a></li>
              <li><strong>Teléfono:</strong> <a href="tel:+576023212100">602 321 2100 Ext. 2649 o 2653</a></li>
              <li><strong>Dirección:</strong> Buenaventura, Valle del Cauca, Colombia</li>
            </BulletList>
          </section>

          <footer className="vt-privacy-footer">
            <span>Vialtros · Colombia</span>
            <Link to="/support">¿Tienes una pregunta? Contacta a soporte <IoArrowForward aria-hidden="true" /></Link>
          </footer>
        </main>
      </div>
    </div>
  );
}

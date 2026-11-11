import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IoArrowBack,
  IoArrowForward,
  IoCallOutline,
  IoChevronDown,
  IoGlobeOutline,
  IoLocationOutline,
  IoMailOutline,
} from "react-icons/io5";
import { Logo } from "../components/Logo";
import { useAppTheme } from "../context/ThemeContext";
import "./SupportPage.css";

const SUPPORT_CHANNELS = [
  {
    label: "Correo",
    value: "contacto@vialtros.com",
    href: "mailto:contacto@vialtros.com",
    Icon: IoMailOutline,
    tone: "teal",
    action: "Enviar correo",
  },
  {
    label: "Teléfono",
    value: "602 321 2100",
    detail: "Ext. 2649 o 2653",
    href: "tel:+576023212100",
    Icon: IoCallOutline,
    tone: "green",
    action: "Llamar",
  },
  {
    label: "Sitio web",
    value: "www.vialtros.com",
    href: "https://www.vialtros.com",
    Icon: IoGlobeOutline,
    tone: "blue",
    action: "Visitar sitio",
    external: true,
  },
  {
    label: "Ubicación",
    value: "Buenaventura, Valle del Cauca",
    detail: "Colombia",
    Icon: IoLocationOutline,
    tone: "amber",
  },
];

const FAQS = [
  {
    question: "¿Cómo veo mi ruta asignada?",
    answer: "Inicia sesión con tu cuenta de pasajero. En el panel principal encontrarás la ruta asignada, junto con el conductor, el origen y el destino.",
  },
  {
    question: "¿Por qué no aparece la ubicación del conductor en el mapa?",
    answer: "El seguimiento GPS se activa cuando el conductor inicia la ruta. Si aún no ha comenzado, el mapa no mostrará una ubicación en tiempo real. Comprueba también que tengas una conexión estable a internet.",
  },
  {
    question: "¿Cómo recupero mi contraseña?",
    answer: "En la pantalla de inicio de sesión, selecciona “¿Olvidaste tu contraseña?” e ingresa el correo registrado para recibir las instrucciones de recuperación.",
  },
  {
    question: "¿Cómo califico una ruta?",
    answer: "Cuando la ruta haya finalizado, podrás calificar el servicio y dejar un comentario desde el detalle de la ruta en tu panel.",
  },
  {
    question: "No recibo notificaciones, ¿qué puedo hacer?",
    answer: "Revisa que el navegador permita las notificaciones de Vialtros y que tu sesión siga activa. Si el problema continúa, contacta al administrador de tu institución o escríbenos.",
  },
  {
    question: "¿Cómo agrego un conductor o pasajero?",
    answer: "Si eres administrador, abre Usuarios o Conductores desde el panel y crea un registro nuevo. Allí podrás asignar el rol correspondiente.",
  },
];

function RouteArtwork() {
  return (
    <svg className="vt-support-route" viewBox="0 0 680 430" fill="none" aria-hidden="true">
      <path className="vt-support-route-glow" d="M-16 331C111 331 122 207 248 225S380 316 445 225 548 103 699 82" />
      <path className="vt-support-route-line" d="M-16 331C111 331 122 207 248 225S380 316 445 225 548 103 699 82" />
      <circle className="vt-support-route-stop" cx="112" cy="278" r="7" />
      <circle className="vt-support-route-stop" cx="248" cy="225" r="7" />
      <circle className="vt-support-route-stop is-destination" cx="548" cy="145" r="8" />
      <circle className="vt-support-route-ring" cx="548" cy="145" r="28" />
    </svg>
  );
}

export default function SupportPage() {
  const navigate = useNavigate();
  const { resolvedTheme } = useAppTheme();
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="vt-support-page">
      <RouteArtwork />
      <header className="vt-support-header">
        <Link className="vt-support-brand" to="/" aria-label="Vialtros, ir al inicio">
          <Logo iconSize={27} variant={resolvedTheme === "dark" ? "light" : "default"} />
        </Link>
        <nav aria-label="Navegación de soporte">
          <Link className="vt-support-home" to="/">Inicio</Link>
          <Link className="vt-support-access" to="/login">Acceder al sistema</Link>
        </nav>
      </header>

      <main className="vt-support-main">
        <button className="vt-support-back" type="button" onClick={() => navigate(-1)}>
          <IoArrowBack aria-hidden="true" />
          Volver
        </button>

        <section className="vt-support-intro" aria-labelledby="vt-support-title">
          <p className="vt-support-kicker">Estamos para ayudarte</p>
          <h1 id="vt-support-title">Hablemos de tu <span>recorrido.</span></h1>
          <p className="vt-support-lead">
            Encuentra una respuesta rápida o contacta al equipo de Vialtros por el canal que prefieras.
          </p>
        </section>

        <section className="vt-support-channels" aria-label="Canales de contacto">
          {SUPPORT_CHANNELS.map(({ label, value, detail, href, Icon, tone, action, external }) => {
            const content = (
              <>
                <span className={`vt-support-channel-icon is-${tone}`}><Icon aria-hidden="true" /></span>
                <span className="vt-support-channel-copy">
                  <span className="vt-support-channel-label">{label}</span>
                  <strong>{value}</strong>
                  {detail && <span className="vt-support-channel-detail">{detail}</span>}
                </span>
                {href && <span className="vt-support-channel-action">{action}<IoArrowForward aria-hidden="true" /></span>}
              </>
            );

            return href ? (
              <a
                className="vt-support-channel"
                href={href}
                key={label}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
              >
                {content}
              </a>
            ) : (
              <div className="vt-support-channel" key={label}>{content}</div>
            );
          })}
        </section>

        <section className="vt-support-faq-section" aria-labelledby="vt-support-faq-title">
          <div className="vt-support-section-heading">
            <div>
              <p className="vt-support-kicker">Respuestas claras</p>
              <h2 id="vt-support-faq-title">Preguntas frecuentes</h2>
            </div>
            <a className="vt-support-email-link" href="mailto:contacto@vialtros.com">
              ¿No encuentras tu respuesta? <span>Escríbenos</span>
            </a>
          </div>

          <div className="vt-support-faq-list">
            {FAQS.map(({ question, answer }, index) => {
              const isOpen = openFaq === index;
              const answerId = `vt-support-answer-${index}`;
              return (
                <article className={`vt-support-faq${isOpen ? " is-open" : ""}`} key={question}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    >
                      <span>{question}</span>
                      <IoChevronDown aria-hidden="true" />
                    </button>
                  </h3>
                  <div className="vt-support-faq-answer" id={answerId} hidden={!isOpen}>
                    <p>{answer}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="vt-support-footer">
          <p>¿Necesitas ayuda con un caso específico? <a href="mailto:contacto@vialtros.com">Cuéntanos qué ocurre</a>.</p>
          <nav aria-label="Información legal">
            <Link to="/privacy">Privacidad</Link>
            <Link to="/terms">Términos y condiciones</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}

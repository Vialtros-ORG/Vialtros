import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { icons } from "./icons";
import useTrackingRoute from "./useTrackingRoute";
import dashboardVideo from "../../assets/dashboard-city-night.mp4";
import dashboardPoster from "../../assets/dashboard-city-night.jpg";

const JOURNEY_LABELS = {
  admin: "Centro de rutas",
  driver: "Tu jornada",
  user: "Tu recorrido",
};

export default function HeroCard({ role }) {
  const { trackingLink, trackingEnabled } = useTrackingRoute(role);
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = (event) => setReduceMotion(event.matches);
    media.addEventListener?.("change", updateMotionPreference);
    return () => media.removeEventListener?.("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section || reduceMotion) {
      video?.pause();
      return undefined;
    }

    if (!("IntersectionObserver" in window)) {
      setIsInView(true);
      video.play().catch(() => {});
      return () => video.pause();
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.12 });
    observer.observe(section);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [reduceMotion]);

  const emptyRouteLabel = role === "admin"
    ? "No hay rutas registradas"
    : role === "driver"
      ? "No tienes rutas asignadas"
      : "No tienes ruta asignada";

  return (
    <section ref={sectionRef} className={`vt-dashboard-hero${isInView ? " is-in-view" : ""}`} aria-labelledby="vt-dashboard-hero-title">
      <div className="vt-dashboard-hero-media" aria-hidden="true">
        <img className="vt-dashboard-hero-poster" src={dashboardPoster} alt="" />
        {!reduceMotion && (
          <video
            ref={videoRef}
            className={`vt-dashboard-hero-video${videoReady ? " is-ready" : ""}`}
            muted
            loop
            playsInline
            preload="metadata"
            poster={dashboardPoster}
            onCanPlay={() => setVideoReady(true)}
          >
            <source src={dashboardVideo} type="video/mp4" />
          </video>
        )}
        <div className="vt-dashboard-hero-wash" />
      </div>
      <div className="vt-dashboard-hero-copy">
        <div className="vt-dashboard-live"><i aria-hidden="true" /> {JOURNEY_LABELS[role] || JOURNEY_LABELS.user}</div>
        <h2 id="vt-dashboard-hero-title">Tracking en tiempo real</h2>
        <p>
          Monitorea rutas activas y sigue cada recorrido con una vista clara de la operación.
        </p>
        {trackingEnabled ? (
          <Link to={trackingLink} className="vt-dashboard-action">
            Abrir mapa
            {icons.arrowRight({ size: 14, strokeWidth: 2.5 })}
          </Link>
        ) : (
          <button type="button" disabled className="vt-dashboard-action">
            {emptyRouteLabel}
          </button>
        )}
      </div>
      <div className="vt-dashboard-map-art" aria-hidden="true">
        <svg viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice" fill="none">
          <path className="vt-route-glow vt-route-glow--teal" d="M380 250C520 200 600 220 700 140S840 60 920 30" />
          <path className="vt-route-flow vt-route-flow--teal" d="M380 250C520 200 600 220 700 140S840 60 920 30" />
          <path className="vt-route-glow vt-route-glow--amber" d="M420 40C520 90 640 70 740 150S860 200 920 190" />
          <path className="vt-route-flow vt-route-flow--amber" d="M420 40C520 90 640 70 740 150S860 200 920 190" />
          <circle className="vt-route-point" cx="540" cy="190" r="5" />
          <circle className="vt-route-point" cx="700" cy="140" r="5" />
          <circle className="vt-route-point" cx="840" cy="60" r="5" />
          <circle className="vt-route-point is-destination" cx="420" cy="40" r="6" />
        </svg>
      </div>
    </section>
  );
}

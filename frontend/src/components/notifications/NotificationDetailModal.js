import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  MdClose,
  MdDirectionsBus,
  MdPersonAdd,
  MdPersonPin,
  MdLocationOn,
  MdFlag,
  MdWarning,
  MdOutlinedFlag,
  MdSend,
  MdChat,
  MdCheckCircle,
  MdInfo,
} from "react-icons/md";
import api from "../../services/api";
import { useAppTheme } from "../../context/ThemeContext";

const TYPE_CONFIG = {
  route_started: {
    Icon: MdDirectionsBus,
    label: "Ruta iniciada",
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  student_picked_up: {
    Icon: MdPersonAdd,
    label: "Estudiante recogido",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  student_dropped_off: {
    Icon: MdPersonPin,
    label: "Estudiante dejado en parada",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  approaching_stop: {
    Icon: MdLocationOn,
    label: "Bus aproximándose a su parada",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  approaching_destination: {
    Icon: MdFlag,
    label: "Bus aproximándose al destino",
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  driver_near_stop: {
    Icon: MdWarning,
    label: "Próximo a la parada de un estudiante",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  driver_near_destination: {
    Icon: MdOutlinedFlag,
    label: "Próximo al destino final",
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  message_from_user: {
    Icon: MdChat,
    label: "Mensaje del familiar",
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
};

const FALLBACK_CONFIG = {
  Icon: MdInfo,
  label: "Notificación",
  color: "text-gray-600",
  bg: "bg-gray-50",
  border: "border-gray-200",
};

function formatDateTime(isoString) {
  if (!isoString) return "";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

// Determina si este tipo de notificacion puede enviar mensaje al conductor
const CAN_SEND_MESSAGE_TYPES = [
  "route_started",
  "student_picked_up",
  "student_dropped_off",
  "approaching_stop",
  "approaching_destination",
];

export default function NotificationDetailModal({ notification, onClose }) {
  const { resolvedTheme } = useAppTheme();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const overlayRef = useRef(null);

  const config = TYPE_CONFIG[notification?.type] || FALLBACK_CONFIG;
  const { Icon, label, color, bg, border } = config;
  const canSendMessage = CAN_SEND_MESSAGE_TYPES.includes(notification?.type) && notification?.route_id;

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSendError("");
    try {
      await api.post(`/notifications/${notification.id}/send_message/`, { message: message.trim() });
      setSent(true);
      setMessage("");
    } catch (err) {
      setSendError(
        err?.response?.data?.detail || "No se pudo enviar el mensaje. Intenta nuevamente."
      );
    } finally {
      setSending(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div data-theme={resolvedTheme} className="vt-notification-detail w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 px-6 py-5 ${bg} border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${bg} border ${border}`}>
              <Icon className={`text-2xl ${color}`} />
            </div>
            <div>
              <p className={`text-xs font-semibold tracking-wide ${color}`}>{label}</p>
              <p className="text-base font-bold text-gray-900 mt-0.5 leading-tight">
                {notification.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/10 transition-colors text-gray-500 mt-0.5"
            aria-label="Cerrar"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Mensaje completo */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Detalle
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {notification.message}
            </p>
          </section>

          {/* Informacion de la notificacion */}
          <section className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-gray-400 font-medium">Fecha y hora</span>
              <span className="text-xs text-gray-700 font-semibold text-right max-w-[60%]">
                {formatDateTime(notification.created_at)}
              </span>
            </div>
            {notification.route_id && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-gray-400 font-medium">Ruta</span>
                <span className="text-xs text-gray-700 font-semibold">
                  #{notification.route_id}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-gray-400 font-medium">Estado</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${notification.read ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"}`}>
                {notification.read ? "Leida" : "No leida"}
              </span>
            </div>
          </section>

          {/* Formulario de mensaje al conductor */}
          {canSendMessage && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Enviar mensaje al conductor
              </p>
              {sent ? (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700">
                  <MdCheckCircle className="text-lg shrink-0" />
                  <p className="text-sm font-medium">Mensaje enviado correctamente al conductor.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe tu mensaje para el conductor..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400">{message.length}/500</span>
                    {sendError && (
                      <p className="text-xs text-red-500 flex-1 text-right">{sendError}</p>
                    )}
                    <button
                      onClick={handleSend}
                      disabled={sending || !message.trim()}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                        sending || !message.trim()
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      <MdSend className="text-base" />
                      {sending ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

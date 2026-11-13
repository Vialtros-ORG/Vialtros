import React from "react";

export default function Modal({ title, onClose, children }) {
  return (
      <div className="vt-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="vt-modal-dialog bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="vt-modal-title">
        <div className="vt-modal-header px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 id="vt-modal-title" className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="vt-modal-body px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

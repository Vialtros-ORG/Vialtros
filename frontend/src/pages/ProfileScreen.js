import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SectionCard from "../components/dashboard/SectionCard";
import { getCurrentUser, updateCurrentUser, getUserCache, saveUserCache } from "../services/auth";
import {
  isValidEmail,
  isValidPersonName,
  isValidPhone,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
} from "../services/validation";
import { getApiErrorMessage } from "../services/apiErrors";

export default function ProfileScreen() {
  const [avatar, setAvatar] = useState("");
  const [photoSavedMsg, setPhotoSavedMsg] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [user, setUser] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone_number: "",
  });
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef();
  const navigate = useNavigate();

  const getUserIdKey = (u, token) => {
    if (u && u.id) return String(u.id);
    if (u && u.username) return String(u.username).toLowerCase();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.id) return String(payload.id);
        if (payload.username) return String(payload.username).toLowerCase();
      } catch {}
    }
    return (localStorage.getItem("username") || "default").toLowerCase();
  };

  const applyUserData = useCallback((u, token) => {
    if (!u) return;
    const usernameRaw = localStorage.getItem("username") || u.username || "";
    const username = usernameRaw.charAt(0).toUpperCase() + usernameRaw.slice(1);
    const userData = {
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      username,
      email: u.email || "",
      phone_number: u.phone_number || "",
    };
    setUser(userData);
    setEditData(userData);
    const userIdKey = getUserIdKey(u, token);
    const saved = localStorage.getItem(`profileImage_${userIdKey}`);
    setAvatar(saved || "");
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access");

    // Carga instantánea desde caché
    const cached = getUserCache();
    if (cached) applyUserData(cached, token);

    // Refresco en background desde la API
    getCurrentUser().then((u) => {
      if (!u) return;
      saveUserCache(u);
      applyUserData(u, token);
    });
  }, [applyUserData]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Selecciona una imagen PNG, JPG o WebP.");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("La imagen no puede superar los 2 MB.");
      e.target.value = "";
      return;
    }
    const token = localStorage.getItem("access");
    getCurrentUser().then((u) => {
      if (!u) throw new Error("No se pudo identificar la cuenta.");
      const userIdKey = getUserIdKey(u, token);
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          localStorage.setItem(`profileImage_${userIdKey}`, ev.target.result);
          setAvatar(ev.target.result);
          setPhotoSavedMsg("Foto guardada correctamente.");
          setTimeout(() => setPhotoSavedMsg(""), 2000);
        } catch {
          setPhotoError("No se pudo guardar la imagen. Prueba con un archivo más pequeño.");
        }
      };
      reader.onerror = () => setPhotoError("No se pudo leer la imagen seleccionada.");
      reader.readAsDataURL(file);
    }).catch(() => setPhotoError("No se pudo guardar la foto. Inténtalo de nuevo."));
  };

  const handleInputChange = (field) => (e) =>
    setEditData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    const firstName = normalizePersonName(editData.first_name);
    const lastName = normalizePersonName(editData.last_name);
    const email = normalizeEmail(editData.email);
    const phone = normalizePhone(editData.phone_number);

    if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
      setSaveError("El nombre y el apellido solo pueden contener letras, espacios, guiones y apóstrofos.");
      return;
    }
    if (!isValidEmail(email)) {
      setSaveError("Ingresa un correo válido de hasta 254 caracteres.");
      return;
    }
    if (!isValidPhone(phone)) {
      setSaveError("Ingresa un teléfono internacional válido, por ejemplo +57 300 123 4567.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      await updateCurrentUser({
        first_name: firstName || "",
        last_name: lastName,
        email,
        phone_number: phone,
      });
      const updatedUser = {
        ...editData,
        first_name: firstName || "",
        last_name: lastName,
        email,
        phone_number: phone,
      };
      setEditData(updatedUser);
      setUser(updatedUser);
      saveUserCache(updatedUser);
      setEditMode(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, "No se pudieron guardar los cambios."));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({ ...user });
    setEditMode(false);
    setSaveError("");
  };

  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    "Sin nombre";

  return (
    <div className="w-full flex justify-center px-4 py-10">
      <div className="relative flex w-full min-w-0 max-w-[600px] flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8 md:p-12">
        <button
          type="button"
          className="absolute top-6 right-6 text-3xl text-gray-400 hover:text-gray-700 focus:outline-none"
          title="Cerrar"
          aria-label="Volver al panel"
          onClick={() => navigate("/dashboard")}
        >
          ×
        </button>
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Mi Perfil</h2>
        <p className="text-gray-500 text-center mb-8">Actualiza tu foto e información personal.</p>

        {/* Avatar */}
        <div className="relative mb-10 flex flex-col items-center">
          {avatar ? (
            <img
              src={avatar}
              alt={`Foto de perfil de ${displayName}`}
              className="h-28 w-28 rounded-full border-4 border-blue-100 object-cover shadow-sm md:h-36 md:w-36"
            />
          ) : (
            <div
              aria-label={`Iniciales de ${displayName}`}
              className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-blue-100 bg-blue-50 text-3xl font-semibold text-blue-700 md:h-36 md:w-36"
            >
              {[user.first_name, user.last_name]
                .filter(Boolean)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toLocaleUpperCase("es-CO") || "V"}
            </div>
          )}
          <button
            type="button"
            aria-label="Cambiar foto de perfil"
            onClick={() => fileInputRef.current.click()}
            className="absolute bottom-2 right-2 md:bottom-4 md:right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-md focus:outline-none"
            title="Cambiar foto"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Seleccionar imagen de perfil"
            className="hidden"
            onChange={handleImageChange}
          />
          {photoSavedMsg && (
            <span className="mt-3 text-green-600 text-sm font-semibold">{photoSavedMsg}</span>
          )}
          {photoError && <span role="alert" className="mt-3 text-sm text-red-600">{photoError}</span>}
        </div>

        {/* Campos */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-10">
          <SectionCard
            label="Nombre"
            value={editMode ? editData.first_name : user.first_name || user.username}
            editable={editMode}
            onChange={handleInputChange("first_name")}
            autoComplete="given-name"
            maxLength={80}
          />
          <SectionCard
            label="Apellido"
            value={editMode ? editData.last_name : user.last_name || "Sin especificar"}
            editable={editMode}
            onChange={handleInputChange("last_name")}
            autoComplete="family-name"
            maxLength={80}
          />
          <SectionCard
            label="Correo"
            value={editMode ? editData.email : user.email}
            editable={editMode}
            onChange={handleInputChange("email")}
            type="email"
            autoComplete="email"
            maxLength={254}
          />
          <SectionCard
            label="Teléfono"
            value={editMode ? editData.phone_number : (user.phone_number || "Sin especificar")}
            editable={editMode}
            onChange={handleInputChange("phone_number")}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={24}
          />
        </div>

        {saveError && (
          <p className="text-red-500 text-sm mb-4 text-center">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="text-green-600 text-sm mb-4 text-center font-semibold">Cambios guardados correctamente.</p>
        )}

        {/* Botones */}
        <div className="w-full flex flex-col gap-4">
          {!editMode ? (
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold w-full py-3 rounded-lg shadow transition-all text-lg"
              onClick={() => setEditMode(true)}
            >
              Editar perfil
            </button>
          ) : (
            <>
              <button
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold w-full py-3 rounded-lg shadow transition-all text-lg"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold w-full py-3 rounded-lg shadow transition-all text-lg"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

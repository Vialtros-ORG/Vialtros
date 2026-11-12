import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import { getCurrentUser, getUserCache, saveUserCache, updateCurrentUser } from "../services/auth";

const EMPTY_PROFILE = { first_name: "", last_name: "", username: "", email: "", phone_number: "" };

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ").split(" ")
    .map((word) => word ? word[0].toLocaleUpperCase("es-CO") + word.slice(1).toLocaleLowerCase("es-CO") : "")
    .join(" ");
}

function initials(profile) {
  const first = profile.first_name?.trim()?.[0] || profile.username?.[0] || "V";
  const last = profile.last_name?.trim()?.[0] || "";
  return `${first}${last}`.toLocaleUpperCase("es-CO");
}

export default function ProfileScreen({ role, onLogout }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [draft, setDraft] = useState(EMPTY_PROFILE);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [avatar, setAvatar] = useState("");
  const photoRef = useRef(null);

  const applyProfile = useCallback((user) => {
    if (!user) return;
    const next = {
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      username: user.username || localStorage.getItem("username") || "",
      email: user.email || "",
      phone_number: user.phone_number || "",
    };
    setProfile(next);
    setDraft(next);
    const key = next.username.toLowerCase();
    try { setAvatar(localStorage.getItem(`profileImage_${key}`) || ""); } catch { setAvatar(""); }
  }, []);

  useEffect(() => {
    const cached = getUserCache();
    if (cached) applyProfile(cached);
    let active = true;
    getCurrentUser().then((user) => {
      if (!active || !user) return;
      saveUserCache(user);
      applyProfile(user);
    }).catch(() => {
      if (!cached) setError("No se pudieron cargar los datos de la cuenta. Revisa tu conexión e inténtalo de nuevo.");
    });
    return () => { active = false; };
  }, [applyProfile]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const next = {
      ...draft,
      first_name: normalizeName(draft.first_name),
      last_name: normalizeName(draft.last_name),
    };
    try {
      const updatedUser = await updateCurrentUser({
        first_name: next.first_name,
        last_name: next.last_name,
        email: next.email.trim(),
        phone_number: next.phone_number.trim(),
      });
      setProfile(next);
      setDraft(next);
      saveUserCache({ ...updatedUser, ...next, id: updatedUser?.id || getUserCache()?.id });
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
    } catch {
      setError("No se guardaron los cambios. Comprueba los datos y vuelve a intentarlo.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Elige un archivo de imagen."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("La foto debe pesar menos de 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      setAvatar(data);
      try { localStorage.setItem(`profileImage_${profile.username.toLowerCase()}`, data); } catch { setError("No hay espacio disponible para guardar la foto en este dispositivo."); }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="vt-settings-page">
        <header className="vt-settings-heading vt-profile-heading">
          <div>
            <p className="vt-settings-eyebrow">Tu cuenta</p>
            <h1>Mi perfil</h1>
            <p>Consulta y actualiza la información de tu cuenta.</p>
          </div>
          <button className="vt-settings-back" type="button" onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/dashboard")}>
            <span aria-hidden="true">←</span> Volver
          </button>
        </header>

        <div className="vt-profile-grid">
          <section className="vt-settings-section vt-profile-section" id="perfil" aria-labelledby="vt-profile-title">
            <div className="vt-settings-section-heading">
              <div><h2 id="vt-profile-title">Datos de tu perfil</h2><p>La información que identifica tu cuenta.</p></div>
              {!editing && <button className="vt-settings-edit" type="button" onClick={() => { setError(""); setEditing(true); }}>Editar datos</button>}
            </div>

            <div className="vt-profile-identity">
              <div className="vt-profile-avatar" aria-hidden="true">
                {avatar ? <img src={avatar} alt="" /> : <span>{initials(profile)}</span>}
              </div>
              <div className="vt-profile-identity-copy">
                <strong>{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username || "Tu cuenta"}</strong>
                <span>{role === "admin" ? "Administrador" : role === "driver" ? "Conductor" : "Pasajero"}</span>
              </div>
              <button className="vt-profile-photo" type="button" onClick={() => photoRef.current?.click()}>Cambiar foto</button>
              <input ref={photoRef} className="vt-visually-hidden" type="file" accept="image/*" onChange={handlePhoto} aria-label="Seleccionar foto de perfil" />
            </div>

            <form onSubmit={handleSave}>
              <div className="vt-profile-fields">
                <label><span>Nombre</span><input disabled={!editing} value={draft.first_name} onChange={(e) => setDraft((current) => ({ ...current, first_name: e.target.value }))} autoComplete="given-name" /></label>
                <label><span>Apellido</span><input disabled={!editing} value={draft.last_name} onChange={(e) => setDraft((current) => ({ ...current, last_name: e.target.value }))} autoComplete="family-name" /></label>
                <label><span>Correo</span><input disabled={!editing} type="email" value={draft.email} onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))} autoComplete="email" /></label>
                <label><span>Teléfono</span><input disabled={!editing} type="tel" value={draft.phone_number} onChange={(e) => setDraft((current) => ({ ...current, phone_number: e.target.value }))} autoComplete="tel" /></label>
                <label className="vt-profile-username"><span>Nombre de usuario</span><input disabled value={profile.username} autoComplete="username" /></label>
              </div>
              {error && <p className="vt-settings-message is-error" role="alert">{error}</p>}
              {saved && <p className="vt-settings-message is-success" role="status">Cambios guardados.</p>}
              {editing && <div className="vt-profile-actions"><button className="vt-settings-cancel" type="button" disabled={saving} onClick={() => { setDraft(profile); setEditing(false); setError(""); }}>Cancelar</button><button className="vt-settings-save" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>}
            </form>
          </section>

        </div>
      </main>
    </div>
  );
}

const FIELD_LABELS = {
  username: "Usuario",
  first_name: "Nombre",
  last_name: "Apellido",
  email: "Correo",
  phone: "Teléfono",
  phone_number: "Teléfono",
  license_number: "Licencia",
  password: "Contraseña", // NOSONAR: nombre de campo de la API, no es una credencial.
  non_field_errors: "Formulario",
  detail: "Solicitud",
};

function collectMessages(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectMessages);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => {
      const label = FIELD_LABELS[key] || key.replaceAll("_", " ");
      return collectMessages(nested).map((message) => `${label}: ${message}`);
    });
  }
  return [];
}

export function getApiErrorMessage(error, fallback = "No se pudo completar la operación.") {
  const messages = collectMessages(error?.response?.data);
  return messages.length ? [...new Set(messages)].join(" ") : fallback;
}

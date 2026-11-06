const PERSON_NAME_PATTERN = /^[\p{L}]+(?:[ '\u2019-][\p{L}]+)*$/u;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizeWhitespace(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizePersonName(value) {
  const normalized = normalizeWhitespace(value).normalize("NFC").toLocaleLowerCase("es-CO");
  return normalized.replace(/(^|[ '\u2019-])(\p{L})/gu, (_, separator, letter) =>
    `${separator}${letter.toLocaleUpperCase("es-CO")}`,
  );
}

export function isValidPersonName(value) {
  const normalized = normalizePersonName(value);
  return !normalized || (normalized.length <= 80 && PERSON_NAME_PATTERN.test(normalized));
}

export function normalizeUsername(value) {
  return normalizeWhitespace(value).toLowerCase();
}

export function isValidUsername(value) {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

export function normalizeEmail(value) {
  return normalizeWhitespace(value).toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return !email || (email.length <= 254 && EMAIL_PATTERN.test(email));
}

export function normalizePhone(value) {
  let phone = String(value ?? "").replace(/[\s().-]/g, "");
  if (!phone) return "";
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  else if (/^\d{10}$/.test(phone)) phone = `+57${phone}`;
  else if (!phone.startsWith("+")) phone = `+${phone}`;
  return phone;
}

export function isValidPhone(value, { required = false } = {}) {
  const phone = normalizePhone(value);
  return (!required && !phone) || E164_PATTERN.test(phone);
}

export function isValidLicense(value) {
  return /^[A-Za-z0-9.-]{4,25}$/.test(String(value ?? "").trim());
}

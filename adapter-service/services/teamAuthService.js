import { ValidationError } from "../lib/httpErrors.js";

const MAX_PROFILE_IMAGE_BYTES = 512 * 1024;

export function assertMinLength(value, min, message) {
  const text = String(value || "").trim();
  if (!text || text.length < min) {
    throw new ValidationError(message);
  }
  return text;
}

export function assertPasswordMinLength(password, min = 8) {
  const raw = String(password || "");
  if (!raw || raw.length < min) {
    throw new ValidationError(`Passwort muss mindestens ${min} Zeichen enthalten.`);
  }
  const hasUpper = /[A-Z]/.test(raw);
  const hasLower = /[a-z]/.test(raw);
  const hasDigit = /\d/.test(raw);
  if (!hasUpper || !hasLower || !hasDigit) {
    throw new ValidationError("Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.");
  }
  return raw;
}

export function normalizeInvitationRole(requestedRole) {
  const role = String(requestedRole || "").trim().toLowerCase();
  return ["admin", "coordinator", "scout", "readonly"].includes(role) ? role : "scout";
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function assertEmail(value) {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ValidationError("Bitte eine gültige E-Mail-Adresse angeben.");
  }
  return email;
}

export function normalizeBirthDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new ValidationError("Geburtsdatum muss im Format YYYY-MM-DD vorliegen.");
  }
  const timestamp = Date.parse(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) {
    throw new ValidationError("Geburtsdatum ist ungültig.");
  }
  return text;
}

export function normalizeProfileImage(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(text)) {
    throw new ValidationError("Profilbild muss ein PNG, JPEG oder WebP Data-URL sein.");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_PROFILE_IMAGE_BYTES) {
    throw new ValidationError("Profilbild ist zu groß.");
  }
  return text;
}

export function isAccountEmailVerified(account) {
  if (!account?.email) {
    return true;
  }
  return account.emailVerified !== false;
}

export function isAccountProfileComplete(account) {
  if (!account?.email) {
    return true;
  }
  return Boolean(String(account?.name || "").trim() && String(account?.birthDate || "").trim() && String(account?.profileImage || "").trim());
}

export function createTimedToken(randomUUID, ttlSec, now = Date.now()) {
  return {
    token: randomUUID(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSec * 1000).toISOString(),
  };
}

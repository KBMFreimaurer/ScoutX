import { ValidationError } from "../lib/httpErrors.js";

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
    throw new ValidationError("Passwort muss mindestens einen Grossbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.");
  }
  return raw;
}

export function normalizeInvitationRole(requestedRole) {
  const role = String(requestedRole || "").trim().toLowerCase();
  return ["admin", "coordinator", "scout", "readonly"].includes(role) ? role : "scout";
}

export function createTimedToken(randomUUID, ttlSec, now = Date.now()) {
  return {
    token: randomUUID(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSec * 1000).toISOString(),
  };
}

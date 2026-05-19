import { ValidationError } from "./httpErrors.js";

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parsePushSubscriptionPayload(payload, context, nowIso) {
  const endpoint = String(payload?.subscription?.endpoint || "").trim();
  if (!endpoint) {
    throw new ValidationError("Push-Subscription endpoint fehlt.");
  }
  return {
    endpoint,
    keys: {
      p256dh: String(payload?.subscription?.keys?.p256dh || "").trim(),
      auth: String(payload?.subscription?.keys?.auth || "").trim(),
    },
    userId: String(context?.account?.id || ""),
    teamId: String(context?.account?.teamId || ""),
    updatedAt: nowIso(),
  };
}

export function parseEventIdsPayload(payload) {
  const ids = (Array.isArray(payload?.eventIds) ? payload.eventIds : [payload?.eventId]).map((item) => normalizeId(item)).filter(Boolean);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > 200) {
    throw new ValidationError("Maximal 200 eventIds pro Anfrage erlaubt.");
  }
  if (uniqueIds.length === 0) {
    throw new ValidationError("eventId/eventIds ist erforderlich.");
  }
  return uniqueIds;
}

import { getHttpErrorStatus } from "../lib/httpErrors.js";

export function sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus = 400, fallbackMessage = "Request fehlgeschlagen." }) {
  const statusCode = getHttpErrorStatus(error, fallbackStatus);
  const message = statusCode === 400 ? String(error?.message || fallbackMessage) : fallbackMessage;
  sendJson(res, statusCode, { ok: false, error: message }, origin, requestId);
}

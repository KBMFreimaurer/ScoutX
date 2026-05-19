import { getHttpErrorStatus } from "../lib/httpErrors.js";

export function sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus = 400, fallbackMessage = "Request fehlgeschlagen." }) {
  const statusCode = getHttpErrorStatus(error, fallbackStatus);
  const message = String(error?.message || fallbackMessage);
  sendJson(res, statusCode, { ok: false, error: message }, origin, requestId);
}

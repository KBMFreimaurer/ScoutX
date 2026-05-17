export class HttpError extends Error {
  constructor(statusCode, message) {
    super(String(message || "Request fehlgeschlagen."));
    this.name = "HttpError";
    this.statusCode = Number(statusCode) || 500;
  }
}

export class ValidationError extends HttpError {
  constructor(message) {
    super(400, message || "Ungültige Anfrage.");
    this.name = "ValidationError";
  }
}

export function getHttpErrorStatus(error, fallback = 500) {
  const status = Number(error?.statusCode);
  if (!Number.isFinite(status) || status < 100 || status > 599) {
    return fallback;
  }
  return status;
}

import { randomUUID } from "node:crypto";

const LOG_LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

function normalizeLevel(value) {
  const level = String(value || "info")
    .trim()
    .toLowerCase();
  if (!Object.hasOwn(LOG_LEVELS, level)) {
    return "info";
  }
  return level;
}

function shouldLog(configuredLevel, eventLevel) {
  return LOG_LEVELS[eventLevel] >= LOG_LEVELS[configuredLevel];
}

function sanitizeContext(context) {
  const out = {};
  for (const [key, value] of Object.entries(context || {})) {
    if (value === undefined) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function writeLine(payload, level) {
  const text = `${JSON.stringify(payload)}\n`;
  if (level === "error") {
    process.stderr.write(text);
    return;
  }
  process.stdout.write(text);
}

function buildErrorMeta(error) {
  if (!error) {
    return null;
  }
  return {
    message: String(error.message || error),
    name: error.name || "Error",
    stack: typeof error.stack === "string" ? error.stack.split("\n").slice(0, 6).join("\n") : "",
  };
}

function createLogger({ service = "app", level = process.env.LOG_LEVEL || "info", context = {} } = {}) {
  const configuredLevel = normalizeLevel(level);
  const baseContext = sanitizeContext(context);

  function log(eventLevel, message, fields = {}) {
    if (!shouldLog(configuredLevel, eventLevel)) {
      return;
    }
    writeLine(
      {
        ts: new Date().toISOString(),
        level: eventLevel,
        service,
        message: String(message || ""),
        ...baseContext,
        ...sanitizeContext(fields),
      },
      eventLevel,
    );
  }

  return {
    child(fields = {}) {
      return createLogger({
        service,
        level: configuredLevel,
        context: {
          ...baseContext,
          ...sanitizeContext(fields),
        },
      });
    },
    withRequest(requestId = randomUUID()) {
      return createLogger({
        service,
        level: configuredLevel,
        context: {
          ...baseContext,
          requestId,
        },
      });
    },
    debug(message, fields = {}) {
      log("debug", message, fields);
    },
    info(message, fields = {}) {
      log("info", message, fields);
    },
    warn(message, fields = {}) {
      log("warn", message, fields);
    },
    error(message, fields = {}) {
      const errorMeta = buildErrorMeta(fields.error);
      const nextFields = { ...fields };
      delete nextFields.error;
      log("error", message, errorMeta ? { ...nextFields, error: errorMeta } : nextFields);
    },
  };
}

export { createLogger };

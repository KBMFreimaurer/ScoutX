const DESTINATION_MAP = {
  setup: "/setup",
  games: "/games",
  plan: "/plan",
  "scout-sheet": "/scout-sheet",
  scoutsheet: "/scout-sheet",
  dashboard: "/dashboard",
  hub: "/hub",
};

function sanitizePathSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function resolveDestinationFromUrl(parsed) {
  const pathPart = sanitizePathSegment(parsed.pathname);
  const hostPart = sanitizePathSegment(parsed.host);
  const queryPart = sanitizePathSegment(parsed.searchParams.get("to") || parsed.searchParams.get("path"));
  const destinationKey = pathPart || hostPart || queryPart;
  return DESTINATION_MAP[destinationKey] || null;
}

export function resolveScoutxDeepLink(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "scoutx:") {
      return null;
    }
    return resolveDestinationFromUrl(parsed);
  } catch {
    return null;
  }
}

export function isNativeCapacitorRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const runtime = window.Capacitor;
  if (!runtime) {
    return false;
  }

  if (typeof runtime.isNativePlatform === "function") {
    return Boolean(runtime.isNativePlatform());
  }

  return String(runtime.getPlatform?.() || "") === "ios" || String(runtime.getPlatform?.() || "") === "android";
}

const ENV_ADAPTER_ENDPOINT = String(import.meta.env?.VITE_ADAPTER_ENDPOINT || "").trim();

export const ADAPTER_ENDPOINT = ENV_ADAPTER_ENDPOINT || "/api/games";
export const ADAPTER_FALLBACK_TOKEN = "";
export const ADAPTER_AUTH_TOKEN = String(import.meta.env?.VITE_ADAPTER_TOKEN || ADAPTER_FALLBACK_TOKEN).trim();

export const ADAPTER_ENDPOINT = "/api/games";
export const ADAPTER_FALLBACK_TOKEN = "scoutx-internal-2026";
export const ADAPTER_AUTH_TOKEN = String(import.meta.env?.VITE_ADAPTER_TOKEN || ADAPTER_FALLBACK_TOKEN).trim();

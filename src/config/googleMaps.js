const ENV_KEY = String(import.meta?.env?.VITE_GOOGLE_MAPS_API_KEY || "").trim();

export const GOOGLE_MAPS_API_KEY = ENV_KEY;
export const GOOGLE_MAPS_API_KEY_SOURCE = ENV_KEY ? "env" : "none";

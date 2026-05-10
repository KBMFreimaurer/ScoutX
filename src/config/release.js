function envFlag(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const ENABLE_ADMIN_SURFACE = import.meta.env.DEV || envFlag(import.meta.env?.VITE_ENABLE_ADMIN);
export const SUPPORT_EMAIL = String(import.meta.env?.VITE_SUPPORT_EMAIL || "support@scoutx.app").trim();
export const PRIVACY_POLICY_URL = String(import.meta.env?.VITE_PRIVACY_POLICY_URL || "/privacy").trim();
export const SUPPORT_URL = String(import.meta.env?.VITE_SUPPORT_URL || "/support").trim();

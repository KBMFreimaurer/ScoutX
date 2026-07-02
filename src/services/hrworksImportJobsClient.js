// Client für serverseitige HRworks-Importaufträge (adapter-service).
import { ADAPTER_ENDPOINT } from "../config/adapter";

export function resolveHrworksJobsApiBase(adapterEndpoint = ADAPTER_ENDPOINT) {
  const endpoint = String(adapterEndpoint || "").trim() || "/api/games";
  try {
    const url = endpoint.startsWith("http") ? new URL(endpoint) : new URL(endpoint, "http://placeholder.local");
    const basePath = url.pathname.replace(/\/games\/?$/, "") || "/api";
    const prefix = endpoint.startsWith("http") ? `${url.origin}${basePath}` : basePath;
    return `${prefix.replace(/\/$/, "")}/hrworks/import-jobs`;
  } catch {
    return "/api/hrworks/import-jobs";
  }
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HRworks-Auftragsdienst antwortet mit HTTP ${response.status}.`);
  }
  return payload;
}

export async function createHrworksImportJob({ planId, employeeName, payloads, credentials }) {
  const response = await fetch(resolveHrworksJobsApiBase(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planId, employeeName, payloads, credentials }),
  });
  return readJson(response);
}

export async function getHrworksImportJob(jobId) {
  const response = await fetch(`${resolveHrworksJobsApiBase()}/${encodeURIComponent(String(jobId || ""))}`);
  return readJson(response);
}

export async function listHrworksImportJobs() {
  const response = await fetch(resolveHrworksJobsApiBase());
  return readJson(response);
}

export const HRWORKS_JOB_STATUS_LABELS = {
  queued: "In Warteschlange",
  running: "Wird ausgeführt",
  needs_action: "Aktion erforderlich",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  interrupted: "Unterbrochen (Server-Neustart)",
  cancelled: "Abgebrochen",
};

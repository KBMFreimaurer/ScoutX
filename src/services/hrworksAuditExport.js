import { shareOrDownloadBlob } from "../native/share";

export async function exportHrworksAuditLog(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const payload = {
    exportedAt: new Date().toISOString(),
    entryCount: safeEntries.length,
    entries: safeEntries,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const filename = `ScoutX-HRworks-Audit-${new Date().toISOString().slice(0, 10)}.json`;
  return shareOrDownloadBlob(blob, filename, "ScoutX HRworks Audit exportieren");
}

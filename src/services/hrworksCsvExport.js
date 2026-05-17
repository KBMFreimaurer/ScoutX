import { shareOrDownloadBlob } from "../native/share";

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatDateDE(isoDate) {
  const text = String(isoDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const [year, month, day] = text.split("-");
  return `${day}.${month}.${year}`;
}

export function buildHrworksImportCsv(payload) {
  const normalized = payload && typeof payload === "object" ? payload : {};
  const row = {
    planId: String(normalized.planId || ""),
    employeeName: String(normalized.employeeName || ""),
    date: formatDateDE(normalized.date),
    startTime: String(normalized.startTime || ""),
    endTime: String(normalized.endTime || ""),
    workHours: Number.isFinite(Number(normalized.workHours)) ? Number(normalized.workHours).toFixed(2) : "",
    purpose: String(normalized.purpose || ""),
    note: String(normalized.note || ""),
    departureLocation: String(normalized.departureLocation || ""),
    destinationLocation: String(normalized.destinationLocation || ""),
    intermediateStops: Array.isArray(normalized.intermediateStops) ? normalized.intermediateStops.join(" | ") : "",
    costCenter: String(normalized.costCenter || ""),
    sourceGames: Array.isArray(normalized.sourceGames)
      ? normalized.sourceGames.map((game) => `${game.home} vs ${game.away} (${game.venue || "-"})`).join(" | ")
      : "",
  };

  const headers = Object.keys(row);
  const values = headers.map((header) => csvEscape(row[header]));
  return `${headers.join(";")}\n${values.join(";")}\n`;
}

export async function exportHrworksImportCsv(payload) {
  const content = buildHrworksImportCsv(payload);
  const dateStamp = String(payload?.date || new Date().toISOString().slice(0, 10));
  const fileName = `ScoutX-HRworks-Import-${dateStamp}.csv`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  return shareOrDownloadBlob(blob, fileName, "ScoutX HRworks-Export");
}

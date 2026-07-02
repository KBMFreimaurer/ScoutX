// Erzeugt die HRworks-Arbeitszeitdokumentation (XLSX) aus ScoutX-Plan-Payloads.
// Format orientiert sich an der Beispieldatei "AEB April Onay.xlsx" (MiLoG-Vorlage):
// Sheet "Tabelle1", Kopfzeilen, eine Zeile pro Kalendertag, Gesamtstunden, Unterschriften.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as XLSX from "xlsx";

const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function toDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// Wie in der Beispieldatei: Zeilen vom Montag vor Monatsbeginn bis zum Sonntag nach Monatsende.
function buildDayRange(firstPayloadDate) {
  const monthStart = new Date(Date.UTC(firstPayloadDate.getUTCFullYear(), firstPayloadDate.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(firstPayloadDate.getUTCFullYear(), firstPayloadDate.getUTCMonth() + 1, 0));
  const start = addDays(monthStart, -((monthStart.getUTCDay() + 6) % 7));
  const end = addDays(monthEnd, (7 - monthEnd.getUTCDay()) % 7);
  const days = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

function shortTime(value) {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text.replace(/^0/, "") : text;
}

export function buildHrworksTimesheetRows(payloads, { employeeName = "" } = {}) {
  const validPayloads = (Array.isArray(payloads) ? payloads : [])
    .map((payload) => ({ ...payload, dateObj: toDate(payload?.date) }))
    .filter((payload) => payload.dateObj)
    .sort((left, right) => left.dateObj - right.dateObj);
  if (validPayloads.length === 0) {
    throw new Error("Keine Plan-Tage mit gültigem Datum für die HRworks-Datei vorhanden.");
  }

  const byDate = new Map(validPayloads.map((payload) => [isoDate(payload.dateObj), payload]));
  const firstDate = validPayloads[0].dateObj;
  const monthName = MONTHS_DE[firstDate.getUTCMonth()];
  const name = String(employeeName || validPayloads[0]?.employeeName || "").trim();

  const rows = [];
  rows.push(["Arbeitszeitdokumentation gemäß MiLoG", "", "", "", "", "", "", ""]);
  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push(["Name: ", name, "", "", "", "Monat:", monthName, ""]);
  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push(["", "", "", "", "Ruhezeit", "", "Arbeits-", ""]);
  rows.push(["Tag", "Datum", "Beginn", "Ende", "von", "bis", "Stunden", "Vermerk"]);

  let totalHours = 0;
  for (const day of buildDayRange(firstDate)) {
    const payload = byDate.get(isoDate(day));
    const hours = Number(payload?.workHours);
    if (Number.isFinite(hours) && hours > 0) {
      totalHours += hours;
    }
    rows.push([
      WEEKDAYS_DE[day.getUTCDay()],
      day,
      payload ? shortTime(payload.startTime) : "",
      payload ? shortTime(payload.endTime) : "",
      payload ? shortTime(payload.breakStart) : "",
      payload ? shortTime(payload.breakEnd) : "",
      payload && Number.isFinite(hours) ? hours.toFixed(2) : "",
      payload ? String(payload.purpose || payload.note || "").trim() : "",
    ]);
  }

  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push(["", "", "", "", "Gesamtstunden", "", totalHours.toFixed(1), ""]);
  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push(["Unterschrift Mitarbeiter", "", "", "", "Unterschrift Abteilungsleiter", "", "", ""]);

  return { rows, monthName, name, totalHours: Number(totalHours.toFixed(2)) };
}

export function buildHrworksTimesheetWorkbook(payloads, options = {}) {
  const { rows, monthName, name, totalHours } = buildHrworksTimesheetRows(payloads, options);
  const worksheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true, dateNF: "m/d/yy" });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tabelle1");
  return { workbook, monthName, name, totalHours };
}

export function writeHrworksTimesheetXlsx(filePath, payloads, options = {}) {
  const { workbook, monthName, name, totalHours } = buildHrworksTimesheetWorkbook(payloads, options);
  mkdirSync(dirname(filePath), { recursive: true });
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  writeFileSync(filePath, buffer);
  return { filePath, monthName, name, totalHours };
}

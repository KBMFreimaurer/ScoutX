function excelSerialToDate(serial) {
  const value = Number(serial);
  if (!Number.isFinite(value)) {
    return null;
  }
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const millis = Math.round(value * 24 * 60 * 60 * 1000);
  const date = new Date(excelEpoch.getTime() + millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = excelSerialToDate(value);
    return parsed ? parsed.toISOString().slice(0, 10) : "";
  }

  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [dd, mm, yyyy] = text.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

export function toTimeHHmm(value) {
  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60) % (24 * 60);
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minutes = String(totalMinutes % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return "";
  }
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return "";
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toHours(start, end, fallbackHours) {
  const startMatch = String(start || "").match(/^(\d{2}):(\d{2})$/);
  const endMatch = String(end || "").match(/^(\d{2}):(\d{2})$/);
  if (!startMatch || !endMatch) {
    const parsed = Number(String(fallbackHours || "").replace(",", "."));
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
  }

  const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
  const endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
  if (endMinutes <= startMinutes) {
    return null;
  }
  return Number(((endMinutes - startMinutes) / 60).toFixed(2));
}

export function parseHrworksTimesheetRows(rows) {
  const entries = [];
  const warnings = [];

  for (const [index, row] of (Array.isArray(rows) ? rows : []).entries()) {
    const date = toIsoDate(row?.Datum || row?.date);
    const startTime = toTimeHHmm(row?.Beginn || row?.start || row?.von);
    const endTime = toTimeHHmm(row?.Ende || row?.end || row?.bis);
    const breakStart = toTimeHHmm(row?.["Ruhezeit von"] || row?.breakStart);
    const breakEnd = toTimeHHmm(row?.["Ruhezeit bis"] || row?.breakEnd);
    const workHours = toHours(startTime, endTime, row?.Arbeitsstunden || row?.Stunden || row?.hours);
    const note = String(row?.Vermerk || row?.Bemerkung || "").trim();

    if (!date && !startTime && !endTime && !workHours) {
      continue;
    }

    if (!date || !startTime || !endTime || !Number.isFinite(workHours)) {
      warnings.push(`Zeile ${index + 1}: unvollständige Arbeitszeitdaten wurden übersprungen.`);
      continue;
    }

    entries.push({
      employeeName: String(row?.Name || row?.Mitarbeitername || "").trim(),
      month: String(row?.Monat || "").trim(),
      date,
      startTime,
      endTime,
      breakStart,
      breakEnd,
      workHours,
      note,
    });
  }

  const declaredTotalRaw = String(rows?.[0]?.Gesamtstunden || "").trim();
  const declaredTotal = Number(declaredTotalRaw.replace(",", "."));
  if (declaredTotalRaw && Number.isFinite(declaredTotal)) {
    const sum = Number(entries.reduce((acc, item) => acc + item.workHours, 0).toFixed(2));
    if (Math.abs(sum - declaredTotal) > 0.01) {
      warnings.push(`Gesamtstundenabweichung: Datei ${declaredTotal}h vs. berechnet ${sum}h.`);
    }
  }

  return { entries, warnings };
}

function parseDelimitedLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index];
    const next = line[index + 1];

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current.trim());
  return result;
}

export function parseHrworksTimesheetText(fileText) {
  const text = String(fileText || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { entries: [], warnings: ["Datei ist leer."] };
  }

  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { entries: [], warnings: ["Datei enthält keine Datenzeilen."] };
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });

  return parseHrworksTimesheetRows(rows);
}

export function validateHrworksTimesheetFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (!name) {
    return { ok: false, message: "Dateiname fehlt." };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return {
      ok: false,
      message:
        "Excel-Dateien (.xlsx/.xls) werden aktuell nicht direkt gelesen. Bitte als CSV exportieren und erneut importieren.",
    };
  }

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return { ok: true, message: "" };
  }

  return {
    ok: false,
    message: "Nicht unterstütztes Dateiformat. Bitte CSV oder TXT verwenden.",
  };
}

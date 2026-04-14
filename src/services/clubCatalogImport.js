function toLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLogoUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (text.startsWith("//")) {
    return `https:${text}`;
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return "";
}

function normalizeLogoLocalPath(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const normalized = text
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1] || "";
  if (!fileName || fileName === "." || fileName === ".." || fileName.includes("..")) {
    return "";
  }

  return `logos/${fileName}`;
}

function normalizeKreisIds(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[;,|]/);
  const unique = new Set();

  for (const entry of source) {
    const normalized = String(entry || "").trim().toLowerCase();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

function normalizeClubEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const name = String(raw.name || raw.verein || raw.club || raw.team || "").trim();
  if (!name) {
    return null;
  }

  return {
    name,
    location: String(raw.location || raw.ort || raw.city || raw.plz || "").trim(),
    logoUrl: normalizeLogoUrl(raw.logoUrl || raw.logo || raw.wappen || raw.badge || raw.crest || ""),
    logoLocal: normalizeLogoLocalPath(raw.logoLocal || raw.logo_local || raw.localLogo || raw.logoPath || ""),
    link: String(raw.link || raw.url || raw.vereinUrl || "").trim(),
    kreisIds: normalizeKreisIds(raw.kreisIds || raw.kreis || raw.kreise || ""),
  };
}

function dedupeClubs(clubs) {
  const unique = new Map();

  for (const club of Array.isArray(clubs) ? clubs : []) {
    const normalized = normalizeClubEntry(club);
    if (!normalized) {
      continue;
    }

    const key = toLookupKey(normalized.name);
    if (!key) {
      continue;
    }

    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, normalized);
      continue;
    }

    unique.set(key, {
      ...existing,
      location: existing.location || normalized.location,
      logoUrl: existing.logoUrl || normalized.logoUrl,
      logoLocal: existing.logoLocal || normalized.logoLocal,
      link: existing.link || normalized.link,
      kreisIds: normalizeKreisIds([...(existing.kreisIds || []), ...(normalized.kreisIds || [])]),
    });
  }

  return [...unique.values()];
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvRows(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter).map((header) => String(header || "").trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function parseJsonRows(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed?.clubs)) {
    return parsed.clubs;
  }
  return [];
}

function isJsonFile(fileName) {
  return /\.json$/i.test(String(fileName || "").trim());
}

export function parseClubCatalogText(fileText, fileName = "") {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const parsedRows = isJsonFile(normalizedName) ? parseJsonRows(fileText) : parseCsvRows(fileText);
  const clubs = dedupeClubs(parsedRows);

  return {
    clubs,
    stats: {
      totalRows: Array.isArray(parsedRows) ? parsedRows.length : 0,
      validRows: clubs.length,
      skippedRows: Math.max(0, Number((Array.isArray(parsedRows) ? parsedRows.length : 0) - clubs.length)),
    },
  };
}

export async function parseClubCatalogFile(file) {
  const safeFile = file && typeof file === "object" ? file : null;
  const text = String((await safeFile?.text?.()) || "");
  const fileName = String(safeFile?.name || "");
  return parseClubCatalogText(text, fileName);
}

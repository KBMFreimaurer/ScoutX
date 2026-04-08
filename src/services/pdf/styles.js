export const COLORS = {
  text: [20, 24, 39],
  muted: [99, 107, 126],
  accent: [0, 120, 67],
  accentLight: [232, 248, 236],
  line: [221, 226, 235],
  tableStripe: [247, 249, 252],
  cardBg: [244, 247, 251],
  white: [255, 255, 255],
};

export function toSafeString(value) {
  return String(value ?? "").trim();
}

export function sanitizePdfText(value) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n");
  let cleaned = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    const isControl =
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127;

    if (isControl) {
      continue;
    }

    cleaned += normalized[index];
  }

  return cleaned;
}

export function sanitizeFileSegment(value, fallback = "ScoutX") {
  const cleaned = toSafeString(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || fallback;
}

export function buildFileName(cfg) {
  const kreis = sanitizeFileSegment(cfg?.kreisLabel, "ScoutX");
  const jugend = sanitizeFileSegment(cfg?.jugendLabel, "Plan");
  const date = new Date();
  const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  const timePart = `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  return `ScoutX-${kreis}-${jugend}-${datePart}-${timePart}.pdf`;
}

export function normalizeLookup(value) {
  return toSafeString(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function truncateText(text, maxChars) {
  const safe = toSafeString(text);
  if (safe.length <= maxChars) {
    return safe;
  }
  return `${safe.slice(0, maxChars - 1)}…`;
}

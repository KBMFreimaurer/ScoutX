function normalizeText(value) {
  return String(value || "").trim()
}

function normalizeDate(value) {
  const text = normalizeText(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text
  }
  return ""
}

function normalizeEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {}
  return {
    id: normalizeText(source.id),
    name: normalizeText(source.name),
    club: normalizeText(source.club),
    birthDate: normalizeDate(source.birthDate),
    jerseyNumber: normalizeText(source.jerseyNumber),
    dominantFoot: normalizeText(source.dominantFoot),
    position: normalizeText(source.position),
    strengths: normalizeText(source.strengths),
    createdAt: normalizeText(source.createdAt),
    updatedAt: normalizeText(source.updatedAt || source.createdAt),
  }
}

function csvEscapeCell(value) {
  const text = String(value || "")
  if (!/[\n",;]/.test(text)) {
    return text
  }
  return `"${text.replace(/"/g, '""')}"`
}

export function buildPlayersCsv(entries) {
  const rows = Array.isArray(entries) ? entries.map(normalizeEntry) : []
  const header = [
    "id",
    "name",
    "club",
    "birthDate",
    "jerseyNumber",
    "dominantFoot",
    "position",
    "strengths",
    "createdAt",
    "updatedAt",
  ]

  const lines = [header.join(";")]
  for (const row of rows) {
    lines.push(header.map((key) => csvEscapeCell(row[key])).join(";"))
  }

  return `${lines.join("\n")}\n`
}

export function buildPlayersJson(entries) {
  const rows = Array.isArray(entries) ? entries.map(normalizeEntry) : []
  return `${JSON.stringify(rows, null, 2)}\n`
}

export function triggerDownload({ filename, content, mimeType = "text/plain;charset=utf-8" }) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false
  }

  const blob = new Blob([String(content || "")], { type: mimeType })
  const objectUrl = window.URL.createObjectURL(blob)

  try {
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename || "export.txt"
    link.rel = "noopener"
    document.body.appendChild(link)
    link.click()
    link.remove()
    return true
  } finally {
    window.URL.revokeObjectURL(objectUrl)
  }
}

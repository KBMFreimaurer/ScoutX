#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_FILE="${1:-}"
VERIFY_FILE="docs/hrworks-verification-last-run.txt"
IMPORT_LOG_KEY="scoutx.hrworksImports.v1"

if [[ -z "$EVIDENCE_FILE" ]]; then
  EVIDENCE_FILE="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"
fi

if [[ -z "$EVIDENCE_FILE" || ! -f "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei nicht gefunden"
  exit 1
fi

VERIFY_STATUS="nein"
if [[ -f "$VERIFY_FILE" ]] && grep -q "status=ok" "$VERIFY_FILE"; then
  VERIFY_STATUS="ja"
fi

IMPORT_STATUS=""
IMPORT_PRESENT="nein"
LOG_EXPORT_PRESENT="nein"
IMPORT_REFERENCE=""
IMPORT_DURATION=""
IMPORT_STEP_SUMMARY=""

# Try reading from docs export first if present
LATEST_AUDIT_JSON="$(find docs -maxdepth 1 -type f -name 'ScoutX-HRworks-Audit-*.json' -print 2>/dev/null | sort | tail -n 1 || true)"
if [[ -n "$LATEST_AUDIT_JSON" && -f "$LATEST_AUDIT_JSON" ]]; then
  LOG_EXPORT_PRESENT="ja"
  AUDIT_ROW="$(node --input-type=module - "$LATEST_AUDIT_JSON" <<'EOF'
import fs from "node:fs";

const file = process.argv[2];
const safe = (value) => String(value ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();

try {
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw);
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const entry = entries[0] && typeof entries[0] === "object" ? entries[0] : null;
  const stepSummary = Array.isArray(entry?.performanceSteps)
    ? entry.performanceSteps
        .slice(0, 5)
        .map((step) => {
          const label = safe(step?.step);
          const detail = safe(step?.detail);
          const elapsed = Number(step?.elapsedMs);
          return [label, detail, Number.isFinite(elapsed) && elapsed >= 0 ? `+${Math.round(elapsed)}ms` : ""]
            .filter(Boolean)
            .join(" · ");
        })
        .filter(Boolean)
        .join(" | ")
    : "";
  process.stdout.write([
    entry ? "ja" : "nein",
    safe(entry?.hrworksStatus),
    safe(entry?.hrworksReference),
    safe(entry?.durationMs),
    safe(stepSummary),
  ].join("\t"));
} catch {
  process.stdout.write(["nein", "", "", "", ""].join("\t"));
}
EOF
)"
  IFS=$'\t' read -r IMPORT_PRESENT IMPORT_STATUS IMPORT_REFERENCE IMPORT_DURATION IMPORT_STEP_SUMMARY <<< "$AUDIT_ROW"
fi

# Try extracting last status from browser-localstorage snapshot fallback file if user stored one
# If unavailable, keep placeholders for manual completion.

awk \
  -v verify_status="$VERIFY_STATUS" \
  -v import_present="$IMPORT_PRESENT" \
  -v import_status="$IMPORT_STATUS" \
  -v log_export_present="$LOG_EXPORT_PRESENT" \
  -v import_reference="$IMPORT_REFERENCE" \
  -v import_duration="$IMPORT_DURATION" \
  -v import_step_summary="$IMPORT_STEP_SUMMARY" \
  '
  /^- Ergebnisdatei \(`docs\/hrworks-verification-last-run.txt`\) aktualisiert: ja\/nein/ {
    print "- Ergebnisdatei (`docs/hrworks-verification-last-run.txt`) aktualisiert: " verify_status;
    next
  }
  /^- HRworks-Importhistorie-Eintrag vorhanden: ja\/nein/ {
    print "- HRworks-Importhistorie-Eintrag vorhanden: " import_present;
    next
  }
  /^- Status \(`imported\/failed\/\.\.\.`\):/ {
    if (length(import_status) > 0) {
      print "- Status (`imported/failed/...`): " import_status;
    } else {
      print $0;
    }
    next
  }
  /^- Audit-Log exportiert \(`JSON`\): ja\/nein/ {
    print "- Audit-Log exportiert (`JSON`): " log_export_present;
    next
  }
  /^- Referenznummer \(optional\):/ {
    if (length(import_reference) > 0) {
      print "- Referenznummer (optional): " import_reference;
    } else {
      print $0;
    }
    next
  }
  /^- Laufzeit laut Audit-Log \(optional\):/ {
    if (length(import_duration) > 0) {
      print "- Laufzeit laut Audit-Log (optional): " import_duration " ms";
    } else {
      print $0;
    }
    next
  }
  /^- Schrittfolge laut Audit-Log \(optional\):/ {
    if (length(import_step_summary) > 0) {
      print "- Schrittfolge laut Audit-Log (optional): " import_step_summary;
    } else {
      print $0;
    }
    next
  }
  { print }
' "$EVIDENCE_FILE" > "$EVIDENCE_FILE.tmp"

mv "$EVIDENCE_FILE.tmp" "$EVIDENCE_FILE"
echo "OK: Evidence vorbefüllt: $EVIDENCE_FILE"

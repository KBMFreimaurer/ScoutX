#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

STATUS_FILE="docs/hrworks-acceptance-status.json"
EVIDENCE_FILE="${1:-}"
if [[ -z "$EVIDENCE_FILE" ]]; then
  EVIDENCE_FILE="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"
fi

if [[ ! -f "$STATUS_FILE" ]]; then
  echo "FAIL: $STATUS_FILE fehlt"
  exit 1
fi
if [[ -z "$EVIDENCE_FILE" || ! -f "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei nicht gefunden"
  exit 1
fi

EVIDENCE_FILE="$EVIDENCE_FILE" node <<'NODE'
const fs = require('fs');
const statusPath = 'docs/hrworks-acceptance-status.json';
const evidencePath = process.env.EVIDENCE_FILE;
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
const evidence = fs.readFileSync(evidencePath, 'utf8');

function hasYes(pattern) {
  const re = new RegExp(pattern, 'im');
  return re.test(evidence);
}

function readFieldValue(prefixPattern) {
  const re = new RegExp(`^${prefixPattern}\\s*(.*)$`, 'im');
  const m = evidence.match(re);
  return (m && m[1] ? String(m[1]).trim() : '');
}

const userValue = readFieldValue('- Durchführender Nutzer:');
const tenantValue = readFieldValue('- HRworks Mandant/Umgebung:');
const placeholderLike = /(vorname nachname|simulation|n\/a|unknown|hrworks-mandant|hr tenant)/i;
const looksReal = !placeholderLike.test(userValue) && !placeholderLike.test(tenantValue);

const updates = new Map();
const loginConfirmed = hasYes('^3\\. Nutzer manuell in HRworks eingeloggt:\\s*ja\\s*$');
const prefillConfirmed = hasYes('^4\\. Felder in HRworks korrekt vorbefüllt:\\s*ja\\s*$');
const realAcceptanceConfirmed = hasYes('^- Akzeptanzkriterien im Realbetrieb erfüllt:\\s*ja\\s*$');

if (looksReal && loginConfirmed) updates.set('ac8', 'fulfilled');
if (looksReal && prefillConfirmed) updates.set('ac9', 'fulfilled');
if (looksReal && realAcceptanceConfirmed && loginConfirmed && prefillConfirmed) {
  updates.set('ac7', 'fulfilled');
  updates.set('ac15', 'fulfilled');
  updates.set('ac16', 'fulfilled');
}

const downgrades = new Map();
if (!looksReal) {
  downgrades.set('ac8', {
    status: 'partial',
    note: 'Live-Evidence enthält Platzhalter/Testwerte; realer Login-Nachweis ausstehend',
  });
  downgrades.set('ac9', {
    status: 'partial',
    note: 'Live-Evidence enthält Platzhalter/Testwerte; reale DOM-Validierung ausstehend',
  });
}

for (const item of status.acceptance_criteria || []) {
  if (downgrades.has(item.id)) {
    const downgrade = downgrades.get(item.id);
    item.status = downgrade.status;
    item.note = downgrade.note;
    item.evidence = Array.from(new Set([...(item.evidence || []), evidencePath]));
    continue;
  }
  if (updates.has(item.id)) {
    item.status = updates.get(item.id);
    item.note = 'Automatisch aus Live-Evidence aktualisiert';
    item.evidence = Array.from(new Set([...(item.evidence || []), evidencePath]));
  }
}

const hasOpen = (status.acceptance_criteria || []).some((i) => i.status !== 'fulfilled');
status.global_status = hasOpen ? 'not_complete' : 'complete';
status.updated_at_utc = new Date().toISOString();

fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');
console.log(`OK: updated ${statusPath} from ${evidencePath}`);
NODE

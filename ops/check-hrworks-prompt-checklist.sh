#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CHECKLIST_FILE="docs/hrworks-prompt-checklist.json"

if [[ ! -f "$CHECKLIST_FILE" ]]; then
  echo "FAIL: $CHECKLIST_FILE fehlt"
  exit 1
fi

node <<'NODE'
const fs = require('fs');
const path = require('path');

const file = 'docs/hrworks-prompt-checklist.json';
const raw = fs.readFileSync(file, 'utf8');
const data = JSON.parse(raw);

let ok = true;

if (!Array.isArray(data.items) || data.items.length === 0) {
  console.error('FAIL: checklist items fehlen');
  process.exit(1);
}

const missingEvidence = [];
const openItems = [];

for (const item of data.items) {
  const id = item.id || '<no-id>';
  const status = item.status || 'unknown';
  if (status !== 'fulfilled') {
    openItems.push(`${id}: ${status}`);
  }
  for (const ev of item.evidence || []) {
    if (!fs.existsSync(path.resolve(ev))) {
      missingEvidence.push(`${id} -> ${ev}`);
    }
  }
}

if (missingEvidence.length > 0) {
  ok = false;
  console.error('FAIL: Fehlende Evidence-Pfade:');
  for (const e of missingEvidence) console.error(`  - ${e}`);
}

console.log(`checklist_file=${file}`);
console.log(`overall_status=${data.overall_status || 'unknown'}`);
console.log(`items_total=${data.items.length}`);
console.log(`open_items=${openItems.length}`);

if (openItems.length > 0) {
  console.log('Open checklist items:');
  for (const e of openItems) console.log(`  - ${e}`);
}

if (!ok) process.exit(1);
NODE


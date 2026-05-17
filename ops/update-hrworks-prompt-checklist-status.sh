#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CHECKLIST_FILE="docs/hrworks-prompt-checklist.json"
ACCEPTANCE_FILE="docs/hrworks-acceptance-status.json"

if [[ ! -f "$CHECKLIST_FILE" ]]; then
  echo "FAIL: $CHECKLIST_FILE fehlt"
  exit 1
fi
if [[ ! -f "$ACCEPTANCE_FILE" ]]; then
  echo "FAIL: $ACCEPTANCE_FILE fehlt"
  exit 1
fi

node <<'NODE'
const fs = require('fs');

const checklistPath = 'docs/hrworks-prompt-checklist.json';
const acceptancePath = 'docs/hrworks-acceptance-status.json';

const checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
const acceptance = JSON.parse(fs.readFileSync(acceptancePath, 'utf8'));

const byId = new Map((acceptance.acceptance_criteria || []).map((x) => [x.id, x]));
const ac8 = byId.get('ac8');
const ac9 = byId.get('ac9');

for (const item of checklist.items || []) {
  if (item.id === '13-acceptance-complete') {
    if (acceptance.global_status === 'complete') {
      item.status = 'fulfilled';
      delete item.gap;
    } else {
      item.status = 'not_complete';
      item.gap = 'ac8/ac9 bleiben partial bis echte Live-Evidence mit echten Nutzer-/Tenantwerten vorliegt';
    }
    item.evidence = Array.from(new Set([...(item.evidence || []), acceptancePath]));
  }
  if (item.id === '5-browser-automation-login' && ac8) {
    if (ac8.status === 'fulfilled') {
      item.status = 'fulfilled';
      delete item.gap;
    } else {
      item.status = 'partial';
      item.gap = 'Realer E2E-Nachweis im echten HRworks-DOM noch ausstehend';
    }
  }
  if (item.id === '6-selector-mapping' && ac9) {
    if (ac9.status === 'fulfilled') {
      item.status = 'fulfilled';
    }
  }
}

const open = (checklist.items || []).some((i) => i.status !== 'fulfilled');
checklist.overall_status = open ? 'not_complete' : 'complete';
checklist.updated_at_utc = new Date().toISOString();

fs.writeFileSync(checklistPath, JSON.stringify(checklist, null, 2) + '\n');
console.log(`OK: updated ${checklistPath} from ${acceptancePath}`);
NODE


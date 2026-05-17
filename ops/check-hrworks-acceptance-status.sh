#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

STATUS_FILE="docs/hrworks-acceptance-status.json"

if [[ ! -f "$STATUS_FILE" ]]; then
  echo "FAIL: $STATUS_FILE fehlt"
  exit 1
fi

node <<'NODE'
const fs = require('fs');
const path = 'docs/hrworks-acceptance-status.json';
const raw = fs.readFileSync(path, 'utf8');
const data = JSON.parse(raw);
const items = Array.isArray(data.acceptance_criteria) ? data.acceptance_criteria : [];
const partial = items.filter((i) => i.status === 'partial');
const open = items.filter((i) => i.status === 'open');
const fulfilled = items.filter((i) => i.status === 'fulfilled');

console.log(`status_file=${path}`);
console.log(`global_status=${data.global_status || 'unknown'}`);
console.log(`counts: fulfilled=${fulfilled.length} partial=${partial.length} open=${open.length}`);

if ((data.global_status || '').toLowerCase() !== 'complete') {
  console.log('FAIL: Akzeptanzstatus ist nicht complete');
  const remaining = [...partial, ...open];
  if (remaining.length > 0) {
    console.log('Offene Kriterien:');
    for (const item of remaining) {
      console.log(`- ${item.id || 'n/a'}: ${item.criterion || 'ohne Titel'} [${item.status}]`);
    }
  }
  process.exit(1);
}

console.log('OK: Akzeptanzstatus complete');
NODE

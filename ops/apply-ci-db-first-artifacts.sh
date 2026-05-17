#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ARTIFACT_DIR="${1:-${ARTIFACT_DIR:-}}"
if [[ -z "$ARTIFACT_DIR" ]]; then
  echo "Usage: ./ops/apply-ci-db-first-artifacts.sh <artifact-dir>" >&2
  echo "Erwartet einen Ordner aus 'gh run download'." >&2
  exit 1
fi

if [[ ! -d "$ARTIFACT_DIR" ]]; then
  echo "Artifact-Verzeichnis nicht gefunden: $ARTIFACT_DIR" >&2
  exit 1
fi

RESULTS_SRC="$(find "$ARTIFACT_DIR" -type f -name 'release-db-first-e2e-last-run.txt' | head -n 1 || true)"
CHECKLIST_SRC="$(find "$ARTIFACT_DIR" -type f -name 'scoutx_v1_release_gate_checklist.md' | head -n 1 || true)"

if [[ -z "$RESULTS_SRC" ]]; then
  echo "Konnte 'release-db-first-e2e-last-run.txt' in $ARTIFACT_DIR nicht finden." >&2
  exit 1
fi

cp "$RESULTS_SRC" docs/release-db-first-e2e-last-run.txt
echo "Übernommen: docs/release-db-first-e2e-last-run.txt"

if [[ -n "$CHECKLIST_SRC" ]]; then
  cp "$CHECKLIST_SRC" docs/scoutx_v1_release_gate_checklist.md
  echo "Übernommen: docs/scoutx_v1_release_gate_checklist.md"
fi

CI_STATUS="unknown"
if rg -q "^[[:space:]]*[0-9]+ failed|PostgreSQL-Preflight fehlgeschlagen|Error:" docs/release-db-first-e2e-last-run.txt; then
  CI_STATUS="failed"
elif rg -q "^[[:space:]]*[0-9]+ passed" docs/release-db-first-e2e-last-run.txt; then
  CI_STATUS="passed"
fi

CI_STATUS="$CI_STATUS" RESULTS_FILE="docs/release-db-first-e2e-last-run.txt" ./ops/update-release-checklist-from-ci-db-first.sh
echo "CI-Status aus Artefakten erkannt: $CI_STATUS"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WORKFLOW_FILE="${WORKFLOW_FILE:-ci.yml}"
TARGET_JOB="${TARGET_JOB:-e2e-release-db-first}"
POLL_SECONDS="${POLL_SECONDS:-15}"
MAX_POLLS="${MAX_POLLS:-80}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/tmp/scoutx-ci-db-first-artifacts}"

if ! command -v gh >/dev/null 2>&1; then
  echo "'gh' CLI ist nicht installiert." >&2
  exit 1
fi

if [[ -n "${GITHUB_TOKEN:-}" && -z "${GH_TOKEN:-}" ]]; then
  export GH_TOKEN="$GITHUB_TOKEN"
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI ist nicht authentifiziert. Nutze GH_TOKEN/GITHUB_TOKEN oder führe 'gh auth login' aus." >&2
  exit 1
fi

echo "Starte Workflow $WORKFLOW_FILE via workflow_dispatch..."
gh workflow run "$WORKFLOW_FILE"

echo "Warte auf neuen Workflow-Run..."
run_id=""
for _ in {1..20}; do
  run_id="$(gh run list --workflow "$WORKFLOW_FILE" --limit 1 --json databaseId --jq '.[0].databaseId' || true)"
  if [[ -n "$run_id" && "$run_id" != "null" ]]; then
    break
  fi
  sleep 3
done

if [[ -z "$run_id" || "$run_id" == "null" ]]; then
  echo "Konnte keinen gestarteten Workflow-Run ermitteln." >&2
  exit 1
fi

echo "Run-ID: $run_id"
echo "Verfolge Status für Job '$TARGET_JOB'..."

conclusion=""
job_conclusion=""
for ((i = 1; i <= MAX_POLLS; i++)); do
  status="$(gh run view "$run_id" --json status --jq '.status')"
  conclusion="$(gh run view "$run_id" --json conclusion --jq '.conclusion')"
  job_conclusion="$(gh run view "$run_id" --json jobs --jq ".jobs[] | select(.name==\"$TARGET_JOB\") | .conclusion" | head -n 1 || true)"
  echo "Poll $i/$MAX_POLLS: status=$status workflow_conclusion=$conclusion job_conclusion=${job_conclusion:-null}"
  if [[ "$status" == "completed" ]]; then
    break
  fi
  sleep "$POLL_SECONDS"
done

if [[ "$conclusion" == "null" || -z "$conclusion" ]]; then
  echo "Workflow wurde nicht rechtzeitig abgeschlossen." >&2
  exit 1
fi

if [[ -z "${job_conclusion:-}" || "$job_conclusion" == "null" ]]; then
  echo "Konnte Job-Conclusion für '$TARGET_JOB' nicht ermitteln." >&2
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"
echo "Lade Artefakte nach $ARTIFACT_DIR ..."
gh run download "$run_id" --dir "$ARTIFACT_DIR"

if [[ "$job_conclusion" == "success" ]]; then
  CI_STATUS=passed ./ops/update-release-checklist-from-ci-db-first.sh
else
  CI_STATUS=failed ./ops/update-release-checklist-from-ci-db-first.sh
fi

echo "Fertig. Workflow-Conclusion: $conclusion | Job-Conclusion ($TARGET_JOB): $job_conclusion"
echo "Artifacts: $ARTIFACT_DIR"

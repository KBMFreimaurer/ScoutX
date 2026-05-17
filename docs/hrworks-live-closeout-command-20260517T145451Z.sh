#!/usr/bin/env bash
set -euo pipefail

npm run check:hrworks:live-closeout -- "docs/hrworks-live-session-evidence-20260517T131103Z.md" \
  --user="Ayoub Ben" \
  --tenant="HRworks Prod EU" \
  --review=ja \
  --validated=ja \
  --login=ja \
  --prefill=ja \
  --confirm=ja \
  --saved=ja \
  --imported=ja \
  --reference-captured=ja \
  --abort-ok=ja \
  --acceptance=ja \
  --status=imported \
  --open-points="keine"

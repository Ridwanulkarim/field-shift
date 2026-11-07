#!/usr/bin/env bash
# Removes files that are superseded, one-off, or hold a cookie. DRY RUN by default: it only lists what it would do.
#   bash cleanup-backend.sh                    show the plan
#   bash cleanup-backend.sh --apply            do it
#   bash cleanup-backend.sh --apply --also-diagnostics    also the May-rainfall investigation scripts
# Run from the field-shift/ folder. Uses `git rm` when the folder is a git repo, so every removal is one `git restore` away.
set -euo pipefail
APPLY=0; DIAG=0
for a in "$@"; do case "$a" in --apply) APPLY=1;; --also-diagnostics) DIAG=1;; *) echo "unknown option $a"; exit 2;; esac; done
[ -d backend/scripts ] || { echo "Run this from the field-shift/ folder (the one that contains backend/)."; exit 2; }

FILES=(
  cookies.txt  # curl cookie jar with a session cookie; not needed, not safe to commit
  backend/scripts/analyze-onset.js              # superseded by the planting-window analysis and npm run screen:advisory
  backend/scripts/onset-sensitivity.js          # the same sensitivity grid is returned by /planting-window
  backend/scripts/planting-overview.js          # superseded by npm run screen:advisory
)
if [ "$DIAG" = 1 ]; then FILES+=(
  backend/scripts/crosscheck-may-rain.js        # one-off POWER vs ERA5 diagnostic
  backend/scripts/inspect-early-rain.js         # one-off May rainfall inspection
  backend/src/science/crosscheck.js             # used only by crosscheck-may-rain.js
); fi

for f in "${FILES[@]}"; do
  [ -e "$f" ] || { echo "skip (not there): $f"; continue; }
  if [ "$APPLY" = 1 ]; then
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git ls-files --error-unmatch "$f" >/dev/null 2>&1; then git rm -q "$f"; else rm -- "$f"; fi
    echo "removed: $f"
  else echo "would remove: $f"; fi
done
[ "$APPLY" = 1 ] || echo "Dry run only. Nothing changed. Add --apply to do it."

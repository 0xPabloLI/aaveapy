#!/usr/bin/env bash
# check-portfolio-panel-spacing.sh
#
# Guards every Portfolio*.tsx file in src/components/dashboard against
# arbitrary horizontal-spacing magic values:
#   pl-[Npx] pr-[Npx] px-[Npx] ml-[Npx] mr-[Npx] mx-[Npx]
# (and the same with `rem` units). All horizontal padding and margin must
# reference a --ds-space-* token so the Portfolio-mode header toggle stays
# X-aligned with the Single-mode toggle.
#
# See: docs/design/portfolio-panel-spacing.md
#
# Usage: bash scripts/check-portfolio-panel-spacing.sh [--strict]
#   --strict: exit 1 on any finding (CI mode). Default exits 0.

set -euo pipefail
set +H

STRICT=false
if [[ "${1:-}" == "--strict" ]]; then
  STRICT=true
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/src/components/dashboard"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Match (p|m)(l|r|x)-[<starts-with-digit ... ends with px|rem>]. Token
# usage like pr-[var(--ds-space-3)] is intentionally NOT matched.
PATTERN='\b[pm][lrx]-\[[0-9][^]]*(px|rem)\]'

FILES=$(find "$TARGET_DIR" -maxdepth 1 -type f -name 'Portfolio*.tsx' | sort)

if [[ -z "$FILES" ]]; then
  echo -e "${RED}FAIL${NC}: no Portfolio*.tsx files found under $TARGET_DIR"
  exit 1
fi

MATCHES=""
while IFS= read -r file; do
  HITS=$(grep -nE "$PATTERN" "$file" || true)
  if [[ -n "$HITS" ]]; then
    MATCHES+="── ${file#$ROOT_DIR/} ──"$'\n'"$HITS"$'\n'
  fi
done <<< "$FILES"

if [[ -n "$MATCHES" ]]; then
  echo -e "${RED}FAIL${NC}: Portfolio*.tsx contains arbitrary horizontal spacing values."
  echo "Use pl/pr/px/ml/mr/mx-[var(--ds-space-N)] tokens instead."
  echo "See docs/design/portfolio-panel-spacing.md"
  echo ""
  echo "$MATCHES"
  if $STRICT; then exit 1; fi
  exit 0
fi

echo -e "${GREEN}PASS${NC}: all Portfolio*.tsx files use token-based horizontal spacing."

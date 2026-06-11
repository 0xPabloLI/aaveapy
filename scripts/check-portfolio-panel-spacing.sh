#!/usr/bin/env bash
# check-portfolio-panel-spacing.sh
#
# Guards PortfolioPanel.tsx against arbitrary pr-[Npx] / mr-[Npx] /
# pl-[Npx] / ml-[Npx] / px-[Npx] / mx-[Npx] magic values. All horizontal
# padding and margin must reference --ds-space-* tokens so the Portfolio-
# mode header toggle stays X-aligned with the Single-mode toggle.
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
TARGET="$ROOT_DIR/src/components/dashboard/PortfolioPanel.tsx"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Match (p|m)(l|r|x)-[<anything-with-px-or-rem>]. Token usage like
# pr-[var(--ds-space-3)] is intentionally NOT matched.
PATTERN='\b[pm][lrx]-\[[0-9][^]]*(px|rem)\]'

MATCHES=$(grep -nE "$PATTERN" "$TARGET" || true)

if [[ -n "$MATCHES" ]]; then
  echo -e "${RED}FAIL${NC}: PortfolioPanel.tsx contains arbitrary horizontal spacing values."
  echo "Use pr-[var(--ds-space-N)] / mr-[var(--ds-space-N)] etc. instead."
  echo "See docs/design/portfolio-panel-spacing.md"
  echo ""
  echo "$MATCHES"
  if $STRICT; then exit 1; fi
  exit 0
fi

echo -e "${GREEN}PASS${NC}: PortfolioPanel.tsx uses only token-based horizontal spacing."

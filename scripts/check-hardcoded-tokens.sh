#!/usr/bin/env bash
# check-hardcoded-tokens.sh
# Scan for hardcoded design values that should use CSS tokens.
# Usage: bash scripts/check-hardcoded-tokens.sh [--strict]
#
# --strict: exit with non-zero if any hardcoded values found (CI mode)
# Default: report-only mode, exits 0 unless grep fails

set -euo pipefail
set +H

STRICT=false
if [[ "${1:-}" == "--strict" ]]; then
  STRICT=true
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/src"
ISSUES=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Hardcoded Token Scan ==="
echo ""

# ─── Font-size: no text-[Npx] in component source ───

echo "--- Font-size: text-[Npx] in component source ---"
FONT_MATCHES=$(grep -rn 'text-\[\(9\|10\|11\|12\|13\)px\]' "$SRC_DIR/components/" "$SRC_DIR/lib/" "$SRC_DIR/pages/" "$SRC_DIR/hooks/" 2>/dev/null || true)
if [[ -n "$FONT_MATCHES" ]]; then
  echo -e "${RED}FAIL: hardcoded text-[Npx] found:${NC}"
  echo "$FONT_MATCHES"
  ISSUES=$((ISSUES + 1))
else
  echo -e "${GREEN}PASS${NC}: no hardcoded text-[Npx] in source"
fi
echo ""

# ─── Control height: no h-8 in component source ───

echo "--- Control height: h-8 in component source ---"
H8_MATCHES=$(grep -rn '\bh-8\b' "$SRC_DIR/components/" "$SRC_DIR/pages/" 2>/dev/null || true)
if [[ -n "$H8_MATCHES" ]]; then
  echo -e "${YELLOW}WARN: h-8 found (may be skeleton/icon use not yet migrated):${NC}"
  echo "$H8_MATCHES"
else
  echo -e "${GREEN}PASS${NC}: no h-8 in component source"
fi
echo ""

# ─── Control height: no h-9 in component source ───

echo "--- Control height: h-9 in component source ---"
H9_MATCHES=$(grep -rn '\bh-9\b' "$SRC_DIR/components/" "$SRC_DIR/pages/" 2>/dev/null || true)
if [[ -n "$H9_MATCHES" ]]; then
  echo -e "${YELLOW}WARN: h-9 found (may be skeleton icon not yet migrated):${NC}"
  echo "$H9_MATCHES"
else
  echo -e "${GREEN}PASS${NC}: no h-9 in component source"
fi
echo ""

# ─── Control height: no h-11 in component source ───

echo "--- Control height: h-11 in component source ---"
H11_MATCHES=$(grep -rn '\bh-11\b' "$SRC_DIR/components/" "$SRC_DIR/pages/" 2>/dev/null || true)
if [[ -n "$H11_MATCHES" ]]; then
  echo -e "${YELLOW}WARN: h-11 found:${NC}"
  echo "$H11_MATCHES"
else
  echo -e "${GREEN}PASS${NC}: no h-11 in component source"
fi
echo ""

# ─── Ring tooltip: no max-w-[220px] in component source ───

echo "--- Ring tooltip: max-w-[220px] in component source ---"
TOOLTIP_MATCHES=$(grep -rn 'max-w-\[220px\]' "$SRC_DIR/components/" 2>/dev/null || true)
if [[ -n "$TOOLTIP_MATCHES" ]]; then
  echo -e "${RED}FAIL: hardcoded max-w-[220px] found:${NC}"
  echo "$TOOLTIP_MATCHES"
  ISSUES=$((ISSUES + 1))
else
  echo -e "${GREEN}PASS${NC}: no hardcoded max-w-[220px] in source"
fi
echo ""

# ─── Anti-pattern: !ds-text-N (line-height important conflict) ───

echo "--- Anti-pattern: !ds-text-N (line-height !important conflict) ---"
DS_IMPORTANT_MATCHES=$(grep -rn '!ds-text-\(9\|11\)' "$SRC_DIR/components/" "$SRC_DIR/lib/" 2>/dev/null || true)
if [[ -n "$DS_IMPORTANT_MATCHES" ]]; then
  echo -e "${RED}FAIL: !ds-text-N anti-pattern found (line-height conflict risk):${NC}"
  echo "$DS_IMPORTANT_MATCHES"
  ISSUES=$((ISSUES + 1))
else
  echo -e "${GREEN}PASS${NC}: no !ds-text-N anti-pattern"
fi
echo ""

# ─── Summary ───

echo "=== Summary ==="
if [[ $ISSUES -eq 0 ]]; then
  echo -e "${GREEN}All checks passed.${NC}"
  exit 0
else
  echo -e "${RED}$ISSUES issue(s) found.${NC}"
  if $STRICT; then
    exit 1
  fi
  exit 0
fi
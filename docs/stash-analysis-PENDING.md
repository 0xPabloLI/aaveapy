# Pending Stash Analysis

Three stashes contain unfinished work directions that need review before deciding whether to implement or discard.

---

## Stash 0: IncentiveTooltip grid→inline-flex layout

**Stash message**: `WIP: IncentiveTooltip grid→inline-flex layout`

**Files changed**:
- `src/components/dashboard/IncentiveTooltip.tsx` (91 lines changed)
- `src/components/dashboard/IncentiveTooltip.test.tsx` (8 lines changed)

### What it does

Replaces `grid grid-cols-[1fr_5rem]` layout with `flex` + `ml-auto` for APR alignment between opportunity headers and campaign rows in the IncentiveTooltip.

**Before (current)**: Source header and campaign rows use `grid grid-cols-[1fr_5rem]` — fixed 5rem column for APR values.

**After (stash)**: Uses `flex items-start gap-x-[var(--ds-space-1-5)]` + `ml-auto` on the APR `<span>` — APR values right-align via flex auto margin instead of grid column.

### Why it was started

User preference: arrow gap between text and APR should stay consistent when text wraps to multiple lines. Grid with fixed `5rem` column causes the APR to always start at the same horizontal position regardless of text length, which creates inconsistent visual spacing when text wraps.

### Current state

**Partially adopted**: Current lovable code already uses `ml-auto` and `inline-flex` in some places (source header APR, campaign APR), but still retains `grid grid-cols-[1fr_5rem]` in other rows (RecentlyEndedSection header, campaign date+APR rows). The stash is a more aggressive full replacement.

### Key decisions needed

1. Should the full IncentiveTooltip switch from grid to flex layout, or is the current hybrid (flex for some rows, grid for others) acceptable?
2. The stash removes the fixed `5rem` column width — this means APR values no longer align vertically at a fixed position. Is this acceptable for visual consistency?

### Diff summary

```diff
- <div className="grid grid-cols-[1fr_5rem] items-center gap-x-[var(--ds-space-1-5)] mb-[var(--ds-space-1)]">
+ <div className="flex items-center gap-x-[var(--ds-space-1-5)] mb-[var(--ds-space-1)]">

- <span className="... justify-self-end">
+ <span className="... ml-auto">

- <div className="ds-tooltip-body grid grid-cols-[1fr_5rem] items-start gap-x-[var(--ds-space-1-5)]">
+ <div className="ds-tooltip-body flex items-start gap-x-[var(--ds-space-1-5)]">

- <span className="break-words min-w-0 flex items-center gap-1.5">
+ <span className="break-words min-w-0 inline-flex flex-wrap items-center gap-1.5">
```

---

## Stash 1: ReservesTable crossReservePositions simplification

**Stash message**: `WIP: ReservesTable crossReservePositions simplification`

**Files changed**:
- `src/components/dashboard/ReservesTable.tsx` (7 insertions, 19 deletions)

### What it does

Replaces the full `crossReservePositions` useMemo computation with a simple `return undefined`.

**Before (current)**: In shared scenario mode, `crossReservePositions` builds a Map of per-reserve supplyUsd/borrowUsd from the shared input. In portfolio mode, returns `undefined` (portfolio passes its own map via `perReserveInputs`).

**After (stash)**: Always returns `undefined`, regardless of mode. The comment explains:
> Only portfolio mode builds crossReservePositions (from actual wallet positions). Shared scenario mode returns undefined — the same input copied to all reserves would cause incorrect cross-reserve offset calculations (AAV-1035).

### Why it was started

AAV-1035: In shared scenario mode, the same input amount is copied to every reserve. This causes cross-reserve offset calculations (e.g., Merkl scoring) to incorrectly count the same $1,000 borrow multiple times — once per reserve. The fix: shared scenario mode should not build crossReservePositions at all.

### Current state

**Not adopted**: Current lovable code still has the full computation. The `if (!isPortfolioMode) return undefined;` guard already skips shared scenario mode, so the AAV-1035 issue is already fixed in the current code. The stash goes further by removing the dead code path entirely.

### Key decisions needed

1. The current `if (!isPortfolioMode) return undefined;` guard already prevents the bug. Is it worth removing the dead code path (the 15 lines that build the map from shared inputs)?
2. If removed, the `reserveSymbolById` memo that depends on `crossReservePositions` will also always return `undefined` — verify this has no side effects on Merkl cross-reserve note display.

### Diff summary

```diff
  const crossReservePositions = useMemo((): Map<string, ReservePositions> | undefined => {
-    if (!isPortfolioMode) return undefined;
-    const rawSupply = parseNumberInput(debouncedSharedSupplyInput);
-    const rawBorrow = parseNumberInput(debouncedSharedBorrowInput);
-    if (rawSupply === 0 && rawBorrow === 0) return undefined;
-    const map = new Map<string, ReservePositions>();
-    for (const r of reserves) {
-      const tp = r.tokenPrice ?? 0;
-      const supplyUsd = sharedInputMode === 'usd' ? rawSupply : rawSupply * tp;
-      const borrowUsd = sharedInputMode === 'usd' ? rawBorrow : rawBorrow * tp;
-      if (supplyUsd > 0 || borrowUsd > 0) {
-        map.set(r.reserveId, { supplyUsd, borrowUsd });
-      }
-    }
-    return map.size > 0 ? map : undefined;
-  }, [reserves, debouncedSharedSupplyInput, debouncedSharedBorrowInput, sharedInputMode, isPortfolioMode]);
+    // Only portfolio mode builds crossReservePositions (from actual wallet positions).
+    // Shared scenario mode returns undefined — the same input copied to all reserves
+    // would cause incorrect cross-reserve offset calculations (AAV-1035).
+    // In portfolio mode, shared inputs are empty strings, so rawSupply/rawBorrow are 0.
+    // The map is built from portfolioEntries via perReserveInputs instead.
+    return undefined;
+  }, []);
```

---

## Stash 2: E1a portfolio code review fixes + reservesSorter disabled sort

**Stash message**: `WIP: E1a portfolio code review fixes + reservesSorter disabled sort`

**Files changed**:
- `public/openapi.json` (3766 lines changed — spec format change, can be ignored)
- `src/components/dashboard/PortfolioResultsTable.tsx` (29 lines changed)
- `src/components/dashboard/PortfolioTokenRow.render.test.tsx` (30 lines changed)
- `src/components/dashboard/PortfolioTokenRow.tsx` (6 lines changed)
- `src/lib/reservesSorter.test.ts` (14 lines changed)
- `src/lib/reservesSorter.ts` (13 lines changed)

### What it does — three separate changes bundled together

#### Change A: PortfolioResultsTable semantic colors

Adds `accentClass` prop to `DeltaCell` and `ResultRow`, using `ds-text-emerald-600` for supply deltas and `ds-text-brand-cyan` for borrow deltas. Total percent column uses side-specific colors instead of generic `text-foreground`. Daily earn column uses `dayColor` (emerald for positive, destructive for negative, muted for zero).

**Before**: All delta cells use `text-foreground/70`. Total percent uses `font-bold text-foreground`.

**After**: Delta cells inherit accent class from their side. Total percent uses side-specific color. Daily earn uses conditional coloring.

#### Change B: PortfolioTokenRow token input mode fix

Fixes wallet display in token input mode — when `inputMode === 'token'` and `tokenPriceInUsd` is available, wallet value should be divided by token price to show token amount instead of USD amount.

Also changes `text-[rgb(var(--ds-brand-cyan-rgb))]` → `ds-text-brand-cyan` (design token consistency), and arrow color `text-border` → `text-muted-foreground/40`.

**Note**: The `ds-text-brand-cyan` change is **already adopted** in current lovable code. The token price division and arrow color change are not.

#### Change C: reservesSorter disabled sort

Adds `isSupplyDisabled` and `isBorrowDisabled` to `ReserveSortValueGetters` interface. Disabled reserves sort to the bottom in desc order (and top in asc order). This ensures frozen/paused/disabled reserves don't clutter the top of the table when sorting by highest APR.

### Current state

- **Change A**: Not adopted — PortfolioResultsTable still uses generic `text-foreground/70`
- **Change B**: Partially adopted — `ds-text-brand-cyan` is in, but token input wallet display fix and arrow color are not
- **Change C**: Not adopted — reservesSorter does not have `isSupplyDisabled`/`isBorrowDisabled`

### Key decisions needed

1. **Change A**: Should delta cells in PortfolioResultsTable use side-specific colors? This matches the PortfolioTokenRow convention but makes the results table more colorful.
2. **Change B**: The token input wallet display fix is a bug — in token mode, wallet shows USD value instead of token amount. Is this the right fix? Also, `formatDeltaUsdDay` now uses `Math.abs(value)` — is this intentional?
3. **Change C**: Should disabled/frozen reserves sort to the bottom? This is a UX improvement but adds two new interface methods to `ReserveSortValueGetters`, affecting all callers.

### Diff summary for each change

**Change A — PortfolioResultsTable accent colors**:
```diff
- <td className={cn('... text-foreground/70', ...)}>
+ <td className={cn('... ', value ? accentClass : 'text-muted-foreground', ...)}>

- <td className={cn('... font-bold text-foreground', ...)}>
+ <td className={cn('... font-bold ', isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600', ...)}>
```

**Change B — PortfolioTokenRow token input fix**:
```diff
- : formatNumberInput(formatConvertedAmount(sideData.walletValue!));
+ : (tokenPriceInUsd != null ? formatNumberInput(formatConvertedAmount(sideData.walletValue! / tokenPriceInUsd)) : formatNumberInput(formatConvertedAmount(sideData.walletValue!)));

- <span className="text-border">→</span>
+ <span className="text-muted-foreground/40">→</span>

- const prefix = value > 0 ? '+' : '';
- return `${prefix}$${value.toFixed(2)}`;
+ const prefix = value > 0 ? '+' : '';
+ return `${prefix}$${Math.abs(value).toFixed(2)}`;
```

**Change C — reservesSorter disabled sort**:
```diff
+ isSupplyDisabled: (reserve: R) => boolean;
+ isBorrowDisabled: (reserve: R) => boolean;

+ const aDisabled = isDisabled(a);
+ const bDisabled = isDisabled(b);
+ if (aDisabled !== bDisabled) {
+   return order === 'desc' ? (aDisabled ? 1 : -1) : (aDisabled ? -1 : 1);
+ }
```

---

## Working tree WIP files (not in stash)

These files are also pending in the working tree:

| File | Description | Status |
|------|-------------|--------|
| `src/components/dashboard/PortfolioPanel.tsx` | Adds `?unified=1` query param mode that renders `PortfolioUnifiedTable` instead of split entry list + results table | Modified, 17 insertions, 6 deletions |
| `src/components/dashboard/PortfolioUnifiedTable.tsx` | New 740-line component — unified input + results + summary in one table | Untracked, incomplete (parse error on line 740) |
| `src/pages/Index.tsx` | `GithubIcon` → `Github` — **regression**, contradicts lucide-react 1.x upgrade | Modified, should revert |
| `public/openapi.json` | Spec format change (inline → $ref or reverse) | Modified, should let CI sync |
| `scripts/inspect-unified.ts` | Dev helper script for unified table | Untracked |
| `scripts/screenshot-unified.ts` | Dev helper script for unified table | Untracked |
| `修复 bot PR auto-merge(unstable-status 竞态根因).md` | Temporary document | Untracked, should delete |

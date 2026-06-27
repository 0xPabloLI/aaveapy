# ADR-016: Conditional soft delete & force sync guard fix

## Status

Superseded by AAV-803 (conditional soft delete v2)

## Context

AAV-769: When a user deletes a reserve with wallet position (hidden=true), then manually re-adds the same reserve via search panel, and force syncs, the wallet position data (`walletValue`) is not restored.

Root cause: `forceSyncEntries` → `forceSide` guard `if (existing.walletValue === null) return existing` skips wallet data sync for manually-added entries. Since `addReserve` creates entries with `walletValue: null`, any manually re-added reserve that actually has a wallet position will never get its `walletValue` updated by force sync.

## Decision

### 1. Conditional soft delete

Delete behavior depends on whether the entry has a wallet position:

- **Has wallet position** (any side `walletValue !== null`) → `hideReserve` (soft delete, `hidden: true`)
  - Entry becomes gray + sunk to bottom, with eye-off icon for restore
  - All position data preserved — force sync / addReserve auto-unhide can recover
- **Pure manual** (both sides `walletValue === null`) → `removeReserve` (hard delete, removed from array)
  - No data loss risk — entry has only user-typed amounts, no wallet data
  - User can re-add via search panel in 2 seconds

This replaces the original "unified soft delete" that applied `hideReserve` to all entries regardless of wallet status. Pure manual entries have nothing to recover, so soft-deleting them wastes memory and confuses users with eye-off icons on empty entries.

### 2. addReserve auto-unhide (unchanged)

When `addReserve` encounters an existing hidden entry with the same `reserveId`:
- Unhide the entry (`hidden: false`) instead of returning early
- Preserve existing position data — user gets their data back

### 3. Force sync guard fix (unchanged)

Change `forceSide` guard from:
```ts
if (existing.walletValue === null) return existing;
```
to:
```ts
if (incoming.walletValue === null) return existing;
```

### 4. Unhide preserves all data (unchanged)

`unhideReserve` only sets `hidden: false`. No data reset. If user wants to reset to wallet state, use `restoreToWallet`.

### 5. clearAll conditional behavior

`clearAll` applies the same conditional logic:
- Wallet entries → `hidden: true` (preserved for force sync recovery)
- Manual entries → removed from array

### 6. Removed: undoLastRemove, removeHiddenEntries, added toast

- `undoLastRemove` removed — hide has eye-off one-click restore, remove is empty data
- `removeHiddenEntries` removed — no consumers
- Added toast with Undo button removed — Undo called `hideReserve` which was wrong for manual entries; toast no longer needed

## Consequences

### Positive
- **Bug fix**: Force sync correctly updates manually re-added entries with wallet position data
- **Correct semantics**: Wallet entries preserve data through hide/unhide cycle; manual entries are truly removed
- **No wasted memory**: Manual entries don't linger as hidden empty shells
- **Simpler UX**: No eye-off icon on empty entries that have nothing to "restore"

### Negative
- **Two delete paths**: Callers must check `hasWallet` before choosing `hideReserve` vs `removeReserve`. Mitigated: this is a simple boolean check and the UI layer (PortfolioTokenRow, usePortfolioToggle) handles it centrally.

## Related Issues

AAV-769, AAV-803

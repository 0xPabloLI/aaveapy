# ADR-016: Unified soft delete & force sync guard fix

## Status

Completed

## Context

AAV-769: When a user deletes a reserve with wallet position (hidden=true), then manually re-adds the same reserve via search panel, and force syncs, the wallet position data (`walletValue`) is not restored.

Root cause: `forceSyncEntries` → `forceSide` guard `if (existing.walletValue === null) return existing` skips wallet data sync for manually-added entries. Since `addReserve` creates entries with `walletValue: null`, any manually re-added reserve that actually has a wallet position will never get its `walletValue` updated by force sync.

Additionally, the current delete strategy is mixed:
- Has wallet position → soft delete (hidden=true, entry preserved)
- No wallet position → hard delete (removed from array)

This creates two delete semantics for the same user action, making the mental model inconsistent.

## Decision

### 1. Unified soft delete

All entry deletion → `hidden: true`. Remove `removeReserve` (hard delete) from the API surface. Remove `getEntrySoftDeleteAction` (no longer needed).

When user clicks delete on any entry:
- Call `hideReserve(reserveId)` — always soft delete
- Entry becomes gray + sunk to bottom, with unhide button
- All position data (walletValue, delta, amount) preserved

### 2. addReserve auto-unhide

When `addReserve` encounters an existing hidden entry with the same `reserveId`:
- Unhide the entry (`hidden: false`) instead of returning early
- Preserve existing position data — user gets their data back

### 3. Force sync guard fix

Change `forceSide` guard from:
```ts
if (existing.walletValue === null) return existing;
```
to:
```ts
if (incoming.walletValue === null) return existing;
```

Semantics: "if incoming has no wallet data for this side, don't update" instead of "if existing is a manual entry, don't update". This allows force sync to correctly populate `walletValue`/`source` for manually-added entries that match a wallet position.

### 4. Unhide preserves all data

`unhideReserve` only sets `hidden: false`. No data reset. If user wants to reset to wallet state, use `restoreToWallet`.

### 5. undoLastRemove LIFO semantics

`undoLastRemove` unhides only the last hidden reserve (LIFO), not a full-snapshot rollback. Uses `lastHiddenReserveIdRef` (single reserveId) instead of `lastRemoveSnapshotRef` (full array snapshot). This ensures that hiding A → hiding B → undo only restores B, not both A and B.

## Consequences

### Positive
- **Bug fix**: Force sync correctly updates manually re-added entries with wallet position data
- **Consistent semantics**: One delete action (hidden=true) for all entries
- **No data loss**: All position data preserved through delete/re-add cycle
- **Simpler API**: `removeReserve` and `getEntrySoftDeleteAction` removed

### Negative
- **Hidden entries accumulate**: Pure manual entries deleted via soft delete remain in array (hidden). Mitigated: `removeHiddenEntries()` exists for cleanup.
- **Memory**: Hidden entries consume memory. Low risk: typical user has <50 entries.

## Related Issues

AAV-769

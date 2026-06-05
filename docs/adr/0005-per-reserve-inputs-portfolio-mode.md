# ADR-005: Per-Reserve Simulation Inputs for Portfolio/Batch Mode

## Status

Accepted

## Context

Shared scenario mode provides a single `supplyInput`/`borrowInput` pair applied uniformly to all reserves. Portfolio/batch mode has per-reserve positions (e.g. supply 5000 USDC, borrow 2000 USDT) that must drive per-reserve simulation independently.

Previously, expanding a reserve row in portfolio mode showed only the current snapshot (no after/delta) because `useSharedRateSimulations` only consumed the shared input pair.

## Decision

**Per-reserve inputs with mutual exclusion**:

1. `buildPerReserveInputs(positions, reserves) → Map<reserveId, PerReserveInput>` — pure function aggregating portfolio positions into per-reserve `{ supplyInput, borrowInput, inputMode }` (AAV-553)
2. `useSharedRateSimulations` gains `perReserveInputs` param; in `simulationsById` reduce, `effectiveSupplyInput = perReserve?.supplyInput ?? supplyInput` (AAV-555)
3. ReservesTable passes `perReserveInputs` when `isPortfolioMode`; shared `supplyInput`/`borrowInput` are set to `''` (empty) — **mutual exclusion**, not priority fallback (AAV-556)

### Mutual Exclusion Semantics

- Portfolio mode ON: shared inputs blanked, `perReserveInputs` drives per-reserve simulation
- Single mode ON: `perReserveInputs` is `undefined`, shared inputs drive uniform simulation
- No reserve input: `after = null`, `after ?? current = current` (natural fallback)

### UI Gate Removal (AAV-554)

`hasAnyInput`/`hasSharedScenario` UI-layer gates removed. The `after ?? current` pattern provides natural fallback without explicit gates. Calculator-internal `hasAnyInput` short-circuits (B-class) preserved.

## Consequences

### Positive
- Reserve rows show after/delta from batch positions in portfolio mode
- Mutual exclusion is simple: one mode blanks the other's inputs
- `after ?? current` fallback is zero-cost and natural
- `buildPerReserveInputs` is a pure function with full test coverage

### Negative
- `perReserveInputs` adds a `Map` to `useSharedRateSimulations` deps; recomputes when positions change
- Portfolio mode clears shared inputs — if user switches back, shared inputs are lost (debounced values reset)

## Alternatives Considered

### Priority Fallback (per-reserve overrides shared)
Rejected. Creates subtle interaction: shared input partially applies where no per-reserve input exists. Mutual exclusion is cleaner and matches the UX (modes are toggled, not layered).

### Separate Hook for Portfolio Simulation
Rejected. Would duplicate `useSharedRateSimulations` logic. The `perReserveInputs` param extends the existing hook with minimal change.

## Related Issues

AAV-468 (parent), AAV-553, AAV-554, AAV-555, AAV-556

# Spec: Portfolio Complete Snapshot, Eligibility Composition, and Rate Semantics

## Problem Statement

Three intertwined issues affect Portfolio Simulation incentive display:

1. **Cross-reserve offset invisible**: When Reserve A's borrow delta cross-offsets Reserve B's supply incentive (via `netPositionConstraint`), but B has no local delta, B's `afterIncentive` remains `null`. Users cannot see how deltas on one reserve affect incentives on others.

2. **Eligibility double-scaling**: Position cap and cross-reserve offset are applied as independent multiplicative ratios. The correct model computes a single eligible principal: `eligible = min(netAfterOffsets, positionCap)`. Current code can produce `10% × 0.667 × 0.667 = 4.44%` instead of `10% × 1000/1500 = 6.67%`.

3. **Rate semantics confusion**: `headlineIncentive` is not a pure market rate (it applies wallet-only cross-reserve multiplier to Merkl). `deltaIncentive` is overloaded with two meanings (`after - current` vs `current - headline`), confusing users.

## Solution

Three coordinated changes:

1. **Portfolio Complete Snapshot**: When any portfolio entry has a non-zero delta, all portfolio member reserves compute `after*` values reflecting the full target portfolio.

2. **Unified Eligibility Principal**: Position cap and cross-reserve offset compose into a single eligible principal before scaling the rate, not as independent multipliers.

3. **Three-Tier Rate Semantics**: `headlineIncentive` = pure market advertised rate (no forecast/wallet/cap/offset). `currentIncentive` = wallet effective rate (forecast + wallet cap/offset). `afterIncentive` = target portfolio effective rate (forecast + portfolio cap/offset). `deltaIncentive` = `after - current` only.

## User Stories

1. As a portfolio user, I want to see how my borrow delta on USDC affects my supply incentive on USDe, so that I can evaluate the net lending tradeoff.
2. As a portfolio user, I want the Reserve Table to show the post-scenario incentive for all my wallet positions, not just the ones I directly modified, so that I see the complete impact of my portfolio plan.
3. As a portfolio user, I want the Portfolio Result Table and Reserve Table to show the same after values, so that I don't get confused by inconsistent numbers.
4. As a portfolio user, I want the delta column to show only the scenario change (after minus current), so that it always means the same thing.
5. As a portfolio user, I want my current incentive to never change when I modify deltas on other reserves, so that I can trust the current vs after comparison.
6. As a portfolio user, I want reserves not in my portfolio to be unaffected by the scenario, so that the market table isn't polluted with personalized projections.
7. As a portfolio user with no deltas entered, I want to see current values only (no after/delta), so that the UI doesn't show spurious scenario effects.
8. As a portfolio user, I want the native rate for unmodified reserves to stay the same in the after state, so that only incentive changes are reflected.
9. As a portfolio user, I want to see the market headline rate as a reference value in expanded details, so that I can compare it with my current and after rates.
10. As a portfolio user, I want to see structured eligibility info (eligible amount, position cap, net after offsets) in expanded details, so that I understand why my effective rate differs from the headline.
11. As a portfolio user, I want the after total (native + incentive) to be correctly computed for unmodified reserves, so that the USD/day and summary numbers are accurate.
12. As a portfolio user, I want position cap and cross-reserve offset to compose correctly, so that I don't see double-discounted incentive rates.

## Implementation Decisions

### D1: Split `hasAnyInput` into two gates

- `hasLocalInput` (per-reserve, same as current `hasAnyInput`): controls native rate simulation, forecast input, cap constraints, Brevis shared deposits, forecast loading. Unchanged.
- `shouldComputeAfter = hasLocalInput || portfolioScenarioActive`: controls per-source `sumAfter`, `afterIncentive`, `afterTotal`, `afterNative` fallback.

New parameter `portfolioScenarioActive?: boolean` on `buildRateSimulationResult`. Default `undefined` preserves Single Mode behavior.

### D2: Unified eligibility principal

Refactor Merkl/Merit/Brevis cap + offset composition to compute a single eligible principal:

```text
netEligible = max(grossPosition - crossReserveOffset, 0)
eligible = min(netEligible, positionCap)
effectiveRate = rate × eligible / grossPosition
```

This replaces the current pattern of applying `applyPositionCap` and `merklGroupMultiplier` as independent sequential multipliers. The refactored path must produce identical results for cases where only one of cap/offset is active (no regression), and correct results when both are active (fixes double-scaling).

### D3: Headline redefinition

`headlineIncentive` becomes pure API advertised campaign/protocol rate:
- No forecast computation
- No wallet position dependency
- No position cap
- No cross-reserve offset
- Uses `calculateTotalIncentiveApy/Apr` with no `merklGroupMultiplier`, no `positionUsd`

Golden Rule #4 amended: headline is truly wallet-independent. The `current - headline` gap is no longer computed or stored in `deltaIncentive`.

### D4: Delta unification

`deltaIncentive` formula changes to:
```text
after != null ? after - current : null
```

The `current - headline` path is removed. Eligibility gap info (cap, offset, eligible amount) becomes structured data for display in expanded details, not a rate delta.

### D5: After native fallback

When `portfolioScenarioActive` is true but `hasLocalInput` is false:
- `afterNative = currentNative` (explicit fallback).
- `deltaNative = 0`.

### D6: Portfolio Scenario activation

- Hook level: `hasPerReserveInput` (already exists) passed as `portfolioScenarioActive`, scoped to `perReserveInputs.has(reserveId)`.
- Simulator level: compute whether any group has non-zero delta before the per-group loop.

### D7: Scope and path compliance

- Only portfolio members compute after. Non-portfolio reserves unaffected.
- Both hook path and standalone path (ADR-0017) must pass `portfolioScenarioActive`.
- ADR-0005's "No reserve input: `after = null`" amended for Portfolio Mode only.

## Testing Decisions

### Seam 1: `buildRateSimulationResult` unit tests

Prior art: AAV-1137, AAV-1113 test groups.

New test cases:
- Portfolio scenario active + no local input + cross-reserve constraint → `afterIncentive` non-null, reflects cross-offset.
- Portfolio scenario active + no local input → `afterNative = currentNative`, `deltaNative = 0`.
- `deltaIncentive = after - current` only; `current - headline` path removed.
- `currentIncentive` unchanged when toggling `portfolioScenarioActive`.
- Non-portfolio reserve → `afterIncentive = null` even when scenario active.
- Scenario active + no cross-reserve constraint → `afterIncentive = currentIncentive`, `delta = 0`.
- Single Mode → existing behavior preserved (regression guard).
- **Eligibility composition**: position cap + cross-reserve offset both active → single eligible principal, no double-scaling.
- **Headline purity**: `headlineIncentive` does not change when wallet position changes.
- **Headline purity**: `headlineIncentive` does not use forecast (equals advertised API rate).

### Seam 2: `simulatePortfolioFromEntries` integration tests

Prior art: existing cross-reserve net position constraint test group.

New test cases:
- Wallet-only entry B (delta=0) + entry A with borrow delta → B's after reflects A's offset.
- Wallet-only entry B + no other deltas → B's after = current (no scenario).
- Hidden/orphan entries excluded from scenario activation.
- Position cap + cross-reserve offset both active → correct single eligible principal.

### Seam 3: `useSharedRateSimulations` hook tests

- Portfolio mode + one entry has delta → all portfolio members receive `portfolioScenarioActive = true`.
- Non-portfolio reserves receive `portfolioScenarioActive = false`.

### Seam 4: ReservesTable / Portfolio UI tests

- Portfolio scenario active + wallet-only reserve affected by cross-offset → shows after value.
- Delta column shows only `after - current`.
- Expanded details show headline as reference and eligibility info (eligible amount, cap, offset).
- `MetricValue` tooltip shows `Current → After + Δ` when both exist and differ.

## Out of Scope

- Per-source `Math.min(afterRaw, current)` cap (separate existing rule).
- Cross-reserve offset in Single Mode.
- ADR-0017 duplicate path removal.
- `SimulationLane.hasInput` semantics changes.
- New UI components or layout changes (reuse existing expanded row / tooltip surfaces).

## Further Notes

- Golden Rules #1-3 preserved. Rule #4 amended: headline = pure market rate, no wallet dependency.
- Eligibility info (cap gap, offset amounts) is structured data for expanded details, not a rate delta.
- ADR-0025 documents all decisions. CONTEXT.md updated with domain terms.
- Linear issue: AAV-1163.

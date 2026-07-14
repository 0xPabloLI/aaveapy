# ADR-0025: Portfolio Complete Snapshot, Eligibility Composition, and Rate Semantics

## Status

Accepted

## Context

Three intertwined issues were discovered during Portfolio Simulation cross-reserve offset analysis:

### Issue 1: Cross-reserve offset invisible on unmodified reserves

ADR-0005 preserved the calculator-internal `hasAnyInput` short-circuit: "No reserve input: `after = null`." When Reserve A's borrow delta cross-offsets Reserve B's supply incentive (via `netPositionConstraint`), but B has no local delta, B's `afterIncentive` remains `null`. Users cannot see how deltas on one reserve affect incentives on other portfolio reserves.

### Issue 2: Eligibility double-scaling

Position cap and cross-reserve offset are applied as independent multiplicative ratios in the current Merkl aggregate path. The correct model computes a single eligible principal:

```text
eligible = min(netAfterOffsets, positionCap)
effectiveRate = headlineRate × eligible / grossPosition
```

Example: wallet supply $1500, position cap $1000, cross-reserve offset $500.
- Correct: net = 1000, eligible = min(1000, 1000) = 1000, rate = 10% × 1000/1500 = 6.67%
- Bug: cap ratio = 1000/1500 = 0.667, cross ratio = 1000/1500 = 0.667, rate = 10% × 0.667 × 0.667 = 4.44%

### Issue 3: `headlineIncentive` semantics drift and `deltaIncentive` overloading

Golden Rule #4 defines `headlineIncentive` as "no position cap dilution," but the implementation still applies wallet-only cross-reserve multiplier to Merkl headline. This makes it a wallet-adjusted baseline, not a pure market reference rate.

Additionally, `deltaIncentive` is overloaded with two meanings:
- `after - current` (scenario change) when after is non-null
- `current - headline` (eligibility/cap gap) when after is null but wallet exists

This confuses users: the same column means different things depending on whether a scenario is active.

## Decision

### D1: Portfolio Complete Snapshot (split `hasAnyInput`)

1. `hasLocalInput` (per-reserve, same as current `hasAnyInput`): controls native rate simulation, forecast input, cap constraints, Brevis shared deposits, forecast loading. Unchanged.

2. `shouldComputeAfter = hasLocalInput || hasPortfolioScenario`: controls after incentive/total computation, per-source `sumAfter`, and `afterNative` fallback.

- `hasPortfolioScenario = true` when any portfolio entry has a non-zero delta.
- Only portfolio member reserves (present in `perReserveInputs`) compute after.
- `afterNative = currentNative` for no-local-input members (their utilization doesn't change from other reserves' deltas).

### D2: Unified Eligibility Principal

Position cap and cross-reserve offset must compose into a single eligible principal before scaling the rate, not as independent multipliers:

```text
netEligible = max(grossPosition - crossReserveOffset, 0)
eligible = min(netEligible, positionCap)
effectiveRate = headlineOrForecastRate × eligible / grossPosition
```

This applies to both `currentIncentive` (using wallet-only positions) and `afterIncentive` (using total positions). The existing `merklGroupMultiplier` and `applyPositionCap` must be refactored to share this unified computation path.

### D3: Three-Tier Rate Semantics

| Field | Model | Meaning |
|---|---|---|
| `headlineIncentive` | Pure API advertised campaign/protocol rate | Market reference; no forecast, no wallet, no cap, no offset |
| `currentIncentive` | Forecast + wallet cap/offset | Wallet's current effective rate: "what you earn now" |
| `afterIncentive` | Forecast + target portfolio cap/offset | Scenario effective rate: "what you'd earn after" |
| `deltaIncentive` | `after - current` only | Pure scenario change; `null` when no scenario |

**Golden Rule #4 amended**: `headlineIncentive` is now a pure market advertised rate with no wallet dependency whatsoever. It no longer uses forecast or wallet-only cross-reserve multiplier. The `current - headline` path is removed from `deltaIncentive`.

**Eligibility info** (cap gap, offset amounts) becomes a separate concept, not overloaded into delta. It should be surfaced in expanded details or tooltip as structured information (e.g., "Eligible: $1,000 / $1,500", "Position cap: $1,000", "Net after offsets: $1,000").

### D4: Delta Unification

`deltaIncentive` formula changes from:
```text
after != null ? after - current : (wallet ? current - headline : null)
```
to:
```text
after != null ? after - current : null
```

The `current - headline` path is removed entirely. Eligibility gap information is displayed separately, not as a delta.

## Consequences

### Positive
- Users see cross-reserve offset effects on all portfolio reserves.
- No double-scaling bug in eligibility composition.
- Three rate concepts are cleanly separated; delta has one meaning.
- Reserve Table and Portfolio Result Table show consistent values.
- Golden Rules #1-3 preserved; #4 strengthened (headline is truly wallet-independent).

### Negative
- `headlineIncentive` computation changes: Merkl headline no longer applies `walletMerklGroupMultiplier`. This affects the `current - headline` gap which is being removed anyway.
- `buildRateSimulationResult` gains `portfolioScenarioActive` parameter. Both paths (ADR-0017) must pass it.
- Eligibility composition refactor touches `incentiveAggregation.ts`, `campaignGroups.ts`, and `rateSimulationCalculator.ts` Merkl/Merit/Brevis paths.
- Eligibility info display requires new UI surface (expanded row or tooltip addition).
- Additional computation: all portfolio members compute after when any delta exists.

### Non-Goals
- Per-source `Math.min(afterRaw, current)` cap (separate existing rule, not in scope).
- Cross-reserve offset in Single Mode.
- ADR-0017 duplicate path removal.
- `SimulationLane.hasInput` semantics changes.
- New UI components or layout changes (reuse existing expanded row / tooltip surfaces).

## Alternatives Considered

### Keep `current - headline` in delta
Rejected. Overloading delta with two meanings confuses users. The eligibility gap is better shown as structured info, not as a rate delta.

### Keep headline as wallet-adjusted baseline
Rejected. A baseline that depends on wallet position is not a "headline." It should be either pure market rate or removed. Pure market rate is more useful as a reference.

### Compute after only for reserves with actual cross-reserve dependencies
Rejected. Requires parsing campaign constraint graphs. Fragile for future constraint types. Complete snapshot naturally yields `after = current` for unaffected reserves.

## Related

- ADR-0005 — Per-reserve inputs (amended: `hasAnyInput` short-circuit no longer applies universally in Portfolio Mode)
- ADR-0009 — Stock-Flow Separation
- ADR-0017 — Duplicate rate simulation path (both paths must pass `portfolioScenarioActive`)
- ADR-0021 — Merkl wallet position in forecast input (established total-based eligibility)
- Golden Rules #1-3 preserved, #4 amended (headline = pure market rate)
- AAV-1101 — Cross-side effect principle (extended to cross-reserve)
- AAV-1163 — Linear issue tracking this work

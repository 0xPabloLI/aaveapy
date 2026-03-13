# Reserves Table Simulation Notes

This note tracks interaction decisions for the inline reserve simulation flow.

## Current behavior

- Native simulation uses one combined reserve state:
  - `supplyAmount` increases available liquidity
  - `borrowAmount` decreases available liquidity and increases variable debt
  - utilization, borrow rate, and supply rate are recalculated from that same combined state
- Incentive simulation remains reserve-specific:
  - supply-side incentives react to the shared supply input
  - borrow-side incentives react to the shared borrow input

## Data-source boundaries

- Shared table simulation must treat backend snapshots as the primary data plane.
  - `markets` provides reserve rows plus any local `tokenPrices`.
  - `rate-inputs` provides the native-rate state used for supply/borrow recomputation.
  - `forecast-states` provides Merkl campaign state when a campaign is actually being forecast.
- Browser-side third-party price backup is enabled for shared simulation as a bounded fallback.
  - Primary path remains backend snapshot `tokenPrices`.
  - Fallback is only used when snapshot misses price entries and is protected by query-key dedupe, module in-flight dedupe, limiter, and TTL caches.
- Keep monitoring fan-out and provider limits.
  - If request volume rises, prefer backend batch/proxy consolidation over unbounded client scatter/gather.

## Interaction direction

- Row expansion is acceptable for detailed inspection.
- If the primary product goal becomes comparing many reserves under the same hypothetical size, move the scenario inputs to a shared table-level control bar.
- In that model:
  - main table cells should update from the shared scenario
  - row expansion should only expose the detailed breakdown, not own the scenario state

## UI rules

- Keep `Native` and `Incentive total` visible even when simulated values are empty.
- Hide downstream source rows when both current and simulated values are effectively zero.
- Use fixed numeric column widths so placeholders align with headers.

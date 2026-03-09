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
- Browser-side third-party price backup is not allowed for table-wide shared simulation.
  - The fan-out is too large and turns one scenario edit into many CoinGecko requests.
  - If broad backup coverage is needed, add a backend batch/proxy path instead of restoring client-side scatter/gather.
- Single-target flows can still use narrower fallback logic.
  - Examples: one tooltip, one dedicated forecast panel, or other isolated user actions with bounded request count.

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

# ADR-0017: Duplicate Rate Simulation Path in PortfolioPanel

## Status

Accepted (Known Tech Debt)

## Context

Portfolio mode has two independent code paths that both call `buildRateSimulationResult`:

1. **Hook path** (`useSharedRateSimulations` → `simulationsById`): Computes per-reserve simulation results. Used by `ReservesTable` to display after rates in the table rows.

2. **Standalone path** (`computeResultsFromGroups` in `portfolioSimulator.ts`, called from `usePortfolioToggle.ts`): Re-computes the same simulation results independently. Used to display per-slot results (e.g., PortfolioSummaryCard, PortfolioTokenRow breakdowns).

Both paths pass the same inputs (`delta`, `principal`, `reserve data`) through the same calculator function and produce identical numerical results. The duplication exists because the portfolio panel needs **per-slot** results (grouped by supply/borrow slot within a reserve) while `simulationsById` returns **per-reserve** results.

### Why This Exists

- `simulationsById` is keyed by `reserveId` and aggregates supply + borrow into a single `SimulationResult` per reserve
- The portfolio panel needs results disaggregated by slot (e.g., separate supply APR and borrow APR for the same reserve, displayed in different UI sections)
- `computeResultsFromGroups` was built before `simulationsById` existed, and the per-slot vs per-reserve mismatch prevented direct reuse

## Decision

**Accept the duplication as known tech debt.** The cost of refactoring is high relative to the benefit:

- `simulationsById` would need to change from `Map<reserveId, SimulationResult>` to support per-slot access — a type-level change that cascades through all consumers
- The portfolio panel's slot grouping logic is tightly coupled to its UI layout — extracting it into a shared layer would require a new abstraction (e.g., `SlotSimulationResult`) that has no other consumer
- The duplication is functionally harmless: same inputs, same calculator, same results — no risk of divergence

### Trigger for Reconsideration

Revisit this trade-off when any of these conditions are met:

1. A third consumer needs per-slot simulation results (making the abstraction worth extracting)
2. A bug arises from the two paths diverging (e.g., one path gets a bug fix that the other misses)
3. The `SimulationResult` type is being redesigned for another reason (opportunity to add per-slot support)

## Consequences

- **Positive**: No risk of breaking `PortfolioPanel` behavior during unrelated simulation refactors
- **Negative**: Any change to `buildRateSimulationResult` signature or behavior must be applied in two places
- **Negative**: New developers may wonder why the same calculation appears twice and waste time trying to "fix" it
- **Mitigation**: This ADR serves as the canonical explanation. [AAV-800](https://linear.app/aaveapy/issue/AAV-800) tracks this debt for future prioritization.

## Related

- ADR-0009 — Stock-Flow Separation (introduced the `buildRateSimulationResult` contract)
- `src/lib/rateSimulationCalculator.ts` — `buildRateSimulationResult`
- `src/hooks/useRateSimulation.ts` — `useSharedRateSimulations` (hook path)
- `src/hooks/reserves-table/usePortfolioToggle.ts` — `simulatePortfolioFromEntries` → `computeResultsFromGroups` (standalone path)
# ADR-009: Delta-Based Simulation with Stock-Flow Separation

## Status

Accepted

## Context

Portfolio mode imports wallet positions into the simulator. Each position has `walletValue` (onchain amount) and `amount` (user-adjusted amount). Currently `buildPerReserveInputs` passes `position.amount` directly as `supplyInput` to `buildRateSimulationResult`, which uses the same value both as the simulation input (affecting utilization/after rate) and as the principal for yield calculation.

**The bug**: Onchain `totalLiquidity` already includes the wallet position. Passing `position.amount` (= walletValue when unadjusted) as `supplyInput` adds the same funds to the utilization denominator a second time — a double-count that inflates supply-side liquidity and deflates after rates incorrectly.

This does not affect ReservesTable Shared Scenario, where inputs are pure increments (no wallet stock to double-count).

## Decision

**Separate simulation input (delta) from yield principal (effective amount)**:

1. `delta = parseNumberInput(position.amount) - (position.walletValue ?? 0)` — only the change relative to onchain stock enters the rate model
2. `effectiveAmount = walletValue + delta` (= `position.amount`) — the full position after adjustment is the principal for yield
3. `buildRateSimulationResult` gains a new `totalSupplyUsd`/`totalBorrowUsd` parameter (formerly `principalUsd`), independent from `supplyInputUsd`
4. Portfolio path: `supplyInputUsd = delta`, `totalSupplyUsd = effectiveAmount`
5. Shared Scenario path: `totalSupplyUsd = supplyInputUsd` (pure increment, no stock, backward compatible)

### Scenario Table

| Scenario | Wallet | Adjusted To | Delta | Rate Used | Yield (after) | USD/day current | USD/day delta |
|----------|--------|-------------|-------|-----------|----------------|-----------------|---------------|
| Unchanged | $1000 | $1000 | $0 | current | currentRate × $1000 | currentRate × $1000 | $0 |
| Add | $1000 | $1500 | +$500 | after(+500) | afterRate × $1500 | currentRate × $1000 | afterRate×$1500 − currentRate×$1000 |
| Withdraw | $1000 | $500 | -$500 | after(-500) | afterRate × $500 | currentRate × $1000 | afterRate×$500 − currentRate×$1000 |
| Manual (no wallet) | — | $2000 | +$2000 | after(+2000) | afterRate × $2000 | afterRate × $2000 | $0 |

### Delta Sync Policy

When `walletValue` changes (chain re-sync), **delta is held constant** — user intent "add $500 extra" should not shift with onchain fluctuations. `effectiveAmount` recomputes as `newWalletValue + delta`.

### Delta Clamp

`delta >= -walletValue` (cannot withdraw more than onchain). `effectiveAmount = 0` is legal (simulate full withdrawal), separate from soft delete (`hidden: true`).

## Consequences

### Positive
- Fixes double-count bug: wallet stock no longer inflates utilization
- `buildRateSimulationResult` API is more honest — input and principal serve different purposes
- Shared Scenario unchanged — `principalUsd = supplyInputUsd` preserves existing behavior
- Delta sync policy is intuitive: "add $500" stays "add $500" even if chain value drifts

### Negative
- `buildRateSimulationResult` signature change: all callers must supply `totalSupplyUsd`/`totalBorrowUsd`
- UI must display delta (increment input) alongside effective amount, adding complexity
- Effective amount shown as plain text in delta input row (E1a design): wallet(muted) → effective(side-color+bold) when modified; wallet-only(muted) when synced; tooltip shows wallet value on hover (AAV-626)
- Incentive APRs use stale data for wallet positions (known limitation, not fixed here — data source timeliness, not calculation logic)

## Alternatives Considered

### A: Deduct walletValue inside buildRateSimulationResult
Rejected. The function would need to know about wallet context, breaking its purity. The caller (portfolio path) has the domain knowledge to compute delta; the calculator should remain a pure math function.

### B: Set supplyInput = 0 for wallet positions, only simulate deltas
This is what we do — but we also need `totalSupplyUsd` for yield. Without the total position parameter, after-rate yield would be calculated on delta only (e.g. $500 yield on a $1500 position), which is wrong.

### C: Track walletValue in PortfolioPosition type
Rejected (Decision 3). `PortfolioPosition` already has `walletValue`; delta is a computed property (`amount - walletValue`), not a persisted field. No type change needed.

### Inline Delta Display (AAV-635)

`PortfolioSimulationMetric` type carries `{ current, after, delta }` triples for each position and summary metric. `buildMetricsFromLane(simResult, side, amountUsd, isApy, walletUsd)` extracts metrics from `SimulationLane`. Positions render inline delta badge (after value + small delta); `PortfolioSummaryCard` renders delta for Total Supply/Borrow, Net Daily Earn, Net APY.

### USD/day Metric Stock-Flow Separation

`usdPerDayMetric` distinguishes current vs after principal:
- **current** = `walletUsd × currentRate` — what the wallet position earns at current rates
- **after** = `amountUsd × afterRate` — what the adjusted position earns after simulation
- **delta** = after − current — reflects BOTH rate change AND position change

When `walletValue = null` (manual entry, no wallet), `walletUsd = 0` — there is no existing position, so `current = 0` and `delta = after` (pure new earnings). `aggregatePortfolioSummary` uses `r.walletUsd ?? r.amountUsd` for `currentTotalSupplyUsd`/`currentTotalBorrowUsd` to maintain consistency.

## Related Issues

AAV-563 (wallet import double-count), AAV-635 (inline delta display), AAV-468 (parent portfolio epic)

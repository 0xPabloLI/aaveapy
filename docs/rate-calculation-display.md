# APR / APY Display Semantics

This module covers display-time behavior, cashflow semantics, and net-position eligibility.

## Native vs incentive rates

- Native Aave rates stay in APY in the UI.
- Incentive / forecast-derived rates follow the global APR/APY toggle.

## Incentive APR → APY conversion

```text
aprDecimal = aprPercent / 100
apyPercent = ((1 + aprDecimal / 12) ^ 12 - 1) × 100
```

Applied consistently to Merkl, Merit, Brevis, protocol incentive rows, and incentive totals.

## Total rate composition

- Supply total = `nativeSupplyApy + incentiveDisplayValue`
- Borrow total = `nativeBorrowApy - incentiveDisplayValue`

The toggle changes incentive contribution only, not the native base rate.

## Scenario USD/day semantics

`scenarioUsdAccrual` should stay stable when APR/APY toggles change.

- Native daily USD uses simulated native APR with Aave per-second compounding semantics.
- Incentive daily USD uses fixed APR-linear daily conversion.
- Total daily USD = native + incentive.

## Net Position Eligibility (Scenario Simulation)

When both supply and borrow are present:

- Merkl and Merit use net position
- Brevis uses gross input

| Eligibility mode | Used by | Formula |
|------------------|---------|---------|
| Net | Merkl, Merit | `max(supply - borrow, 0)` / `max(borrow - supply, 0)` |
| Gross | Brevis | `supply` / `borrow` |

```text
eligibilityRatio = netInputUsd / grossInputUsd
effectiveAPR = poolForecastAPR × eligibilityRatio
```

Single-input scenarios keep `eligibilityRatio = 1`.

When `eligibilityRatio < 1`, rows show a net eligibility hint via `capNote`.

## Related Files

- `src/hooks/useRateSimulation.ts`
- `src/lib/formatters.ts`
- `src/lib/incentiveCeilings.ts`
- `docs/design/frontend-interaction-guardrails.md`

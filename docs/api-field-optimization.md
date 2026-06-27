# API Field Optimization Analysis

## Summary

Analysis of `/api/markets` response fields: which are essential, which are derivable but worth keeping, and optimization alternatives.

## Field Classification

### ✅ Must Keep (Not Derivable — Simulation Required)

These fields are **mathematically irreversible** (many-to-one mapping) and required for frontend rate simulation (`simulateNativeRatesAfterActions`):

| Category | Fields |
|----------|--------|
| **Liquidity** | `availableLiquidity`, `totalVariableDebt`, `deficit` |
| **Rate Curve** | `optimalUsageRate`, `variableRateSlope1`, `variableRateSlope2`, `baseVariableBorrowRate`, `reserveFactor` |
| **Display & Sort** | `tokenPrice`, `reserveSizeUsd`, `supplyCapUsd`, `borrowCapUsd`, `decimals` |

> **Why irreversible**: e.g. `utilizationPct = 50%` has infinite `(liquidity, debt)` solutions; `borrowApy = 5%` cannot determine 4 rate curve unknowns from 1 equation.

### ⚠️ Keep (Derivable but Direct Display Use)

| Field | Derivation Source | Keep Reason |
|-------|-------------------|-------------|
| `utilizationPct` | `availableLiquidity` + `totalVariableDebt` | Table display, sorting, color coding |
| `supplyApy` | APR + compound formula | APR/APY toggle display |
| `borrowApy` | APR + compound formula | APR/APY toggle display |

Removing these would force frontend recomputation on every render with risk of precision drift — bandwidth savings negligible.

### ℹ️ No Action Needed

| Field | Note |
|-------|------|
| `optimalUtilizationPercent` | **Not an API field.** Frontend computes it from `optimalUsageRate` via `rayToPercent()` in `interestRateCalculator.ts`. Used in UI for utilization warning color and progress bar optimal marker. |

## Alternative Optimization Strategies

If response size reduction is needed, consider (by effort/impact):

1. **Cache TTL extension** — immutable fields (`optimalUsageRate`, `reserveFactor`) rarely change
2. **Lazy loading** — return base fields first, fetch rate curve params on row expand
3. **Compact encoding** — protobuf / MessagePack instead of JSON
4. **Field name compression** — shorter keys (`al` vs `availableLiquidity`)

## References

- `src/lib/apiSchemas.ts:119-147` — Reserve schema
- `src/lib/interestRateCalculator.ts` — Rate calculation
- `src/hooks/useRateSimulation.ts` — Simulation hook
- `src/components/dashboard/DesktopReserveRow.tsx:364-369` — Optimal utilization UI usage

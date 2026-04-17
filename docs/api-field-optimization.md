# API Field Optimization Analysis

## Executive Summary

This document analyzes redundant fields in the `/api/markets` response and provides recommendations for optimization.

## Recommendations

### ❌ Delete (Fully Redundant)

#### `optimalUtilizationPercent`

| Property | Value |
|----------|-------|
| **Derivation** | `optimalUsageRate` |
| **Formula** | `optimalUtilizationPercent = rayToPercent(optimalUsageRate)` |
| **Frontend Usage** | None (only intermediate calculation result) |
| **Impact** | Zero |

**Reason**: This field is never used in the frontend. It's only computed as an intermediate value in `interestRateCalculator.ts:181`.

---

### ⚠️ Keep (Derivable but Essential)

#### `utilizationPct`, `supplyApy`, `borrowApy`

| Field | Derivation | Keep Reason |
|-------|-----------|-------------|
| `utilizationPct` | `availableLiquidity` + `totalVariableDebt` | Used in table display & sorting |
| `supplyApy` | APR + compound interest formula | Used in APR/APY toggle display |
| `borrowApy` | APR + compound interest formula | Used in APR/APY toggle display |

**Reason**: While mathematically derivable, deleting these would require:
1. Frontend to recompute on every render
2. Access to all underlying rate calculation parameters
3. Risk of precision differences between backend/frontend

**Cost-Benefit**: The bandwidth savings are minimal compared to the added frontend complexity.

---

### ✅ Must Keep (Not Derivable)

The following fields are **mathematically不可逆** (cannot be derived from other fields) and **required for frontend simulation**:

#### Liquidity & Market Data
- `availableLiquidity` - Required for utilization calculation
- `totalVariableDebt` - Required for utilization calculation
- `deficit` - Required for supply rate dilution calculation
- `tokenPrice` - USD display & sorting
- `reserveSizeUsd` - Market size display & sorting
- `supplyCapUsd` / `borrowCapUsd` - Cap progress bar display

#### Interest Rate Curve Parameters
- `reserveFactor` - Protocol fee deduction
- `variableRateSlope1` - Rate curve slope (below optimal)
- `variableRateSlope2` - Rate curve slope (above optimal)
- `baseVariableBorrowRate` - Base borrow rate
- `optimalUsageRate` - Optimal utilization threshold
- `decimals` - Unit conversion

#### Why These Cannot Be Deleted

**Mathematical Reason**: Many-to-one mapping

```typescript
// Example: utilizationPct = 50% has infinite solutions
// Case 1: availableLiquidity = 1000, totalVariableDebt = 1000
// Case 2: availableLiquidity = 500, totalVariableDebt = 500
// Case 3: availableLiquidity = 2000, totalVariableDebt = 2000
// ❌ Cannot reverse!

// Example: borrowApy = 5% cannot determine rate curve parameters
// 4 unknowns (baseRate, slope1, slope2, optimal), 1 equation
// ❌ Cannot reverse!
```

**Functional Reason**: Frontend simulation requires raw parameters

```typescript
// User inputs "deposit 1000 USDT", need to calculate new rate
simulateNativeRatesAfterSupply(rateInput, '1000')
// Requires ALL raw parameters to compute
```

---

## Dependency Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Response (Must Keep)                     │
│  availableLiquidity, totalVariableDebt, deficit,                │
│  reserveFactor, slope1/2, baseRate, optimal, decimals           │
│  tokenPrice, reserveSizeUsd, supplyCapUsd, borrowCapUsd         │
└─────────────────┬───────────────────────────────────────────────┘
                  │ (Frontend computes)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│            Derived Fields (Keep for Performance)                │
│  utilizationPct, supplyApy, borrowApy                           │
└─────────────────┬───────────────────────────────────────────────┘
                  │ (Display in table)
                  ▼
           User sees APR/APY toggle display
                  
                  △
                  │ (Recalculate on user input)
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│      Frontend simulation requires raw parameters                │
│      (Mathematically irreversible)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Action Items

| Priority | Field | Action | Reason |
|----------|-------|--------|--------|
| **P0** | `optimalUtilizationPercent` | Delete | Fully redundant, zero usage |
| **P1** | `utilizationPct`, `supplyApy`, `borrowApy` | Keep | Direct display use, avoid recomputation |
| **P2** | All other raw parameters | Keep | Mathematically irreversible, simulation required |

---

## Alternative Optimization Strategies

If API response size reduction is critical:

1. **Lazy Loading**: Return only base fields on initial load, fetch detailed parameters on row expand
2. **Field Compression**: Use shorter field names (`al` instead of `availableLiquidity`)
3. **Data Format**: Use compact encoding (protobuf, MessagePack) instead of JSON
4. **Caching Strategy**: Extend cache TTL for immutable fields (`optimalUsageRate`, `reserveFactor`)

---

## References

- `src/lib/apiSchemas.ts:119-147` - Reserve schema definition
- `src/lib/interestRateCalculator.ts` - Rate calculation logic
- `src/hooks/useRateSimulation.ts` - Simulation hook usage
- `src/components/dashboard/ReservesTable.tsx` - Table display usage

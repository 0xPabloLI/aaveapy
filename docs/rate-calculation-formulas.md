# Rate Calculation Formulas

Frontend interest rate simulation based on `/rate-inputs` API data.

Source: `src/lib/interestRateCalculator.ts`

## Constants

| Name | Value | Usage |
|------|-------|-------|
| RAY | 10^27 | Aave's fixed-point precision unit |
| PERCENTAGE_FACTOR | 10000 | Basis points (bps) denominator |
| SECONDS_PER_YEAR | 31536000 | 365 × 24 × 60 × 60 |

## Input Fields (from `/rate-inputs`)

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `availableLiquidity` | string (bigint) | token decimals | Pool liquidity available for borrowing |
| `totalScaledVariableDebt` | string (bigint) | scaled units | Accumulated variable debt (needs index multiplication) |
| `variableBorrowIndex` | string (bigint) | ray (10^27) | Interest accumulation index |
| `reserveFactor` | string (bigint) | bps | Protocol fee on interest (0–10000) |
| `optimalUsageRate` | string (bigint) | ray | Target utilization (kink point) |
| `baseVariableBorrowRate` | string (bigint) | ray | Minimum borrow rate |
| `variableRateSlope1` | string (bigint) | ray | Rate slope below optimal utilization |
| `variableRateSlope2` | string (bigint) | ray | Rate slope above optimal utilization |

## Calculation Steps

### 1. Compute Total Variable Debt

```
totalVariableDebt = rayMul(totalScaledVariableDebt, variableBorrowIndex)
```

Where `rayMul(a, b) = (a × b + RAY/2) / RAY`

### 2. Adjust for User Actions (simulation)

```
availableLiquidity' = availableLiquidity + supplyAmount - borrowAmount
totalVariableDebt'  = totalVariableDebt + borrowAmount
```

### 3. Compute Utilization Rate

```
totalLiquidityAndDebt = availableLiquidity' + totalVariableDebt'
utilizationRate = rayDiv(totalVariableDebt', totalLiquidityAndDebt)
```

Where `rayDiv(a, b) = (a × RAY + b/2) / b`

Result is in ray units (e.g., 0.8 × 10^27 = 80% utilization).

### 4. Compute Variable Borrow Rate (APR)

Two-slope linear model with kink at `optimalUsageRate`:

**If `utilizationRate ≤ optimalUsageRate`:**
```
normalizedUsage = rayDiv(utilizationRate, optimalUsageRate)
variableBorrowRate = baseVariableBorrowRate + rayMul(variableRateSlope1, normalizedUsage)
```

**If `utilizationRate > optimalUsageRate`:**
```
excessRatio = rayDiv(utilizationRate - optimalUsageRate, RAY - optimalUsageRate)
variableBorrowRate = baseVariableBorrowRate + variableRateSlope1 + rayMul(variableRateSlope2, excessRatio)
```

Result is annual rate in ray units.

### 5. Compute Liquidity Rate (Supply APR)

```
liquidityRate = percentMul(
  rayMul(variableBorrowRate, utilizationRate),
  PERCENTAGE_FACTOR - reserveFactor
)
```

Where `percentMul(v, pct) = (v × pct + 5000) / 10000`

This is the interest paid to suppliers after protocol fee.

### 6. Convert APR to APY (compound)

```
ratePerSecond = aprRay / SECONDS_PER_YEAR
apyRay = rayPow(RAY + ratePerSecond, SECONDS_PER_YEAR) - RAY
```

Where `rayPow` is exponentiation via binary decomposition.

### 7. Convert Ray to Percentage

```
percent = Number(rayValue) / 1e25
```

Example: `2.5e25` ray → `2.5%`

## Output Structure

```typescript
interface NativeRateSimulation {
  utilizationRateRay: string;      // ray units
  utilizationRatePercent: number;  // e.g. 80.0
  supplyAprPercent: number;        // e.g. 2.5
  borrowAprPercent: number;        // e.g. 3.2
  supplyApyPercent: number;        // e.g. 2.53
  borrowApyPercent: number;        // e.g. 3.25
  addedLiquidityRaw: string;       // user supply input (raw)
  addedBorrowRaw: string;          // user borrow input (raw)
}
```

## Visual Model

```
Borrow Rate
    │
    │                      ╱ slope2 (steep)
    │                     ╱
    │                    ╱
    │           ╱───────•  ← kink at optimalUsageRate
    │          ╱ slope1
    │         ╱
    ├────────•  ← baseVariableBorrowRate
    │
    └──────────────────────────────► Utilization
              optimal (e.g. 80%)
```

## Debugging Checklist

| Check | How |
|-------|-----|
| Utilization mismatch | Compare `utilizationRatePercent` vs market's `utilizationPct` |
| Rate mismatch | Verify slope params, reserveFactor, index values |
| Ray precision | Ensure all inputs are parsed as bigint, not Number (precision loss) |
| Index staleness | `variableBorrowIndex` should reflect recent accrual |

## Related Files

- `src/lib/interestRateCalculator.ts` – Core calculation functions
- `src/hooks/useRateSimulation.ts` – React hook wrapping simulation
- `src/hooks/useReserveRateInputs.ts` – Fetches `/rate-inputs` API
- `src/components/dev/RateInputsVsMarketCheck.tsx` – Dev panel for validation

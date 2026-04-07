# Native Rate Simulation

Source: `src/lib/interestRateCalculator.ts`.

This file covers the native Aave interest-rate math used for supply / borrow simulation.

## Constants

| Name | Value | Usage |
|------|-------|-------|
| RAY | 10^27 | Aave fixed-point precision |
| PERCENTAGE_FACTOR | 10000 | Basis points denominator |
| SECONDS_PER_YEAR | 31536000 | 365 × 24 × 60 × 60 |

## Input Fields (from `/rate-inputs`)

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `availableLiquidity` | string (bigint) | token decimals | Pool liquidity available for borrowing |
| `totalScaledVariableDebt` | string (bigint) | scaled units | Variable debt before index multiplication |
| `variableBorrowIndex` | string (bigint) | ray (10^27) | Interest accumulation index |
| `deficit` | string (bigint) | token decimals | Reserve deficit from onchain/Aave API |
| `reserveFactor` | string (bigint) | bps | Protocol fee on interest |
| `optimalUsageRate` | string (bigint) | ray | Target utilization / kink |
| `baseVariableBorrowRate` | string (bigint) | ray | Minimum borrow rate |
| `variableRateSlope1` | string (bigint) | ray | Slope below kink |
| `variableRateSlope2` | string (bigint) | ray | Slope above kink |

## Calculation Steps

### 1. Compute total variable debt

```text
totalVariableDebt = rayMul(totalScaledVariableDebt, variableBorrowIndex)
```

`rayMul(a, b) = (a × b + RAY/2) / RAY`

### 2. Apply user actions

```text
totalVariableDebt' = totalVariableDebt + borrowAmount
```

### 3. Compute usage rates

| Rate | Formula | Purpose |
|------|---------|---------|
| `borrowUsageRate` | `totalVariableDebt' / (availableLiquidity + totalVariableDebt + supplyAmount)` | Borrow rate and displayed utilization |
| `supplyUsageRate` | `totalVariableDebt' / (availableLiquidity + totalVariableDebt + deficit + supplyAmount)` | Liquidity rate, includes deficit |

```text
borrowUsageRate = rayDiv(totalVariableDebt', availableLiquidity + totalVariableDebt + supplyAmount)
supplyUsageRate = rayDiv(totalVariableDebt', availableLiquidity + totalVariableDebt + deficit + supplyAmount)
```

`rayDiv(a, b) = (a × RAY + b/2) / b`

### 4. Compute variable borrow rate

If `borrowUsageRate ≤ optimalUsageRate`:

```text
normalizedUsage = rayDiv(borrowUsageRate, optimalUsageRate)
variableBorrowRate = baseVariableBorrowRate + rayMul(variableRateSlope1, normalizedUsage)
```

If `borrowUsageRate > optimalUsageRate`:

```text
excessRatio = rayDiv(borrowUsageRate - optimalUsageRate, RAY - optimalUsageRate)
variableBorrowRate = baseVariableBorrowRate + variableRateSlope1 + rayMul(variableRateSlope2, excessRatio)
```

### 5. Compute liquidity rate

```text
liquidityRate = percentMul(rayMul(variableBorrowRate, supplyUsageRate), PERCENTAGE_FACTOR - reserveFactor)
```

`percentMul(v, pct) = (v × pct + 5000) / 10000`

### 6. Convert APR to APY

```text
ratePerSecond = aprRay / SECONDS_PER_YEAR
apyRay = rayPow(RAY + ratePerSecond, SECONDS_PER_YEAR) - RAY
```

### 7. Convert ray to percentage

```text
percent = Number(rayValue) / 1e25
```

## Output Structure

```typescript
interface NativeRateSimulation {
  utilizationRateRay: string
  utilizationRatePercent: number
  supplyAprPercent: number
  borrowAprPercent: number
  supplyApyPercent: number
  borrowApyPercent: number
  addedLiquidityRaw: string
  addedBorrowRaw: string
}
```

## Visual Model

```text
Borrow Rate
    │
    │                      ╱ slope2
    │                     ╱
    │                    ╱
    │           ╱───────•  kink at optimalUsageRate
    │          ╱ slope1
    │         ╱
    ├────────•  baseVariableBorrowRate
    │
    └──────────────────────────────► Utilization
```

## Debugging Checklist

| Check | How |
|-------|-----|
| Utilization mismatch | Compare `utilizationRatePercent` vs market `utilizationPct` |
| Rate mismatch | Verify slope params, reserveFactor, index values |
| Ray precision | Parse inputs as bigint, not Number |
| Index staleness | `variableBorrowIndex` should reflect recent accrual |

## Borrow Availability Constraint

```text
Available to Borrow = min(Pool Liquidity + Supply Input, Borrow Cap Remaining)
```

Where:

- Pool Liquidity = `availableLiquidity` from `/rate-inputs` (converted to USD)
- Supply Input = user supply input
- Borrow Cap Remaining = `borrowCapUsd - currentTotalBorrowedUsd`

| Constraint | When Active | UI Message |
|------------|-------------|------------|
| Borrow Cap | `borrowCapRemaining < poolLiquidity` | `limited by borrow cap` |
| Pool Liquidity | `poolLiquidity < borrowCapRemaining` | `limited by pool liquidity` |

The simulation hook caps borrow input to the effective limit and surfaces which constraint binds.

## Related Files

- `src/lib/interestRateCalculator.ts`
- `src/hooks/useRateSimulation.ts`
- `docs/frontend-data-loading-matrix.md`

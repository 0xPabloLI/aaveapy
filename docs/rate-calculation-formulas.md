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
| `deficit` | string (bigint) | token decimals | Reserve deficit from onchain/Aave API |
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
totalVariableDebt' = totalVariableDebt + borrowAmount
```

### 3. Compute Usage Rates

**Important:** Aave uses two distinct usage rates:

| Rate | Formula | Purpose |
|------|---------|---------|
| `borrowUsageRate` | `totalVariableDebt' / (availableLiquidity + totalVariableDebt + supplyAmount)` | Borrow rate calculation, externally displayed utilization |
| `supplyUsageRate` | `totalVariableDebt' / (availableLiquidity + totalVariableDebt + deficit + supplyAmount)` | Liquidity rate calculation (includes deficit) |

```
borrowUsageRate = rayDiv(totalVariableDebt', availableLiquidity + totalVariableDebt + supplyAmount)
supplyUsageRate = rayDiv(totalVariableDebt', availableLiquidity + totalVariableDebt + deficit + supplyAmount)
```

Where `rayDiv(a, b) = (a × RAY + b/2) / b`

Results are in ray units (e.g., 0.8 × 10^27 = 80% utilization).

**Note:** The externally displayed "utilization" is `borrowUsageRate` (without deficit). The `supplyUsageRate` is higher when deficit exists, diluting supplier yields.

### 4. Compute Variable Borrow Rate (APR)

Two-slope linear model with kink at `optimalUsageRate`, using **borrowUsageRate**:

**If `borrowUsageRate ≤ optimalUsageRate`:**
```
normalizedUsage = rayDiv(borrowUsageRate, optimalUsageRate)
variableBorrowRate = baseVariableBorrowRate + rayMul(variableRateSlope1, normalizedUsage)
```

**If `borrowUsageRate > optimalUsageRate`:**
```
excessRatio = rayDiv(borrowUsageRate - optimalUsageRate, RAY - optimalUsageRate)
variableBorrowRate = baseVariableBorrowRate + variableRateSlope1 + rayMul(variableRateSlope2, excessRatio)
```

Result is annual rate in ray units.

### 5. Compute Liquidity Rate (Supply APR)

Uses **supplyUsageRate** (which includes deficit):

```
liquidityRate = percentMul(
  rayMul(variableBorrowRate, supplyUsageRate),
  PERCENTAGE_FACTOR - reserveFactor
)
```

Where `percentMul(v, pct) = (v × pct + 5000) / 10000`

This is the interest paid to suppliers after protocol fee. When deficit exists, `supplyUsageRate < borrowUsageRate`, resulting in lower supplier yields.

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

## Borrow Availability Constraint

When simulating borrow actions, the available borrow amount is constrained by **both** pool liquidity and borrow cap:

```
Available to Borrow = min(Pool Liquidity + Supply Input, Borrow Cap Remaining)
```

Where:
- **Pool Liquidity** = `availableLiquidity` from `/rate-inputs` (converted to USD)
- **Supply Input** = User's supply input (adds to available liquidity)
- **Borrow Cap Remaining** = `borrowCapUsd - currentTotalBorrowedUsd`

### Constraint Application

| Constraint | When Active | UI Message |
|------------|-------------|------------|
| Borrow Cap | `borrowCapRemaining < poolLiquidity` | "limited by borrow cap" |
| Pool Liquidity | `poolLiquidity < borrowCapRemaining` | "limited by pool liquidity" |

The simulation hook (`useRateSimulation.ts`) automatically caps borrow input to the effective limit. The UI shows which constraint is binding when the user exceeds it.

## Related Files

- `src/lib/interestRateCalculator.ts` – Core calculation functions
- `src/hooks/useRateSimulation.ts` – React hook wrapping simulation (includes borrow availability constraints)
- `src/hooks/useReserveRateInputs.ts` – Fetches `/rate-inputs` API
- `src/components/dev/RateInputsVsMarketCheck.tsx` – Dev panel for validation

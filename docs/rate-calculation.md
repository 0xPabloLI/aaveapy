# Rate Calculation Reference

Frontend rate simulation documentation — consolidated from the former multi-file module docs.

## Module Map

| Module | Section |
|---|---|
| Native Aave rate math | [Part 1: Native Rate Simulation](#part-1-native-rate-simulation) |
| Merkl incentive forecast | [Part 2: Merkl Incentive Forecast](#part-2-merkl-incentive-forecast) |
| APR/APY display, USD/day, net eligibility | [Part 3: APR / APY Display Semantics](#part-3-apr--apy-display-semantics) |
| Incentive cap / ceiling reference | [Part 4: Incentive Reward Cap Reference](#part-4-incentive-reward-cap-reference) |

---

## Part 1: Native Rate Simulation

Source: `src/lib/interestRateCalculator.ts`.

This section covers the native Aave interest-rate math used for supply / borrow simulation.

### Constants

| Name | Value | Usage |
|------|-------|-------|
| RAY | 10^27 | Aave fixed-point precision |
| PERCENTAGE_FACTOR | 10000 | Basis points denominator |
| SECONDS_PER_YEAR | 31536000 | 365 × 24 × 60 × 60 |

### Input Fields (from `/rate-inputs`)

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

### Calculation Steps

#### 1. Compute total variable debt

```text
totalVariableDebt = rayMul(totalScaledVariableDebt, variableBorrowIndex)
```

`rayMul(a, b) = (a × b + RAY/2) / RAY`

#### 2. Apply user actions

```text
totalVariableDebt' = totalVariableDebt + borrowAmount
```

#### 3. Compute usage rates

| Rate | Formula | Purpose |
|------|---------|---------|
| `borrowUsageRate` | `totalVariableDebt' / (availableLiquidity + totalVariableDebt + supplyAmount)` | Borrow rate and displayed utilization |
| `supplyUsageRate` | `totalVariableDebt' / (availableLiquidity + totalVariableDebt + deficit + supplyAmount)` | Liquidity rate, includes deficit |

```text
borrowUsageRate = rayDiv(totalVariableDebt', availableLiquidity + totalVariableDebt + supplyAmount)
supplyUsageRate = rayDiv(totalVariableDebt', availableLiquidity + totalVariableDebt + deficit + supplyAmount)
```

`rayDiv(a, b) = (a × RAY + b/2) / b`

#### 4. Compute variable borrow rate

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

#### 5. Compute liquidity rate

```text
liquidityRate = percentMul(rayMul(variableBorrowRate, supplyUsageRate), PERCENTAGE_FACTOR - reserveFactor)
```

`percentMul(v, pct) = (v × pct + 5000) / 10000`

#### 6. Convert APR to APY

```text
ratePerSecond = aprRay / SECONDS_PER_YEAR
apyRay = rayPow(RAY + ratePerSecond, SECONDS_PER_YEAR) - RAY
```

#### 7. Convert ray to percentage

```text
percent = Number(rayValue) / 1e25
```

### Output Structure

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

### Visual Model

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

### Debugging Checklist

| Check | How |
|-------|-----|
| Utilization mismatch | Compare `utilizationRatePercent` vs market `utilizationPct` |
| Rate mismatch | Verify slope params, reserveFactor, index values |
| Ray precision | Parse inputs as bigint, not Number |
| Index staleness | `variableBorrowIndex` should reflect recent accrual |

### Borrow Availability Constraint

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

---

## Part 2: Merkl Incentive Forecast

Source: `src/lib/merklForecast.ts`.

This section covers `forecastWithTVL` and how Merkl forecast data plugs into simulation.

### How simulation connects

- User input is converted to USD for incentives (`supplyInputUsd` / `borrowInputUsd`).
- For a forecast row with a matching `campaignId`:

```text
hypotheticalTvl = max(0, latestTvl + inputUsd)
```

- If `inputUsd ≤ 0` or no forecast row exists, the UI keeps the current reserve Merkl APR.

`getMerklBreakdownApr` precedence:

1. Use `campaignApr > 0`
2. Else if `pointsPerThousandUsd` exists:
   - If positive, use Tydro math (`points × TYDRO_POINT_TO_USD_RATE × 36.5`)
   - If `0` / invalid, only `DUTCH_AUCTION` may use the Dutch-auction fallback below
3. Else fallback to `campaignApr` coerced to number or `0`

### Dutch auction fallback rule

`DUTCH_AUCTION` can use a fallback APR when the points field exists but the points value is unusable.

- Scope: `campaignType === 'DUTCH_AUCTION'` only
- Inputs: `plannedDaily`, `latestTvl`
- Purpose: keep Dutch auction APR display stable when points metadata is present but not usable
- Non-DUTCH campaign types do **not** use this fallback path, even if `pointsPerThousandUsd` exists
- If another campaign type needs a fallback later, define a separate type-specific rule

### Symbols

| Symbol / field | Meaning |
|----------------|---------|
| `tvl` | USD eligible TVL passed into `forecastWithTVL` |
| `aprCap` | Annual APR as decimal fraction |
| `plannedDaily` / `requiredDaily` | Backend daily emission targets |
| `remainingBudget` | `max(0, totalBudget - distributedSoFar)` |

### Campaign type matrix

| `campaignType` | Forecast path | Uses `requiredDaily` from side-data? | Fallback when missing | Returned fields |
|----------------|---------------|--------------------------------------|-----------------------|-----------------|
| `DUTCH_AUCTION` | Planned-only | No | `plannedDaily` | `dailyRewards`, `apr`, `regime` |
| `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | Capped by APR, then catch-up via required daily emission | Yes | `plannedDaily` | `dailyRewards`, `apr`, `regime` |
| `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | Fixed APR budget path | No | N/A | `dailyRewards`, `apr`, `regime`, `fixRewardableDays`, `fixRewardableUntilTs` |

Current source wiring:

- `src/hooks/useRateSimulation.ts` and `src/components/dashboard/MerklForecastPanel.tsx` both merge `requiredDaily` from `/meta/side-data` into the forecast state.
- `src/lib/merklForecast.ts` still resolves `requiredDaily ?? plannedDaily` on the MAX path only.
- If `requiredDaily` is absent, the fallback is `plannedDaily`; if that is also missing, the safe value becomes `0`.

### `campaignApr` 与 `plannedDaily + TVL` 的一致性核对

当你需要验证接口返回的 `campaignApr` 是否等于反推值时，请按**百分比点位**统一口径：

```text
impliedAprPercent = plannedDaily * 365 / tvl * 100
```

`campaignApr` 与 `impliedAprPercent` 的关系是**按 campaignType 分支**判断：

- `DUTCH_AUCTION`：
  - 理想情况 `campaignApr` 会等于 `impliedAprPercent`（或与它只差浮点噪声）。
  - 若 `campaignApr == 0` 且 `pointsPerThousandUsd` 字段存在（包括值为 `0`、无效值），则 points 语义仍保留，但 fallback 只在 Dutch auction 上启用。

- `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE`：
   - 不能直接用 `plannedDaily` 做反推。
   - 需要先按分支计算：
   ```text
   aprBasedDaily = (tvl * aprCap) / 365
   dailyRewards = min(requiredDaily, aprBasedDaily)
   campaignAprEff = (dailyRewards * 365) / tvl
   ```
   其中 `requiredDaily` 来自 side-data forecast state，缺失时回退为 `plannedDaily`。

- `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE`：
  - 不能直接用 `plannedDaily` 做反推。
  - 需先按分支计算：
  ```text
  aprBasedDaily = (tvl * aprCap) / 365
  dailyRewards = min(aprBasedDaily, remainingBudget)
  campaignAprEff = (dailyRewards * 365) / tvl
  ```

一个经验可复现结果（按当前快照）是：非零 `campaignApr` 中，主要偏差都发生在 MAX/FIX 分支；points 模式常见 `campaignApr=0`、`pointsPerThousandUsd>0` 且 `impliedAprPercent` 为正值，不应判定为异常。

### 结论速记（通用）

- `DUTCH_AUCTION` 可以用 `plannedDaily + latestTvl` 做 Dutch-auction fallback 对账。
- `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` / `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` 不能只用 `plannedDaily` 反推；必须走 capped 分支（`requiredDaily`、`aprCap`，以及 FIX 的 `remainingBudget`）。
- `campaignApr == 0` 且 `pointsPerThousandUsd` 字段存在时视为 points 模式；若字段值为 `0` / 无效，只有 `DUTCH_AUCTION` 继续走该 fallback。

### Session Notes (campaignApr reconciliation)

- 本次修复把 `pointsPerThousandUsd` 的"字段存在性"纳入分支判断，避免 `0` / 无效值被当成非 points 处理。
- `DUTCH_AUCTION` 的 fallback 只在 points 字段存在但值不可用时启用。
- 已新增真实 fixture 的回归测试，确保 Dutch-auction fallback 不会被其它 campaignType 复用。

### 对账输出建议（`campaignApr` vs `planned+TVL`）

建议把每条活动按以下三类输出，便于判断是否异常：

- `plain-match`
  - `campaignType` 为 `DUTCH_AUCTION`
  - 且 `|impliedAprPercent - campaignApr| <= tolerance`
  - 或者 `campaignApr == 0` + `pointsPerThousandUsd > 0` 且 `campaignApr` 被规则定义为 points 模式

- `capped-required`
  - `campaignType` 为 `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` 或 `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE`
  - 需要用 `requiredDaily`/`aprCap`/`remainingBudget` 重建 `campaignAprEff`
  - 与 `campaignAprEff` 比较

- `needs-data-check`
  - 缺失关键字段：`latestTvl`、`requiredDaily`、`aprCap`、`totalBudget/distributedSoFar`
  - 或者 `tvl <= 0`

简化脚本输出样例：

```text
campaignId=... chain=... token=... side=... type=... category=plain-match | tol=0.0001
  campaignApr=1.05% | implied=1.0500% | diff=+0.0000pp

campaignId=... type=MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE category=capped-required
  campaignApr=1.75% | projectedApr=1.78% | diff=+0.03pp | requiredDaily=... | aprCap=...

campaignId=... category=needs-data-check
  miss=latestTvl=0 or requiredDaily missing
```

用于你这次结论时：先看 `category`，再看 `type`。

### FIX branch

```text
aprBasedDaily = (tvl × aprCap) / 365
dailyRewards   = min(aprBasedDaily, remainingBudget)
apr            = (dailyRewards × 365) / tvl
```

Produces `fixRewardableDays` and `fixRewardableUntilTs` from remaining budget.

### MAX / capped APR branch

```text
aprBasedDaily = (tvl × aprCap) / 365
dailyRewards   = min(requiredDaily, aprBasedDaily)
apr            = (dailyRewards × 365) / tvl
```

- `APR_CAPPED` means the cap binds.
- `CATCHING_UP` means required daily emission is above planned daily by tolerance.
- This branch does not multiply by `remainingBudget`.

### DUTCH_AUCTION

```text
dailyRewards = plannedDaily
apr = (dailyRewards × 365) / tvl
```

`DUTCH_AUCTION` does not use `requiredDaily` or APR-cap catch-up logic.

### Other non-FIX/MAX types

The current code does not apply a separate forecast branch to additional campaign types. They flow through the same MAX-style fallback path unless new handling is added.

### Edge case

If `tvl ≤ 0`, both `dailyRewards` and `apr` are `0`.

### Model APR to UI percentage

```text
forecastAprPercent = forecast.apr × 100 × multiplier
```

`multiplier` is `1` unless Tydro points are involved.

### Session Notes (Merkl forecast)

- Points campaigns now use field presence, not just `> 0`, to decide whether to enter points-aware handling.
- For real points fixtures, implied APR and traditional points APR should match after `plannedDaily -> USD` conversion.
- `latestTvl` stays in USD in the implied APR fallback; only `plannedDaily` is converted from points to USD.
- `src/lib/tydro.test.ts` includes a regression test that asserts the real fixture stays aligned across both formulas.

---

## Part 3: APR / APY Display Semantics

This section covers display-time behavior, cashflow semantics, and net-position eligibility.

### Native vs incentive rates

- Native Aave rates stay in APY in the UI.
- Incentive / forecast-derived rates follow the global APR/APY toggle.

### Incentive APR → APY conversion

```text
aprDecimal = aprPercent / 100
apyPercent = ((1 + aprDecimal / 12) ^ 12 - 1) × 100
```

Applied consistently to Merkl, Merit, Brevis, protocol incentive rows, and incentive totals.

### Total rate composition

- Supply total = `nativeSupplyApy + incentiveDisplayValue`
- Borrow total = `nativeBorrowApy - incentiveDisplayValue`

The toggle changes incentive contribution only, not the native base rate.

### Scenario USD/day semantics

`scenarioUsdAccrual` should stay stable when APR/APY toggles change.

- Native daily USD uses simulated native APR with Aave per-second compounding semantics.
- Incentive daily USD uses fixed APR-linear daily conversion.
- Total daily USD = native + incentive.

### Net Position Eligibility (Scenario Simulation)

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

---

## Part 4: Incentive Reward Cap Reference

This section groups cap / ceiling semantics for Merit, Merkl, and Brevis.

### Naming layers

| Layer | Role | Examples |
|-------|------|----------|
| API | Backend field names stay stable | `perUserRewardCapUsd` |
| Domain | Prefer `ceiling` vocabulary | `depositCeilingUsd`, `rewardCeilingUsd` |
| UI | Stable row diagnostics | `capNote`, `capWarning` |

### Field mapping

| Source | Domain meaning | Notes |
|--------|----------------|-------|
| Brevis `perUserRewardCapUsd` | Per-user reward ceiling | Keep API name |
| Merit `selfCapUsd` | Deposit ceiling | Eligible deposit only |
| Simulation UI | Same diagnostics | Keep `cap*` props stable |

### Unified simulation `capNote` strings

| Incentive / branch | When shown | `capNote` pattern |
|--------------------|------------|-------------------|
| Merkl FIX | Scenario input exists and rewardable days resolved | `~Nd earn` |
| Merkl MAX | APR capped for low TVL | `APR capped for low TVL` |
| Brevis | Per-user cap exists | `Reward capped at $X/user` |
| Brevis no cap | No per-user cap, time remaining exists | `~Nd to end` |
| Merit Self | Deposit ceiling applies | `Eligible supply capped at $Z` |
| Merit Base | Net note only | `Net eligible $X of $Y` |
| Merkl DUTCH_AUCTION | Net note only | `Net eligible $X of $Y` |

### Cap taxonomy

| Cap type | Scope | Mechanism | Source file |
|----------|-------|-----------|-------------|
| Pool budget | Pool-wide | `dailyRewards = min(aprBasedDaily, remainingBudget)` | `merklForecast.ts` |
| Deposit ceiling | Per-user | `eligibleDeposit = min(deposit, selfCapUsd)` | `meritForecast.ts` |
| Per-user reward ceiling | Per-user | cap by reward / remaining horizon | `brevisForecast.ts` |

### Brevis per-user reward cap

- `perUserRewardCapUsd` is a cumulative USD reward ceiling.
- Missing `endDate` degrades gracefully to nominal APR.
- Missing `distributedSoFar` means budget exhaustion timing is uncertain.
- Shared cap across supply/borrow requires the same `campaignId` and matching metadata.

### Merkl FIX reward cap

- `fixRewardableDays` and `fixRewardableUntilTs` come from remaining budget divided by daily rewards.
- This is a pool-level cap shared by all users.

### Merit Base / Merit Self

- Merit Base anchors to reserve TVL when available.
- Merit Self uses `selfCapUsd` as an eligible deposit ceiling.
- Merit Base intentionally emits no per-row `capNote`.

### UI surfaces

- `IncentiveTooltip` keeps static context only.
- `SimulationSubRow` uses `capNote` / `capWarning` for per-campaign diagnostics.

---

## Related Files

- `src/lib/interestRateCalculator.ts` – Core native rate calculation functions
- `src/lib/merklForecast.ts` – Merkl `forecastWithTVL` and progress flags
- `src/lib/meritForecast.ts` – Merit forecast (base + self-auth deposit cap)
- `src/lib/incentiveCeilings.ts` – Domain-layer ceiling effects → simulation `capNote` / `capWarning`
- `src/lib/brevisForecast.ts` – Brevis per-user reward cap forecast
- `src/lib/tydro.ts` – Tydro points-to-USD conversion
- `src/hooks/useRateSimulation.ts` – React hook: native simulation + incentive forecast overlay
- `src/lib/formatters.ts` – Display formatting utilities
- `docs/frontend-data-loading-matrix.md` – Data loading architecture
- `docs/design/frontend-interaction-guardrails.md` – Interaction design guardrails

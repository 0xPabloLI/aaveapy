# Rate Calculation Formulas

Frontend rate simulation is split into smaller module docs so markdown review and search stay manageable.

## Module map

| Module | File |
|---|---|
| Native Aave rate math | [`rate-calculation-native.md`](./rate-calculation-native.md) |
| Merkl incentive forecast | [`rate-calculation-merkl.md`](./rate-calculation-merkl.md) |
| APR/APY display, USD/day, net eligibility | [`rate-calculation-display.md`](./rate-calculation-display.md) |
| Incentive cap / ceiling reference | [`rate-calculation-cap-reference.md`](./rate-calculation-cap-reference.md) |

## Constants

See [`rate-calculation-native.md`](./rate-calculation-native.md).

## Input Fields (from `/rate-inputs`)

See [`rate-calculation-native.md`](./rate-calculation-native.md).

## Calculation Steps

See [`rate-calculation-native.md`](./rate-calculation-native.md).

## Borrow Availability Constraint

See [`rate-calculation-native.md`](./rate-calculation-native.md).

## Merkl incentive forecast (`forecastWithTVL`)

See [`rate-calculation-merkl.md`](./rate-calculation-merkl.md).

## `campaignApr` 与 `plannedDaily+latestTvl` 反推一致性（实操口径）

建议的对账口径如下：

- `impliedAprPercent = plannedDaily * 365 / latestTvl * 100`
- `campaignApr` 先按 `campaignType` 分支判断一致性：

| campaignType | `campaignApr` 与反推口径关系 |
|---|---|
| `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | 不能直接按 `plannedDaily` 反推；应走 MAX 分支（`min(requiredDaily, aprCap)`）再换算 |
| `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | 不能直接按 `plannedDaily` 反推；应走 FIX 分支（`aprBasedDaily = (tvl × aprCap) / 365`，`dailyRewards = min(aprBasedDaily, remainingBudget)`）再换算 |
| `DUTCH_AUCTION`（与其他非 MAX/FIX 分支） | 可按 `requiredDaily/ plannedDaily -> tvl` 反推比较；若 `pointsPerThousandUsd > 0` 且 `campaignApr == 0`，属于 points 模式，不按常规 APR 比较 |

对于当前环境的实际对账，非零 `campaignApr` 中，明显偏差主要集中在 MAX/FIX 类；`campaignApr=0 & pointsPerThousandUsd>0` 常见于 points 语义，不是普通 APR 反推错误。

### 结论速记（通用）

- `DUTCH_AUCTION`（以及其他非 MAX/FIX）通常可用 `plannedDaily + latestTvl` 反推 APR 做对账。
- `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` / `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` 不能只用 `plannedDaily` 反推；必须走 capped 分支（`requiredDaily`、`aprCap`，以及 FIX 的 `remainingBudget`）。
- `campaignApr == 0` 且 `pointsPerThousandUsd > 0` 视为 points 模式，不按常规 APR 反推判错。

## APR/APY display semantics

See [`rate-calculation-display.md`](./rate-calculation-display.md).

## Net Position Eligibility (Scenario Simulation)

See [`rate-calculation-display.md`](./rate-calculation-display.md).

## Incentive Reward Cap Reference

See [`rate-calculation-cap-reference.md`](./rate-calculation-cap-reference.md).

## Related Files

- `src/lib/interestRateCalculator.ts` – Core native rate calculation functions
- `src/lib/merklForecast.ts` – Merkl `forecastWithTVL` and progress flags
- `src/lib/meritForecast.ts` – Merit forecast (base + self-auth deposit cap)
- `src/lib/incentiveCeilings.ts` – Domain-layer ceiling effects → simulation `capNote` / `capWarning`
- `src/lib/brevisForecast.ts` – Brevis per-user reward cap forecast
- `src/hooks/useRateSimulation.ts` – React hook: native simulation + incentive forecast overlay

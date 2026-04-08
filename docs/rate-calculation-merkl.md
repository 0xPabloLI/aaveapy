# Merkl Incentive Forecast

Source: `src/lib/merklForecast.ts`.

This module covers `forecastWithTVL` and how Merkl forecast data plugs into simulation.

## How simulation connects

- User input is converted to USD for incentives (`supplyInputUsd` / `borrowInputUsd`).
- For a forecast row with a matching `campaignId`:

```text
hypotheticalTvl = max(0, latestTvl + inputUsd)
```

- If `inputUsd ≤ 0` or no forecast row exists, the UI keeps the current reserve Merkl APR.

`getMerklBreakdownApr` precedence:

1. Use `campaignApr > 0`
2. Else use `pointsPerThousandUsd` if Tydro math yields positive APR
3. Else fallback to `campaignApr` coerced to number or `0`

## Symbols

| Symbol / field | Meaning |
|----------------|---------|
| `tvl` | USD eligible TVL passed into `forecastWithTVL` |
| `aprCap` | Annual APR as decimal fraction |
| `plannedDaily` / `requiredDaily` | Backend daily emission targets |
| `remainingBudget` | `max(0, totalBudget - distributedSoFar)` |

## `campaignApr` 与 `plannedDaily + TVL` 的一致性核对

当你需要验证接口返回的 `campaignApr` 是否等于反推值时，请按**百分比点位**统一口径：

```text
impliedAprPercent = plannedDaily * 365 / tvl * 100
```

`campaignApr` 与 `impliedAprPercent` 的关系是**按 campaignType 分支**判断：

- `DUTCH_AUCTION`（以及其他非 MAX/FIX 分支）：
  - 理想情况 `campaignApr` 会等于 `impliedAprPercent`（或与它只差浮点噪声）。
  - 若 `campaignApr == 0` 且 `pointsPerThousandUsd > 0`，则表示 points 模式；此时应走 points 转换逻辑，不应把 `campaignApr` 当作常规 APR 反推。

- `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE`：
  - 不能直接用 `plannedDaily` 做反推。
  - 需要先按分支计算：
  ```text
  aprBasedDaily = (tvl * aprCap) / 365
  dailyRewards = min(requiredDaily, aprBasedDaily)
  campaignAprEff = (dailyRewards * 365) / tvl
  ```
  其中 `requiredDaily` 来自 side-data forecast state（缺失时回退为 `plannedDaily`）。

- `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE`：
  - 不能直接用 `plannedDaily` 做反推。
  - 需先按分支计算：
  ```text
  aprBasedDaily = (tvl * aprCap) / 365
  dailyRewards = min(aprBasedDaily, remainingBudget)
  campaignAprEff = (dailyRewards * 365) / tvl
  ```

一个经验可复现结果（按当前快照）是：非零 `campaignApr` 中，主要偏差都发生在 MAX/FIX 分支；points 模式常见 `campaignApr=0`、`pointsPerThousandUsd>0` 且 `impliedAprPercent` 为正值，不应判定为异常。

## 对账输出建议（`campaignApr` vs `planned+TVL`）

建议把每条活动按以下三类输出，便于判断是否异常：

- `plain-match`
  - `campaignType` 非 MAX/FIX（通常是 DUTCH_AUCTION）
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


## FIX branch

```text
aprBasedDaily = (tvl × aprCap) / 365
dailyRewards   = min(aprBasedDaily, remainingBudget)
apr            = (dailyRewards × 365) / tvl
```

Produces `fixRewardableDays` and `fixRewardableUntilTs` from remaining budget.

## MAX / capped APR branch

```text
aprBasedDaily = (tvl × aprCap) / 365
dailyRewards   = min(requiredDaily, aprBasedDaily)
apr            = (dailyRewards × 365) / tvl
```

- `APR_CAPPED` means the cap binds.
- `CATCHING_UP` means required daily emission is above planned daily by tolerance.
- This branch does not multiply by `remainingBudget`.

## DUTCH_AUCTION and other non-FIX/MAX types

```text
dailyRewards = requiredDaily
apr = (dailyRewards × 365) / tvl
```

## Edge case

If `tvl ≤ 0`, both `dailyRewards` and `apr` are `0`.

## Model APR to UI percentage

```text
forecastAprPercent = forecast.apr × 100 × multiplier
```

`multiplier` is `1` unless Tydro points are involved.

## Related Files

- `src/lib/merklForecast.ts`
- `src/lib/tydro.ts`
- `src/hooks/useRateSimulation.ts`
- `docs/frontend-data-loading-matrix.md`

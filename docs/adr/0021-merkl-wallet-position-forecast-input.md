# ADR 0021: Merkl Wallet Position in Forecast Input

## Status

Proposed

## Context

Portfolio 模式下，用户有 wallet supply position（如 $1042 WETH on Ink）但没有新的 supply delta（`supplyInputUsd = 0`），borrow 有 delta（`borrowInputUsd = $1`）。

Merkl DUTCH_AUCTION campaign 的 `campaignApr = 0`（headline 为零），需要 `forecastMerklApr` 基于 forecast state 计算真实 APR（约 2.65%）。

**Bug 现象**：用户看到 supply incentive APR 为 0，而非正确的 forecast 值。

## 根因分析

### 数据流追踪

```
Portfolio 输入:
  supplyInputUsd = 0 (无新 delta)
  borrowInputUsd = 1 (有 borrow delta)
  totalSupplyUsd = 1042 (wallet position)

→ supplyNetInputUsd = max(0 - 1, 0) = 0          [行 1199, delta-only]
→ supplyNetForEligibility = max(1042 - borrow, 0)   [行 1211, total-based]

→ supplyMeritMerklInputUsd = supplyNetInputUsd = 0   [行 1218, delta-only!]
→ supplyEligibilityRatio = supplyNetForEligibility / supplyGrossForEligibility  [行 1212, total-based]

→ buildForecastMerklOpportunities(inputUsd = 0)       [行 1312]
  → forecastMerklApr(breakdown, inputUsd=0, ...)
    → inputUsd <= 0 && currentApr == 0
    → forecastWithTVL(merged, latestTvl)               ← 计算出 2.65%
```

等等——如果 `forecastMerklApr` 返回 2.65%，为什么 `sumAfter` 返回 0？

**真正的根因不在 `forecastMerklApr`，而在 `sumCurrent`**：

```
sumCurrent (行 1306-1309):
  sumMerklIncentiveApr(data, rate, { forecastStates, merklGroupMultiplier })
  → sumActiveCampaignBreakdownValues(opportunities, {
      mapValue: forecastMerklApr(breakdown, 0, forecastStates, rate)  ← 返回 2.65%
      groupMultiplier: merklGroupMultiplier                            ← 这是关键！
    })
```

`merklGroupMultiplier` (行 1223-1238) 计算的是 **eligibility ratio**：

```js
merklGroupMultiplier = (side) => {
  const grossUsd = side === 'supply' ? supplyInputUsd : borrowInputUsd;  // 0 for supply!
  const sameReserveRatio = supplyMeritMerklEligibilityRatio;              // 基于 total position
  const crossReserveRatio = ...;

  const sameReserveFactor = constraint ? sameReserveRatio : 1;
  return crossReserveRatio * sameReserveFactor;
}
```

**`grossUsd` 用的是 `supplyInputUsd`（= 0），而 `sameReserveRatio` 基于 total position 算。** 但 `merklGroupMultiplier` 只在有 `netPositionConstraint` 的 group 上应用 `sameReserveRatio`。没有 constraint 的 group 返回 1。

所以 `merklGroupMultiplier` 本身不是问题——它只在有 constraint 时缩放。

### 真正的 bug 位置

重新回到 `buildIncentiveAfter` (行 885-910)：

```js
const forecastedMerkl = buildForecastMerklOpportunities({
  inputUsd: netInputUsd,  // = supplyMeritMerklInputUsd = 0
  ...
});
// forecastedMerkl 的 breakdown.campaignApr 被 forecastMerklApr 替换为 forecast 值
// 对于 DUTCH_AUCTION + campaignApr=0 + inputUsd=0: forecastMerklApr 返回 2.65%

return sumMerklIncentiveApr(forecastedMerkl, ...)  // 应该返回 2.65%
```

但 `sumMerklIncentiveApr` 内部 `sumActiveCampaignBreakdownValues` 的 `getStartDate` 返回 `breakdown.campaignStartedAt`——如果 API 数据有这个字段，`isCampaignActive` 应该通过。

**在 production API 上，Merkl breakdown 都有 `campaignStartedAt`，计算应返回正确值。**

### 结论：bug 是否存在取决于数据源

1. **Production API**: Merkl breakdown 有 `campaignStartedAt`，`forecastMerklApr` 正确返回 2.65%，`sumMerklIncentiveApr` 返回正确值
2. **Staging API**: 没有 Merkl 数据，无法验证
3. **用户报告的场景**: 可能是 campaign 已结束（`campaignEndedAt` 过期），或 forecast state 不完整

### 但还有一个语义问题

即使数值正确，**`meritMerklInputUsd = 0` 意味着 forecast APR 是基于当前 TVL 计算的，不包含用户 wallet position 对 TVL 的贡献**。

这是**正确的**行为——wallet position 已经在 `latestTvl` 中，不应再加到 `inputUsd`（否则 double-count）。

**真正的语义问题**是：当 wallet position 存在但 `inputUsd = 0` 时：
- `forecastMerklApr` 返回的是 **headline forecast APR**（基于总 TVL，不包含任何 position cap dilution）
- 但 Merit 的 `sumCurrent` 已经对 wallet position 做了 cap dilution（`applyPositionCap`）
- **Merkl 没有等价的 wallet position dilution 逻辑**

这是 Merkl 和 Merit 之间的不一致：
- Merit: `sumCurrent(inputUsd=0, totalPositionUsd=walletPositionUsd)` → cap dilution
- Merkl: `sumCurrent` 没有 `totalPositionUsd` 参数 → 无 cap dilution

Merkl 的 `netPositionConstraint` 只影响 eligibility ratio（乘法缩放），不影响 forecast 计算本身。

## 决策

### 方案 A: Merkl `meritMerklInputUsd` 改用 total position 而非 delta-only

当 `totalSupplyUsd` 存在且 `hasAnyInput=true` 时，`supplyMeritMerklInputUsd` 改为 `max(totalSupplyUsd - totalBorrowUsd, 0)`。

**风险**: TVL double-count。`forecastMerklApr` 会把 `inputUsd` 加到 `latestTvl` 上，但 `latestTvl` 已经包含了 wallet position。结果 APR 被低估。

**不可行**。

### 方案 B: Merkl 加 wallet position dilution（类似 Merit 的 `applyPositionCap`）

给 `forecastMerklApr` / `sumMerklIncentiveApr` 加 `totalPositionUsd` 参数，对 forecast 结果做 `applyPositionCap` 稀释。

**问题**: Merkl DUTCH_AUCTION 没有 position cap 概念。Merit 有 cap 是因为 Merit 协议对存款有上限约束；Merkl 没有。这个 dilution 的语义不成立。

**不可行**（至少不能直接复用 Merit 的 cap dilution）。

### 方案 C: 分离 "forecast inputUsd" 和 "offset inputUsd"

当前 `meritMerklInputUsd` 同时用于两个目的：
1. 传给 `forecastMerklApr` 作为 hypothetical deposit 量（不应包含 wallet）
2. 传给 `buildMeritCampaignDetails` / `buildMerklCampaignDetails` 作为 offset 计算的输入（应该包含 wallet）

**方案 C-1**: Merkl `sumAfter` 中，当 `meritMerklInputUsd = 0` 但 `totalSupplyUsd > 0` 时，用 `totalSupplyUsd` 替代 `meritMerklInputUsd` 传给 `buildForecastMerklOpportunities`——但不用来加 TVL，而是用来**确保 forecast 被触发**（即 `inputUsd > 0` 走 forecast 分支而非 `inputUsd <= 0` 的 fallback）。

等等，`inputUsd <= 0 && currentApr == 0` 分支已经会做 `forecastWithTVL(merged, latestTvl)` 计算 forecast。所以 forecast 是被触发的。

### 重新审视问题

让我重新确认：**在 production 环境下，Portfolio 模式 + wallet supply + no supply delta + borrow delta，Merkl DUTCH_AUCTION 的 incentive APR 到底是不是 0？**

从代码分析：
1. `buildIncentiveCurrent` → `sumMerklIncentiveApr` → `forecastMerklApr(bd, 0, forecastStates, rate)` → `forecastWithTVL(merged, latestTvl)` → **2.65%** ✓
2. `buildIncentiveAfter` → `buildForecastMerklOpportunities(inputUsd=0)` → `forecastMerklApr(bd, 0, ...)` → **2.65%** ✓
3. `afterIncentive = Math.min(2.65%, 2.65%) = 2.65%` ✓
4. `deltaIncentive = hasInput ? after - current : walletDilution` → `2.65% - 2.65% = 0%`

**deltaIncentive = 0 是正确的**——after 和 current 相同（都是基于当前 TVL 的 forecast），没有变化。

但 `afterIncentive = 2.65%` 应该在 UI 上显示。**如果用户看到 0，那是 UI 显示层的问题，不是计算层。**

### 真正需要确认的

用户看到的 "0" 到底是：
1. `afterIncentive = 0`（计算层 bug）
2. `currentIncentive = 0`（current 计算层 bug）
3. delta 显示为 0 但实际 APR 有值（显示层 bug）
4. campaign 已结束导致 `isCampaignActive` 返回 false

**需要用户在 production 环境验证后才能确定修复方向。**

## 待确认问题

1. 用户看到 0 的环境：production 还是 staging？具体哪个 reserve？
2. 看到的是 `currentIncentive = 0` 还是 `afterIncentive = 0`？
3. 是否是 campaign 已结束（`campaignEndedAt` 已过期）？
4. Merkl 的 `netPositionConstraint` 是否对 Ink WETH 生效？

## 参考

- `src/lib/rateSimulationCalculator.ts:1196-1221` — netInputUsd vs netForEligibility
- `src/lib/rateSimulationCalculator.ts:1310-1318` — Merkl sumAfter 用 meritMerklInputUsd
- `src/lib/merklForecast.ts:285-308` — forecastMerklApr 的 inputUsd 分支
- `src/lib/incentiveAggregation.ts:79-101` — sumMerklIncentiveApr
- `src/lib/campaignGroups.ts:21-32` — isCampaignActive 对 campaignStartedAt 的依赖
- AAV-761, AAV-771 — wallet position dilution 相关修复

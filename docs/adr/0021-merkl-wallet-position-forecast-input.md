# ADR 0021: Merkl Wallet Position in Forecast Input

## Status

Accepted

## Context

Portfolio 模式下，用户有 wallet supply position（如 $1042 WETH on Ink）但没有新的 supply delta（`supplyInputUsd = 0`），borrow 有 delta（`borrowInputUsd = $1`）。

Merkl DUTCH_AUCTION campaign 的 `campaignApr = 0`（headline 为零），需要 `forecastMerklApr` 基于 forecast state 计算真实 APR（约 2.65%）。

**Bug 现象**：用户看到 supply incentive APR 为 0，而非正确的 forecast 值。

## 根因分析

### Bug 1: `merklGroupMultiplier` 的 `grossUsd` 用 delta-only，cross-reserve eligibility 跳过

**位置**: `rateSimulationCalculator.ts:1221`

```ts
const merklGroupMultiplier = (side: RateSide) => {
  const grossUsd = side === 'supply' ? supplyInputUsd : borrowInputUsd; // delta-only = 0!
  // ...
  return (group) => {
    const crossReserveRatio = constraint && crossReservePositions && ...
      ? computeCrossReserveEligibilityRatio({
          sourceSide: constraint.sourceSide,
          sourceGrossUsd: grossUsd,  // 0!
          constraint,
          crossReservePositions,
        })
      : 1;
    const sameReserveFactor = constraint ? sameReserveRatio : 1;
    return crossReserveRatio * sameReserveFactor;
  };
};
```

`computeCrossReserveEligibilityRatio`（netLendingCrossReserve.ts:34）在 `sourceGrossUsd <= 0` 时返回 1（跳过缩放）。

**后果**：wallet supply $1042，cross-reserve borrow $600，正确 ratio = (1042-600)/1042 ≈ 0.42。但 `sourceGrossUsd=0` → ratio=1 → **完全不缩放**，用户看到全额 APR 而非被 cross-reserve offset 缩放后的值。

**同样问题存在于 `merklCrossReserveNote`**（行 1238-1249），也用 `supplyInputUsd` 作为 `sourceGrossUsd`。

**修复**：`grossUsd` 改为 `supplyGrossForEligibility`（total-based），与 `sameReserveRatio` 的口径一致。

### Bug 2: `buildIncentiveCurrent` 的 Merkl 部分 没有 `merklGroupMultiplier`

**位置**: `rateSimulationCalculator.ts:336-344`

```ts
if (walletPositionUsd != null && walletPositionUsd > 0 && merit && merit.length > 0) {
  const meritPercent = sumForecastMeritIncentiveApr(merit, isApy, 0, anchorTvlUsd, walletPositionUsd);
  const otherPercent = isApy
    ? calculateTotalIncentiveApy([], merkl, brevis, protocol, tydroPointToUsdRate, options)
    : calculateTotalIncentiveApr([], merkl, brevis, protocol, tydroPointToUsdRate, options);
  return meritPercent + otherPercent;
}
```

`calculateTotalIncentiveApr/Apy` → `sumMerklIncentiveApr(data, rate, options)` — `options` 没有 `merklGroupMultiplier`。

**对比 `buildIncentiveAfter`**（行 905-907）：
```ts
sumMerklIncentiveApr(forecastedMerkl, tydroPointToUsdRate, {
  whitelistMerklCampaignIds, merklGroupMultiplier, campaignAccessStatuses, pointRateMap
})
```

`buildIncentiveAfter` **有** `merklGroupMultiplier`，`buildIncentiveCurrent` **没有**。

**后果**：
- `currentIncentive`（aggregate）= Merkl headline（无 eligibility 缩放）
- `afterIncentive`（aggregate）= Merkl forecast × eligibility ratio
- 当 eligibility ratio < 1 时，`after < current`，`Math.min(after, current)` 截断到 after
- dispatch map 的 per-source `current` **有** `merklGroupMultiplier` → per-source sum < aggregate current → **per-source sum 与 aggregate current 不一致**

**这也意味着行 1297 的测试 `expect(perSourceSum).toBeCloseTo(result.supply.currentIncentive, 1)` 在有 netPositionConstraint 时可能失败**（但当前测试数据没有 constraint 所以通过了）。

**修复**：`buildIncentiveCurrent` 的 Merkl 部分也需要传 `merklGroupMultiplier`。但 `buildIncentiveCurrent` 是独立函数，不知道 portfolio context 中的 `merklGroupMultiplier`。需要把 `merklGroupMultiplier` 作为参数传入。

### 非Bug: forecast 计算本身是正确的

`forecastMerklApr(breakdown, 0, forecastStates, rate)` 走 `inputUsd<=0 && currentApr==0` 分支 → `forecastWithTVL(merged, latestTvl)` → 正确的 2.65%。

`buildForecastMerklOpportunities(inputUsd=0)` 也会触发 forecast → `sumMerklIncentiveApr` 对 forecasted 数据做 sum → 正确值。

**`meritMerklInputUsd = 0` 对 forecast 本身没有错误**——wallet position 已在 `latestTvl` 中，不应加到 `inputUsd`（否则 double-count）。

### 非Bug: Merkl 不需要 Merit 的 position cap dilution

Merit 有 `depositCeilingUsd` → 超过 cap 的部分不赚 incentive → 需要 `applyPositionCap` 稀释。
Merkl DUTCH_AUCTION 没有 position cap → 所有 deposit 都按同样 APR 赚 incentive → 不需要 dilution。

但 Merkl **有** `netPositionConstraint` → supply < borrow 时 incentive 应被缩放 → 这个缩放必须基于 total position（wallet + delta），不能只看 delta。

## 决策

### 方案: 修复 Bug 1 + Bug 2

**Bug 1 修复**：`merklGroupMultiplier` 和 `merklCrossReserveNote` 的 `grossUsd` 从 delta-only（`supplyInputUsd`/`borrowInputUsd`）改为 total-based（`supplyGrossForEligibility`/`borrowGrossForEligibility`）。

```ts
// Before:
const grossUsd = side === 'supply' ? supplyInputUsd : borrowInputUsd;

// After:
const grossUsd = side === 'supply' ? supplyGrossForEligibility : borrowGrossForEligibility;
```

这与 `sameReserveRatio`（行 1222）的口径一致——`supplyMeritMerklEligibilityRatio` 基于 `supplyGrossForEligibility` 计算，`crossReserveRatio` 也应该用同样的分母。

**Bug 2 修复**：`buildIncentiveCurrent` 增加 `merklGroupMultiplier` 参数，传入 Merkl 的 eligibility 缩放函数。

```ts
// buildIncentiveCurrent 签名增加:
merklGroupMultiplier?: (group: MerklOpportunityGroup) => number

// wallet 分支中:
const otherPercent = isApy
  ? sumMerklIncentiveApy(merkl, tydroPointToUsdRate, { ..., merklGroupMultiplier })
  : sumMerklIncentiveApr(merkl, tydroPointToUsdRate, { ..., merklGroupMultiplier });
```

headline 分支（行 348-350）同理。

**调用侧**（行 1149-1167）需要构造 `merklGroupMultiplier` 并传入。当前 `buildIncentiveCurrent` 在 `buildRateSimulationResult` 中被调用时，`merklGroupMultiplier` 还未定义（它在行 1220 才定义）。需要把 `merklGroupMultiplier` 的构造提取到 `buildIncentiveCurrent` 调用之前，或者在 `buildIncentiveCurrent` 内部构造。

### 不修改的部分

- `meritMerklInputUsd` 保持 delta-only（不改用 total position）——避免 TVL double-count
- Merkl 不加 position cap dilution——Merkl 没有 cap 概念
- `forecastMerklApr` 的 `inputUsd=0` 分支逻辑正确，不修改

### Review 修复: headline incentive 也需要 `merklGroupMultiplier`

Code review 发现 `supplyHeadlineIncentive`/`borrowHeadlineIncentive` 的 `calculateTotalIncentiveApr/Apy` 没传 `merklGroupMultiplier`，而 `buildIncentiveCurrent` 已传。

**影响**：`deltaIncentive = currentIncentive - headlineIncentive` 在 wallet dilution gap 路径（`hasInput=false` + wallet）下，`current` 有缩放而 `headline` 没有 → 差值混入缩放差异，语义不正确。

**修复**：headline incentive 调用也传入 `merklGroupMultiplier`，确保 `deltaIncentive` 三态分路的每一路（simulation delta / wallet dilution gap / null）中 `current` 和 `headline` 使用同一缩放。

**测试**：新增 `headline incentive also includes eligibility scaling` 测试，验证有 constraint 时的 headline < 无 constraint 时的 headline。

## 影响范围

### Bug 1 影响

| 场景 | 影响 |
|------|------|
| `supplyInputUsd > 0` | 不受影响（`grossUsd = supplyInputUsd` 有值） |
| `supplyInputUsd = 0` + wallet position + cross-reserve constraint | **修复**：cross-reserve ratio 从 1 变为正确值 |
| `supplyInputUsd = 0` + 无 cross-reserve constraint | 不受影响（`sameReserveFactor = 1`，cross-reserve ratio 不参与） |

### Bug 2 影响

| 场景 | 影响 |
|------|------|
| wallet position + netPositionConstraint | **修复**：aggregate current 和 per-source current 一致 |
| 无 wallet position | 不受影响（走 headline 分支，无 multiplier） |
| wallet position + 无 netPositionConstraint | 轻微影响（multiplier=1，结果不变） |

## 测试计划

1. Calculator 层新增：`supplyInputUsd=0` + `totalSupplyUsd=1042` + `netPositionConstraint` + cross-reserve offset
2. 验证 `merklGroupMultiplier` 返回值 < 1（被 cross-reserve offset 缩放）
3. 验证 `buildIncentiveCurrent` 的 Merkl 值 = per-source `sumCurrent` 的 Merkl 值
4. 验证 `perSourceSum ≈ currentIncentive`（行 1295-1297 的断言在 constraint 场景下也通过）
5. Hook 层现有测试不受影响（用 `supplyInput='1000'`，不触发 bug）
6. 验证 `merklCrossReserveNote` 使用 total position 作为 grossUsd（note 显示 `$1,042` 而非 `$0`）
7. 验证 headline incentive 传入 `merklGroupMultiplier`，有 constraint 时的 headline < 无 constraint 时的 headline
8. 浏览器验证：Ink 链 Merkl incentive APR 非零显示（Playwright + watchMode wallet）

## 参考

- `src/lib/rateSimulationCalculator.ts:1146-1203` — eligibility ratio + `merklGroupMultiplier` + `merklCrossReserveNote`（提前计算，Bug 1 修复）
- `src/lib/rateSimulationCalculator.ts:1207-1216` — headline incentive 调用（Review 修复：加了 `merklGroupMultiplier`）
- `src/lib/rateSimulationCalculator.ts:1213-1228` — `buildIncentiveCurrent` 调用（Bug 2 修复：加了 `merklGroupMultiplier` 参数）
- `src/lib/rateSimulationCalculator.ts:305-354` — `buildIncentiveCurrent` 函数签名（Bug 2：新增 `merklGroupMultiplier` 参数）
- `src/lib/rateSimulationCalculator.test.ts:1410+` — AAV-1060 测试（5 个：Bug 1×2 + Bug 2 + headline + merklCrossReserveNote）
- `src/lib/netLendingCrossReserve.ts:32-37` — `computeCrossReserveEligibilityRatio` sourceGrossUsd<=0 返回 1
- `src/lib/incentiveAggregation.ts:79-101` — `sumMerklIncentiveApr`
- AAV-761, AAV-771 — wallet position dilution 相关修复

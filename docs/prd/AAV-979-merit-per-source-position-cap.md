# AAV-979: Merit per-source current 缺 position cap dilution

**Parent**: AAV-978
**Project**: Incentive Source Upper-Layer Unification
**Priority**: Medium
**Status**: Draft

## Problem

dispatch map 的 Merit `sumCurrent` 用 `sumMeritIncentiveApr(data, ctx.isApy)`（纯 headline），但 `buildIncentiveCurrent` 在 wallet 有仓位时用 `sumForecastMeritIncentiveApr(merit, isApy, 0, anchorTvlUsd, walletPositionUsd)`（含 position cap 稀释）。当 wallet 超过 positionCap 时，per-source Merit current + 其他 source ≠ total current。

同样，`buildMeritCampaignDetails` 的 per-campaign `current` 也是纯 headline（`meritAprToDisplay(baseAprPercent, isApy)`），per-campaign current 之和 ≠ per-source current。

### Concrete Scenario

wallet=$10k, positionCap=$1k, headline APR=5%:
- per-source Merit current = 5%（headline）
- total current 中 Merit 分量 = 0.5%（稀释后，`5% × min(1000, 10000) / 10000`）
- 偏差 = 4.5 个百分点

### Trigger Conditions

Merit campaign 有 `positionCap` 且用户钱包仓位超过 cap。当前只有少数 reserve（主要是 GHO E-Mode）有 Merit positionCap。

## Fix

### 1. `SideSourceContext` 新增 `walletPositionUsd` 字段

```typescript
interface SideSourceContext {
  // ... existing fields ...
  walletPositionUsd: number | undefined;  // wallet-only position (no delta), for position cap dilution
}
```

实例化处（行 1311-1330）从已有的 `walletSupplyUsd`/`walletBorrowUsd` 按 side 选择：
```typescript
walletPositionUsd: isSupply ? walletSupplyUsd : walletBorrowUsd,
```

`walletSupplyUsd`/`walletBorrowUsd` 已在行 1126-1134 推导完毕，零额外计算成本。

### 2. dispatch map Merit `sumCurrent` 改用 `sumForecastMeritIncentiveApr`

```typescript
// Before:
sumCurrent: (data, ctx) => sumMeritIncentiveApr(data, ctx.isApy),

// After:
sumCurrent: (data, ctx) =>
  sumForecastMeritIncentiveApr(data, ctx.isApy, 0, ctx.anchorTvlUsd, ctx.walletPositionUsd) * ctx.eligibilityRatio,
```

`inputUsd=0`：wallet 仓位是已有存量，不会稀释 TVL。position cap 稀释由 `totalPositionUsd` 参数控制（在 `forecastMeritAprPercent` 内部，`depositUsd=0` 且 `totalPositionUsd > 0` 时走 position cap 稀释路径）。

### 3. `buildMeritCampaignDetails` per-campaign `current` 含 position cap 稀释

新增 `walletPositionUsd` 参数。`baseCurrent` 从纯 headline 改为含 `applyPositionCap` 稀释：

```typescript
// Before:
const baseCurrent = meritAprToDisplay(baseAprPercent, isApy);

// After:
let effectiveBaseApr = baseAprPercent;
if (positionCapUsd != null && positionCapUsd > 0 && walletPositionUsd != null && walletPositionUsd > 0) {
  const { aprPercent: cappedApr } = applyPositionCap(baseAprPercent, walletPositionUsd, positionCapUsd);
  effectiveBaseApr = cappedApr;
}
const baseCurrent = meritAprToDisplay(effectiveBaseApr, isApy);
```

这保证 per-campaign current 之和 = per-source current。

### 4. 向后兼容

- `sumForecastMeritIncentiveApr(data, isApy, 0, anchorTvlUsd, undefined)` 在 `walletPositionUsd=undefined` 时退化为 headline（与现有行为一致）
- `applyPositionCap` 在 `positionCapUsd` 不存在时不执行稀释
- 无 positionCap 的 campaign 完全不受影响

## Key Code Locations

- `src/lib/rateSimulationCalculator.ts:1250-1266` — `SideSourceContext` interface
- `src/lib/rateSimulationCalculator.ts:1273-1279` — dispatch map Merit sumCurrent
- `src/lib/rateSimulationCalculator.ts:630-634` — `buildMeritCampaignDetails` per-campaign current
- `src/lib/rateSimulationCalculator.ts:318-333` — `buildIncentiveCurrent` Merit branch (correct implementation)
- `src/lib/rateSimulationCalculator.ts:1311-1330` — `SideSourceContext` instantiation
- `src/lib/rateSimulationCalculator.ts:1126-1134` — wallet position derivation
- `src/lib/meritForecast.ts:161-209` — `forecastMeritAprPercent` (depositUsd=0 path)
- `src/lib/incentiveMath.ts:23-31` — `applyPositionCap`

## Risk

低。所有修改路径在 `walletPositionUsd=undefined` 时退化为现有行为。无 positionCap 的 reserve 不受影响。

## Regression Prevention

在 dispatch map Merit `sumCurrent` 行旁加注释标注 AAV-979 修复，防止交叉 commit 覆盖（AAV-978 教训）。添加 per-source current = total current Brevis portion 断言测试。

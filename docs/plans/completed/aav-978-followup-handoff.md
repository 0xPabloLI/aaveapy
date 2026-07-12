# AAV-978 Follow-up Handoff

**Status**: ✅ Completed (verified 2026-06-27)
**Parent Issue**: AAV-978 (sumBrevisIncentiveApr 同名不同参)
**Project**: Incentive Source Upper-Layer Unification
**Date**: 2026-06-21

## Completed

AAV-978 核心修复已全部完成并提交（4 个 commits）：
1. `1c825e47` — 统一 sumBrevisIncentiveApr，删除 calculator 本地版本
2. `65130443` — AAV-975 dispatch map 重构（不慎覆盖 AAV-978 修复）
3. `9d603475` — dailyRewardUsd 改用 aprPercent
4. `4287ab65` — 恢复 AAV-978 被 AAV-975 覆盖的修复

## Follow-up 1: Merit per-source current 缺 position cap 稀释 — ✅ 已修复 (AAV-979)

**Commit**: `2c440785` — fix(AAV-979): per-source Merit current includes position cap dilution

**优先级**: 下个迭代（Low-Medium）
**建议 Linear 标题**: `sumMeritIncentiveApr per-source current lacks position cap dilution — per-source ≠ total`

### 问题

dispatch map 的 Merit `sumCurrent` 用 `sumMeritIncentiveApr(data, ctx.isApy)`（纯 headline），但 `buildIncentiveCurrent` 在 wallet 有仓位时用 `sumForecastMeritIncentiveApr(merit, isApy, 0, anchorTvlUsd, walletPositionUsd)`（含 position cap 稀释）。当 wallet 超过 positionCap 时，per-source Merit current + 其他 source ≠ total current。

### 具体场景

wallet=$10k, positionCap=$1k, headline APR=5%:
- per-source Merit current = 5%（headline）
- total current 中 Merit 分量 = 0.5%（稀释后）
- 偏差 = 4.5 个百分点

### 触发条件

Merit campaign 有 `positionCap` 且用户钱包仓位超过 cap。当前只有少数 reserve（主要是 GHO E-Mode）有 Merit positionCap。

### 修复方向

1. `SideSourceContext` 新增 `walletPositionUsd` 字段
2. dispatch map `sumCurrent` 改为 `sumForecastMeritIncentiveApr(data, ctx.isApy, 0, ctx.anchorTvlUsd, ctx.walletPositionUsd) * ctx.eligibilityRatio`
3. `buildMeritCampaignDetails` per-campaign `current` 同步修改（行 633-634: `baseAprPercent` 需要含稀释）

### 关键代码位置

- `src/lib/rateSimulationCalculator.ts:1273-1274` — dispatch map Merit sumCurrent
- `src/lib/rateSimulationCalculator.ts:318-333` — buildIncentiveCurrent Merit 分支（正确的实现）
- `src/lib/rateSimulationCalculator.ts:630-634` — buildMeritCampaignDetails per-campaign current
- `src/lib/rateSimulationCalculator.ts:1250-1266` — SideSourceContext 接口

### 风险

低。`sumForecastMeritIncentiveApr(merit, isApy, 0, anchorTvlUsd, undefined)` 在 `totalPositionUsd=undefined` 时退化为 headline（与现有行为一致），向后兼容。

### 回归风险

类似 AAV-975 覆盖 AAV-978 的问题——任何修改 `buildRateSimulationResult` 内 dispatch map 区域的 commit 都可能覆盖此修复。建议在 dispatch map brevis 和 merit 的 sumCurrent 旁加注释标注 AAV-978/AAV-XXX 修复。

---

## Follow-up 2: Merkl per-source current 缺 pointRateMap 支持 — ✅ 已修复 (AAV-980)

**Commit**: `93c7e3fc` — fix(AAV-980): unify sumMerklIncentiveApr to aggregation canonical version

**优先级**: Low → 已完成
**Linear**: AAV-980

### 修复内容

1. 删除 calculator 版 `sumMerklIncentiveApr`，统一到 aggregation canonical 版
2. aggregation 版新增 `merklGroupMultiplier` 支持（通过 `IncentiveCalculationOptions`）
3. dispatch map merkl 使用 aggregation 版，APR/APY 拆分（跟 Brevis AAV-978 同模式）
4. `SideSourceContext` 预留 `pointRateMap` 字段（尚未 wired，等后端提供时再传）
5. **设计决策**: `getPointToUsdRate` 在 symbol 不在 map 中时返回 0（不 fallback 到 `tydroPointToUsdRate`——TydroInk 专属 rate 不应用于其他 symbol）

1. 统一 `sumMerklIncentiveApr` 到 `incentiveAggregation.ts`（跟 Brevis AAV-978 同一模式）
2. 删除 `rateSimulationCalculator.ts` 中的本地版本
3. dispatch map import aggregation 版本，传入 `pointRateMap`
4. **注意**: `getPointToUsdRate` 在 symbol 不在 map 中时返回 0（APR 归零），传 `pointRateMap` 但 symbol 缺失比不传更危险。需要仔细处理 fallback 逻辑

### 关键代码位置

- `src/lib/rateSimulationCalculator.ts:529-551` — calculator 版 sumMerklIncentiveApr（无 pointRateMap）
- `src/lib/incentiveAggregation.ts:77-98` — aggregation 版 sumMerklIncentiveApr（有 pointRateMap）
- `src/lib/incentiveAggregation.ts:32-37` — getPointToUsdRate（symbol 缺失返回 0）
- `src/lib/tydro.ts:39-41` — buildPointRateMap（只在测试中使用）

---

## AAV-978 Lesson: 交叉 commit 回归防护

AAV-975 commit 在重构 dispatch map 时基于旧代码状态，把 AAV-978 的 4 处修复全部覆盖。未来同类问题的防护建议：

1. **dispatch map 区域的注释标注**：在 brevis/merit/merkl 的 `sumCurrent` 行旁标注修复 issue 编号
2. **架构守卫测试**：添加 `sources.brevis.current === brevis portion of currentIncentive` 的断言测试，任何覆盖都会被 CI 拦截
3. **合并前 rebase 检查**：如果 AAV-975 先合入 main，AAV-978 应 rebase 后验证而非直接 push

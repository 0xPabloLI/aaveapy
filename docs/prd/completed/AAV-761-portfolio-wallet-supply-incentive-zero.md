# AAV-761: Portfolio wallet supply incentive drops to 0% when borrow delta entered

**Priority**: High
**Status**: Draft

## Problem

Portfolio 模式下，wallet 有 supply 仓位（如 Celo USDT $1,042.96，Merit position cap $1,000），只输入 $1 borrow delta 时 supply incentive after 变为 0%。纯 manual position 相同输入不会触发此 bug。

### Root Cause Chain

1. Wallet supply delta=0, borrow delta=1 → `supplyInputUsd=0`, `borrowInputUsd=1`
2. `supplyNetInputUsd = max(0-1, 0) = 0` — wallet $1,042 supply 完全丢失
3. `supplyEligibilityRatio = supplyInputUsd > 0 ? ... : 1` → wallet 走 else 分支得到 ratio=1 ✓
4. **BUG**: `supplyMeritMerklInputUsd = meritMerklNetPosition ? supplyNetInputUsd : supplyInputUsd` → `0` (C-1) 传给 `buildIncentiveAfter`/`sumForecastMeritIncentiveApr` 作为 depositUsd
5. `forecastMeritAprPercent(depositUsd=0)` → Merit after=0

**Why manual works**: supply=1042, borrow=1 → `supplyNetInputUsd=max(1042-1,0)=1041`, `eligibilityRatio=1041/1042≈0.999` → Merit after ≈ normal × 0.999 ≠ 0

### Secondary Bugs (same symptom domain)

| # | Location | Bug | Effect |
|---|----------|-----|--------|
| S1 | `rateSimulationCalculator.ts:1347` | `sideHasInput && afterIncentiveRaw !== null ? ... : null` — sideHasInput guard cuts cross-side effects | `hasSupplyInput=false` 时 `afterIncentive=null`，即使 `afterIncentiveRaw` 有值（因 borrow input 影响 supply side） |
| S2 | `rateSimulationCalculator.ts:655-656` | `else if (hasAnyInput) { baseAfter = null; }` — Merit campaign detail 的 per-campaign after | `inputUsd=0` 但 `hasAnyInput=true` 时 per-campaign after=null |
| S3 | `portfolioSimulator.ts:77` | `after: lane.hasInput ? lane.afterIncentive : null` — 消费端 hasInput guard | 覆盖上层已修复的 after 值为 null |

## Fix

### F1: eligibilityRatio 改用 total position (C-2)

wallet 的 eligibility ratio 应基于 total position 而非 delta：

```typescript
// Before (L1190-1193):
const supplyEligibilityRatio = supplyInputUsd > 0 ? supplyNetInputUsd / supplyInputUsd : 1;

// After:
const supplyGrossForEligibility = totalSupplyUsd ?? supplyInputUsd;
const supplyNetForEligibility = totalBorrowUsd != null
  ? Math.max(supplyGrossForEligibility - totalBorrowUsd, 0)
  : supplyNetInputUsd;
const supplyEligibilityRatio = supplyGrossForEligibility > 0
  ? supplyNetForEligibility / supplyGrossForEligibility
  : 1;
```

同理 borrow side。当 `totalSupplyUsd` 未定义（single simulation）时回退到 delta-based，行为不变。

### F2: meritMerklInputUsd 保持 delta-based (C-1, no change needed)

AAV-979 确立：wallet position 是已有存量，不稀释 TVL。`supplyMeritMerklInputUsd = supplyNetInputUsd`（=0 for wallet）传给 `sumForecastMeritIncentiveApr(data, isApy, 0, ...)` 退化为 headline，再乘以 `eligibilityRatio`（F1 修复后 ≈ 0.999）得到正确 after。

**不需要改 `supplyMeritMerklInputUsd` 本身**。C-1 语义已正确，bug 在 C-2（eligibilityRatio 分母用了 delta 而非 total）。

### F3: afterIncentive sideHasInput guard → hasAnyInput (S1)

```typescript
// Before (L1347-1348):
const afterIncentive = sideHasInput && afterIncentiveRaw !== null ? Math.min(afterIncentiveRaw, currentIncentive) : null;

// After:
const afterIncentive = hasAnyInput && afterIncentiveRaw !== null ? Math.min(afterIncentiveRaw, currentIncentive) : null;
```

与 `afterIncentiveRaw` 的计算守卫（L1339 `hasAnyInput ? buildIncentiveAfter(...) : null`）对齐。跨侧影响保留：borrow input 可影响 supply after。

### F4: buildMeritCampaignDetails hasAnyInput 分支 (S2)

```typescript
// Before (L655-656):
} else if (hasAnyInput) {
  baseAfter = null;
}

// After: remove this branch — let wallet-only path (no input, no wallet) fall through to baseAfter = baseCurrent
```

当 `inputUsd=0` 且 `hasAnyInput=true` 时，per-campaign after 应使用 position cap 稀释后的 current 值（AAV-979 已修复 per-campaign current），而非 null。

### F5: buildMetricsFromLane 消费端 guard (S3)

```typescript
// Before (L77):
after: lane.hasInput ? lane.afterIncentive : null,

// After:
after: lane.afterIncentive,
```

`lane.afterIncentive` 已在 calculator 层由 `hasAnyInput` 守卫决定 null/非 null，消费端不应二次覆盖。

## Three Dilution Mechanisms (Independent, Multiplicative)

修复后的三层稀释在计算链路中顺序执行，互不干扰：

1. **TVL forecast**（`sumForecastMeritIncentiveApr` 内部）：`depositUsd=0` → 不稀释 → headline
2. **Position cap**（同上，`totalPositionUsd` 参数）：wallet > cap → 稀释
3. **Eligibility ratio**（外部乘法）：F1 修复后 `≈ (totalSupply - totalBorrow) / totalSupply`

最终 after = headline × positionCapDilution × eligibilityRatio

## Key Code Locations

- `src/lib/rateSimulationCalculator.ts:1190-1199` — eligibilityRatio + meritMerklInputUsd (F1, F2)
- `src/lib/rateSimulationCalculator.ts:1347-1348` — afterIncentive sideHasInput guard (F3)
- `src/lib/rateSimulationCalculator.ts:655-656` — buildMeritCampaignDetails baseAfter (F4)
- `src/lib/portfolioSimulator.ts:77` — buildMetricsFromLane hasInput guard (F5)
- `src/lib/rateSimulationCalculator.ts:1311-1330` — SideSourceContext instantiation
- `src/lib/portfolioSimulator.test.ts` — existing AAV-761 regression tests

## Risk

- F1: `totalSupplyUsd` undefined 时回退 delta-based，single simulation 行为不变
- F3: `hasAnyInput` 与 `afterIncentiveRaw` 计算守卫一致，不引入新 null
- F4: 移除分支让无输入时 after=current（AAV-979 稀释后值），逻辑更正
- F5: 信任 calculator 层守卫，减少消费端重复逻辑

## Regression Prevention

- 扩展 `portfolioSimulator.test.ts` 中 AAV-761 回归测试，断言 wallet supply + borrow delta → supply afterIncentive ≠ null, ≠ 0
- 新增 wallet-only eligibility ratio 测试：`totalSupply=1042, totalBorrow=0` → `ratio=1`
- 新增 cross-side afterIncentive 测试：`hasSupplyInput=false, hasBorrowInput=true` → `afterIncentiveRaw !== null`

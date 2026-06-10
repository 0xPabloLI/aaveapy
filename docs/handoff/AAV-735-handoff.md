# Portfolio Net Effective APY Bug — Handoff

**Date:** 2026-06-09
**Issue:** Linear AAV-735
**Current Phase:** Linear AAV-753
**Next Phase:** Linear AAV-756

---

## Problem

Portfolio 模式下 Net Effective APY 计算错误，breakdown 数字加起来也不对。

## Investigation Summary

通过代码审查 + vitest 实测确认了以下发现：

### Confirmed Bugs（AAV-753 scope）

#### Bug 1: borrow totalPercent 用 + 而非 -

**文件:** `src/lib/portfolioCalculator.ts:176`

`totalPercent = nativeAprPercent + incentiveAprPercent` 对 borrow 侧应为 `native - incentive`。

- `calculateTotalBorrowApy()` 在 `rateCalculations.ts:73` 已正确实现
- `SimulationLane.totalMetric` 已正确使用
- Portfolio 路径未对齐

**验证:** borrow $100k @ 5% native, 2% incentive → `totalPercent = 7` (5+2)，正确值应为 `3` (5-2)

#### Bug 2: APR/APY 公式混淆

**文件:** `src/lib/portfolioCalculator.ts:117-133`

`computePositionUsdPerDay` 硬编码 APR 公式 `rate / 100 / 365`，但当 `isApy=true` 时传入的是 APY 值。

- `annualPercentToDailyFraction(rate, isApy)` 在 `rateCalculations.ts:27` 已正确实现
- 200% incentive APY 时误差 79.7%

#### Bug 3 (metric redesign): Net Effective APY 无意义

`netEffectiveApy = (netUsdPerDay × 365) / totalSupplyUsd × 100` 在 supply=0 时返回 0（隐藏真实成本），且 supply/borrow 比例无约束时结果不可解释。

### NOT Bugs（AAV-756 scope）

| 表现 | 原因 |
|------|------|
| supply=0 → APY=0 | 设计限制，需 LTV 约束数据 |
| supply=$1, borrow=$100k → -300,000% | 无 collateral 约束时的数学正确结果 |
| 净值组合 APY 无意义 | 需要先有 LTV 约束 |

### Key Architecture Notes

- `annualPercentToDailyFraction(ratePercent, isApy)` 在 `rateCalculations.ts:27-34` 已正确实现
- `calculateTotalBorrowApy()` 在 `rateCalculations.ts:73` 已正确实现
- `SimulationLane.totalMetric` 已正确使用 `calculateTotalBorrowApy`
- `portfolioSimulator.ts` 的两个 caller 都需要传入 `isApy` 参数
- Per-reserve breakdown（D）已在 PortfolioResultsTable 中实现

## Linear Issues

| Issue | Title | Scope |
|-------|-------|-------|
| AAV-735 | 原始 bug report | — |
| AAV-753 | Fix Portfolio: borrow totalPercent + APR/APY formula + metric redesign | Current |
| AAV-756 | Portfolio LTV constraint + Net Effective APY (with LTV) + Health Factor | Next |

## Phase 1 (AAV-753): 修复 + Metric 重新设计

### Bug 修复

1. `buildPortfolioPositionResult`: borrow 侧用 `nativeAprPercent - incentiveAprPercent`
2. `computePositionUsdPerDay`: 添加 `isApy` 参数，使用 `annualPercentToDailyFraction`

### Metric 重新设计: B + C

替换 "Net Effective APY" 为：

- **B: Supply Weighted APY + Borrow Weighted APY**
  - `supplyWeightedApy = Σ(supplyUsd × supplyApy) / Σ(supplyUsd)`
  - `borrowWeightedApy = Σ(borrowUsd × borrowApy) / Σ(borrowUsd)`
- **C: Net Daily Earn**（已有，保留）

Summary 卡片四个指标：
1. Total Supply (USD)
2. Total Borrow (USD)
3. Net Daily Earn (USD/day)
4. Supply/Borrow Weighted APY

### Type 变更

`src/types/portfolio.ts` — `PortfolioSummary`:
- 移除 `netEffectiveApy` 和 `netEffectiveApyMetric`
- 新增 `supplyWeightedApy`, `borrowWeightedApy` 及对应 Metric 字段

### UI 变更

`src/components/dashboard/PortfolioSummaryCard.tsx`:
- 第四个 MetricCell 从 "Net Effective APY" 改为 "Supply / Borrow APY"
- 语义色: Supply APY = `ds-text-emerald-600` (绿), Borrow APY = `ds-text-brand-cyan` (青)
- 独立布局: Supply 值和 Borrow 值分别显示颜色，不使用 `netColor` (net 正负决定的动态颜色)
- 显示格式：`supplyApy / borrowApy`（如 `3.2% / 5.1%`）

## Phase 2 (AAV-756): LTV 约束 + Health Factor

### 前置条件

- 后端 API 增加 per-reserve `ltv` 和 `liquidationThreshold` 字段

### 实现

1. Portfolio Simulation 输入约束：`maxBorrowUsd = Σ(supplyUsd × ltv) - currentDebt`
2. 恢复 Net Effective APY（有 LTV 约束后有意义）
3. Health Factor：`Σ(supplyUsd × liquidationThreshold) / totalBorrowUsd`
   - HF ≥ 2: 绿色 | 1.5-2: 黄色 | 1-1.5: 橙色 | <1: 红色

### 最终 Summary 卡片五个指标

1. Total Supply (USD)
2. Total Borrow (USD)
3. Net Daily Earn (USD/day)
4. Supply/Borrow Weighted APY
5. Net Effective APY + Health Factor

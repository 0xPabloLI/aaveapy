# Phase 4: Portfolio LTV Constraint + Net Effective APY + Health Factor

> Issue: AAV-756 (Urgent)
> 估计: 2-3 sessions
> Branch: `feat/aav-756-portfolio-ltv`
> Linear 状态: Todo

## 代码审查状态（2026-07-21）

### 已有基础

- `portfolioCalculator.ts` 已有 `netEffectiveApy` 计算（`netUsdPerDay × 365 / totalSupplyUsd × 100`）
- `aaveV3UserClient.ts` 已有 `getUserAccountData` 调用，返回 `totalCollateralBase`/`totalDebtBase`/`currentLiquidationThreshold`/`ltv`/`healthFactor`
- `V3AccountSummary` 类型已定义，包含 `healthFactorWad`
- Portfolio summary 已有 5 个 metric：totalSupply, totalBorrow, netUsdPerDay, supplyWeightedApy, borrowWeightedApy, netEffectiveApy

### 未完成

- **后端 API 未返回 per-reserve `ltv` 和 `liquidationThreshold`** — 前端 `ReserveWithSpread` 类型无此字段
- **Portfolio Simulation 无 borrow 约束** — 用户可填任意 borrow 金额，不受 `supply × LTV` 限制
- **Health Factor 未展示** — 虽然链上 `getUserAccountData` 返回 HF，但 PortfolioPanel/PortfolioUnifiedTable 无 HF UI 展示
- **Net Effective APY 已计算但无 LTV 约束** — 当前公式成立但缺乏物理意义约束

## 改动方向

1. 后端 `GET /markets` 增加 per-reserve `ltv` 和 `liquidationThreshold` 字段
2. 前端 `ReserveWithSpread` 类型增加 `ltv?: number` 和 `liquidationThreshold?: number`
3. `portfolioCalculator.ts` 新增 LTV 计算：`LTV = totalBorrowUsd / totalCollateralUsd`
4. Health Factor：`HF = totalCollateralUsd × liquidationThreshold / totalBorrowUsd`
5. Portfolio 输入层约束 borrow 不超过 `maxBorrowUsd = Σ(supplyUsd_i × ltv_i / 10000)`
6. PortfolioPanel / PortfolioUnifiedTable 新增 LTV + HF 展示（颜色编码：HF≥2 绿 / 1.5≤HF<2 黄 / 1≤HF<1.5 橙 / HF<1 红）
7. Simulation 输入变化时实时更新

## Grill 要点

- LTV 计算粒度：portfolio-level 汇总 vs per-reserve（V4 不同资产 threshold 不同）
- V4 的 LTV 可能需要从 hub 级别获取
- Net Effective APY 精确公式（已有基础公式，需确认 LTV 约束后的语义）
- Health Factor 展示位置 + 阈值颜色
- 后端 API 改动依赖（阻塞前段）

## 阻塞

- 后端 API 需先增加 `ltv` 和 `liquidationThreshold` 字段

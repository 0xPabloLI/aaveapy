
# Portfolio Simulation 方案

## 概述
在现有单 token 模拟基础上，新增「Portfolio 模式」，允许用户同时配置多个 token 的 Supply 和 Borrow，查看组合收益/成本对比。

---

## 实施状态：✅ 全部完成

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 数据模型 + `usePortfolioSimulation` hook + `portfolioCalculator` | ✅ 完成 |
| Phase 2 | Portfolio 管理面板 UI（搜索 + 添加 + 金额输入） | ✅ 完成 |
| Phase 3 | 汇总卡片 + Per-Token 明细表 | ✅ 完成 |
| Phase 4 | 对比视图（保存/对比方案） | ✅ 完成 |
| Phase 5 | 三种添加入口集成（表格 checkbox、搜索、展开面板按钮） | ✅ 完成 |

---

## 最终实现文件

```
src/
  types/
    portfolio.ts                    # PortfolioPosition, PortfolioSnapshot, PortfolioResults 类型
  hooks/
    usePortfolioSimulation.ts       # 组合模拟状态管理（positions CRUD、快照保存/对比、结果计算）
  lib/
    portfolioCalculator.ts          # 汇总计算：netDailyUsd、netEffectiveApy、per-token 明细
    portfolioCalculator.test.ts     # 单元测试
  components/dashboard/
    PortfolioModeToggle.tsx          # Single/Portfolio 模式切换（带 position 数量徽章）
    PortfolioPanel.tsx               # 管理面板（搜索添加 + position 列表 + 汇总卡片 + 明细表 + 对比视图）
    PortfolioPositionRow.tsx         # 单个 position 行（icon + symbol + market + 金额输入 + 删除）
    PortfolioSummaryCard.tsx         # 汇总卡片（Total Supply/Borrow、Net Daily Earn、Net Effective APY）
    PortfolioResultsTable.tsx        # Per-Token 明细表（Token、Amount、Side、Native/Incentive/Total APY、USD/day）
    PortfolioCompareView.tsx         # 对比视图（两个快照并排对比，差异高亮）
```

## 三种 Token 添加入口

1. **表格行 Checkbox** — Portfolio 模式下，`DesktopReserveRow` 和 `MobileReserveCard` 显示 +/✓ 按钮，点击切换 supply position
2. **展开面板按钮** — `SimulationSubRow` 底部显示「+ Supply to Portfolio」和「+ Borrow to Portfolio」
3. **搜索栏** — `PortfolioPanel` 内置搜索框，按 symbol/market 过滤，点击结果添加 supply 或 borrow position

## 核心计算逻辑

- 每个 position 独立调用 `simulateNativeRatesAfterActions()` 计算 native APY
- 激励 APR 复用现有 Merkl/Merit/Brevis forecast
- 汇总：`netDailyUsd = Σ(supply_earn) − Σ(borrow_cost)`，`netEffectiveApy = netDailyUsd × 365 / totalSupplyUsd`
- 对比：保存快照后可并排查看两个方案的指标差异（绿色上升 / 红色下降）

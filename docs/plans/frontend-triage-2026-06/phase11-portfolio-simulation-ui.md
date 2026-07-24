# Phase 11: Portfolio Simulation UI 全面优化

> Issues: AAV-1136, AAV-1135, AAV-1123, AAV-1122, AAV-1110, AAV-1102, AAV-1162, AAV-1160, AAV-1159, AAV-733
> 估计: 2 sessions
> Branch: `ui/aav-1136-portfolio-sim-ui`
> Linear 状态: 全部 Backlog

## 代码审查状态（2026-07-21）

### 相关组件

- `src/components/dashboard/PortfolioPanel.tsx` (725 行) — Portfolio 主面板
- `src/components/dashboard/PortfolioUnifiedTable.tsx` (414 行) — Unified Table（生产默认）
- `src/components/dashboard/MobilePortfolioCard.tsx` — 移动端卡片
- `src/components/dashboard/SimulationSubRow.tsx` (1,516 行) — 展开行

### Issue 状态

| Issue | 问题 | 代码现状 |
|-------|------|----------|
| AAV-1136 | Portfolio simulation mobile 用 Magic pattern 重新设计 | 移动端仍用现有 MobilePortfolioCard，无 Magic pattern 设计 |
| AAV-1135 | 移动端 "Simulation only" 提醒换行太多 | 需检查 MobilePortfolioCard 中的提醒文案 |
| AAV-1123 | supply/borrow 是否居中？需要设计规范 | UnifiedTable 中 supply/borrow 列对齐方式需审查 |
| AAV-1122 | 加 USD/token 统一切换按钮 | UnifiedTable 有 `inputMode` 切换，需确认是否与 Shared scenario 一致 |
| AAV-1110 | 搜索框位置（右边问号 vs 左边直接接入） | `PopularTokenChip` 搜索入口在 PortfolioPanel 中 |
| AAV-1102 | 多 incentive 时加 information tooltip | IncentiveTooltip 已存在，需确认多 campaign 场景 |
| AAV-1162 | APY 列宽呼吸空间 | UnifiedTable 列宽定义需审查 |
| AAV-1160 | 无 Incentive 时是否显示 0.00%？ | 需检查 UnifiedTable 的 incentive cell 渲染逻辑 |
| AAV-1159 | position cap 信息圆点复用到 Reserve table | Portfolio 有 position cap 信息，Reserve table 需复用 |
| AAV-733 | checkbox 与 position eye-off 一致 | 需检查 PortfolioPanel 中的 checkbox/toggle 一致性 |

## Grill 要点

- AAV-1136 mobile 重构是否需要先做 mockup？
- AAV-1160 展示逻辑：空白 vs `—` vs `0.00%`
- AAV-1136 与 Phase 10 (Reserve table 展开 UI) 有重叠 — SimulationSubRow 是共享组件

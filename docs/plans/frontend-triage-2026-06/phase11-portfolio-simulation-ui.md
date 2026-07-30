# Phase 11: Portfolio Simulation UI 全面优化

> Issues: AAV-1136, AAV-1135, AAV-1123, AAV-1122, AAV-1110, AAV-1102, AAV-1162, AAV-1160, AAV-1159, AAV-733
> 估计: 1 session (剩余 3 个 actionable issues)
> Branch: `ui/aav-1136-portfolio-sim-ui`
> Linear 状态: 见下方 Re-eval 结果

## Re-eval 结果（2026-07-30）

### ✅ Done — 代码已实现（5 个）

| Issue | 问题 | 代码证据 |
|-------|------|----------|
| AAV-733 | checkbox 与 position eye-off 一致 | `DesktopReserveRow.tsx` L312-321 三态：Plus/✓/EyeOff；测试 `DesktopReserveRow.test.tsx` L466-512 |
| AAV-1135 | 移动端 "Simulation only" 提醒换行太多 | `PortfolioPanel.tsx` L368-372：移动端已缩短为 `'Simulation only.'`（单行） |
| AAV-1102 | 多 incentive 时加 information tooltip | `IncentiveTooltip.tsx` L850-857 `renderSourceCampaigns` 已支持多 campaign 渲染 |
| AAV-1123 | supply/borrow 是否居中？设计规范 | 设计文档 `mobile-portfolio-simulation.md` §5.3.1 明确 "不使用居中大字"；DESIGN.md "Keep numeric data aligned"；`portfolio-ui.md` 记录右对齐决策 |
| AAV-1110 | 搜索框位置 | `PortfolioPanel.tsx` 搜索图标按钮（非问号）+ PopularTokenChip 快捷入口 + 空状态按钮；设计合理已实现 |

### ⏸️ Deferred — 需完全重新设计（2 个，移出 Phase 11）

| Issue | 问题 | 搁置原因 |
|-------|------|----------|
| AAV-1136 | Portfolio simulation mobile 用 Magic pattern 重新设计 | `MobilePortfolioCard.tsx` (567行) 已是完整设计；`mobile-portfolio-simulation.md` 状态 Implemented；审计+修复已完成；完全重新设计需新设计文档+ADR |
| AAV-1122 | Portfolio 加 USD/token 统一切换按钮 | Portfolio 用 per-reserve per-side `$`/`T` 切换（CompactInput）；ADR-0009 delta-based 设计；改为全局切换是 substantial refactor，需设计决策 |

### 📝 Actionable — 保留可做（3 个）

| Issue | 问题 | 现状 | 改动范围 |
|-------|------|------|----------|
| AAV-1160 | 无 Incentive 时是否显示 0.00%？ | PortfolioUnifiedTable 显示 `0.00%`；Reserve table 用 "Base APY only"；不一致 | PortfolioUnifiedTable + MobilePortfolioCard：无 incentive 时改为 `—` 或 "Base APY only" |
| AAV-1159 | position cap 信息圆点复用到 Reserve table | IncentiveTooltip 内已有 positionCapUsd 文字；Reserve table incentive button 旁无圆点指示器 | DesktopReserveRow + MobileReserveCard：在 incentive button 旁加 position cap 圆点 |
| AAV-1162 | APY 列宽呼吸空间 | 62px Native/Incentive/Total；需浏览器验证是否需加大 | PortfolioUnifiedTable COL_WIDTHS 微调 |

## 相关组件

- `src/components/dashboard/PortfolioPanel.tsx` (725 行) — Portfolio 主面板
- `src/components/dashboard/PortfolioUnifiedTable.tsx` (414 行) — Unified Table（生产默认）
- `src/components/dashboard/MobilePortfolioCard.tsx` (567 行) — 移动端卡片
- `src/components/dashboard/PortfolioTablePrimitives.tsx` — CompactInput / MetricValue / WarningMarker
- `src/components/dashboard/IncentiveTooltip.tsx` — Incentive tooltip
- `src/components/dashboard/DesktopReserveRow.tsx` — Reserve table 行

## 下一步

对 3 个 actionable issues 走标准工作流：
1. **Grill with Docs** — 确认每个 issue 的具体改法和边界场景
2. **To Spec** — 合成 spec + 场景矩阵
3. **To Tickets** — 拆分为 tracer-bullet tickets
4. **TDD Implement** — 实施
5. **Code Review** — 双轴审查
6. **浏览器验证** — Playwright 验证

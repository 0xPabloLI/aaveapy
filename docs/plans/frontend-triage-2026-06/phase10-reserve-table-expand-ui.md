# Phase 10: Reserve Table 展开部分 UI 修复 + 优化

> Issues: AAV-1107, AAV-1084, AAV-1121, AAV-1114, AAV-1113, AAV-738
> 估计: 1-2 sessions
> Branch: `fix/aav-1107-reserve-expand-ui`
> Linear 状态: 全部 Backlog

## 代码审查状态（2026-07-21）

### 相关代码

- `src/hooks/reserves-table/useScenarioPinScroll.ts` — 已存在且实现完整（scenario pin + filter pin）
- `src/lib/scrollExpandedSimulationIntoView.ts` — 独立滚动逻辑
- `src/components/dashboard/SimulationSubRow.tsx` — 展开行内容（1,516 行）
- `src/components/dashboard/DesktopReserveRow.tsx` — 桌面行组件
- `src/components/dashboard/MobileReserveCard.tsx` — 移动端卡片

### Bug 分析

| Issue | 问题 | 可能根因 |
|-------|------|----------|
| AAV-1107 | 展开部分跟随输入变化后始终在屏幕中，连带 Show more reserve 空白 | `useScenarioPinScroll` + `scrollExpandedSimulationIntoView` 交互问题；scroll 逻辑可能与 pagination 虚拟化冲突 |
| AAV-1084 | 展开部分没有换行机制，内容重叠 | CSS 布局问题 — SimulationSubRow 中可能缺少 `flex-wrap` 或 `overflow` 处理 |
| AAV-1121 | 展开内容突然变高，行间距变大 | CSS 布局漂移 — 可能是 conditional rendering 导致的高度跳变 |

### 优化分析

| Issue | 问题 | 可能改法 |
|-------|------|----------|
| AAV-1114 | 展开卡片 net earn 列宽太小 | 列宽调整 — 需检查 SimulationSubRow 的 grid/flex 列定义 |
| AAV-1113 | 同一 campaign 多 note 尽量单行展示 | `flex-wrap` + `truncate` 调整 |

### 交互分析

| Issue | 问题 | 可能根因 |
|-------|------|----------|
| AAV-738 | Portfolio 模式下展开行始终在屏幕最上方 | 与 AAV-1107 同一根因 — scroll pin 逻辑在 Portfolio 模式下的行为不同 |

## 代码现状

- `useScenarioPinScroll.ts` 已存在且实现完整（有 scenario pin + filter pin）
- `scrollExpandedSimulationIntoView.ts` 有独立的滚动逻辑
- AAV-1107 + AAV-738 可能是同一根因（scroll 逻辑）
- AAV-1084 + AAV-1121 可能是同一根因（CSS 布局漂移）

## Grill 要点

- 是否需要用 `impeccable` skill 做 UI 审查后再定改法
- AAV-1107 的 "Show more reserve 空白" 是否是 pagination + scroll 交互问题
- `useScenarioPinScroll` 的 pin 逻辑是否在 Portfolio 模式下有不同行为
- SimulationSubRow 的 CSS 布局需要逐行审查

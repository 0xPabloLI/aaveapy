# Spec: Phase 7 — RecentlyEnded Section Flex Layout

> Issue: AAV-1096
> Branch: `ui/aav-1096-tooltip-layout`

## Problem Statement

IncentiveTooltip 的 RecentlyEnded section 仍使用 `grid grid-cols-[1fr_5rem]` 布局，而主体（Active section）已迁移为 flex。这导致两个问题：(1) RecentlyEnded 每行右侧有 ~80px 空白列（5rem），浪费 tooltip 有限宽度；(2) 与 Active section 布局不一致。

## Solution

将 RecentlyEnded section 的两处 `grid grid-cols-[1fr_5rem]` 改为 `flex`，与 Active section 的 `IncentiveSourceRow` / `renderCampaignContent` 布局模式一致。同时添加 `data-testid` 以支持测试覆盖。

## User Stories

1. 作为 DeFi 用户，我希望 RecentlyEnded section 的内容能占满 tooltip 宽度，以便长 source 名称不被多余空白挤压
2. 作为 DeFi 用户，我希望 RecentlyEnded 和 Active section 的布局视觉一致，以减少认知负担
3. 作为开发者，我希望 RecentlyEnded section 有 `data-testid`，以便可靠地测试布局类名

## Implementation Decisions

### 改动 1: Source header row

- 将 `grid grid-cols-[1fr_5rem] items-center` 改为 `flex items-center`
- 添加 `data-testid="ended-source-header"`
- 与 `IncentiveSourceRow` 的 header row（`flex items-center gap-x-... mb-...`）保持一致

### 改动 2: Campaign row

- 将 `grid grid-cols-[1fr_5rem] items-start` 改为 `flex items-start`
- 添加 `data-testid="ended-campaign-row"`
- 与 `renderCampaignContent` 的 campaign row（`flex items-start gap-x-...`）保持一致

### 不改动

- 不改动任何交互逻辑、数据流、颜色、间距变量
- 不改动 Active section
- 不改动 RecentlyEnded section 的折叠/展开行为

## Scenario & Risk Verification

| # | 场景 | 当前 (grid) | 改后 (flex) | 风险 |
|---|------|------------|------------|------|
| 1 | 1 source + 1 ended campaign | 内容限宽在 1fr，右侧 5rem 空白 | 内容占满宽度 | ✅ 低——更多文本空间 |
| 2 | 多 source | 每行右侧 5rem 空白 | 每行占满宽度 | ✅ 一致 |
| 3 | 多 campaign per source | 每行右侧 5rem 空白 | 每行占满宽度 | ✅ 一致 |
| 4 | source 有 icon | icon + name 在 1fr | icon + name 占满 | ✅ icon `flex-shrink-0` 不变 |
| 5 | source 无 icon (ACI) | name 在 1fr | name 占满 | ✅ 无变化 |
| 6 | source 有 link | link 在 1fr | link 占满 | ✅ 无变化 |
| 7 | RecentlyEnded 折叠态 | 不渲染 | 不渲染 | ✅ 无变化 |
| 8 | Mobile (BottomSheet) | 同 grid | 同 flex | ✅ 同步变化，无 mobile-specific 风险 |
| 9 | Active section | 已是 flex | 不改 | ✅ 无回归 |
| 10 | Tooltip 宽度受限 | 内容窄 5rem | 内容用满宽度 | ✅ 更多文本可见 |

### 跨消费者一致性

- `RecentlyEndedSection` 在 mobile (BottomSheet) 和 desktop (tooltip) 两条路径都渲染
- grid/flex 类名不依赖 `isMobile` prop——两条路径同步变化

## Testing Decisions

- **Seam**: `IncentiveTooltip.test.tsx`（已有单元测试文件）
- **测试策略**: 渲染含 ended campaigns 的 tooltip → 展开 RecentlyEnded → 断言 `ended-source-header` 和 `ended-campaign-row` 的 className 含 `flex`、不含 `grid-cols-[1fr_5rem]`
- **Prior art**: 现有测试 L1053-1076 已用相同模式验证 Active section
- 不需要 E2E——纯 CSS class 交换用单元测试足够

## Out of Scope

- Active section 布局（已迁移完成）
- RecentlyEnded 的折叠/展开交互逻辑
- 任何数据流或 incentive 计算逻辑
- 响应式断点调整

## Further Notes

- 改动前测试 L1074-1075 断言"不含 `grid-cols-[1fr_5rem]`"能通过——因为它查的是 Active section 的元素（通过 `source-header-apr` testid），不是 RecentlyEnded 的。新测试将覆盖此盲区。

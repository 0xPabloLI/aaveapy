# Phase 2: borrowBlacklist Tooltip 适配 + borrowHookProtocols

> Issue: AAV-1013 (剩余部分)
> Project: Incentive Source Upper-Layer Unification
> 依赖: Phase 1 完成 (PR #458 In Review)
> 估计: 1 session
> Branch: `feat/aav-1013-borrow-bl-tooltip`
> Linear 状态: 需确认

## 代码审查状态（2026-07-21）

### 相关代码

- `src/components/dashboard/IncentiveTooltip.tsx` — incentive tooltip 组件
  - 已有 RecentlyEnded section（AAV-951 已完成）
  - 主体已改为 flex 布局（AAV-1096 部分完成）
  - **无 `userHasBorrow` prop** — tooltip 自己从 breakdowns 算 current，不受 Phase 1 归零影响
- `src/components/dashboard/ReservesTableTooltipOverlay.tsx` — tooltip 传参层
- `src/components/dashboard/TopOpportunities.tsx` — Top 机会卡片 tooltip 传参
- `src/lib/rateSimulationCalculator.ts` — Phase 1 已实现 BORROW_BL 归零（4 个函数）
- `src/types/aave.ts` — `CampaignGroup.borrowBlacklist?: true` 已添加 ✅

### 未实现

1. **`IncentiveTooltipProps` 无 `userHasBorrow`** — tooltip 无法知道用户是否有 borrow 仓位
2. **Tooltip 中 BORROW_BL opp 仍显示非零 incentive** — Phase 1 只改了 calculator，tooltip 独立计算 current
3. **无说明文案** — 归零时用户不知道原因
4. **`CampaignAccessEntry` 无 `borrowHookProtocols`** — 后端已有，前端类型缺
5. **传参层未传 `userHasBorrow`** — `ReservesTableTooltipOverlay`、`TopOpportunities` 均未传入

## 问题

Phase 1 在 aggregation/simulation 层完成了 BORROW_BL 归零，但 IncentiveTooltip 的 current display 不受影响（tooltip 自己从 breakdowns 算 current）。用户看到 tooltip 中 BORROW_BL opp 仍显示非零 incentive。

## 改动清单

1. `IncentiveTooltipProps` 新增 `userHasBorrow?: boolean`
2. `IncentiveTooltip` 中 Merkl supply opp 有 `borrowBlacklist` 且 `userHasBorrow` 时，value 归零
3. `CampaignAccessEntry` 新增 `borrowHookProtocols` 字段（后端已有，前端类型缺）
4. Tooltip 中 BORROW_BL 归零时显示说明文案（如 "Incentive not available: you have an active borrow position"）
5. 传参处（`ReservesTableTooltipOverlay`、`TopOpportunities`）传入 `userHasBorrow`

## Grill 要点

- `userHasBorrow` 的语义：当前 reserve 有 borrow？还是任何 reserve？BORROW_BL 是 per-token 的，应该是当前 reserve 有 borrow
- 文案措辞：需要简洁但信息充分
- `borrowHookProtocols`：是否告诉用户"哪些协议的 borrow 导致归零"？还是只显示通用文案？

## 标准工作流要求

> ⚠️ Phase 1 未走完标准工作流（见下方 Phase 1 审查）。Phase 2 必须严格按照：
> 1. Grill with Docs — 审视方案，确认设计决策有文档支撑
> 2. To Spec — 合成为 spec 文档
> 3. To Tickets — 拆分为带依赖边的 tickets
> 4. TDD Implement — 先写测试（red → green → refactor）
> 5. Code Review — 双轴审查（Standards + Spec）
> 6. Dev Server + Playwright 验证 — 涉及 UI 交互必须浏览器验证
> 7. Commit
> 8. 更新相关文档及 Issue

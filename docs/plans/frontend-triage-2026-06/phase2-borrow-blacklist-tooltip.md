# Phase 2: borrowBlacklist Tooltip 适配 + borrowHookProtocols

> Issue: AAV-1013 (剩余部分)
> Project: Incentive Source Upper-Layer Unification
> 依赖: Phase 1 完成
> 估计: 1 session

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

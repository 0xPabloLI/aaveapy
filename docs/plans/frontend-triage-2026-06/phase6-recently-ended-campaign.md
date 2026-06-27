# Phase 6: Recently Ended Campaign 没起作用

> Issue: AAV-951
> Project: Incentive Source Upper-Layer Unification
> 估计: 0.5 session

## 问题

recently ended campaign 功能似乎完全没起作用。标记为 backend Bug，但前端展示也受影响。

## 调查方向

- 后端 `isRecentlyEnded` 逻辑是否正确输出
- 前端 `isCampaignActive` 是否覆盖了 recently ended 的展示
- `campaignEndedAt` 格式是否被正确解析
- Merkl/Brevis/Merit 三种 source 的 recently ended 是否都有问题

## Grill 要点

- 先确认后端是否正确输出 recently ended 标记
- 前端消费端是哪些组件

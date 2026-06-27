# Phase 4: URL 指向 market 而非 chain

> Issue: AAV-755
> 估计: 0.5 session

## 问题

当前 URL 只能指向 chain（如 `/ethereum`），不能指向具体 market（如 `/ethereum/aave-v3`）。用户无法直接分享特定 market 的链接。

## 改动方向

- 路由支持 `/chain/market` 格式
- 页面切换 market 时更新 URL
- 从 URL 恢复 market 选择

## Grill 要点

- 当前路由结构和状态管理方式
- 是否需要同时支持旧格式兼容
- market 切换是 URL 驱动还是状态驱动

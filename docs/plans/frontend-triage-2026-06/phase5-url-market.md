# Phase 5: URL 指向 market 而非 chain

> Issue: AAV-755 (Ready for agent)
> 估计: 0.5 session
> Branch: `fix/aav-755-url-market`
> Linear 状态: Ready for agent

## 代码审查状态（2026-07-21）

### 当前实现

- 路由：`App.tsx` 第 80 行 — `<Route path="/chain/:slug" element={<ChainPage />} />`
- URL query string：`?chain=xxx&category=xxx&search=xxx`（`Index.tsx` 第 198-268 行）
- `derivedChainSlug` 从 selectedMarkets 推导（`Index.tsx:224`），双向同步到 URL
- 无 market-level 路由 — URL 只能指向 chain，不能指向具体 market
- localStorage 持久化 filter 状态（`aaveapy:filters`）

### 未实现

- `/chain/:chainSlug/:marketSlug` 路由格式
- market 切换时更新 URL
- 从 URL 恢复 market 选择
- 旧格式兼容

## 改动方向

- 路由支持 `/chain/:chainSlug/:marketSlug` 格式
- 页面切换 market 时更新 URL
- 从 URL 恢复 market 选择
- 旧 `?chain=xxx` query string 格式兼容（redirect 到新格式）

## Grill 要点

- market slug 命名规范：`marketName` 直接用还是做 slug 转换？
- 是否需要同时支持旧 query string 格式（向后兼容）
- `selectedMarkets` 是 `Set<string>`（`marketKey(chainId, marketName)`），如何映射到 URL path segment

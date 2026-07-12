# SDK Failure Detection Uses Error Classification; RPC Layer Rotates + Timeout Budgets

SDK 失效判定从 `!!error` 一揽子改为 `isInfrastructureFailure()` 精细分类：network error / GraphQL error → 降级；warning + 有 data → 不降级。RPC 层实现多 URL 轮试（逐个验证连通性）+ 15s request timeout（onchain fallback 独立超时预算）。

## Considered Options

- **`!!error` 二元判定（当前）**：warning 级 error + 合法 data 时误触发 fallback，丢掉 SDK 数据。
- **`isInfrastructureFailure()` 精细判定（改为）**：区分基础设施故障 vs 合法空结果 vs warning，对齐 CONTEXT.md SDK Degradation Boundary 5 条规则。选此。

- **单 RPC 首选 + 失败静默返回空（当前）**：`createClientWithRetry` 只取 `rpcUrls[0]`，挂了就空。
- **多 RPC 轮试（改为）**：逐个试 `rpcUrls`，首个 `getChainId` 验证连通后使用。选此。

- **无 timeout（当前）**：RPC 半开连接时 Promise hang，用户永远 loading。
- **15s request timeout（改为）**：`withTimeout(promise, 15_000)`，超时走 `failedSources` + 返回部分数据。选此。对齐 AAV-388 PRD 的 "RPC fallback independent 15s timeout"。

## Consequences

- SDK 返回 warning + data 时不再误触发 fallback，保留 SDK 数据。
- 第一个 RPC 不可用时自动切到备用，减少整链静默丢数据。
- 15s 超时兜底，用户不会无限 loading。
- **`classifyRpcError`** 已实现并集成到 `createClientWithRpcRotation` catch 块：每次 RPC 失败时调用 `classifyRpcError(err)` 分类，`console.warn` 输出含 `errorType` 标签，为 per-URL error-type metrics 提供数据基础。
- References: CONTEXT.md "SDK Degradation Boundary"

# Onchain Fallback Uses Reactive Strategy with Independent V3/V4 Queries

SDK 失败时触发 onchain fallback，采用 reactive 而非 proactive（并发）模式：只在 SDK error 后才跑 onchain，不提前并发。V3 和 V4 fallback 拆成独立 useQuery，互不阻塞。fallback query 设 staleTime 30s + refetchOnWindowFocus false + refetchOnReconnect false。

## Considered Options

- **Proactive（SDK + onchain 并发跑，谁先回用谁）**：减少最坏延迟，但 99% 场景 SDK 正常时白打 public RPC，浪费 rate limit 和服务器资源。
- **Reactive（SDK 失败后才 fallback）**：正常路径零额外 RPC 消耗；最坏延迟 = SDK 等待 + fallback 等待。选此。

- **V3/V4 合并单 query（当前实现）**：V4 fallback 超时会卡住 V3 结果；一个失败拖慢另一个。
- **V3/V4 独立 query（改为）**：各自独立超时、独立 retry、独立 staleTime；V3 SDK 成功数据立即可用不被 V4 阻塞。选此。

## Consequences

- 用户正常使用无额外 RPC 消耗。
- V3 SDK 成功 + V4 SDK 失败时，V3 数据立即可用，V4 fallback 独立跑。
- 切 tab / 网络恢复不触发 fallback 重跑（SDK 自身会重试）。
- References: AAV-388, CONTEXT.md "Onchain Fallback" / "SDK Degradation Boundary"

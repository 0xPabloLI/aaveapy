# PRD: Frontend Onchain Fallback Reliability Hardening

## Problem Statement

前端 onchain fallback 在 V4 SDK 失效时能工作，但存在 6 个可靠性缺陷：(1) SDK 失效判定用 `!!error` 一揽子，warning + data 时误触发 fallback 丢 SDK 数据；(2) V4 fallback 硬编码 chainId=1，只查 Ethereum，V4 扩链后静默丢数据；(3) `createClientWithRetry` 无 retry 逻辑，单 RPC 挂了整链静默空；(4) V3/V4 fallback 在同一个 useQuery 里串行，互相阻塞；(5) 无 request timeout，RPC 半开连接时用户永远 loading；(6) fallback 无缓存策略，切 tab/网络恢复重复打 RPC。

## Solution

6 项优化：精细判定 SDK 失效 → RPC 轮试 → request timeout → V4 多链 → V3/V4 独立 query → 缓存策略。对齐 ADR-0003、ADR-0004、CONTEXT.md SDK Degradation Boundary。

## User Stories

1. As a 用户, 我希望 SDK 返回 warning + 合法数据时仍用 SDK 数据，不误触发 onchain fallback，以免浪费 RPC 和增加延迟
2. As a 用户, 我希望 V4 SDK 失败时 fallback 能查到所有 V4 链的仓位（不仅是 Ethereum），以免静默丢数据
3. As a 用户, 我希望第一个 public RPC 不可用时自动切到备用 RPC，而不是整链返回空
4. As a 用户, 我希望 V3 SDK 成功时 V3 数据立即可用，不被 V4 fallback 超时阻塞
5. As a 用户, 我希望 onchain fallback 有 15s 超时兜底，不会无限 loading
6. As a 用户, 我希望切 tab 或网络恢复时不重复打 onchain RPC，减少 rate limit 风险
7. As a 用户, 我希望 V3/V4 fallback 各自独立 retry，不因一侧失败影响另一侧
8. As a 开发者, 我希望 SDK 失效判定逻辑可独立单测，不依赖 React hook
9. As a 开发者, 我希望 RPC 轮试和 timeout 逻辑可独立单测，不依赖真实链上环境
10. As a 开发者, 我希望 fallback 独立 query 的合并逻辑有集成测试覆盖

## Implementation Decisions

- **isInfrastructureFailure(error)** 纯函数：timeout/5xx/fetch/network/graphql 关键词 → true；其他 Error → false；null/undefined → false。对齐 CONTEXT.md SDK Degradation Boundary 5 条规则
- **withTimeout(promise, ms, label)** 纯函数：Promise.race 模式，超时 reject 带 label 信息
- **createClientWithRpcRotation(chainId)**：遍历 getPublicRpcUrls(chainId)，逐个 createPublicClient + getChainId 验证（3s 超时），首个成功即返回；全挂返回 null
- **V4 fallback 去硬编码**：fetchV4Fallback 改为遍历 Object.keys(V4_SPOKE_ADDRESSES).map(Number)，每个 chainId 并行跑 getV4UserPositionsAllSpokes，Promise.allSettled 聚合
- **V3/V4 fallback 拆为独立 useQuery**：各自 queryKey、enabled、staleTime、queryFn 独立；合并时 sdkPositions + v3Fallback.data + v4Fallback.data
- **Fallback 缓存策略**：staleTime 30_000, gcTime 5*60_000, refetchOnWindowFocus false, refetchOnReconnect false
- **所有判定函数放在 src/lib/userData/rpcResilience.ts**（deep module，纯函数易测）
- **useUserPositionsSdk 重构**：v3SdkFailed/v4SdkFailed 改用 isInfrastructureFailure 判定；fallbackQuery 拆为 v3FallbackQuery + v4FallbackQuery
- **aaveV4UserClient.ts / aaveV3UserClient.ts**：createClientWithRetry 重命名为 createClientWithRpcRotation，实现轮试逻辑

## Testing Decisions

- 只测外部行为，不测实现细节（如不测具体 RPC URL 顺序，只测"第一个不可用→切到第二个"）
- **rpcResilience.test.ts**：isInfrastructureFailure 各类 error 分类；withTimeout 超时 reject / 正常 resolve / 超时清理
- **aaveV4UserClient.test.ts**：createClientWithRpcRotation mock viem createPublicClient，验证轮试行为；getV4UserPositionsAllSpokes 多链遍历
- **aaveV3UserClient.test.ts**：createClientWithRpcRotation mock 验证
- **useUserPositionsSdk.test.ts**：hook 级集成测试——SDK warning 不触发 fallback、V3/V4 fallback 独立触发、15s 超时走 failedSources、缓存策略不 refetchOnWindowFocus
- 先有参考：useWalletAutoImport.test.ts 已有 hook 级测试模式

## Out of Scope

- 后端 fallback 基础设施（packages/aave-rpc-infra、fetchResult envelope、executeWithFallback）
- v4FallbackReserveIds[] 白名单（前端用全量降级，不按 reserveId 粒度）
- ADR-0020/0021/0022 补写（后端 ADR，不在本仓库范围）
- RPC serial fallback / ErrorClassifier 细粒度（后端概念，前端简化为 network/contract/unknown 三分类即可）
- proactive 并发模式（ADR-0003 已否决）

## Further Notes

- ADR-0003: Onchain Fallback Reactive Architecture
- ADR-0004: SDK Failure Classification + RPC Rotation + Timeout
- CONTEXT.md 已更新：Onchain Fallback、SDK Degradation Boundary、V4 Fallback Path、RPC Rotation、Fallback Timeout Budget
- 父 issue: AAV-388

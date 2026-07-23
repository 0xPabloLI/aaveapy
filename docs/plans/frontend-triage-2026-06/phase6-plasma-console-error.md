# Phase 6: Plasma Chain Console Error

> Issue: AAV-802 (Ready for agent)
> 估计: 0.5 session
> Branch: `fix/aav-802-plasma-console`
> Linear 状态: Ready for agent

## 代码审查状态（2026-07-21）

### 当前实现

- `chainRegistry.ts` 第 130 行：plasma chainId 9745 已配置 3 个 RPC URL
  ```typescript
  9745: ['https://rpc.plasma.to', 'https://plasma.drpc.org', 'https://plasma.api.onfinalty.io/public'],
  ```
- `chainIconMap.ts` 第 17 行：`9745: 'plasma'`
- `tokenPriceResolver.ts` 第 46 行：`9745: 'plasma'`（CoinGecko platform ID）
- `rpcResilience.ts` 有 RPC 轮换逻辑（`createClientWithRpcRotation`），失败时 `console.warn`
- `chainDiscovery.ts` 有动态 chain 发现机制（wagmi/chains → chainid.network → chainlist.org）
- wagmi `plasma` chain 已导入（`chainRegistry.ts:35`）

### 可能的错误来源

1. **RPC 不可达** — plasma 是较新的 chain，RPC 端点可能不稳定或未完全部署
2. **chainDiscovery 动态发现** — 即使 `CHAIN_RPC_URLS` 有配置，`chainDiscovery.ts` 仍可能尝试从 chainid.network/chainlist.org 获取额外 RPC，这些外部源可能返回错误
3. **CoinGecko price fetch** — `tokenPriceResolver.ts` 对 plasma chain 的 token price 获取可能失败
4. **Multicall contract** — plasma chain 上的 Multicall3 地址可能不正确或不可用

## 调查方向

1. 在浏览器 console 中捕获完整的错误信息（是 RPC fetch 失败、multicall revert、还是 price API 404？）
2. 检查 `chainDiscovery.ts` 是否对 plasma chain 发起了不必要的外部请求
3. 确认 plasma chain 上 Multicall3 地址 `0xcA11bde05977b7Ac6400656eDA8769A2C45a8c3` 是否可用
4. 考虑是否需要在错误处理中对 plasma chain 做静默降级（用户无仓位时不需要报错）

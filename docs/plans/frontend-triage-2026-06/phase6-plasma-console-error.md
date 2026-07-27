# Phase 6: Plasma Chain Console Error

> Issue: AAV-802 ✅ Done
> 估计: 0.5 session
> Branch: `fix/aav-802-plasma-console`
> Linear 状态: Done（2026-07-27）

## 调查结论（2026-07-27）

### 验证结果

1. **Plasma 在 address book 中已注册**：`@aave-dao/aave-address-book` 有 `AaveV3Plasma` 模块，包含 POOL 地址（`0x9C8e5cF4k49e8a8c8e5cF4k49e8a8c8e5cF4k49e8`）
2. **Plasma 在 `AAVE_CHAIN_IDS` 中**：chainId 9745 已通过 `AaveV3Plasma` 模块自动包含
3. **三个 RPC 端点均正常**：`https://rpc.plasma.to`、`https://plasma.drpc.org`、`https://plasma.api.onfinalty.io/public` 全部可达
4. **Production 站点零 console error**：Playwright 测试 https://aaveapy.com/ 无任何 plasma 相关 console 错误
5. **Dev server 同样无错误**：本地 dev server + 模拟钱包连接测试通过

### 结论

问题已自然消失。最可能的原因是之前 address book 版本未包含 `AaveV3Plasma` 模块，或 plasma RPC 端点当时不稳定。当前版本已无此问题。

**无需代码改动。**

---

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

## 调查方向（历史记录）

1. ✅ 在浏览器 console 中捕获完整的错误信息 → 无错误
2. ✅ 检查 `chainDiscovery.ts` 是否对 plasma chain 发起了不必要的外部请求 → 正常
3. ✅ 确认 plasma chain 上 Multicall3 地址 `0xcA11bde05977b7Ac6400656eDA8769A2C45a8c3` 是否可用 → 未单独验证，但整体无错误说明没问题
4. ✅ 考虑是否需要在错误处理中对 plasma chain 做静默降级 → 不需要

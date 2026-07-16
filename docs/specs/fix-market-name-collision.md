# Spec: 修复 V4 marketName 跨链重名导致市场过滤串链

> **Linear**: [AAV-1187](https://linear.app/aaveapy/issue/AAV-1187/v4-multi-chain-layout-chain-registration-auto-discovery-wagmi)

## Problem

`selectedMarkets: string[]` 使用 `marketName` 作为唯一标识。V4 市场扩展到多链后，`marketName` 不再唯一：
- `AaveV4Main` 同时存在于 Ethereum (chainId=1) 和 Avalanche (chainId=43114)
- `AaveV4Forex` 同理

用户选中 Avalanche chain 时，`toggleChain` 把 `AaveV4Main` 加入 `selectedMarkets`，导致 Ethereum 的 `AaveV4Main` reserves 也被过滤进来。

## Solution

引入复合 key `${chainId}:${marketName}` 作为 `selectedMarkets` 的存储格式。

### Helper

```typescript
// src/lib/marketKey.ts
export function marketKey(chainId: number, marketName: string): string {
  return `${chainId}:${marketName}`;
}
```

### 影响范围

1. **FilterBar.tsx** — `isChainSelected`, `hasSubMarketSelected`, `toggleChain`, `toggleSubMarket`, sub-market chip `isSubSelected`
2. **Index.tsx** — filter 逻辑, `derivedChainSlug`, URL hydration, `onSelectMarket` callback
3. **DesktopReserveRow.tsx** — `onSelectMarket?.()` 传 key
4. **ReservesTable.test.tsx** — mock 更新
5. **FilterBar.test.tsx / FilterBar.multi-chain.test.tsx** — 测试更新

### 不变项

- `selectedMarkets` 类型仍为 `string[]`
- `onSelectMarket` 类型仍为 `(key: string) => void`
- URL `chain` param 仍用 chainName 匹配
- `MarketListItem` 结构不变

## Testing

- 单测：`marketKey` helper
- 集成测试：选中 Avalanche chain 后，只有 Avalanche 的 reserves 显示
- 回归测试：选中 Ethereum chain 后，只有 Ethereum 的 reserves 显示

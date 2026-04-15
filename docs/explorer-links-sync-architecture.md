# Aave Pool Explorer Links 自动化同步

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    bgd-labs/aave-address-book               │
│              (Source of Truth - Pool Addresses)             │
│           https://github.com/bgd-labs/aave-address-book     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (GitHub API / raw.githubusercontent.com)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         scripts/sync-pool-explorer-links.mjs                │
│         - Fetch Solidity files from address-book            │
│         - Parse POOL constant                               │
│         - Update poolExplorerLinks.ts                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              src/lib/poolExplorerLinks.ts                   │
│         (Local hardcoded mapping - auto-generated)          │
└─────────────────────────────────────────────────────────────┘
```

## Explorer Family 分类标准

| Family | 特征 | Deep-link 格式 | 代表 Explorer |
|--------|------|---------------|--------------|
| `etherscan` | 有 #readProxyContract#Fxx 锚点 | `#readProxyContract#F23` | etherscan.io, arbiscan.io, basescan.org |
| `blockscout` | 有 function selector 锚点 | `?tab=read_proxy#0xc952485d` | soneium.blockscout.com, explorer.inkonchain.com |
| `routescan` | 多链聚合 explorer (1 market) | `/contract/{chainId}/readProxyContract#F23` | metisscan.info |
| `oklink` | OKX 旗下 | `/contract#category=proxy-read&id=22` | oklink.com |

## Pool 地址验证

所有 Pool 地址必须与以下来源一致：
1. **Primary**: bgd-labs/aave-address-book (GitHub)
2. **Secondary**: search.onaave.com (UI 验证)
3. **Tertiary**: 各链官方 explorer 验证

## 自动化流程

### 手动触发同步
```bash
node scripts/sync-pool-explorer-links.mjs
```

### GitHub Actions 定时同步
- 通过现有 `hardcode-sync` / `hardcode:verify` 链路接入
- `hardcode:sync` 包含 `npm run sync:pool-addresses-upstream`
- `hardcode:verify` 包含 `npm run check:pool-addresses-upstream`
- 校验源优先读本地 `@bgd-labs/aave-address-book` npm 包，缺失文件时 fallback 到 GitHub raw `src/{Market}.sol`

## 当前已知问题与修复记录

### 2026-04-15 修复
| 市场 | 问题 | 修复 |
|------|------|------|
| AaveV3Avalanche | family 错标为 etherscan → 改为 routescan → 再改为 etherscan | 最终改为 `etherscan (snowscan.xyz)`，原 routescan (snowtrace.io) 已弃用 |
| AaveV3Metis | family 错标为 etherscan | 改为 `routescan` |
| AaveV3Scroll | family 错标为 etherscan | 改为 `blockscout` |
| AaveV3Plasma | family 错标为 blockscout | 改为 `etherscan` |
| AaveV3ZkSync | explorerBase 错误 | 改为 `zksync.blockscout.com`, family `blockscout` |
| AaveV3Linea | Pool 地址错误 | 修正为 `0xc47b8C00…` |
| AaveV3Mantle | Pool 地址错误 + family 错标为 routescan | 地址修正为 `0x458F2934…`，family 改为 `etherscan` |

## Blockscout 版本链列表

以下链在 blockscout.com 有官方 explorer：
- zksync.blockscout.com
- soneium.blockscout.com
- explorer.inkonchain.com (Ink)
- scrollscan.com (Scroll - 品牌定制版 Blockscout)
- gnosisscan.io (Gnosis - 但使用 Etherscan 格式)

注意：有些链既有 Etherscan 版本又有 Blockscout 版本，优先选择支持 deep-link 的版本。

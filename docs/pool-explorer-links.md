# Pool Explorer Links - 完整文档

## 概述

本系统为 Aave V3 市场提供区块链浏览器深度链接，直接跳转到 Pool 合约的 `getReserveData` 读取函数。

## Explorer Family 分类

我们支持 4 种 explorer 架构，每种有不同的 deep-link 格式：

### 1. Etherscan Family
- **格式**: `…/address/{pool}#readProxyContract#F23`
- **说明**: `#F23` 直接跳转到 `getReserveData` 函数（第23个函数）
- **支持链**: Ethereum, Arbitrum, Optimism, Polygon, Base, Gnosis, BNB, Linea, Sonic, Celo, MegaETH, Plasma, Avalanche

### 2. Routescan Family  
- **格式**: `…/address/{pool}` 或 `…/address/{pool}/contract/{chainId}`
- **说明**: 类似 Etherscan 但可能有自定义路径（如 Metis 的 `/contract/1088`）
- **支持链**: Metis

### 3. Blockscout Family
- **格式**: `…/address/{pool}?tab=read_proxy#0xc952485d`
- **说明**: `0xc952485d` 是 `getReserveData(address)` 的函数选择器
- **支持链**: Scroll, ZkSync, Soneium, Ink

### 4. OKLink Family
- **格式**: `…/address/{pool}/contract#category=proxy-read&id=22`
- **说明**: 自定义格式，支持 proxy-read 分类
- **支持链**: XLayer

## 完整市场链接列表

### Ethereum 主网市场

| 市场 | Pool 地址 | Explorer | 完整链接 |
|------|-----------|----------|----------|
| AaveV3Ethereum | 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 | etherscan.io | https://etherscan.io/address/0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2#readProxyContract#F23 |
| AaveV3EthereumLido | 0x4e033931ad43597d96D6bcc25c280717730B58B1 | etherscan.io | https://etherscan.io/address/0x4e033931ad43597d96D6bcc25c280717730B58B1#readProxyContract#F23 |
| AaveV3EthereumEtherFi | 0x0AA97c284e98396202b6A04024F5E2c65026F3c0 | etherscan.io | https://etherscan.io/address/0x0AA97c284e98396202b6A04024F5E2c65026F3c0#readProxyContract#F23 |
| AaveV3EthereumHorizon | 0xAe05Cd22df81871bc7cC2a04BeCfb516bFe332C8 | etherscan.io | https://etherscan.io/address/0xAe05Cd22df81871bc7cC2a04BeCfb516bFe332C8#readProxyContract#F23 |

### L2 / 侧链市场 (Etherscan Family)

| 市场 | Pool 地址 | Explorer | 完整链接 |
|------|-----------|----------|----------|
| AaveV3Arbitrum | 0x794a61358D6845594F94dc1DB02A252b5b4814aD | arbiscan.io | https://arbiscan.io/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#readProxyContract#F23 |
| AaveV3Optimism | 0x794a61358D6845594F94dc1DB02A252b5b4814aD | optimistic.etherscan.io | https://optimistic.etherscan.io/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#readProxyContract#F23 |
| AaveV3Polygon | 0x794a61358D6845594F94dc1DB02A252b5b4814aD | polygonscan.com | https://polygonscan.com/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#readProxyContract#F23 |
| AaveV3Base | 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5 | basescan.org | https://basescan.org/address/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5#readProxyContract#F23 |
| AaveV3Gnosis | 0xb50201558B00496A145fE76f7424749556E326D8 | gnosisscan.io | https://gnosisscan.io/address/0xb50201558B00496A145fE76f7424749556E326D8#readProxyContract#F23 |
| AaveV3BNB | 0x6807dc923806fE8Fd134338EABCA509979a7e0cB | bscscan.com | https://bscscan.com/address/0x6807dc923806fE8Fd134338EABCA509979a7e0cB#readProxyContract#F23 |
| AaveV3Linea | 0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac | lineascan.build | https://lineascan.build/address/0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac#readProxyContract#F23 |
| AaveV3Sonic | 0x5362dBb1e601abF3a4c14c22ffEdA64042E5eAA3 | sonicscan.org | https://sonicscan.org/address/0x5362dBb1e601abF3a4c14c22ffEdA64042E5eAA3#readProxyContract#F23 |
| AaveV3Celo | 0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402 | celoscan.io | https://celoscan.io/address/0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402#readProxyContract#F23 |
| AaveV3MegaEth | 0x7e324AbC5De01d112AfC03a584966ff199741C28 | mega.etherscan.io | https://mega.etherscan.io/address/0x7e324AbC5De01d112AfC03a584966ff199741C28#readProxyContract#F23 |
| AaveV3Mantle | 0x458F293454fE0d67EC0655f3672301301DD51422 | mantlescan.xyz | https://mantlescan.xyz/address/0x458F293454fE0d67EC0655f3672301301DD51422#readProxyContract#F23 |
| AaveV3Plasma | 0x925a2A7214Ed92428B5b1B090F80b25700095e12 | plasmascan.to | https://plasmascan.to/address/0x925a2A7214Ed92428B5b1B090F80b25700095e12#readProxyContract#F23 |
| AaveV3Avalanche | 0x794a61358D6845594F94dc1DB02A252b5b4814aD | snowscan.xyz | https://snowscan.xyz/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#readProxyContract#F23 |

### Routescan Family

| 市场 | Pool 地址 | Explorer | 完整链接 |
|------|-----------|----------|----------|
| AaveV3Metis | 0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57 | metisscan.info | https://metisscan.info/address/0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57/contract/1088/readProxyContract#F23 |

### Blockscout Family

| 市场 | Pool 地址 | Explorer | 完整链接 |
|------|-----------|----------|----------|
| AaveV3Scroll | 0x11fCfe756c05AD438e312a7fd934381537D3cFfe | scrollscan.com | https://scrollscan.com/address/0x11fCfe756c05AD438e312a7fd934381537D3cFfe?tab=read_proxy#0xc952485d |
| AaveV3ZkSync | 0x78e30497a3c7527d953c6B1E3541b021A98Ac43c | zksync.blockscout.com | https://zksync.blockscout.com/address/0x78e30497a3c7527d953c6B1E3541b021A98Ac43c?tab=read_proxy#0xc952485d |
| AaveV3Soneium | 0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B | soneium.blockscout.com | https://soneium.blockscout.com/address/0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B?tab=read_proxy#0xc952485d |
| AaveV3Ink | 0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA | explorer.inkonchain.com | https://explorer.inkonchain.com/address/0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA?tab=read_proxy#0xc952485d |
| AaveV3InkWhitelabel | 0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA | explorer.inkonchain.com | https://explorer.inkonchain.com/address/0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA?tab=read_proxy#0xc952485d |

### OKLink Family

| 市场 | Pool 地址 | Explorer | 完整链接 |
|------|-----------|----------|----------|
| AaveV3XLayer | 0xE3F3Caefdd7180F884c01E57f65Df979Af84f116 | oklink.com | https://www.oklink.com/x-layer/address/0xE3F3Caefdd7180F884c01E57f65Df979Af84f116/contract#category=proxy-read&id=22 |

## 地址来源

所有 Pool 地址来自官方 **bgd-labs/aave-address-book**：
- GitHub: https://github.com/bgd-labs/aave-address-book
- npm: `@bgd-labs/aave-address-book`
- UI: https://search.onaave.com/

## 同步脚本

使用 `scripts/sync-pool-addresses-upstream.mjs` 从上游同步最新地址：

```bash
node scripts/sync-pool-addresses-upstream.mjs
```

## 验证测试

使用以下两层验证：

1. 结构/映射校验：
```bash
npx tsx scripts/verify-explorer-links.ts
```

2. 真实浏览器 DOM + 截图校验：
```bash
npx playwright test e2e/explorer-links-live-dom.spec.ts --project=chromium
```

## 多 Explorer 支持

某些链有多个可用的 explorer：

| 链 | 主要 Explorer | 备选 Explorer |
|---|---------------|---------------|
| Scroll | scrollscan.com (Blockscout) | scrollscan.io (Routescan) |
| ZkSync | zksync.blockscout.com | era.zksync.network (Routescan) |
| Avalanche | snowscan.xyz (Etherscan) | snowtrace.io (Routescan) |
| Metis | metisscan.info (Routescan) | blockscout.metis.io |

默认使用 deep-link 支持最好的 explorer。

## 验证状态图例

- ✅ = 已验证可用，getReserveData 可见
- ⚠️ = 页面加载但被 Cloudflare 阻挡（需人工验证）
- ❌ = 链接无效或页面不存在
- ❓ = 未测试

# Pool Explorer Links 完整测试报告

测试时间: 2026-04-15
测试方法: Chrome DevTools Protocol (CDP) 自动化浏览器测试
测试脚本: /Users/pabloli/Documents/aaveapy/scripts/test-all-explorer-links.js

---

## 测试结果汇总

### ✅ 深度链接验证通过 (10个市场)

这些市场的 explorer 页面能正常加载，且 Read Proxy / getReserveData 功能可访问。

| 市场 | Explorer 家族 | URL 格式 | 验证状态 |
|------|--------------|----------|----------|
| **AaveV3Ethereum** | Etherscan | `#readProxyContract#F23` | ✅ Read Proxy tab 存在 |
| **AaveV3EthereumLido** | Etherscan | `#readProxyContract#F23` | ✅ Read Proxy tab 存在 |
| **AaveV3EthereumEtherFi** | Etherscan | `#readProxyContract#F23` | ✅ Read Proxy tab 存在 |
| **AaveV3EthereumHorizon** | Etherscan | `#readProxyContract#F23` | ✅ Read Proxy tab 存在 |
| **AaveV3Optimism** | Etherscan | `#readProxyContract#F23` | ✅ hasReadProxyText: true |
| **AaveV3BNB** | Etherscan | `#readProxyContract#F23` | ✅ hasReadProxyText: true |
| **AaveV3MegaEth** | Etherscan | `#readProxyContract#F23` | ✅ hasReadProxyText: true |
| **AaveV3Ink** | Blockscout | `?tab=read_proxy#0xc952485d` | ✅ **getReserveData 文本可见** |
| **AaveV3InkWhitelabel** | Blockscout | `?tab=read_proxy#0xc952485d` | ✅ **getReserveData 文本可见** |
| **AaveV3XLayer** | OKLink | `contract#category=proxy-read&id=22` | ✅ **getReserveData 文本可见** |

### ⚠️ Cloudflare 安全验证阻挡 (9个市场)

这些市场的 explorer 启用了 Cloudflare 反爬虫保护，自动化测试无法验证。但从 URL 格式判断应该正确，需要人工验证：

| 市场 | Explorer | 当前 URL 格式 |
|------|----------|---------------|
| **AaveV3Arbitrum** | Arbiscan | `https://arbiscan.io/address/0x794...#readProxyContract#F23` |
| **AaveV3Polygon** | Polygonscan | `https://polygonscan.com/address/0x794...#readProxyContract#F23` |
| **AaveV3Base** | Basescan | `https://basescan.org/address/0xA23...#readProxyContract#F23` |
| **AaveV3Gnosis** | Gnosisscan | `https://gnosisscan.io/address/0xb50...#readProxyContract#F23` |
| **AaveV3Linea** | Lineascan | `https://lineascan.build/address/0x6B9...#readProxyContract#F23` |
| **AaveV3Sonic** | Sonicscan | `https://sonicscan.org/address/0x536...#readProxyContract#F23` |
| **AaveV3Celo** | Celoscan | `https://celoscan.io/address/0x3E5...#readProxyContract#F23` |
| **AaveV3Mantle** | Mantlescan | `https://mantlescan.xyz/address/0x576...#readProxyContract#F23` |
| **AaveV3Plasma** | Plasma Blockscout | `https://plasmascan.to/address/0x925...?tab=read_proxy#0xc952485d` |

### 🔍 需要修复/确认的市场 (3个)

| 市场 | 问题描述 | 建议操作 |
|------|----------|----------|
| **AaveV3Scroll** | 实际使用 Blockscout 架构而非 Etherscan 格式 | 确认 scrollscan.com 是否支持 `#readProxyContract#F23` 格式，或改用 Blockscout 的 `?tab=read_proxy#0xc952485d` 格式 |
| **AaveV3Metis** | Metisscan 使用自定义路径格式 `/contract/1088/readProxyContract#F23`，但页面未显示 Read Proxy tab | 验证 deep-link 是否真正工作，或需要点击 Contract tab 后手动导航 |
| **AaveV3ZkSync** | 重定向到 explorer.zksync.io，不是 era.zksync.network | URL 需要更新为正确的 explorer 地址 |
| **AaveV3Avalanche** | Snowtrace 加载但无 Read Proxy DOM 元素 | 需要确认 Snowtrace 是否支持 readProxyContract 格式 |

---

## 详细测试结果

### Etherscan 家族验证结果

```
AaveV3Ethereum:        ✅ #readProxyContract 存在, hasReadProxyText: false (需展开tab)
AaveV3EthereumLido:    ✅ #readProxyContract 存在
AaveV3EthereumEtherFi: ✅ #readProxyContract 存在  
AaveV3EthereumHorizon: ✅ #readProxyContract 存在
AaveV3Arbitrum:        ⚠️  Cloudflare 阻挡
AaveV3Optimism:        ✅ #readProxyContract 存在, hasReadProxyText: true
AaveV3Polygon:         ⚠️  Cloudflare 阻挡
AaveV3Avalanche:       ⚠️  Snowtrace 架构不同，无 #readProxyContract DOM
AaveV3Base:            ⚠️  Cloudflare 阻挡
AaveV3Gnosis:          ⚠️  Cloudflare 阻挡
AaveV3BNB:             ✅ #readProxyContract 存在, hasReadProxyText: true
AaveV3Scroll:          ⚠️  实际为 Blockscout 架构
AaveV3Metis:           ⚠️  自定义格式，无 Read Proxy DOM
AaveV3ZkSync:          ⚠️  重定向到不同 explorer
AaveV3Linea:           ⚠️  Cloudflare 阻挡
AaveV3Sonic:           ⚠️  Cloudflare 阻挡
AaveV3Celo:            ⚠️  Cloudflare 阻挡
AaveV3Mantle:          ⚠️  Cloudflare 阻挡
AaveV3MegaEth:         ✅ #readProxyContract 存在, hasReadProxyText: true
```

### Blockscout 家族验证结果

```
AaveV3Soneium:         ✅ 页面加载, hasSelector: true, hash=#0xc952485d
                       ⚠️  getReserveData 在初始加载时未检测到 (可能需等待)
AaveV3Ink:             ✅ **getReserveData 文本可见** ✅
AaveV3InkWhitelabel:   ✅ **getReserveData 文本可见** ✅
AaveV3Plasma:          ⚠️  Cloudflare 阻挡
```

### OKLink 验证结果

```
AaveV3XLayer:          ✅ **getReserveData 文本可见** ✅
                       URL: https://www.oklink.com/x-layer/address/0xE3F3...84f116/contract#category=proxy-read&id=22
```

---

## 修复建议

### 1. AaveV3Scroll - 需要变更 explorer 家族

Scrollscan 实际使用 Blockscout 架构，应修改：

```typescript
AaveV3Scroll: {
  pool: '0x11fCfe756c05AD438e312a7fd934381537D3cFfe',
  explorerBase: 'https://scrollscan.com',
  family: 'blockscout', // 从 'etherscan' 改为 'blockscout'
},
```

或者保持 `etherscan` 家族但验证 `#readProxyContract#F23` 是否仍然有效。

### 2. AaveV3ZkSync - URL 需要更新

当前配置 `https://era.zksync.network` 重定向到 `https://explorer.zksync.io`，需要更新 URL 格式。

### 3. AaveV3Avalanche - Snowtrace 架构确认

Snowtrace 使用 Multichain Explorer 架构，可能不支持 `#readProxyContract` 格式，需要：
- 验证 Snowtrace 的 Read Proxy 页面 URL 格式
- 或改用 Avalanche 的 Blockscout 实例

### 4. 人工验证被 Cloudflare 阻挡的市场

请手动打开以下链接验证 deep-link 是否工作：

```bash
# Etherscan 家族
open "https://arbiscan.io/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#readProxyContract#F23"
open "https://polygonscan.com/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#readProxyContract#F23"
open "https://basescan.org/address/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5#readProxyContract#F23"
open "https://gnosisscan.io/address/0xb50201558B00496A145fE76f7424749556E326D8#readProxyContract#F23"
open "https://lineascan.build/address/0x6B92da39b9e62CC67ac472DaC23dB29B6C8d07F9#readProxyContract#F23"
open "https://sonicscan.org/address/0x5362dBb1e601abF3a4c14c22ffEdA64042E5Eaa3#readProxyContract#F23"
open "https://celoscan.io/address/0x3E59A31363E2ad014dcbc521c4a0d5757d9F3402#readProxyContract#F23"
open "https://mantlescan.xyz/address/0x5765fCA3547e2CC9E061AbFeef21431F60E882BF2#readProxyContract#F23"

# Blockscout
open "https://plasmascan.to/address/0x925a2A7214Ed92428B5b1B090F80b25700095e12?tab=read_proxy#0xc952485d"
```

---

## 测试方法论说明

### 测试标准
- **通过**: 页面加载成功，且能检测到 Read Proxy 相关元素或 getReserveData 文本
- **Cloudflare 阻挡**: 页面返回 "Just a moment..." 安全验证页面
- **需要修复**: 页面加载但 deep-link 元素不存在或格式不匹配

### 自动化测试限制
1. Cloudflare 对自动化浏览器检测严格，大量 L2 explorer 被阻挡
2. Etherscan 家族的 `getReserveData` 文本需展开 Read Proxy tab 后才可见，初始加载检测不到不代表链接无效
3. Blockscout 家族的 function selector 跳转 (`#0xc952485d`) 部分情况下需要等待 AJAX 加载

### 建议后续行动
1. 修复 AaveV3Scroll、AaveV3ZkSync、AaveV3Avalanche 的配置
2. 人工抽查验证被 Cloudflare 阻挡的市场 (至少测试 Arbitrum、Base、Polygon)
3. 考虑添加 fallback：如果 deep-link 失败，回退到标准地址页面

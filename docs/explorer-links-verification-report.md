# Explorer Links 验证报告

## 问题汇总

### 1. 地址来源问题
当前 poolExplorerLinks.ts 的地址已对齐 address-book，但仍需自动化 drift 校验和真实浏览器验证：
- [x] ZkSync Pool 地址修正并对齐 address-book
- [x] Plasma Pool 地址修正并对齐 address-book
- [x] Sonic / Celo checksum 修正并对齐 address-book

### 2. Explorer Family 分类错误

| 市场 | 当前分类 | 正确分类 | 备注 |
|------|----------|----------|------|
| AaveV3Scroll | etherscan | **blockscout** | scrollscan.com 实际是 Blockscout |
| AaveV3Plasma | blockscout | **etherscan** | plasmascan.to 属于 Etherscan family |
| AaveV3Avalanche | routescan | **etherscan** | snowscan.xyz 是 Etherscan |
| AaveV3Metis | etherscan | **routescan** | metisscan.info 是 Routescan |

### 3. Explorer Base URL 更新

| 市场 | 当前 URL | 建议更新 |
|------|----------|----------|
| AaveV3ZkSync | https://era.zksync.network | **https://zksync.blockscout.com** |

## 正确的地址获取渠道

### 官方来源
1. **bgd-labs/aave-address-book** (GitHub/npm)
   - 仓库: https://github.com/bgd-labs/aave-address-book
   - npm: `@bgd-labs/aave-address-book`
   - UI: https://search.onaave.com/

2. **Aave 官方文档**
   - 部署地址通常在 governance forum 公布

### 各链 Explorer 类型确认

| 链 | Explorer | 类型 | Deep-link 格式 |
|---|----------|------|----------------|
| Ethereum | etherscan.io | Etherscan | `#readProxyContract#F23` |
| Arbitrum | arbiscan.io | Etherscan | `#readProxyContract#F23` |
| Optimism | optimistic.etherscan.io | Etherscan | `#readProxyContract#F23` |
| Polygon | polygonscan.com | Etherscan | `#readProxyContract#F23` |
| Base | basescan.org | Etherscan | `#readProxyContract#F23` |
| Gnosis | gnosisscan.io | Etherscan | `#readProxyContract#F23` |
| BNB | bscscan.com | Etherscan | `#readProxyContract#F23` |
| Linea | lineascan.build | Etherscan | `#readProxyContract#F23` |
| Sonic | sonicscan.org | Etherscan | `#readProxyContract#F23` |
| Celo | celoscan.io | Etherscan | `#readProxyContract#F23` |
| MegaETH | mega.etherscan.io | Etherscan | `#readProxyContract#F23` |
| Avalanche | snowscan.xyz | **Etherscan** | `#readProxyContract#F23` |
| Metis | metisscan.info | **Routescan** | `/contract/{chainId}/readProxyContract#F23` |
| Scroll | scrollscan.com | **Blockscout** | `?tab=read_proxy#0xc952485d` |
| ZkSync | zksync.blockscout.com | **Blockscout** | `?tab=read_proxy#0xc952485d` |
| Soneium | soneium.blockscout.com | **Blockscout** | `?tab=read_proxy#0xc952485d` |
| Ink | explorer.inkonchain.com | **Blockscout** | `?tab=read_proxy#0xc952485d` |
| Mantle | mantlescan.xyz | **Etherscan** | `#readProxyContract#F23` |
| Plasma | plasmascan.to | **Etherscan** | `#readProxyContract#F23` |
| XLayer | oklink.com | OKLink | 自定义格式 |

## Blockscout 版本的 Chains

根据 blockscout.com 官网，以下链有 Blockscout 版本的 explorer：

- **zksync.blockscout.com** - ZkSync
- **soneium.blockscout.com** - Soneium  
- **explorer.inkonchain.com** - Ink
- **scrollscan.com** - Scroll

## 待确认的问题

### High Priority
1. [x] Linea Pool 合约地址验证
2. [x] Mantle Pool 合约地址验证
3. [x] ZkSync Pool 合约地址验证

### Medium Priority  
4. [ ] Plasma explorer 类型确认（Etherscan vs Blockscout）

6. [ ] Metis readProxyContract 路径格式

### Documentation
7. [ ] 创建 address-book 同步脚本
8. [ ] 更新 poolExplorerLinks.ts 注释文档
9. [ ] 创建 explorer family 分类参考文档

## 验证测试记录

### 2024-XX-XX 测试结果
- ✅ Etherscan (Ethereum): 工作正常
- ✅ Blockscout (Ink): getReserveData 可见
- ✅ OKLink (XLayer): getReserveData 可见
- ⚠️ 多个市场被 Cloudflare 阻挡（Arbitrum, Polygon, Base, Gnosis, Linea, Sonic, Celo, Mantle）
- ❓ Scroll: 页面加载但 explorer 类型可能是 Blockscout
- ❓ Metis: 页面加载但 deep-link 未激活 Read Proxy
- ❓ ZkSync: 重定向到不同 explorer

## 下一步行动

1. 从 bgd-labs/aave-address-book 获取正确的 Linea, Mantle, ZkSync Pool 地址
2. 修正 explorer family 分类（Scroll→Blockscout, Plasma→Etherscan, Avalanche→Etherscan/snowscan.xyz）
3. 更新 ZkSync 的 explorer base URL
4. 重新验证所有链接

# ADR-0020: chainIconMap 迁移到 chain ID 索引

**状态**: Accepted  
**日期**: 2026-07-04  
**关联**: AAV-1051, AAV-1052, AAV-1053, AAV-1055, AAV-1056

## 上下文

chainIconMap 按 chain name 索引 (`Record<string, string>`)，存在两个问题：

1. **name 不一致**：上游 networksConfig 的 name（如 `OP`、`Polygon POS`）与后端 API 的 chainName（如 `Optimism`、`Polygon`）不一致，依赖 normalize 后碰巧匹配
2. **新链被跳过**：sync 脚本 regex 只匹配 `[ChainId.xxx]:` 格式，Aave 新链（Monad、MegaETH）使用 `[xxx.id]:` 格式，导致静默跳过

## 决策

1. **chainIconMap 改为 `Record<number, string>`**：chain ID 是唯一精确标识，不依赖 name 匹配
2. **getChainIconSrc 签名改为 `(chainId: number)`**：所有调用方传 `reserve.chainId` 而非 `reserve.chainName`
3. **orphan reserve chainId fallback 用 `-1`**：0 不是有效 chain ID，-1 明确表示"未知"
4. **sync 脚本 regex 支持 `[xxx.id]:` 格式**：同时匹配 `[ChainId.xxx]:` 和 `[monad.id]:`

## 影响

### 类型变更

- `MarketListItem` 新增 `chainId: number`
- `PortfolioReserveEntry` 新增 `chainId: number`
- `AssetActionMenuProps.chainId` 从 optional 改为 required
- `PortfolioResultsTable.ResultRowData` 新增 `chainId: number`

### 调用方迁移

所有 `getChainIconSrc(chainName)` → `getChainIconSrc(chainId)`，涉及 10+ 组件。

### 教训：`strict: false` 掩盖类型缺失

迁移签名后，`MarketListItem` 和 `PortfolioReserveEntry` 没有 `chainId` 字段，但 `strict: false` 允许 `entry.chainId` 返回 `undefined` 而不报错，导致 FilterBar 和 Portfolio 的链图标全部显示 first-letter fallback。

**结论**：迁移函数签名后，必须检查所有 derived/slim type 是否也包含新字段。`strict: false` 是系统性风险。

## 验证

- 4 项 CI gate 全部通过（lint、test、build、tsc --noEmit）
- Playwright dev server 验证：21 条链图标正常显示、monad.svg 200、无 broken image
- 三方对齐：chainRegistry ↔ chainIconMap ↔ SVG 文件 21 条链完全一致

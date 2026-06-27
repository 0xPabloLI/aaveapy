# ADR 0019: Merit Campaign Date Source — Block Timestamp Instead of Page Text

## Status

Accepted

## Context

Merit campaign 的 `startDate`/`endDate` 当前从 Aave Chan SSR 页面文本提取，格式为 `'Thu Jun 18 2026'`（JavaScript `Date.toString()` 风格）。前端 `parseCampaignBoundaryMs` 对非 `YYYY-MM-DD` 格式走 `Date.parse()` 分支，按本地时区解析为午夜 → UTC 减 8 小时。导致 endDate 为当天的 campaign 在 UTC 时区下被提前判定过期，UI 不显示。

同时 Merkl/Brevis 的日期来源是结构化 API 返回的 Unix 时间戳，后端统一转为 ISO 格式，不存在时区问题。三种 incentive 类型的日期格式不统一增加了前端解析的分支逻辑。

## Decision

将 Merit 日期来源从"Aave Chan SSR 页面文本提取"改为"链上 block number → Ethereum RPC `eth_getBlockByNumber` → ISO timestamp"。删除 `extractDatesFromDom` 和 `extractDatesWithRegex` 函数，将 `extractBlockNumbers` + `convertBlocksToDates` 提升为唯一日期获取路径。

### 核心设计决策

1. **Merit block 都在 Ethereum 主网**：Aave Chan 页面中 `etherscan.io/block/` 链接的 block number 是 Ethereum 主网的，不是 campaign 对应链（如 Celo）的。旧代码按 key 解析 chainName（如 `celo-supply-usdt` → Celo RPC）查询 block，导致查询到错误链上的 block 数据。

2. **未来 block 的 endDate 估算**：endBlock 尚未被打到时，RPC 返回 null。采用与 Aave Chan 页面一致的估算方式：`endDate = startBlockTimestamp + (endBlock - startBlock) × 12s/block`。Ethereum 平均出块时间 12 秒，估算误差通常在 ±1 天以内。

3. **ISO 日期格式校验**：`isCachedTimeRangeComplete` 和 `loadCachedMeritCampaignMetadata` 新增 `ISO_DATE_PATTERN` 校验，旧格式文本日期（如 `Wed Jun 17 2026`）的缓存条目被标记为不完整，自动触发重新获取。这确保旧缓存不会阻止新代码的 ISO 格式数据写入。

### 具体变更

- 后端：`fetchMeritTimeRange` 从三层策略（DOM→正则→block）简化为唯一路径（block→Ethereum RPC→ISO）
- 后端：`getBlockTimestamp` → `getEthereumBlockTimestamp`，始终用 Ethereum RPC
- 后端：新增 `estimateEndBlockTimestamp`，基于 `ETHEREUM_AVERAGE_BLOCK_TIME_S = 12` 估算未来 block
- 后端：`convertBlocksToDates` 移除 `chainName` 参数，返回 `startDateSource`/`endDateSource` 用于日志追踪
- 后端：删除 `extractDatesFromDom`、`extractDatesWithRegex`、`normalizeDateToIso`
- 没有 etherscan block 链接的 campaign 返回空日期，不显示
- 前端逻辑不需要修改（ISO 格式走 `Date.parse()` 无时区偏差）。去重重构：`meritForecast.ts` 和 `rateSimulationCalculator.ts` 中的 `parseCampaignBoundaryMs` 本地副本已替换为从 `campaignGroups.ts` 导入
- `startBlock`/`endBlock` 不暴露到 API 响应

## Consequences

**Positive:**
- Merit 日期精确到区块级秒数，与链上实际时间一致
- 三种 incentive 日期格式统一为 ISO，消除前端时区解析问题
- 删除约 100 行不再需要的文本日期提取代码
- 旧格式缓存自动淘汰，无需手动清理

**Negative:**
- 没有 etherscan block 链接的 Merit campaign 将没有日期、不显示。当前所有已知 campaign 都有 block 链接
- 增加 Ethereum RPC 调用（每个 campaign 2 次 `eth_getBlockByNumber`）。已在旧 P3 路径中存在，只是现在成为唯一路径
- endBlock 未打出时 endDate 为估算值（±1 天误差），不是精确值。与 Aave Chan 页面显示一致
- 后端数据源切换不可逆：删除了文本日期提取代码，未来如需回退需要重写。前端 `parseCampaignBoundaryMs` 对旧格式和 ISO 格式均能解析，不存在前端侧不可逆性

**Technical Debt:**
- ~~`meritForecast.ts` 中存在 `parseCampaignBoundaryMs` 的本地副本~~ — 已修复，替换为从 `campaignGroups.ts` 导入
- ~~`rateSimulationCalculator.ts` 中存在 `parseBoundaryMs` 的本地副本~~ — 已修复，替换为从 `campaignGroups.ts` 导入

## Alternatives Considered

1. **保留 P1/P2 作为 fallback**：文本日期虽不精确但聊胜于无。被否决——不精确的日期比没有日期更危险（错误显示 vs 不显示）
2. **前端修复时区解析**：在 `parseCampaignBoundaryMs` 中对非 ISO 格式做 endDate 修正。被否决——治标不治本，根因在后端格式不标准
3. **后端将文本日期转为 ISO 再输出**：保留 P1/P2 提取但输出时统一转 ISO。被否决——文本日期本身不精确（只有日期没有时间），转 ISO 后仍然丢失精度
4. **Etherscan 式做法——未来 block 不显示日期**：Etherscan 对未打到的 block 不显示 Timestamp。被否决——用户需要知道 campaign 大约何时结束，空 endDate 的 UX 不好

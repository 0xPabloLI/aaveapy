# ADR 0019: Merit Campaign Date Source — Block Timestamp Instead of Page Text

## Status

Accepted

## Context

Merit campaign 的 `startDate`/`endDate` 当前从 Aave Chan SSR 页面文本提取，格式为 `'Thu Jun 18 2026'`（JavaScript `Date.toString()` 风格）。前端 `parseCampaignBoundaryMs` 对非 `YYYY-MM-DD` 格式走 `Date.parse()` 分支，按本地时区解析为午夜 → UTC 减 8 小时。导致 endDate 为当天的 campaign 在 UTC 时区下被提前判定过期，UI 不显示。

同时 Merkl/Brevis 的日期来源是结构化 API 返回的 Unix 时间戳，后端统一转为 ISO 格式，不存在时区问题。三种 incentive 类型的日期格式不统一增加了前端解析的分支逻辑。

## Decision

将 Merit 日期来源从"Aave Chan SSR 页面文本提取"改为"链上 block number → RPC `eth_getBlockByNumber` → ISO timestamp"。删除 `extractDatesFromDom` 和 `extractDatesWithRegex` 函数，将 `extractBlockNumbers` + `convertBlocksToDates` 提升为唯一日期获取路径。

具体变更：
- 后端：`fetchMeritTimeRange` 从三层策略（DOM→正则→block）简化为唯一路径（block→RPC→ISO）
- 没有 etherscan block 链接的 campaign 返回空日期，不显示
- 前端代码不需要修改（ISO 格式走 `Date.parse()` 无时区偏差）。`meritForecast.ts` 中的 `parseCampaignBoundaryMs` 本地副本代码与 `campaignGroups.ts` 导出版本一致，对 ISO 格式同样正常工作
- `startBlock`/`endBlock` 不暴露到 API 响应

## Consequences

**Positive:**
- Merit 日期精确到区块级秒数，与链上实际时间一致
- 三种 incentive 日期格式统一为 ISO，消除前端时区解析问题
- 删除约 100 行不再需要的文本日期提取代码

**Negative:**
- 没有 etherscan block 链接的 Merit campaign 将没有日期、不显示。当前所有已知 campaign 都有 block 链接
- 增加 RPC 调用（每个 campaign 2 次 `eth_getBlockByNumber`）。已在旧 P3 路径中存在，只是现在成为唯一路径
- 不可逆：删除了文本日期提取代码，未来如需回退需要重写

**Technical Debt:**
- `meritForecast.ts` 中存在 `parseCampaignBoundaryMs` 的本地副本（与 `campaignGroups.ts` 导出版本重复）。本次不修改，但应跟踪为独立技术债

## Alternatives Considered

1. **保留 P1/P2 作为 fallback**：文本日期虽不精确但聊胜于无。被否决——不精确的日期比没有日期更危险（错误显示 vs 不显示）
2. **前端修复时区解析**：在 `parseCampaignBoundaryMs` 中对非 ISO 格式做 endDate 修正。被否决——治标不治本，根因在后端格式不标准
3. **后端将文本日期转为 ISO 再输出**：保留 P1/P2 提取但输出时统一转 ISO。被否决——文本日期本身不精确（只有日期没有时间），转 ISO 后仍然丢失精度

# V3 vs V4 SDK 字段映射对比

本文档系统记录 Aave V3 与 V4 市场数据各字段的 SDK 来源差异、处理方法、前端映射及 V4 Hub/Spoke 级别。

> **精度统一（已完成）**：所有百分比字段已统一为 `number`、单位 %（例如 `9` = 9%）。详见 `v3-v4-precision-unification-plan.md` 的完整精度表。

## 概述

| 维度 | V3 | V4 |
|------|-----|-----|
| **SDK 方法** | `markets()` → `market.supplyReserves[]` | 独立 GraphQL 查询 |
| **数据结构** | 扁平 reserve 列表 | Hub & Spoke 模型 |
| **处理文件** | `src/index.ts` | `src/v4-fetcher.ts` |
| **核心函数** | `buildV3BaseDataset()` | `fetchV4MarketsDataInner()` → 内联循环 |
| **Reserve ID 格式** | `{market}:{chainId}:{token}` | `{market}:{chainId}:{token}:{hubName}` |
| **HTTP 请求数** | 1 次 `markets()` 覆盖多链 | `chains()` + `hubs()` + `reserves()`（**不再调用 `hubAssets()`**） |

**V4 数据来源（精度统一后）**：
- 所有 hub 级参数（utilization / 利率曲线 / availableLiquidity / 费率等）已包含在 `reserve.asset.summary` 与 `reserve.asset.settings` 中。
- 因此 V4 fetcher **已删除 `fetchHubAssetIndex()` / `hubAssets()` 预取调用**，单次 `reserves()` 查询即可一次性拿到所有需要的数据。
- 客户端 `@aave/client-v4` 底层是 urql；如未来需要再次扩展并行查询，urql 默认开启 `batch: true` 会把同 tick 的 query 合并为一次 HTTP POST，无需额外配置。

**V4 数据级别说明**：
- **Reserve 级别**: 数据直接来自 `r`（reserve 对象本身），每个 reserve 独立。
- **Hub 级别**: 数据来自 `r.asset.summary` / `r.asset.settings`（asset = HubAsset，绑定到 reserve 所属的 hub），同一 hub 内多个 reserves 拿到的值相同。

**判断依据**：
- Hub 级别的字段 = 共享的协议参数（利率曲线、费率、利用率、Hub 池流动性等）
- Reserve 级别的字段 = 每个 reserve 独立的状态（spoke 上的 supplied/borrowed、cap、APY 通过 utilization+利率参数实时算出）

---

## 核心字段对比表

### 基础信息字段

| API 字段 | 类型 / 精度 | 前端展示 | V4 级别 | V4 SDK 路径 | V4 处理函数 | V4 处理方法 | V3 SDK 路径 | V3 处理函数 | V3 处理方法 |
|----------|------------|----------|---------|-------------|-------------|-------------|-------------|-------------|-------------|
| **reserveId** | `string` | - | Reserve | 构造: `${market}:${chainId}:${token}:${hubName}` | `fetchV4MarketsDataInner()` 内联 | 字符串拼接 | 构造: `${market}:${chainId}:${token}` | `buildV3BaseDataset()` | 字符串拼接 |
| **marketName** | `string` | Market 列 | Reserve | 构造: `AaveV4${spokeName}` | `fetchV4MarketsDataInner()` 内联 | `spokeName.replace(/\s+/g, '')` 后拼接 | `market.name` | `buildV3BaseDataset()` | 直接使用 |
| **chainName** | `string` | Market 列 | Reserve | `r.chain?.name ?? 'Unknown'` | `fetchV4MarketsDataInner()` 内联 | 带默认值取值 | `market.chain?.name` | `buildV3BaseDataset()` | 直接取值 |
| **chainId** | `number`, 整数 | - | Reserve | `Number(r.chain?.chainId ?? 0)` | `fetchV4MarketsDataInner()` 内联 | 转数字并带默认值 | `market.chain?.chainId` | `buildV3BaseDataset()` | 直接取值 |
| **tokenName** | `string` | Token 名称 | Reserve | `r.asset?.underlying?.info?.name ?? 'Unknown'` | `fetchV4MarketsDataInner()` 内联 | 带默认值取值 | `reserve.underlyingToken?.name` | `buildV3BaseDataset()` | 直接取值 |
| **tokenSymbol** | `string` | Token 列 | Reserve | `r.asset?.underlying?.info?.symbol ?? 'Unknown'` | `fetchV4MarketsDataInner()` 内联 | 带默认值取值 | `reserve.underlyingToken?.symbol` | `buildV3BaseDataset()` | 直接取值 |
| **tokenAddress** | `string` (EVM address) | 合约地址 | Reserve | `r.asset?.underlying?.address ?? ''` | `fetchV4MarketsDataInner()` 内联 | 带默认值取值 | `reserve.underlyingToken?.address` | `buildV3BaseDataset()` | 直接取值 |
| **decimals** | `number`, 整数 | 精度换算除数 | Reserve | `r.asset?.underlying?.info?.decimals ?? undefined` | `fetchV4MarketsDataInner()` 内联 | 带默认值取值 | `reserve.underlyingToken?.decimals` | `buildV3BaseDataset()` | 直接取值 |

### 价格与规模字段

| API 字段 | 类型 / 精度 | 前端展示 | V4 级别 | V4 SDK 路径 | V4 处理函数 | V4 处理方法 | V3 SDK 路径 | V3 处理函数 | V3 处理方法 |
|----------|------------|----------|---------|-------------|-------------|-------------|-------------|-------------|-------------|
| **tokenPrice** | `number`, USD/token | Price 列 | Reserve | `r.summary?.supplied?.exchangeRate` | `fetchV4MarketsDataInner()` 内联 | `toFiniteNumber()` 转换 | `reserve.size?.usdPerToken` ?? `reserve.usdExchangeRate` | `buildV3BaseDataset()` | `toFiniteNumber()` 取首个有效值 |
| **reserveSizeUsd** | `number`, USD | Size 列 / Total supplied | Reserve | `r.summary?.supplied?.exchange` | `fetchV4MarketsDataInner()` 内联 | `toFiniteNumber(r.summary?.supplied?.exchange) ?? undefined` | `reserve.size?.usd` | `buildV3BaseDataset()` | `toFiniteNumber(reserve?.size?.usd) ?? undefined` |
| supplyCapUsd | `number`, USD | Supply cap / CapProgressRing | **Reserve** | `r.settings?.supplyCap?.exchange` | `fetchV4MarketsDataInner()` 内联 | `toFiniteNumber(r.settings?.supplyCap?.exchange) ?? undefined` | `reserve.supplyInfo?.supplyCap?.usd` | `buildV3BaseDataset()` | `toFiniteNumber(supplyCapUsdRaw) ?? undefined` |
| **borrowCapUsd** | `number`, USD | Borrow cap / CapProgressRing | **Reserve** | `r.settings?.borrowCap?.exchange` | `fetchV4MarketsDataInner()` 内联 | `toFiniteNumber(r.settings?.borrowCap?.exchange) ?? undefined` | `reserve.borrowInfo?.borrowCap?.usd` | `buildV3BaseDataset()` | `toFiniteNumber(borrowCapUsdRaw) ?? undefined` |
| **reserveSize** | `string`, raw token units | 后端派生 suppliable 用 | Reserve | `r.summary?.supplied?.amount?.onChainValue` | `fetchV4MarketsDataInner()` 内联 | `onChainValue.toString()` | `reserve.size?.amount?.raw` | `buildV3BaseDataset()` | 直接取值或 `undefined` |
| **supplyCap** | `string`, raw token units | 后端派生 suppliable 用 | Reserve | `r.settings?.supplyCap?.amount?.onChainValue` | `fetchV4MarketsDataInner()` 内联 | `onChainValue.toString()` | `reserve.supplyInfo?.supplyCap?.amount?.raw` | `buildV3BaseDataset()` | 直接取值或 `undefined` |
| **borrowCap** | `string`, raw token units | 后端派生 borrowable 用 | Reserve | `r.settings?.borrowCap?.amount?.onChainValue` | `fetchV4MarketsDataInner()` 内联 | `onChainValue.toString()` | `reserve.borrowInfo?.borrowCap?.amount?.raw` | `buildV3BaseDataset()` | 直接取值或 `undefined` |
| **availableLiquidityUsd** | `number`, USD | 后端提供 | **Hub** | `r.asset.summary.availableLiquidity.exchange.value` | `fetchV4MarketsDataInner()` 内联 | `toFiniteNumber()` | `reserve.borrowInfo?.availableLiquidity?.usd` | `buildV3BaseDataset()` | 直接取值或 `undefined` |
| **totalVariableDebtUsd** | `number`, USD | 后端提供 | Reserve | `r.summary?.borrowed?.exchange` | `fetchV4MarketsDataInner()` 内联 | `toFiniteNumber()` | `reserve.borrowInfo?.total?.usd` | `buildV3BaseDataset()` | 直接取值或 `undefined` |
| **suppliable** | `string`, raw token units | 后端派生 | Reserve | 派生: `max(0, supplyCap − reserveSize)` | `fetchV4MarketsDataInner()` 内联 | 服务端计算 | 派生 | `buildV3BaseDataset()` | 服务端计算 |
| **suppliableUsd** | `number`, USD | 后端派生 | Reserve | 派生: `max(0, supplyCapUsd − reserveSizeUsd)` | `fetchV4MarketsDataInner()` 内联 | 服务端计算 | 派生 | `buildV3BaseDataset()` | 服务端计算 |
| **borrowable** | `string`, raw token units | 后端派生 | Reserve | 派生: `max(0, min(borrowCap−debt, availableLiquidity))` | `fetchV4MarketsDataInner()` 内联 | 服务端计算 | 派生 | `buildV3BaseDataset()` | 服务端计算 |
| **borrowableUsd** | `number`, USD | 后端派生 | Reserve | 派生: `max(0, min(borrowCapUsd−debtUsd, availableLiquidityUsd))` | `fetchV4MarketsDataInner()` 内联 | 服务端计算 | 派生 | `buildV3BaseDataset()` | 服务端计算 |

### APY 与利率字段

| API 字段 | 类型 / 精度 | 前端展示 | V4 级别 | V4 SDK 路径 | V4 处理函数 | V4 处理方法 | V3 SDK 路径 | V3 处理函数 | V3 处理方法 |
|----------|------------|----------|---------|-------------|-------------|-------------|-------------|-------------|-------------|
| **supplyApy** | `number`, percent (e.g., `2.07` = 2.07%) | Supply > Native | **Hub** | `r.summary?.supplyApy?.value` | `fetchV4MarketsDataInner()` 内联 | `toFiniteNumber(r.summary?.supplyApy?.value) ?? undefined` | `reserve.supplyInfo?.apy?.value` | `buildV3BaseDataset()` | 若 `supplyCap === 1` 则为 `undefined`，否则 `toFiniteNumber(supplyApyValue)` |
| **borrowApy** | `number`, percent | Borrow > Native | **Hub** | `r.summary?.borrowApy?.value` | `fetchV4MarketsDataInner()` 内联 | `toFiniteNumber(r.summary?.borrowApy?.value) ?? undefined` | `reserve.borrowInfo?.apy?.value` | `buildV3BaseDataset()` | `toFiniteNumber(borrowApyValue) ?? undefined` |
| **utilizationPct** | `number`, percent (e.g., `45.2` = 45.2%) | Utilization 列 / Util% 指示条 | **Hub** | `r.asset.summary.utilizationRate.value` | `fetchV4MarketsDataInner()` 内联 | `percentNumberToPercent()` = `value × 100` | `reserve.borrowInfo?.utilizationRate?.value` | `buildV3BaseDataset()` | `percentFromV3()` = `value × 100` |
| **availableLiquidity** | `string`, raw token units | 后端子段 | **Hub** | `r.asset.summary.availableLiquidity.amount.onChainValue` | `fetchV4MarketsDataInner()` 内联 | `onChainValue.toString()` | `reserve.borrowInfo?.availableLiquidity?.amount?.raw` | `buildV3BaseDataset()` | 直接取值或 `undefined` |
| **totalVariableDebt** | `string`, raw token units | Total borrowed / Borrow Size | Reserve | `r.summary?.borrowed?.amount?.onChainValue` | `fetchV4MarketsDataInner()` 内联 | `onChainValue.toString()` | `reserve.borrowInfo?.total?.amount?.raw` | `buildV3BaseDataset()` | 直接取值或 `undefined` |

### 利率模型参数字段（已统一为 percent number）

> **精度统一已完成**：以下 5 个字段均已从 RAY/bps string 改为 `number` percent（例如 `reserveFactor: 10` = 10%、`variableRateSlope1: 4` = 4%）。前端 `interestRateCalculator.ts` 已从 BigInt RAY 数学重写为 Float 百分数直接计算。

| API 字段 | 类型 / 精度 | 前单位 | 现单位 | 前端使用 | V4 级别 | V4 SDK 路径 | V4 处理方法 | V3 SDK 路径 | V3 处理方法 |
|----------|------------|--------|--------|----------|---------|-------------|-------------|-------------|-------------|
| **reserveFactor** | `number`, percent | bps string | percent | `useRateSimulation` / rate calc | **Hub** | `r.asset.settings.liquidityFee.value` | `percentNumberToPercent()` = `value × 100` | `reserve.borrowInfo?.reserveFactor.value` | `percentFromV3()` = `value × 100` |
| **variableRateSlope1** | `number`, percent | RAY string | percent | `useRateSimulation` / rate calc | **Hub** | `r.asset.settings.slopeBelowOptimal.value` | `percentNumberToPercent()` = `value × 100` | `reserve.borrowInfo?.variableRateSlope1.value` | `percentFromV3()` = `value × 100` |
| **variableRateSlope2** | `number`, percent | RAY string | percent | `useRateSimulation` / rate calc | **Hub** | `r.asset.settings.slopeAboveOptimal.value` | `percentNumberToPercent()` = `value × 100` | `reserve.borrowInfo?.variableRateSlope2.value` | `percentFromV3()` = `value × 100` |
| **optimalUsageRate** | `number`, percent | RAY string | percent | "Optimal" 标记 / UtilizationSheet | **Hub** | `r.asset.settings.optimalUtilizationRate.value` | `percentNumberToPercent()` = `value × 100` | `reserve.borrowInfo?.optimalUsageRate.value` | `percentFromV3()` = `value × 100` |
| **baseVariableBorrowRate** | `number`, percent | RAY string | percent | `useRateSimulation` / rate calc | **Hub** | `r.asset.settings.baseBorrowRate.value` | `percentNumberToPercent()` = `value × 100` | 链上 RPC (`UiPoolDataProvider`) 或 APY→APR 反推 | `calculateBaseRateFallback()` 输出 percent number（不再 RAY） |

### 合约地址字段

| API 字段 | 前端使用 | V4 级别 | V4 SDK 路径 | V4 处理函数 | V4 处理方法 | V3 SDK 路径 | V3 处理函数 | V3 处理方法 |
|----------|----------|---------|-------------|-------------|-------------|-------------|-------------|-------------|
| **aTokenAddress** | - | N/A | N/A | `fetchV4MarketsDataInner()` 内联 | 固定填 `null` (V4 无 aToken) | `reserve.aToken?.address` | `buildV3BaseDataset()` | 直接取值或 `null` |
| **vTokenAddress** | - | N/A | N/A | `fetchV4MarketsDataInner()` 内联 | 固定填 `null` (V4 无 vToken) | `reserve.vToken?.address` | `buildV3BaseDataset()` | 直接取值或 `null` |
| **hubId** | 拼接待用 (`pro.aave.com/explore/hub/${hubId}`) | **Hub** | `hub?.id` | `fetchV4MarketsDataInner()` 内联 | `String(hub.id)` 转字符串 | N/A | N/A | N/A |
| **hubName** | 显示 Hub 名称 (如 "Core") | **Hub** | `hub?.name` | `fetchV4MarketsDataInner()` 内联 | 直接取值 | N/A | N/A | N/A |
| **hubAddress** | 合约交互用 | **Hub** | `hub?.address` | `fetchV4MarketsDataInner()` 内联 | 直接取值 | N/A | N/A | N/A |
| **spokeId** | 拼接待用 | Reserve | `spoke?.id` | `fetchV4MarketsDataInner()` 内联 | `String(spoke.id)` 转字符串 | N/A | N/A | N/A |
| **spokeName** | 显示 Spoke 名称 (如 "Main") | Reserve | `spoke?.name` | `fetchV4MarketsDataInner()` 内联 | 直接取值 | N/A | N/A | N/A |
| **spokeAddress** | 合约交互用 (市场入口) | Reserve | `spoke?.address` | `fetchV4MarketsDataInner()` 内联 | 直接取值 | N/A | N/A | N/A |
| **aaveProReserveId** | pro.aave.com 深链拼接用 | Reserve | `r.id` | `fetchV4MarketsDataInner()` 内联 | `String(r.id)` 转字符串 | N/A | N/A | N/A |

### 状态与开关字段

| API 字段 | 前端展示 | V4 级别 | V4 SDK 路径 | V4 处理函数 | V4 处理方法 | V3 SDK 路径 | V3 处理函数 | V3 处理方法 |
|----------|----------|---------|-------------|-------------|-------------|-------------|-------------|-------------|
| **supplyDisabled** | Supply unavailable tooltip | Reserve | `!r.canSupply` | `fetchV4MarketsDataInner()` 内联 | 直接取反 `canSupply` 布尔值 | 派生 | `buildV3BaseDataset()` | `isFrozen \|\| isPaused \|\| supplyCap === 1` |
| **borrowDisabled** | Borrow disabled tooltip | Reserve | `!r.canBorrow` | `fetchV4MarketsDataInner()` 内联 | 直接取反 `canBorrow` 布尔值 | 派生 | `buildV3BaseDataset()` | `borrowingState === "DISABLED" \|\| borrowCap === 1` |
| **isFrozen** | Frozen badge + ❄ icon | Reserve | `r.status?.frozen` | `fetchV4MarketsDataInner()` 内联 | `=== true` 判断 | `reserve.isFrozen` | `buildV3BaseDataset()` | `=== true` 判断 |
| **isPaused** | Paused badge + ❄ icon | Reserve | `r.status?.paused` | `fetchV4MarketsDataInner()` 内联 | `=== true` 判断 | `reserve.isPaused` | `buildV3BaseDataset()` | `=== true` 判断 |

### 激励字段 (外部数据源，均 percent number)

| API 字段 | 类型 / 精度 | 前端展示 | V4 级别 | V4 来源 | V4 处理函数 | V4 处理方法 | V3 来源 | V3 处理函数 | V3 处理方法 |
|----------|------------|----------|---------|---------|-------------|-------------|---------|-------------|-------------|
| **supplyIncentives** | `number[]`, percent | Protocol Incentive | Reserve | SDK: `r.summary?.rewards` | `fetchV4MarketsDataInner()` 内联 | **通常跳过** (内部积分，非公开 Merkl) | SDK: `reserve.incentives` | `buildV3BaseDataset()` | 遍历 `incentives` 数组，过滤 `__typename === 'AaveSupplyIncentive'`，提取 `extraSupplyApr` 或 `supplyApr` |
| **borrowIncentives** | `number[]`, percent | Protocol Incentive | Reserve | SDK: `r.summary?.rewards` | `fetchV4MarketsDataInner()` 内联 | **通常跳过** (内部积分，非公开 Merkl) | SDK: `reserve.incentives` | `buildV3BaseDataset()` | 同上，过滤 `AaveBorrowIncentive` |
| **meritSupplys** / **meritBorrows** | `MeritIncentive[]` (`.apr`, `.selfApr` 均为 `number`, percent) | ACI Incentive | 外部 | Merit API | `index.ts:enrichDatasetWithIncentiveData()` | 外部 enrich 阶段匹配 | Merit API | `index.ts:enrichDatasetWithIncentiveData()` | 外部 enrich 阶段匹配 |
| **merklSupplys** / **merklBorrows** / **merklHolds** | `MerklOpportunityGroup[]` (`.campaignApr` / `.aprCap` 均为 `number`, percent) | Merkl Incentive | 外部 | Merkl API | `index.ts:enrichDatasetWithIncentiveData()` | 外部 enrich 阶段匹配 | Merkl API | `index.ts:enrichDatasetWithIncentiveData()` | 外部 enrich 阶段匹配 |
| **brevisSupplys** / **brevisBorrows** | `BrevisIncentive[]` (`.campaignApr` 为 `number`, percent) | Brevis Incentive | 外部 | Brevis API | `index.ts:enrichDatasetWithIncentiveData()` | 外部 enrich 阶段匹配 | Brevis API | `index.ts:enrichDatasetWithIncentiveData()` | 外部 enrich 阶段匹配 |

### 特殊字段

| API 字段 | 类型 / 精度 | 前端展示 | V4 级别 | V4 SDK 路径 | V4 处理函数 | V4 处理方法 | V3 SDK 路径 | V3 处理函数 | V3 处理方法 |
|----------|------------|----------|---------|-------------|-------------|-------------|-------------|-------------|-------------|
| **deficit** | `string`, raw token units | Deficit / Def% / Size 列 Deficit 行 | N/A | N/A (SDK 不提供) | 默认 `'0'` | 默认 `'0'` | 链上 RPC (`UiPoolDataProvider`) | `onchainDataService.refreshOnchainCache()` | 从 RPC 读取，失败则默认 `'0'` |
| **borrowingState** | `string` (V3 only) | 用于判断 borrow 是否 DISABLED | Reserve | 待确认 V4 对应字段 | `fetchV4MarketsDataInner()` 内联 | 未直接提供，通过 `canBorrow` 间接判断 | `reserve.borrowInfo?.borrowingState` | `buildV3BaseDataset()` | 直接取值用于判断 |

---

## V4 Hub 级别字段汇总

以下 V4 字段绑定到 reserve 所属 hub 的 **HubAsset**（即 `r.asset`），同一 hub 内多个 reserves 拿到的值相同。**精度统一后所有字段都是直接从 reserve 对象读取，不再有 hubAssets 二次预取。**

| 字段 | 类型 / 精度 | 说明 | V4 SDK 路径 (`a = r.asset`) | 为什么共享 |
|------|------------|------|---------------|----------|
| `utilizationPct` | `number`, percent | 资金利用率 | `a.summary.utilizationRate.value × 100` | 基于 Hub 总流动性计算 |
| `availableLiquidity` | `string`, raw token units | 可用流动性 | `a.summary.availableLiquidity.amount.onChainValue` | Hub 级别流动性池 |
| `availableLiquidityUsd` | `number`, USD | Hub 可用流动性 USD | `a.summary.availableLiquidity.exchange.value` | Hub 级别 |
| `reserveFactor` | `number`, percent | 储备因子 | `a.settings.liquidityFee.value × 100` | Hub 级别的费率策略 |
| `variableRateSlope1` | `number`, percent | 利率曲线斜率 1 | `a.settings.slopeBelowOptimal.value × 100` | 同一 Hub 利率模型共享 |
| `variableRateSlope2` | `number`, percent | 利率曲线斜率 2 | `a.settings.slopeAboveOptimal.value × 100` | 同一 Hub 利率模型共享 |
| `optimalUsageRate` | `number`, percent | 最优利用率 | `a.settings.optimalUtilizationRate.value × 100` | 同一 Hub 利率模型共享 |
| `baseVariableBorrowRate` | `number`, percent | 基础借款利率 | `a.settings.baseBorrowRate.value × 100` | 同一 Hub 利率模型共享 |
| `hubId` | `string` | Hub ID | `a.hub.id` | Hub 标识 |
| `hubName` | `string` | Hub 名称 | `a.hub.name` | Hub 标识 |
| `hubAddress` | `string` (EVM) | Hub 合约地址 | `a.hub.address` | Hub 标识 |

**重要提示 - SDK 字段结构差异**：

V4 SDK 返回的 HubSummary 字段有不同结构（通过 `r.asset.hub.summary` 或 `hubAsset.hub.summary` 访问）：

```typescript
// 1. ExchangeAmountWithChange (totalSupplied, totalBorrowed)
// 结构: { __typename: "ExchangeAmountWithChange", current: { __typename: "ExchangeAmount", value: string } }
hub.summary?.totalSupplied?.current?.value
hub.summary?.totalBorrowed?.current?.value

// 2. ExchangeAmount (totalSupplyCap, totalBorrowCap)
// 结构: { __typename: "ExchangeAmount", value: string }
hub.summary?.totalSupplyCap?.value
hub.summary?.totalBorrowCap?.value

// 3. Erc20Amount (HubAssetSummary.borrowed, availableLiquidity)
// 结构: { __typename: "Erc20Amount", amount: { onChainValue: string } }
asset.summary?.borrowed?.amount?.onChainValue
asset.summary?.availableLiquidity?.amount?.onChainValue
```

**注意**：`supplyCapUsd` 和 `borrowCapUsd` 是 **Reserve 级别** 字段，来自 `ReserveSettings`（`r.settings.supplyCap.exchange` / `r.settings.borrowCap.exchange`），不是 Hub 级别。HubAssetSettings 没有 supplyCap/borrowCap 字段。

**Reserve 级别但依赖 Hub 参数的字段**：

| 字段 | V4 实际级别 | 说明 |
|------|-------------|------|
| `reserveSizeUsd` | Reserve | 每个 reserve 独立的实际供应额（Spoke 级别） |
| `totalVariableDebt` | Reserve | 每个 reserve 独立的实际借款额（Spoke 级别） |

**重要澄清 - 为什么 `supplyApy`/`borrowApy` 是 Hub 级别**：

虽然这两个值从 `r.summary`（reserve 对象）获取，但它们在 V4 中是 **Hub 级别** 的：

1. **计算公式**：APY = f(utilizationPct, 利率模型参数)，其中 utilizationPct 和利率参数都是 Hub 级别的
2. **实际表现**：同一 Hub 内所有 Spoke 的 `supplyApy` 和 `borrowApy` 值**完全相同**
3. **架构原因**：V4 的利率模型在 Hub 层统一计算，然后应用到所有 Spoke

这与 V3 形成对比：V3 中每个 reserve 有独立的利率参数，所以 APY 可以不同；V4 中同一 Hub 内所有 reserves 的 APY 必然相同。

---

## 前端派生值计算公式（带 V4 级别标注）

来自 `docs/api/field-glossary.md`:

| 派生值 | V4 级别 | 公式 | 代码位置 | 说明 |
|--------|---------|------|---------|------|
| **Size 列派生值** |
| Total Supplied | Reserve | `reserveSizeUsd` (API 直接提供) | `marketsApiSerialize.ts` | 市场总供应量 |
| Total Borrowed (USD) | Reserve | `totalVariableDebt / 10^decimals * tokenPrice` | `scenarioSize.ts:106-119` | 每个 reserve 独立的借款总额 |
| Deficit (USD) | N/A | `deficit / 10^decimals * tokenPrice` | `deficit.ts:91-98` | V3 only，V4 默认 '0' |
| Deficit Share Ratio | N/A | `deficitUsd / (deficitUsd + totalSuppliedUsd)` | `deficit.ts:100-111` | V3 only |
| **Util 列派生值** |
| Utilization | **Hub** | `utilizationPct` (API 直接提供) | `marketsApiSerialize.ts` | Hub 级利用率 |
| Liquidity (USD) | **Hub** | `availableLiquidity / 10^decimals * tokenPrice` | `scenarioSize.ts:139-152` | 基于 Hub 级 availableLiquidity |
| **Cap 相关派生值** |
| Available to Supply | **Reserve** | `min(hubRemainingSupplyCap, spokeSupplyCapUsd - reserveSizeUsd)` | 派生 | Hub remaining + Spoke cap 取较小 |
| Supply Cap % | **Reserve** | `reserveSizeUsd / min(spokeSupplyCapUsd, hubSupplyCapUsd) * 100` | 派生 | Spoke 实际供应 / 实际可用上限 |
| Borrow Cap % | **Reserve** | `borrowedUsd / min(spokeBorrowCapUsd, hubBorrowCapUsd) * 100` | 派生 | Spoke 实际借款 / 实际可用上限 |
| Borrow Avail (Available to Borrow) | **Reserve** | `min(spokeBorrowCapUsd - borrowedUsd, hubLiquidityUsd)` | `scenarioSize.ts:173-193` | Spoke cap - Hub liquidity 取较小 |
| **Supply/Borrow 列派生值** |
| Total Supply APY | **Hub** | `supplyApy + sum(supplyIncentives) + sum(meritSupplys) + sum(merklSupplys) + sum(brevisSupplys)` | `formatters.ts:371-374` | 基于 Hub 级 supplyApy 计算 |
| Total Borrow APY | **Hub** | `borrowApy - sum(borrowIncentives) - sum(meritBorrows) - sum(merklBorrows) - sum(brevisBorrows)` | `formatters.ts:384-388` | 基于 Hub 级 borrowApy 计算 |
| Supply Incentive APY | 外部 | `sum(supplyIncentives) + sum(meritSupplys) + sum(merklSupplys) + sum(brevisSupplys)` | `formatters.ts` | 外部激励合计 |
| Borrow Incentive APY | 外部 | `sum(borrowIncentives) + sum(meritBorrows) + sum(merklBorrows) + sum(brevisBorrows)` | `formatters.ts` | 外部激励合计 |
| **Spread 列** |
| Spread | **Hub** | `totalSupplyApy - totalBorrowApy` | `formatters.ts:392-395` | 基于两个 Hub 级 APY 计算 |

---

## 可复用函数抽象建议

### 1. `toFiniteNumber()` - 已完成抽象 ✅

**现状**: 已合并到 `src/utils/number.ts` 单一规范实现，所有调用方从此导入。

**复用收益**:
- 消除了 4 处重复定义
- 统一数值转换逻辑，避免潜在差异
- 约 15 行代码抽象为 1 处维护

### 2. `parseFloat()` vs `toFiniteNumber()` 统一 ✅ 已完成

**变更前**: V3 部分字段用 `parseFloat`，部分用 `toFiniteNumber`

| V3 字段 | 原使用函数 | 现使用函数 |
|---------|------------|------------|
| `supplyCapUsd` | `parseFloat()` | `toFiniteNumber()` ✅ |
| `borrowCapUsd` | `parseFloat()` | `toFiniteNumber()` ✅ |
| `supplyApy` | `parseFloat()` | `toFiniteNumber()` ✅ |
| `borrowApy` | `parseFloat()` | `toFiniteNumber()` ✅ |
| `supplyCapIsOne` | `parseFloat()` | `toFiniteNumber()` ✅ |
| `borrowCapIsOne` | `parseFloat()` | `toFiniteNumber()` ✅ |
| `incentive apr` | `parseFloat()` | `toFiniteNumber()` ✅ |

**变更后**: 全部统一使用 `toFiniteNumber()`，更安全且与 V4 保持一致。

**代码变更**:
```typescript
// 变更前
const supplyCapUsd = supplyCapUsdRaw ? parseFloat(supplyCapUsdRaw) : undefined;

// 变更后  
const supplyCapUsd = toFiniteNumber(supplyCapUsdRaw) ?? undefined;
```

### 3. V4 的 HubAsset 索引模式 — 已废弃 ✅

**变更前**：V4 fetcher 用 `fetchHubAssetIndex()` 预取所有 hub assets，构建 `Map<chain:token:hubId, HubAssetInfo>` 索引，然后遍历 reserves 时回查。

**变更后**：精度统一时确认 `reserve.asset.summary` 与 `reserve.asset.settings` 已包含全部 hub 级数据，因此移除整个预取流程，单次 `reserves()` 查询即可。

```typescript
// 现行实现（src/v4-fetcher.ts）
for (const r of v4Reserves) {
  const a = r.asset; // ← HubAsset，绑定到 reserve 所属 hub
  const utilizationPct = percentNumberToPercent(a.summary.utilizationRate);
  const variableRateSlope1 = percentNumberToPercent(a.settings.slopeBelowOptimal);
  // ... 不再需要任何 hubAssets() 预取或索引查询
}
```

### 4. disabled 标志生成逻辑 - 可部分抽象

| 版本 | 逻辑 |
|------|------|
| V3 | `isFrozen \|\| isPaused \|\| supplyCap === 1` |
| V4 | `!canSupply` (SDK 直接提供) |

**评估**: 无法完全抽象，因为数据源不同（V3 需要派生，V4 SDK 直接提供布尔值）。但可以抽象一个辅助函数用于 V3：

```typescript
// src/utils/flags.ts
export function isSupplyDisabledV3(
  isFrozen: boolean,
  isPaused: boolean,
  supplyCapValue?: string
): boolean {
  if (isFrozen || isPaused) return true;
  if (supplyCapValue !== undefined && parseFloat(supplyCapValue) === 1) return true;
  return false;
}
```

**收益**: 较低，仅 V3 使用，且逻辑简单，可不抽象。

### 5. Reserve ID 生成 - 不建议抽象

| 版本 | 格式 |
|------|------|
| V3 | `${marketName}:${chainId}:${tokenAddress}` |
| V4 | `${marketName}:${chainId}:${tokenAddress}:${hubName}` |

**评估**: 不建议抽象，因为：
- 格式差异是根本性的（V4 需要 hubName 区分多 hub）
- 强行抽象会增加参数复杂度
- 当前内联实现清晰易读

---

## 工具函数说明

### `toFiniteNumber(value: unknown): number | null`

**位置**: `src/utils/number.ts`（单一规范实现，所有调用方从此导入）

用于安全转换 SDK 返回的数值。已从 4 处重复定义合并为单一实现。

### `percentNumberToPercent(percentNumber): number | undefined`

**位置**: `src/v4-fetcher.ts`

V4 SDK 返回的 `PercentNumber` 形态为 `{ value: "0.09", decimals: ... }`（decimal fraction string）。本函数把 `value` 乘 100 得到 percent number（例如 `0.09 → 9`），用于所有 V4 利率/费率/利用率字段。

```typescript
function percentNumberToPercent(percentNumber: any): number | undefined {
  if (!percentNumber) return undefined;
  const ratio = toFiniteNumber(percentNumber.value);
  if (ratio === null || ratio === undefined) return undefined;
  return ratio * 100;
}
```

### `percentFromV3(percentValue): number | undefined`

**位置**: `src/index.ts`

V3 对等函数。V3 SDK 的 `PercentValue.value` 也是 decimal fraction string（如 `"0.20"` = 20%），同样 `value × 100` 得到 percent number。

### `percentOnChainValueToRay(...)` — 已删除 ❌

精度统一前用于把 V4 的 4-decimal `onChainValue` 转 RAY 27-decimal 字符串以匹配 V3 旧格式。统一后 V3/V4 都直接读 `.value × 100` 输出 percent number，因此本函数已从代码中删除。

### `fetchHubAssetIndex(...)` — 已删除 ❌

精度统一前用于预取所有 hub assets 并构建 `Map<chain:token:hubId, HubAssetInfo>` 索引以便回查 hub 级字段。统一后确认 `reserve.asset.summary/settings` 已包含全部数据，因此本函数及对应的 `hubAssets()` 调用已从代码中删除。`v4-fetcher.ts` 现仅调用 `chains()` + `hubs()` + `reserves()`。

---

## 关键差异详解

### 1. 架构差异

| 维度 | V3 | V4 |
|------|-----|-----|
| **数据处理** | 单一函数 `buildV3BaseDataset()` | 单一函数 `fetchV4MarketsDataInner()`（不再需要 hubAssets 预取） |
| **Hub & Spoke** | 无 | reserve 已绑定 hub via `r.asset` (HubAsset)；hub 级字段直接从 `r.asset.summary/settings` 读 |
| **Reserve 遍历** | 外层 `markets.forEach` + 内层 `supplyReserves.forEach` | 单层 `v4Reserves.forEach` |
| **Reserve ID** | 三字段拼接 | 四字段拼接（含 `hubName`） |
| **数据级别** | 全部为 Reserve 级别 | 部分为 Hub 级别（来自 `r.asset`，同 hub 多 reserves 共享） |

### 2. `reserveSizeUsd` 路径差异

```typescript
// V3: src/index.ts:602 in buildV3BaseDataset()
const reserveSizeUsd = toFiniteNumber(reserve?.size?.usd) ?? undefined;

// V4: src/v4-fetcher.ts:299 in fetchV4MarketsDataInner()
const reserveSizeUsd = toFiniteNumber(r.summary?.supplied?.exchange) ?? undefined;
```

**说明**：
- V3 的 `size.usd` 直接是 reserve 层级的总供应美元值
- V4 的 `summary.supplied.exchange` 中，`supplied` 是 V4 SDK 的数据结构名，`exchange` 表示美元计价

### 3. `supplyCapUsd` / `borrowCapUsd` 路径差异

```typescript
// V3: src/index.ts in buildV3BaseDataset()
const supplyCapUsd = toFiniteNumber(reserve.supplyInfo?.supplyCap?.usd) ?? undefined;
const borrowCapUsd = toFiniteNumber(reserve.borrowInfo?.borrowCap?.usd) ?? undefined;

// V4: src/v4-fetcher.ts in fetchV4MarketsDataInner()
const supplyCapUsd = toFiniteNumber(r.settings?.supplyCap?.exchange) ?? undefined;
const borrowCapUsd = toFiniteNumber(r.settings?.borrowCap?.exchange) ?? undefined;
```

**说明**：
- V3 的 cap 在 `supplyInfo` / `borrowInfo` 下，用 `toFiniteNumber` 转换
- V4 的 cap 在 `settings` 下（实际来自 HubAsset 索引），且字段名用 `exchange` 而非 `usd`，用 `toFiniteNumber` 转换

### 4. V4 Hub & Spoke 架构影响

V4 采用 Hub & Spoke 模型，导致以下差异：

1. **Reserve ID 包含 hubName**：同一 token 可能在多个 hub（Core/Plus/Prime）中出现
2. **utilizationPct 等 hub 级字段来自 `r.asset`**：reserve 自身已经绑定到所属 hub 的 `HubAsset` 上，不需要额外查询
3. **无 aToken/vToken**：V4 使用 hub/spoke 合约地址代替

```typescript
// 现行实现（src/v4-fetcher.ts，精度统一后）
const a = r.asset; // HubAsset，已绑定到 reserve 所属 hub
const utilizationPct = percentNumberToPercent(a?.summary?.utilizationRate); // value × 100
const variableRateSlope1 = percentNumberToPercent(a?.settings?.slopeBelowOptimal);
const availableLiquidity = a?.summary?.availableLiquidity?.amount?.onChainValue?.toString();
```

### 5. V4 利率参数精度（已统一为 percent number）

> **已变更**：V4 SDK 的利率参数原来从 `settings.slopeBelowOptimal.onChainValue`（4-decimal）经 `percentOnChainValueToRay()` 转为 RAY string 以匹配 V3 旧格式。精度统一后，V3 和 V4 都从 SDK 的 `.value`（decimal fraction，如 `0.04` = 4%）直接读，输出 `number × 100` 的 percent number。**`percentOnChainValueToRay()` 已删除，不再需要。**

```typescript
// 变更前（已删除）：
function percentOnChainValueToRay(onChainValue: string, decimals: number): string {
  // 转为 RAY (27-decimal) 以匹配 V3 旧格式
  const value = BigInt(onChainValue);
  const diff = 27 - decimals;
  if (diff <= 0) return value.toString();
  return (value * BigInt(10) ** BigInt(diff)).toString();
}

// 变更后：
// V3/V4 统一：value 是 SDK 返回的 decimal fraction (e.g., 0.04 = 4%), 输出 percent number
const variableRateSlope1 = toFiniteNumber(asset.settings?.slopeBelowOptimal?.value)
  ? toFiniteNumber(asset.settings?.slopeBelowOptimal?.value)! * 100
  : undefined;
```

---

## 数据来源优先级

对于 V3 和 V4 共同使用的字段，数据合并优先级：

1. **SDK 值**（每分钟刷新，最优先）
2. **On-chain RPC**（仅 V3 覆盖，`deficit` 和 `baseVariableBorrowRate` 兜底）
3. **Fallback 计算/默认值**

V4 特有字段完全依赖 SDK，无 RPC 覆盖。

---

## 验证脚本

- V3/V4 reserve 数量对比：`node scripts/validate-sdk-reserve-fields.mjs`
- SDK vs On-chain 匹配：`backend/scripts/validate-sdk-onchain-reserve-match.mjs`
- 基础利率 fallback：`backend/scripts/validate-base-rate-fallback.mjs`

---

## 常见前端用语 ↔ API 字段速查

| 前端说 | 找 API 字段 |
|--------|-----------|
| "Total supplied" / "总供应量" | `reserveSizeUsd` |
| "Total borrowed" / "总借款" | `totalVariableDebt`（需 USD 换算） |
| "Pool liquidity" / "池流动性" | `availableLiquidity`（需 USD 换算） |
| "Supply cap" / "供应上限" | `supplyCapUsd` |
| "Borrow cap" / "借贷上限" | `borrowCapUsd` |
| "Available to supply" | `supplyCapUsd - reserveSizeUsd`（派生） |
| "Available to borrow" | `min(borrowCapUsd - borrowed, poolLiquidity)`（派生） |
| "Utilization" / "利用率" | `utilizationPct` |
| "Deficit" / "坏账" | `deficit`（需 USD 换算 + 占比计算） |
| "Supply APY" | `supplyApy`（Native）+ 各激励（合计） |
| "Borrow APY" | `borrowApy`（Native）- 各激励（合计） |
| "Spread" | `totalSupplyApy - totalBorrowApy`（派生） |
| "Protocol Incentive" | `supplyIncentives` / `borrowIncentives` |
| "ACI Incentive" | `meritSupplys` / `meritBorrows` |
| "Merkl Incentive" | `merklSupplys` / `merklBorrows` / `merklHolds` |
| "Brevis Incentive" | `brevisSupplys` / `brevisBorrows` |

---

## GraphQL 客户端与架构说明

### V3 与 V4 SDK 底层架构

| 维度 | V3 (`@aave/client`) | V4 (`@aave/client-v4`) |
|------|---------------------|------------------------|
| **传输协议** | GraphQL over HTTP | GraphQL over HTTP |
| **客户端** | urql (`AaveClient` extends `GqlClient`) | urql (`AaveClient` extends `GqlClient`) |
| **Batching** | 默认开启 (`batch: true`) | 默认开启 (`batch: true`) |
| **Query 合并** | 同一 tick 内多个 query 自动合并为单个 HTTP POST | 同一 tick 内多个 query 自动合并为单个 HTTP POST |

**关键结论**：V3 和 V4 SDK 底层都使用 urql，不是 Apollo Client。urql 的 batching 机制不需要额外配置，只要把请求改为并行发起即可自动合并。

### 为什么不用 Apollo Client / DataLoader

| 工具 | 定位 | 本项目适用性 |
|------|------|-------------|
| **Apollo Client** | 前端 GraphQL 客户端（React/Vue 生态） | ❌ 不适用。我们使用 urql（更轻量），且 SDK 已封装 |
| **DataLoader** | 服务端 resolver 层批处理工具 | ❌ 不适用。我们是客户端调用方，不是服务端 |
| **urql batching** | 前端 GraphQL 请求合并 | ✅ 已内置，无需额外安装 |

**DataLoader 的典型使用场景**（服务端）：
```typescript
// 服务端 resolver 中解决 N+1
const userLoader = new DataLoader(async (userIds) => {
  // 1 次 SQL/GraphQL 查询获取所有 user
  return await db.users.findMany({ where: { id: { in: userIds } } });
});

// resolver 中多次调用自动合并
const user1 = await userLoader.load(1);
const user2 = await userLoader.load(2); // 合并为 1 次查询
```

**我们的场景**（客户端）：
```typescript
// 客户端直接调用 SDK，利用 urql batching
// V4 现行流程只需 chains() + hubs() + reserves()，不再调用 hubAssets()
const results = await Promise.all([
  chains(client, { query: { filter: 'ALL' } }),
  hubs(client, { /* ... */ }),
  reserves(client, { /* ... */ }),
  // urql 把同 tick 的 query 自动合并为 1 个 HTTP 请求
]);
```

### V3 的 `markets()` 调用模式

V3 的 `markets(client, { chainIds: [...] })` 本身支持批量 chainIds，设计上已经避免了 N+1 问题：

```typescript
// ✅ V3 推荐：1 次请求覆盖多链
const result = await markets(client, {
  chainIds: [chainId(1), chainId(137), chainId(42161)],
});

// ⚠️ V3 当前实现：逐个 chainId 调用（为了错误隔离）
for (const chainIdValue of chainIds) {
  const result = await markets(client, { chainIds: [chainId(chainIdValue)] });
  // 一个链失败不影响其他链
}
```

**权衡**：
- **批量调用**：1 次 HTTP 请求，速度快，但一个链失败全失败
- **逐个调用**：N 次 HTTP 请求，速度慢，但错误隔离好

---

**文档创建日期**: 2026-04-27  
**最近更新**: 2026-05-02（同步 V3/V4 精度统一后的代码现状：删除 `fetchHubAssetIndex` / `hubAssets` / `percentOnChainValueToRay`；rate 参数改 percent number；hub 级字段直接走 `r.asset.summary/settings`）  
**依据代码**: `src/index.ts`, `src/v4-fetcher.ts`  
**相关文档**: `docs/api/v3-v4-precision-unification-plan.md`, `docs/backend/data-precision-comparison.md`, `docs/api/markets-api-sdk-field-validation.md`, `docs/api/field-glossary.md`

# Spec: AAV-755 — URL 指向 Market

> ADR: [0027-url-market-query-param](../adr/0027-url-market-query-param.md)

## Problem Statement

用户选中某个链的特定市场（如 Ethereum → Core）时，URL 只反映链级别
（`?chain=ethereum`），不反映具体市场。分享链接时接收方看到该链全部市场，
而非发送方实际选中的特定市场。缺少 market 维度使 URL 无法精确表达用户视图。

## Solution

在现有 query param 体系上增加 `market` 参数。URL 格式：

```
/?chain=ethereum&market=core&category=stablecoin&search=usdc
```

- `market` 参数值使用 `getSubMarketLabel(marketName)` 输出的 slugified 形式
  （小写 + 空格转 `-`，如 `core`、`prime`、`horizon-rwa`、`ethereum-lido`）
- 多选时逗号分隔：`?chain=ethereum&market=core,prime`
- 全选某链市场时省略 `market` 参数（`?chain=ethereum` = 全选 Ethereum）
- 跨链多选时不带 `chain`/`market` 参数（URL 不表达跨链组合）
- `market` 无 `chain` 上下文时忽略
- 旧 `?chain=xxx` URL 天然兼容（无 `market` = 选全部）

## User Stories

1. 作为进阶 DeFi 用户，我希望选中 Ethereum Core 市场时 URL 显示 `?chain=ethereum&market=core`，以便分享精确的市场链接
2. 作为链接接收方，我希望打开 `?chain=ethereum&market=core` 时自动筛选到 Ethereum Core 市场，以便直接看到发送方想让我看的数据
3. 作为进阶 DeFi 用户，我希望选中 Ethereum Core + Prime 时 URL 显示 `?chain=ethereum&market=core,prime`，以便分享多市场组合
4. 作为进阶 DeFi 用户，我希望选中某链全部市场时 URL 仅显示 `?chain=ethereum`（不带冗余 market 参数），以便 URL 简洁
5. 作为进阶 DeFi 用户，我希望切换市场时 URL 实时更新（replace 不产生 history 条目），以便刷新页面能恢复当前视图
6. 作为进阶 DeFi 用户，我希望打开无效 market slug 的 URL 时优雅降级到该链全部市场 + toast 提示，以便不会被错误 URL 卡住
7. 作为进阶 DeFi 用户，我希望 `?market=core`（无 chain）被忽略而非报错，以便不会因缺少上下文而崩溃
8. 作为进阶 DeFi 用户，我希望 localStorage 持久化包含 market 维度，以便关闭浏览器再打开时恢复之前的 market 选择
9. 作为进阶 DeFi 用户，我希望 URL 优先于 localStorage，以便分享链接打开时以 URL 为准
10. 作为进阶 DeFi 用户，我希望 `category` 和 `search` 参数继续与 `market` 参数共存，以便能组合使用 market 筛选 + token 分类 + 搜索

## Implementation Decisions

### 1. Market Slug 纯函数模块

新建 `src/lib/marketSlug.ts`，包含两个纯函数：

- `slugifyMarketLabel(marketName: string): string` — 将 marketName 经
  `getSubMarketLabel()` 转为显示名，再 slugify（`toLowerCase().replace(/\s+/g, '-')`）
- `resolveMarketSlugs(marketSlugs: string[], chainId: number, marketsList: MarketListItem[]): string[]`
  — 在指定 chainId 的市场范围内，将 slug 数组解析回 `marketKey(chainId, marketName)` 数组；
  未匹配的 slug 收集为 invalid 列表

### 2. URL Hydration 扩展

`Index.tsx` 的一次性 hydration effect（`initialParamsAppliedRef`）扩展：
- 读取 `market` query param，按逗号分隔得到 slug 数组
- 在 `chain` param 已解析出的 chainId 范围内，调用 `resolveMarketSlugs()` 解析
- 如果解析出有效 market keys 且数量 < 该链全部市场数，用解析结果覆盖 `selectedMarkets`
  （精确选择特定市场而非全选）
- 如果有 invalid slug，toast 提示并回退到该链全部市场

### 3. Two-Way Sync 扩展

`Index.tsx` 的 state→URL sync effect 扩展：
- 新增 `derivedMarketSlugs` useMemo：从 `selectedMarkets` + `effectiveMarketsList` 推导，
  仅当所有选中市场属于同一 chain 且非该链全部市场时返回 slug 数组
- URL 更新时：如果 `derivedMarketSlugs` 非空，`set('market', slugs.join(','))`；
  否则 `delete('market')`
- localStorage payload 增加 `market` 字段

### 4. 全选省略逻辑

`derivedMarketSlugs` 返回 null 的条件：
- `selectedMarkets` 为空
- 选中市场跨多个 chain
- 选中市场数 = 该 chain 在 `effectiveMarketsList` 中的全部市场数（全选）
- `effectiveMarketsList` 为空

### 5. 不改动 FilterBar 组件接口

FilterBar 的 `selectedMarkets` / `setSelectedMarkets` 接口不变。URL 同步逻辑
全部在 Index.tsx 的 effects 中处理，FilterBar 无感知。

## Testing Decisions

### 主 Seam：纯函数模块 `src/lib/marketSlug.ts`

测试 `slugifyMarketLabel` 和 `resolveMarketSlugs` 的所有分支。这两个函数
封装了全部 market slug 转换和解析逻辑，无 React/router 依赖，可独立测试。

参考先例：`src/lib/marketKey.ts` + `src/lib/marketsList.ts` 同层纯函数模式。

### 辅助 Seam：MemoryRouter 组件测试

参考 PortfolioPanel 测试中 MemoryRouter 的使用模式，测试 Index.tsx 的
URL hydration 和 two-way sync 行为。但 Index.tsx 组件庞大、依赖众多，
此 seam 仅作为集成验证，不作为主要测试路径。

### 测试原则

- 只测外部行为（输入 → 输出），不测内部实现细节
- 场景矩阵的每一行直接成为纯函数测试用例
- 不 mock 内部函数，只 mock 外部依赖（如 `effectiveMarketsList` 数据）

## Scenario & Risk Verification

| # | 场景 | 输入 | 预期输出 | 风险等级 |
|---|------|------|----------|----------|
| S1 | 单市场 slugify | `slugifyMarketLabel('AaveV3Ethereum')` | `'core'` | 低 |
| S2 | 多词市场 slugify | `slugifyMarketLabel('AaveV3EthereumHorizon')` | `'horizon-rwa'` | 低 |
| S3 | V4 市场 slugify | `slugifyMarketLabel('AaveV4EthereumLido')` | `'ethereum-lido'` | 低 |
| S4 | 单市场链 slugify | `slugifyMarketLabel('AaveV3Base')` | `'base'` | 低 |
| S5 | 解析有效 slug | `resolveMarketSlugs(['core'], 1, marketsList)` | `['1:AaveV3Ethereum']` | 中 |
| S6 | 解析多 slug | `resolveMarketSlugs(['core','prime'], 1, marketsList)` | `['1:AaveV3Ethereum','1:AaveV3EthereumLido']` | 中 |
| S7 | 解析无效 slug | `resolveMarketSlugs(['nonexistent'], 1, marketsList)` | `[]` + invalid: `['nonexistent']` | 中 |
| S8 | 混合有效+无效 | `resolveMarketSlugs(['core','xxx'], 1, marketsList)` | `['1:AaveV3Ethereum']` + invalid: `['xxx']` | 中 |
| S9 | 空 slug 数组 | `resolveMarketSlugs([], 1, marketsList)` | `[]` + invalid: `[]` | 低 |
| S10 | URL hydration: 单市场 | `?chain=ethereum&market=core` | `selectedMarkets = ['1:AaveV3Ethereum']` | 高 |
| S11 | URL hydration: 多市场 | `?chain=ethereum&market=core,prime` | `selectedMarkets = ['1:AaveV3Ethereum','1:AaveV3EthereumLido']` | 高 |
| S12 | URL hydration: 全选(无market) | `?chain=ethereum` | `selectedMarkets` = Ethereum 全部市场 | 高 |
| S13 | URL hydration: 无效market | `?chain=ethereum&market=xxx` | 全选 Ethereum + toast | 高 |
| S14 | URL hydration: market无chain | `?market=core` | 忽略 market, show all | 高 |
| S15 | URL hydration: 旧URL | `?chain=ethereum` | 全选 Ethereum (天然兼容) | 中 |
| S16 | State→URL: 单市场 | selectedMarkets = ['1:AaveV3Ethereum'] | URL = `?chain=ethereum&market=core` | 高 |
| S17 | State→URL: 全选 | selectedMarkets = Ethereum全部 | URL = `?chain=ethereum` (无market) | 高 |
| S18 | State→URL: 无选中 | selectedMarkets = [] | URL 无 chain/market | 中 |
| S19 | State→URL: 跨链 | selectedMarkets 跨多个链 | URL 无 chain/market | 中 |
| S20 | localStorage: 含market | localStorage 有 `{chain,market}` | 恢复 market 选择 | 中 |
| S21 | URL优先于localStorage | URL 有 market + localStorage 有不同 market | 以 URL 为准 | 高 |
| S22 | category+market共存 | `?chain=ethereum&market=core&category=stablecoin` | 两者都生效 | 中 |
| S23 | search+market共存 | `?chain=ethereum&market=core&search=usdc` | 两者都生效 | 中 |
| S24 | 刷新页面 | URL 有 market param | 状态从 URL 恢复 | 高 |

## Out of Scope

- 路由表重构（不改 `/` 和 `/chain/:slug` 路由定义）
- SEO ChainPage 改造（着陆页仍链接到 `/?chain=xxx`）
- 跨链多选 URL 表达（跨链时 URL 不带 chain/market param）
- `isApy` toggle 持久化到 URL
- Hub 选择持久化到 URL

## Further Notes

- ADR-0027 记录了选择 query params 而非 path segments 的决策理由
- `marketKey.ts` 和 `marketsList.ts` 是同层纯函数模块的参考先例
- FilterBar 的 `selectedMarkets` 接口不变，所有 URL 逻辑封装在 Index.tsx effects 中
- `getSubMarketLabel` 已覆盖所有 marketName 格式（V3 Ethereum 映射、V3 非 Ethereum 前缀剥离、V4 前缀剥离），slugify 在其输出上操作

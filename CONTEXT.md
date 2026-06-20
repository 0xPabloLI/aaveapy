# Aaveapy

Aave V3/V4 市场分析前端。领域术语锚定 Aave 协议原词；UI 侧别名见 `docs/TERMINOLOGY.md` 映射链。

## Interest Rate Model

**Liquidity Rate**:
协议内部的供应者收益率，以 ray (10^27) 定点数表示。UI 层转换为 `supplyAprPercent` / `supplyApyPercent`。
_Avoid_: Supply Rate（这是 UI 别名，领域层用 Liquidity Rate 跟协议走）

**Reserve Factor**:
协议从利息中抽取的费用比例，单位 bps（0–10000）。`reserveFactor = 1000` 即 10%。
_Avoid_: Protocol Fee

**Supply Usage Rate**:
供给利用率 = (总债务 + deficit) / 可用流动性。含 deficit，用于 Liquidity Rate 计算。
_Avoid_: Supply Utilization（同义但代码中不出现）

**Borrow Usage Rate**:
借款利用率 = 总债务 / 可用流动性。不含 deficit，用于外部展示。
_Avoid_: Borrow Utilization

**Optimal Usage Rate**:
两斜率模型中，第一段斜率到第二段斜率的转折点利用率。协议参数，ray 定点数。
_Avoid_: Optimal Utilization

## Incentive Programs

**Incentive Three-Level Hierarchy**:
激励数据的三层结构，所有 source（Merit / Merkl / Brevis / Protocol）统一遵循：

1. **Source** — 激励提供方（如 ACI/Merit/Brevis/Protocol）。Source 本身不携带数据，仅用于分组标识和图标/logo。
2. **Opportunity** — 一个独立的激励机会，对应后端 API 的 `MeritCampaignGroup` / `MerklOpportunityGroup` / `BrevisIncentive`。每个 Opportunity 有独立的 `name`、`link`、`message`，下挂 1~N 个 Campaign。同一 token 可以有多个 Opportunity（不同 link = 不同 Opportunity）。Opportunity 级别的 `message` 描述该机会的通用规则（如 Merit 的 "Supply USDT" 和 "Self Authentication" 条目）。
3. **Campaign** — Opportunity 内的一个子活动，对应后端的 `breakdown`（`MeritCampaignBreakdown` / `MerklCampaignBreakdown` / `BrevisCampaignBreakdown`）。每个 Campaign 有独立的 `campaignApr`、`campaignStartedAt`/`campaignEndedAt`、`campaignId`、`campaignType`，可选的 `positionCap`、`aprCap`。

前端 `IncentiveSource` 接口 = Opportunity 层级（不是 Source 层级），`IncentiveSource.campaigns` = Campaign 层级。同名同 link 的 Opportunity 视为同一个（`groupIncentiveSources` 合并，后进覆盖先进）。

_Avoid_: 把 `IncentiveSource` 当作 Source 层级（它是 Opportunity）；把 breakdown 级别叫做 "source"

**Merkl Campaign**:
Merkl 协议分发的激励活动。按 `campaignType`（= normalize 后的 Merkl `distributionType`）分四大类：

| campaignType | 含义 | APR cap 来源 |
|---|---|---|
| `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | Capped: 每 $1 流动性最多 $1 奖励 | `distributionSettings.apr` |
| `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | Fixed: 每 $1 流动性固定 $1 奖励 | `distributionSettings.apr` |
| `DUTCH_AUCTION` | 衰减拍卖 | 无 |
| `TARGET_TOTAL_APR` | 总 APR 目标（AAVE_NET_APR / AAVE_V4_NET_APR / ERC4626 等 7 种 subtype） | `distributionSettings.targetAPR` |

_Avoid_: Merkl Reward, Merkl Incentive

**TARGET_TOTAL_APR aprCap Semantics**:
TARGET_TOTAL_APR 的 `aprCap` 是"总 APR 目标"（= targetAPR），不是 Merkl 实付上限。后端已将 `campaignApr` 转换为 Merkl 实付 APR（`convertAprToApy(targetAPR) - nativeAPY → apyToApr`），前端 A 类路径可直接使用 `campaignApr`。B 类路径（scenario 模拟）需用 `effectiveAprCap = max(aprCap - nativeAPY, 0)` 走现有 MAX/FIX 子逻辑——因为 nativeAPY 随 utilization 变化，scenario 下 effectiveAprCap 也随之变化。`budgetBoundMode`（MAX_APR / FIX_APR）是正交维度，决定 budget 用尽后的行为（dilutive vs early-end），与 MAX/FIX 同族。

_Avoid_: 把 TARGET_TOTAL_APR 的 aprCap 当作 Merkl 实付上限（它是总目标）、手动在 A 类路径减 nativeAPY（后端已算好 campaignApr）

**Merkl Campaign AMOUNT Variant**:
Merkl `distributionType` 中 VALUE/AMOUNT 的区分：`VALUE` = dollar 计价，`AMOUNT` = token 数量计价。命名规律 `{MAX/FIX}_REWARD_{VALUE/AMOUNT}_PER_LIQUIDITY_{VALUE/AMOUNT}`。

`distributionSettings.apr` 在所有变体中格式一致（decimal），但结果单位不同：
- VALUE：`daily_rewards_usd = TVL_usd × apr / 365`
- AMOUNT_PER_VALUE：`daily_rewards_tokens = TVL_usd × apr / 365`（Merkl campaign APR = 0，需 fallback）
- AMOUNT_PER_AMOUNT：`daily_rewards_tokens = targetTokenTVL_in_tokens × apr / 365`（TVL 单位是 token 数量而非 USD）

| distributionType | TVL 单位 | daily rewards 单位 | campaign APR | 实际验证 |
|---|---|---|---|---|
| `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` | USD | USD | 有值 | ✅ 大量 |
| `FIX_REWARD_AMOUNT_PER_LIQUIDITY_VALUE` | USD | token | 0（需 fallback） | ✅ IPOR Fusion Points S2 (Base) |
| `FIX_REWARD_AMOUNT_PER_LIQUIDITY_AMOUNT` | target token count | token | 0（需 fallback） | ✅ Gravity Points (Ethereum) |

AMOUNT 变体的 forecast 计算公式与 VALUE 变体完全一致（`requiredDaily = remainingBudget / remainingDays`），区别仅在于：① `campaignApr = 0` 需从 `distributionSettings.apr` fallback；② `totalBudget` / `distributedSoFar` / `dailyRewards` 单位是 token 而非 USD；③ APR 随 token 价格浮动（VALUE 变体的 USD APR 是固定的）。前端 UI 不显示 campaignType 文字，仅在 forecast simulation 中自动处理。
_Avoid_: 把 AMOUNT 变体映射为 VALUE 变体（语义丢失）、把 `distributionSettings.apr` 在 AMOUNT 变体中当成 token rate（它是 decimal 格式，已数学验证）

**campaignType vs distributionType**:
`campaignType` 是我们对 Merkl `distributionType` normalize 后的枚举值（`CampaignForecastType` / `ForecastCampaignTypeLite`），贯穿全链路（fetcher → backend → API → frontend）。`distributionType` 是 Merkl API 原始字段（6+ 种）。`rawDistributionType` 是 fetcher 内部暂存 Merkl 原始值的字段名，不透传到 API。`campaignType` 无其他含义，等价于 `normalize(distributionType)`。
_Avoid_: 在 API 响应或前端使用 `distributionType`（原始值）、`rawDistributionType`（内部暂存）

**Merit Program**:
Aave 官方的 Merit 激励项目。`campaignType` = `DUTCH_AUCTION`（与 Merkl 统一命名）；self auth 部分有 position cap。Position cap 与 Brevis `positionCap` 同术语。
_Avoid_: Merit Reward, Merit Incentive, deposit ceiling, self cap（用 position cap 代替）

**Brevis Incentive**:
Brevis 协议分发的激励。有 per-user position cap 模型。`campaignType` = `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE`；`rewardTokenSymbol` 从 gRPC `RewardToken.symbol` 提取。
_Avoid_: Brevis Campaign, Brevis Program, reward ceiling（用 position cap 代替）

**Tydro Points**:
仅 Merkl Campaign 的可选 points 路径产出的积分。转换公式：`points × pointToUsdRate × 36.5`。Merit / Brevis / 协议激励**不是** Tydro Points。
_Avoid_: Points（太泛）

**Reward Token Symbol**:
Merkl campaign 的 reward token 标识，来自 Merkl API `rewardToken.symbol`（如 `TydroInkPoints`、`ipor-fusion-points-s2`、`Gravity Points`）。前端按 symbol 做 case-insensitive 匹配路由 `pointToUsdRate`：`TydroInkPoints` → FDV slider rate，其余 → 0。`rewardTokenIconUrl` 来自 Merkl API `rewardToken.icon`，IncentiveTooltip 中 APR 前显示。
_Avoid_: point token name、reward token id

## Net Position

**Net Position Constraint**:
Merkl opportunity 自身的 eligibility 约束：只有 net position（source 侧头寸减去 offset 侧头寸）部分才 eligible 获得奖励，其余被抵消。`sourceSide` 声明哪侧是被奖励的（supply 或 borrow），`offsetTokens` 声明另一侧被抵消的 token 列表。与 Deposit Ceiling 同层——都是限制"多少头寸 eligible"的条件。
_Avoid_: Net Rule, Net Lending Rule, Offset Rule, direction

**Offset Token**:
Net Position Constraint 中被抵消的那一侧的 token。例如 USDT0 supply minus USDT0+USDe+GHO borrows 中，USDT0/USDe/GHO 是 offset tokens，`sourceSide` 为 supply。
_Avoid_: Deduction Token, Exclusion Token

## Campaign Access

**Campaign Whitelist**:
Per-campaign address allowlist. A non-empty whitelist means only listed addresses are eligible; others get status 'whitelist-blocked'. An empty whitelist means the campaign is public (any address eligible).
_Avoid_: Allowlist（保留 whitelist 跟协议原词）

**Campaign Blacklist**:
Per-campaign address blocklist. Addresses on this list are excluded from campaign APR contributions in portfolio simulation, but the campaign itself remains active for other users.
_Avoid_: Blocklist

## Limits

**Eligible Deposit Cap (Merit Self Position Cap)**:
Per-user 存款中可获 incentive 的金额上限。只有前 `selfPositionCapUsd` 部分的存款能获得 incentive，超出部分仍可存入但不获 incentive。
提取层字段名 `selfPositionCapUsd`（从 Merit Self Auth message 解析，提取函数 `extractMeritSelfPositionCapUsd`）。缩放逻辑与 Brevis Position Cap 统一，共享 `applyPositionCap` 纯函数。
UI 显示 `"Incentive on first $X"`。
_Avoid_: Deposit Ceiling, Per-User Deposit Cap, Self Cap（作为领域术语；引用提取产物时可用 `selfPositionCapUsd`）

**Position Cap (Brevis)**:
Per-user 仓位中可获 incentive 的金额上限。Brevis 模型中限制单个用户能获得 incentive 的最大仓位金额（API 字段 `positionCap`，domain 层 `positionCapUsd`）。
UI 显示 `"Incentive on first $X"`（与 Merit Self Position Cap 统一文案）。可能 shared（supply + borrow 共享）。
_Avoid_: Reward Ceiling, Per-User Reward Cap（作为领域术语；引用 API 字段时可用 `positionCap`）

**Supply Cap / Borrow Cap**:
Pool-wide 总量上限。Aave 协议参数，限制整个池子的存款/借款总量。与 per-user cap（Merit Self Position Cap / Brevis Position Cap）是不同概念。
_Avoid_: Supply Ceiling, Borrow Ceiling

**Portfolio Cap Warning**:
Portfolio simulation 输入达到或超过上限时，在 SideInput 下方显示的 amber 提醒。两种来源：(1) Protocol Supply/Borrow Cap（pool-wide，`availableSupplyRoomUsd`/`availableBorrowRoomUsd`），(2) Incentive Position Cap（per-user，Brevis `positionCapUsd`、Merit `selfPositionCapUsd`；API 字段 `positionCap`）。提醒包含描述文字和 "Adjust" 按钮（将输入钳位到 max allowed）。Brevis shared cap（`isSharedSupplyBorrow`）的 Adjust 需减去对侧仓位。仅在 Portfolio 模式下显示，single simulation 不需要。数据流：从 `simulationsById`（已有 simulation 结果）取 `capMetrics`，经 `extractCapWarnings` 聚合，传入 `SideInput` 渲染。
_Avoid_: Cap Error, Cap Alert（这不是错误/警告，是提醒）；red/danger 色（用 amber）

## Identity

**Reserve ID**:
单个字段作为 reserve 的 canonical key。后端真实格式 V3=`{chainId}:{poolAddress}:{tokenAddress}`，V4=`{chainId}:{spokeAddress}:{tokenAddress}:{hubAddress}`（如 `1:0x8787...:0xC02a...:0xCca8...26c9`）。代码中 `composeReserveId(chainId, poolAddress, tokenAddress, hubAddress?)` 构造此格式。`parseReserveId(reserveId)` 反向解析各段（`reserveIdParser.ts`），仅用于从 reserveId 提取 hubAddress/spokeAddress（API 不再返回这两个字段）。`(chainId, tokenAddress)` 二元组仅作 fallback 查找用（`buildReserveLookupByChainAndToken`），V3 同链同币种多 pool 时有歧义（`_ambiguousFallback` 标记 + `console.warn`）。
_Avoid_: Composite key, (underlyingAsset, chainId) pair 作为主匹配路径; SDK `reserve.id`（Base64 编码 opaque ID）用于 Map.get

**Reserve Lookup Strategy**:
`buildReserveMap`（key=reserveId）用于精确 O(1) 查找；`buildReserveLookupByChainAndToken`（key=`{chainId}:{tokenAddress}`）用于 fallback 反查。`resolvePositionMetaByReserveId` 实现三级查找：composeReserveId 精确 → chainToken fallback（带歧义警告）→ orphan。V4 多 hubName 场景遍历 `hubNames[]` 尝试匹配。

---

## Hard-Learned Lessons

**LL1: 绝不能从测试 fixture 的硬编码值推断真实 API 格式**:
测试 fixture 中的 reserveId（如 `AaveV3Celo-0x1234`）只是占位值，不反映后端真实格式。推断真实格式必须：直接 curl 生产/staging API、查阅后端源码、或查阅 API 文档。从 fixture 推断是根本性方法错误，曾导致实现 `composeReserveId(marketName, tokenAddress)` 格式与后端 `{chainId}:{poolAddress}:{tokenAddress}` 不匹配。

**LL2: 测试 fixture 必须尽量使用真实格式**:
即使 fixture 是构造数据，也应使用与生产 API 一致的格式（如 `42220:0xpool:0x1234` 而非 `AaveV3Celo-0x1234`）。这能避免新开发者从 fixture 推断格式时被误导，也使测试更接近真实场景。

**LL3: SDK hook 参数格式必须与 SDK 版本匹配 — 不能凭旧版 API 猜测**:
V3 SDK (`@aave/react-v3` 0.9.1) 需要 `{ markets: [{ address, chainId }], user }` 格式；V4 SDK (`@aave/react` 4.2.0) 需要 `{ query: { userChains: { user, chainIds } } }` 格式。旧代码传 `{ account }` 导致 GraphQL 报错 `field "query"/"markets" is required but not provided`，SDK 两路同时失败 → onchain fallback 也连锁失败 → 用户看到 "Failed to load wallet positions"。**教训：SDK 升级后必须验证 hook 参数签名，不能假设向后兼容；catch 块必须 console.error 实际错误，否则吞掉异常无法诊断。**

## Side Data

**Side Data Sub-Source**:
后端 `/meta/side-data` 的 4 个独立子数据源：`categories`（Token 分类）、`fdv`（CoinGecko FDV）、`forecast`（Merkl 预测）、`campaignAccess`（Merkl 白名单/黑名单）。任一子源可能独立失败，不影响其他子源返回。

**Side Data Errors**:
结构化错误字段 `errors: Partial<Record<SubSource, string>>`，替代原 `partial: boolean`。键为失败的子源名（`categories`/`fdv`/`forecast`/`campaignAccess`），值为人类可读失败原因。`errors` 不存在或为空对象 → 全部子源成功。前端当前不展示 UI，仅更新类型/schema。
_Avoid_: `partial: boolean`（已移除，仅告知"有子源失败"但不知具体哪个和原因）

---

## External Links

**Aave V3 URL** (`buildAaveReserveUrl` / `buildAaveMarketUrl`):
指向 `app.aave.com` 的 V3 市场/资产页面。参数为 `marketName` + `tokenAddress`。

**Aave V4 URL** (`buildAaveV4Url` / `buildAaveV4HubUrl` / `buildAaveV4MarketUrl` / `buildAaveV4AssetUrl`):
指向 `pro.aave.com` 的 V4 深度链接。`buildAaveV4MarketUrl` 生成 spoke 跳转：`/explore/market/{spokeId}`（非 `/explore/spoke/`，后者 404）。`buildAaveV4HubUrl` 生成 hub 跳转：`/explore/hub/{hubId}`。

**Link Priority**:
Market chip 外链优先级：tydro > aaveV4MarketUrl (spoke) > aaveMarketUrl (V3)。`buildAaveUrl` 统一入口：V4 优先于 V3。

_Avoid_: `buildAavePro*`（已重命名为 `buildAaveV4*`），`AAVE_PRO_BASE`（已重命名为 `AAVE_V4_BASE`）

**Block Explorer**:
第三方 chain-level 区块链浏览器（Etherscan / Routescan / Blockscout / OKLink 四大 family），用于查询 address / tx / contract storage / read proxy 等链上信息。与 Aave 官方 URL 不同：Block Explorer **不是 Aave 维护的**，跳转后离开 aaveapy 域名，进入第三方站点的 trust boundary。每个 base URL 在 `src/lib/explorerIconMap.ts` 注册到对应 brand（`etherscan` / `routescan` / `blockscout` / `oklink` 之一，1:N 去重）。详细 pipeline + runbook 见 [`docs/explorer-icons.md`](docs/explorer-icons.md)。
_Avoid_: explorer URL、scan URL、chain browser（跟 aaveapy 自有链概念混淆）

**Block Explorer Icon** (`ExplorerIconStack`):
`AssetActionMenu` 中 4 个 explorer item（`token-explorer` / `pool-explorer` / `hub-explorer` / `spoke-explorer`）trailing 位置展示的视觉 = 链网络 icon + 该 explorer base 对应 brand icon **并排叠放**（12×12，1/3 overlap）。从 `getExplorerIconSrc(base)` 拉 brand 图标，与 chain icon 共同渲染。Asset 缺失时静默 fallback：仅 explorer 缺失 → 只显示 chain icon；仅 chain 缺失 → 只显示 explorer icon；双空 → 隐藏整个 trailing slot。不 console.warn（运行时噪音与已建模的 missing 状态重复）。
_Avoid_: 在 trailing 位置放链网络 icon 单独表示 explorer（缺失 explorer brand 识别）、`!warn when icon missing`（破坏 `silent fallback` 约定）

## Wallet Portfolio

**Portfolio Mode**:
Multi-reserve simulation mode where users manage aggregate positions across multiple assets (supply/borrow per reserve). Toggled via `PortfolioModeToggle`; internally `SimulationMode = 'single' | 'portfolio'`. UI uses "Portfolio" label exclusively — no "Batch" anywhere. In Portfolio mode, the toggle renders inside the `PortfolioPanel` header row alongside action buttons; in Single mode, it renders in the `ReservesTable` scenario controls area.
**Sticky behavior**: In Portfolio mode, the scenario bar (containing PortfolioPanel) is **not sticky** on both desktop and mobile — it scrolls naturally with the page. This prevents the panel from trapping content when it exceeds viewport height. Single mode keeps the scenario bar sticky at viewport top. See ADR-0013.
_Avoid_: Batch Mode, Batch toggle, "Build your batch portfolio"

**Filter-Portfolio Independence**:
Token filter 和 chain filter 不影响 Portfolio simulation 的数据。`ReservesTable` 接收两个 reserve 列表：`reserves`（filtered，用于表格行显示）和 `allReserves`（完整，用于 Portfolio 模拟）。Portfolio 模式下两条独立路径：`usePortfolioToggle({ reserves: allReserves })` 生成模拟结果，`PortfolioPanel reserves={allReserves}` 渲染 entries 和搜索——两者都不受 filter 影响。表格行的 `simulationsById`（来自 `useSharedRateSimulations({ reserves })`）用 filtered reserves 是正确的性能优化：被过滤掉的行不可见，不需要模拟数据。见 AAV-749。
_Avoid_: 让 Portfolio 模拟路径使用 filteredReserves（AAV-749 已修复）

**Snapshot Feature Flag**:
`features.snapshot` (`src/config/features.ts`) 控制 Snapshot UI 的渲染：Save 按钮、Saved Snapshots 列表、Compare 按钮、Compare 视图、prefetch。当前为 `false`（功能暂时下线，详见 ADR-0012）。Hook 层和类型不变。恢复：改一行 flag 为 `true`。
_Avoid_: 删除代码、移到 dead code 目录、环境变量方式

**Onchain Fallback**:
Reactive 模式：SDK 失败后才触发 onchain 查询，不提前并发（省 public RPC 配额）。V3/V4 fallback 拆为独立 useQuery，各自 15s timeout、独立 retry、互不阻塞。fallback query staleTime 30s，不 refetchOnWindowFocus / refetchOnReconnect。合约地址从 `@aave-dao/aave-address-book` 取，不硬编码链列表。
_Avoid_: proactive 并发（浪费 RPC）、private RPC（前端只用 public RPC）、V3/V4 合并单 query（互相阻塞）

**Gap Fallback**:
SDK 成功但覆盖不全时，补查差集链上的用户仓位。与 onchain fallback 互补：onchain fallback = SDK 全挂时全量替代；gap fallback = SDK 部分覆盖时补齐缺口。触发条件：`sdkSucceeded && computeGapChainIds(reserves, sdkCoverage) non-empty`。差集按 V3/V4 独立计算（`gapChainIds.v3Gap` / `gapChainIds.v4Gap`），只查差集链（省 RPC）。数据源标记 `'gap-v3'` / `'gap-v4'`，与 onchain fallback 的 `'onchain-v3'` / `'onchain-v4'` 区分。详见 ADR-0006。
_Avoid_: 差集全量混查（浪费 RPC）、gap 与 onchain fallback 耦合（触发条件不同应独立）

**Wallet Position 三路合并**:
`useUserPositionsSdk` 合并三路仓位数据：SDK（source `'sdk'`）→ onchain fallback（source `'onchain-v3'`/`'onchain-v4'`）→ gap fallback（source `'gap-v3'`/`'gap-v4'`）。`mergeAndDedupPositions` 按 `reserveId::side` 去重，SDK 优先级最高。`mergeFailedSources` 独立收集三路失败源。SDK 失败时 gap fallback 不触发（无差集意义），与 onchain fallback 互斥。

**SDK Degradation Boundary**:
`isInfrastructureFailure()` 精细判定，仅以下情况降级：(1) GraphQL 网络错误（5xx / timeout / fetch reject）；(2) hook 抛 JS 异常（type guard 失败 / 字段缺失）；(3) `AaveClient.create()` 初始化失败。空数组/空仓位 = 合法结果，不降级。hook 返回 error + data 非空时：data 缺字段 → 归入 (2) 降级；error 仅 warning → 不降级。见 ADR-0004。
_Avoid_: `!!error` 一揽子判定（warning + data 时误触发）、"SDK 挂了"（太模糊）

**V3 Fallback Path**:
`Pool.getUserReserveData(asset, user)` → `currentATokenBalance` / `currentStableDebt` / `currentVariableDebt`（直接值，零换算）。合约地址从 address-book 取。
_Avoid_: UiPoolDataProvider（缩放值需额外换算，已否决）

**V4 Fallback Path**:
遍历 `V4_SPOKE_ADDRESSES` 所有链（不硬编码 chainId=1），同链 Spoke 并行，同 Spoke 内 Multicall3 批量。`getUserSuppliedAssets`/`getUserDebt`（直接值零换算）。`totalDebtValueRay` 入口处统一 `/ RAY` 降精度。合约地址从 address-book 取。

**Spoke Discovery**:
遍历 address-book 中所有 Spoke，Multicall3 批量聚合查询。不做"先探再查"。
_Avoid_: 后端 reserves 推断（可能遗漏新 Spoke）

**Tech Debt: onchain 查询 spokeAddress 来源**:
`getV4UserPositionsAllSpokes` 通过 `V4_SPOKE_ADDRESSES`（从 `@aave-dao/aave-address-book` 导入）以 spokeName 反查 spokeAddress，而非从 reserveId 解析。当前可行（address-book 跟随链上部署更新），但新增 Spoke 时需等 address-book 发版。未来可改为从 reserveId 第2段直接获取 spokeAddress，消除对 address-book 的依赖。

**RPC Rotation**:
多 public RPC URL 逐个试连通性（`getChainId` 验证），首个可用即用。全挂才返回 null。见 ADR-0004。
_Avoid_: 单 URL 首选 + 失败静默空（`createClientWithRetry` 名不副实）

**Fallback Timeout Budget**:
onchain fallback / gap fallback 均独立 15s request timeout（`withTimeout`），超时走 `failedSources` + 返回已拿到的部分数据。对齐 AAV-388 PRD "RPC fallback independent 15s timeout"。

**WalletPositionSource**:
仓位数据来源枚举：`'sdk'`（SDK 返回）、`'onchain-v3'`/`'onchain-v4'`（onchain fallback 全量替代）、`'gap-v3'`/`'gap-v4'`（gap fallback 补差集）。Portfolio 侧 `PositionSource` 同步此枚举。`userPositionMapper.ts` 和 `portfolio.ts` 的类型守卫由 `architecture-guard.test.ts` 自动同步验证。

**Portfolio Input Mode Toggle**:
Portfolio 模式下每个 position 的 supply/borrow 侧有独立的 $/T 切换按钮（`PortfolioInputMode = 'usd' | 'token'`）。切换时自动按 `priceInUsd` 转换数值：USD→Token = `amount / price`，Token→USD = `amount × price`。price ≤ 0 或 undefined 时清空输入值。supply/borrow 两侧独立，互不影响。结果区域（PortfolioResultsTable / PortfolioSummaryCard）始终以 USD 显示，因为多 token 单位不同只能统一。
_Avoid_: 清空输入（非 portfolio 模式的行为，portfolio 应转换而非清空）、联动两侧切换

**Portfolio Merge**:
同 token 同 side = 替换（链上为准）；同 token 不同 side = 加缺失 side；全新 token = 直接加入；链上没有但 Simulator 有 = 保留；找不到 reserveId = orphan。

**Merge Match Key**:
reserveId 作为仓位匹配的唯一 key（方案 A）。reserveId 本身已编码 chain 信息（格式如 `v3-ethereum-0x...`），side 隐含在记录本身（supply/borrow 是两条独立记录）。禁止用 `(tokenAddress, chainId, side)` 组合 key 做主匹配——仅作为 `resolvePositionMeta()` 的查找路径，最终仍以 reserveId 锚定。
_Avoid_: 组合 key 做主匹配（方案 B）——冗余且易漏 side

**Dual-Value Tracking**:
`walletValue: number | null`（链上值，null = 钱包无/断连）+ `currentValue: number`（Simulator 当前值）+ `hidden: boolean`（soft delete）。列表排序：钱包仓位（至少一侧 `walletValue !== null`）排最上面，纯手动仓位排中间，hidden 仓位沉底。无钱包图标显示——Eraser 按钮承担"恢复到钱包值"功能。

**Wallet Disconnect Behavior**:
断连时自动清除所有钱包来源的 entry（任一侧 `walletValue !== null` 的 entry 整条删除），手动添加的 entry（两侧 `walletValue` 均为 `null`）保留不动。无钱包 entry 可清时静默（不 toast）。有钱包 entry 被清除时 toast "Removed N wallet position(s)"。实现位置：`usePortfolioSimulation` 新增 `removeWalletEntries()` action，`useWalletAutoImport` 在 `!isConnected` 时调用。
_Avoid_: 清空全部 entry（包括纯手动的）、按 side 分别清除（破坏 Supply-Borrow Inseparability）、不清除钱包 entry

**Wallet Address Switch Behavior**:
切换钱包地址（含 watch mode 切换）时：清空 Simulator 中 `source: 'wallet'` 的仓位，保留 `source: 'manual'` 仓位不动，然后自动 sync/import 新地址的链上仓位。钱包仓位始终属于当前连接地址，切换 = 替换钱包部分。
**Watch Mode 重新提交地址（同地址或新地址）也按 refresh 处理**——这是 user-initiated 的 "我想看最新数据" 意图，与 F5、Refresh 按钮走同一条 refresh 通道（详见 [Refresh Action](#refresh-action)）。_Avoid_: 混合多地址仓位（方案 α）、清空全部含手动仓位（方案 γ）、把 re-submit 当成独立 case 走特殊代码路径

**Force Sync Action**:
Portfolio 面板中的 Force sync 按钮（`CloudDownload` 图标，`data-testid="wallet-sync-button"`）。行为：对钱包来源仓位（`walletValue !== null`）直接覆盖为最新链上值（delta 归零），手动仓位中如果 incoming 有对应 reserveId 的钱包仓位数据（`incomingSide.walletValue !== null`），也更新 `walletValue`/`source`（保留用户已输入的 amount/delta）。与自动导入（`useWalletAutoImport`，走 `mergeEntriesWithDelta` 保留 delta）不同——Force sync 是用户主动"我要放弃修改、复位到链上"的意图。图标：idle=`CloudDownload`（云+下载箭头，语义：从云端/链上拉取），loading=`RefreshCw`（旋转）。文案：title=`Force sync`，aria-label=`Force sync wallet positions`，loading 时 `Syncing…`。toast 成功=`Synced N positions from wallet`。

**Refresh Action**:
一个 user-initiated 或 user-equivalent 的 "强制重新拉取仓位数据" 信号。**三条触发路径走同一个 module-scope emitter**（`refetchEvent`）：
1. F5 / 整页 reload — React tree 重新 mount，所有 query hook 走初始 fetch
2. Refresh 按钮（若存在）— UI onClick 调 `refetchEvent.bump()`
3. Watch Mode 重新提交地址（reentry，同/不同地址）— `useWatchModeConnect` 在 isReentry 分支调 `refetchEvent.bump()`

下游消费者（`useUserPositionsSdk` 内部）通过 `useEffect` 订阅 `refetchEvent`，收到 bump 时：
- 调 RQ 的 `queryClient.invalidateQueries(['user-positions-onchain-fallback', address, ...])`
- 通过 `@aave/react` 暴露的 urql client 调 `client.refetchQueries()` 覆盖 V3 + V4 两条 query

**为什么是 module-scope emitter**（不是 React state / Context / refetchTrigger prop）：
- 绕开 wagmi `useSyncExternalStore` 的 `Object.is` 过滤（同地址 reentry 时 React tree 不会 re-render，prop 永远传不下去）
- 绕开 `useMemo` 的引用稳定（urql/RQ 看不到"值变了"的信号）
- 三个触发路径共享同一段 invalidation 代码，不留边角 case
详见 ADR-0015。_Avoid_: 三个路径各写一份 invalidate 逻辑、用 React state 传 nonce（同地址 reentry 不会触发 re-render）、直接 `location.reload()`（违反 manual 仓位保留规则）

**Supply-Borrow Inseparability**:
一个 reserve 的 supply 和 borrow 永远作为一体操作——隐藏/删除/恢复作用于整个 reserve（supply + borrow 一起），不允许独立隐藏单个 side。这跟 Aave 协议的 Reserve 模型一致：Reserve 是原子单元，supply/borrow 是它的两个属性而非独立实体。数据模型层面通过 `PortfolioReserveEntry`（per-reserve）来强制保证，编译时即不可能出现单 side 缺失。`PortfolioPosition`（per-side）已被删除。详见 ADR-0014。
_Avoid_: 独立隐藏/删除 supply 或 borrow（破坏 Reserve 原子性）、per-side 数据模型（允许单 side 缺失）

**Soft Delete**:
条件软删除：删除行为根据 entry 是否有 wallet position 分叉。有 wallet position（任一侧 `walletValue !== null`）→ `hideReserve`（软删除，`hidden: true`，灰+沉底+EyeOff 图标+点击恢复）。纯手动 entry（两侧 `walletValue === null`）→ `removeReserve`（硬删除，直接从 entries 移除，无数据损失风险）。`clearAll` 同理：有 wallet entry → hidden，纯手动 → 硬删除。Resync/merge 时 hidden → 强制 unhidden。按 Supply-Borrow Inseparability，软删除作用于整个 reserve（同 reserveId 的所有 position 一并 hidden/unhidden）。`addReserve` 在遇到已 hidden 的 entry 时自动 unhide 而非跳过。`undoLastRemove` 已移除（hide 有 eye-off 一键恢复，remove 是空数据无需 undo）。`removeHiddenEntries` 已移除（无消费者）。
_Avoid_: 对纯手动 entry 软删除（没有恢复价值，白占内存）、Undo toast 机制、只 hidden 一个 side

**Watch Mode UI**:
Header + PortfolioPanel 两处入口，语义保持一致。Watch Mode 和真实钱包互斥：同一时间只能有一个 active account，切换 Watch Mode 等同于切换当前钱包地址。Disconnected 状态入口文案统一为 "View address"。Connected 状态 popover 统一三项菜单：Switch wallet（Wallet 图标，打开 RainbowKit 钱包选择）、View another address（Eye 图标，跳到地址输入）、Disconnect（X 图标，断开）。无论当前是钱包连接还是 View address，菜单结构完全一致。Header 桌面端 disconnected 状态并列显示 "Connect" 和 "View address"，移动端用同一个圆形钱包按钮打开紧凑菜单承载两个动作。Watch Mode 用 Eye 图标 + tooltip "Viewing" 区分于钱包连接的绿色点，地址输入支持 ENS 解析。
_Avoid_: Watch Mode 和真实钱包并存、先断开真实钱包才能 Watch、把 Watch Mode 当作 RainbowKit 钱包选项依赖、行内常驻输入框（占 Header 空间）、二次弹窗输入地址、UI 中暴露 "watch mode" 技术术语

---

## Delta-Based Simulation (Stock-Flow Separation)

**Delta**:
Rate simulation 的输入增量 = 用户调整后金额 - 链上存量。`delta = parseNumberInput(position.amount) - (position.walletValue ?? 0)`。仅 delta 影响 after rate（改变 utilization），链上存量已在 `totalLiquidity` 中，不算 delta 的一部分。
_Avoid_: 把 position.amount 整体当 simulation input（导致链上存量 double-count）

**Effective Amount**:
收益计算的本金 = 链上存量 + delta = 用户在 UI 上设置的 amount。`effectiveAmount = walletValue + delta`。收益 = afterRate × effectiveAmount。
_Avoid_: 用 delta 算收益（只算增量部分利息，遗漏存量部分）

**Stock-Flow Separation**:
Rate simulation 内部将 stock（链上存量）和 flow（用户增量）分开处理：flow 进入 utilization 计算改变 after rate，stock + flow 合并作为收益计算的 principal。`buildRateSimulationResult` 新增 `totalSupplyUsd`/`totalBorrowUsd` 参数（旧名 `principalUsd`）与 `supplyInputUsd` 分开。Shared Scenario（纯增量）传 `totalSupplyUsd = supplyInputUsd` 保持原行为。
_Avoid_: 单一值既当 simulation input 又当 principal（Shared Scenario 可以，Portfolio 不行）

**Delta Sync Policy**:
链上值变化时 delta 固定不变（用户意图"额外加 $500"不因链上波动改变）。effective amount = 新 walletValue + 原始 delta。
_Avoid_: effective amount 固定（链上波动时用户意图应是 delta 不变）

---

## Rate Simulation Phases

**buildCurrentRates**:
Phase 1 of rate simulation. 从 reserve/API 数据组装当前利率值（A 类字段）。不执行 rate model，不依赖用户模拟输入。输出不随 simulation input 变化。
_Avoid_: computeSnapshot（Phase 1 不是执行模拟模型，而是组装已有数据）

**calcPredictedRates**:
Phase 2 of rate simulation. 基于用户模拟输入执行 rate model 预测未来利率（B 类字段）。调用 `simulateNativeRatesAfterActions`。输出随 simulation input 变化。无输入时返回 nullPrediction（After/Delta 全 null）。
_Avoid_: computeSimulation（"Prediction" 比 "Simulation" 更精确——本质是预测而非模拟）

### A/B 类字段分类标准

**语义依赖**："用户改了 simulation input，这个值会变吗？"——非实现依赖。例：`availableBorrowRoomUsd` 实现上依赖 `availableLiquidityForBorrowUsd`（含 `effectiveSupplyInputUsd`），supply input 会影响此值，但 borrow input 不会 → 归入 A/B 混合类（多数场景视为 A 类）。

**A 类（Current Snapshot）**：当前快照值。有模拟用模拟，无模拟 fallback 到 API 原值 → "当前值永远显示"。

**B 类（Simulated Prediction）**：模拟预测值。无模拟 = null，无 fallback → "没模拟就没模拟值"。

### A 类字段清单

`totalBorrowedUsd`, `availableLiquidityUsd`, `utilization.current`, `optimalUtilization`, `supplyCapUsd`, `borrowCapUsd`, `protocolFee`, `tokenPrice`, `atSupplyCap`/`nearSupplyCap`/`atBorrowCap`/`nearBorrowCap`, `availableSupplyRoomUsd`, `availableBorrowRoomUsd`, `supply.current*`, `borrow.current*`, `spread.current`

### B 类字段清单

所有 `*After`/`*Delta`, `supply.after*`/`supply.delta*`, `borrow.after*`/`borrow.delta*`, `spread.after`/`spread.delta`, `utilization.after`/`utilization.delta`, `borrowLimitedByLiquidity`, `scenarioUsdAccrual`

---

## Example Dialogue

> **Dev**: 为什么 `meritForecast.ts` 里有 deposit ceiling 而 `merklForecast.ts` 里没有？
>
> **Domain Expert**: 因为 Merit Program 给每个用户设了存款上限（Deposit Ceiling），超出就不算奖励。Merkl Campaign 不限单用户存款，它限的是整个 campaign 的预算。
>
> **Dev**: 那 `supplyCapUsd` 也是上限，跟 Deposit Ceiling 有什么区别？
>
> **Domain Expert**: Supply Cap 是 pool-wide 的——整个池子最多存这么多，Aave 协议参数。Deposit Ceiling 是 per-user 的——单个用户最多存这么多，Merit 自己的规则。两个完全不同的概念。
>
> **Dev**: 明白了。所以 ceiling 是 per-user，cap 是 pool-wide。
>
> **Domain Expert**: 对，这就是我们的命名约定。

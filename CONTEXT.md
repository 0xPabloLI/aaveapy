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

**Merkl Campaign**:
Merkl 协议分发的激励活动。按活动类型分三种：Dutch Auction（衰减拍卖）、MAX（APR 上限 + 追补）、FIX（固定 APR 预算）。
_Avoid_: Merkl Reward, Merkl Incentive

**Merit Program**:
Aave 官方的 Merit 激励项目。有 per-user deposit ceiling 和 self-cap 模型，独立于 Merkl Campaign。
_Avoid_: Merit Reward, Merit Incentive

**Brevis Incentive**:
Brevis 协议分发的激励。有 per-user reward ceiling 模型。
_Avoid_: Brevis Campaign, Brevis Program

**Tydro Points**:
仅 Merkl Campaign 的可选 points 路径产出的积分。转换公式：`points × pointToUsdRate × 36.5`。Merit / Brevis / 协议激励**不是** Tydro Points。
_Avoid_: Points（太泛）

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

**Deposit Ceiling**:
Per-user 存款上限。Merit 自有模型中限制单个用户能存入的金额。
_Avoid_: Per-User Deposit Cap, Self Cap

**Reward Ceiling**:
Per-user 奖励上限。Brevis 模型中限制单个用户能获得的奖励金额。
_Avoid_: Per-User Reward Cap

**Supply Cap / Borrow Cap**:
Pool-wide 总量上限。Aave 协议参数，限制整个池子的存款/借款总量。与 Ceiling（per-user）是不同概念。
_Avoid_: Supply Ceiling, Borrow Ceiling（Ceiling 保留给 per-user 语义）

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

## Wallet Portfolio

**Portfolio Mode**:
Multi-reserve simulation mode where users manage aggregate positions across multiple assets (supply/borrow per reserve). Toggled via `PortfolioModeToggle`; internally `SimulationMode = 'single' | 'portfolio'`. UI uses "Portfolio" label exclusively — no "Batch" anywhere.
_Avoid_: Batch Mode, Batch toggle, "Build your batch portfolio"

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
`walletValue: number | null`（链上值，null = 钱包无/断连）+ `currentValue: number`（Simulator 当前值）+ `hidden: boolean`（soft delete）。三态视觉：🟢 钱包同步未改、🟡 钱包同步已改（可恢复）、⚪ 纯手动。

**Wallet Disconnect Behavior**:
断连时 `walletValue → null`，`currentValue` 保持不变。重连时重新 sync 刷新 walletValue。
_Avoid_: 清空 currentValue（用户可能还在操作 Simulator）

**Wallet Address Switch Behavior**:
切换钱包地址（含 watch mode 切换）时：清空 Simulator 中 `source: 'wallet'` 的仓位，保留 `source: 'manual'` 仓位不动，然后自动 sync/import 新地址的链上仓位。钱包仓位始终属于当前连接地址，切换 = 替换钱包部分。
_Avoid_: 混合多地址仓位（方案 α）、清空全部含手动仓位（方案 γ）

**Soft Delete**:
方案 A+沉底：灰+沉底+EyeOff 图标+点击恢复一步操作。Resync 时 hidden → 强制 unhidden。
_Avoid_: 完全隐藏（用户不知道仓位存在）、Undo 机制

**Watch Mode UI**:
Header + PortfolioPanel 两处入口，语义保持一致。Watch Mode 和真实钱包互斥：同一时间只能有一个 active account，切换 Watch Mode 等同于切换当前钱包地址。入口文案统一为 "View address"，连接后的状态文案统一为 "Viewing"；真实钱包已连接时仍提供显式的 "Switch to watch mode" 入口。Header 桌面端 disconnected 状态并列显示 "Connect" 和 "View address"，移动端用同一个圆形钱包按钮打开紧凑菜单承载两个动作。Watch Mode 用 Eye 图标 + tooltip "Viewing" 区分于钱包连接的绿色点，地址输入支持 ENS 解析。
_Avoid_: Watch Mode 和真实钱包并存、先断开真实钱包才能 Watch、把 Watch Mode 当作 RainbowKit 钱包选项依赖、行内常驻输入框（占 Header 空间）、二次弹窗输入地址

---

## Delta-Based Simulation (Stock-Flow Separation)

**Delta**:
Rate simulation 的输入增量 = 用户调整后金额 - 链上存量。`delta = parseNumberInput(position.amount) - (position.walletValue ?? 0)`。仅 delta 影响 after rate（改变 utilization），链上存量已在 `totalLiquidity` 中，不算 delta 的一部分。
_Avoid_: 把 position.amount 整体当 simulation input（导致链上存量 double-count）

**Effective Amount**:
收益计算的本金 = 链上存量 + delta = 用户在 UI 上设置的 amount。`effectiveAmount = walletValue + delta`。收益 = afterRate × effectiveAmount。
_Avoid_: 用 delta 算收益（只算增量部分利息，遗漏存量部分）

**Stock-Flow Separation**:
Rate simulation 内部将 stock（链上存量）和 flow（用户增量）分开处理：flow 进入 utilization 计算改变 after rate，stock + flow 合并作为收益计算的 principal。`buildRateSimulationResult` 新增 `principalUsd` 参数与 `supplyInputUsd` 分开。Shared Scenario（纯增量）传 `principalUsd = supplyInputUsd` 保持原行为。
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

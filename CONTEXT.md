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
单个字段作为 reserve 的 canonical key。代码中禁止用 `(underlyingAsset, chainId)` 组合作为 key 的 fallback 路径。
_Avoid_: Composite key, (underlyingAsset, chainId) pair

## External Links

**Aave V3 URL** (`buildAaveReserveUrl` / `buildAaveMarketUrl`):
指向 `app.aave.com` 的 V3 市场/资产页面。参数为 `marketName` + `tokenAddress`。

**Aave V4 URL** (`buildAaveV4Url` / `buildAaveV4HubUrl` / `buildAaveV4MarketUrl` / `buildAaveV4AssetUrl`):
指向 `pro.aave.com` 的 V4 深度链接。`buildAaveV4MarketUrl` 生成 spoke 跳转：`/explore/market/{spokeId}`（非 `/explore/spoke/`，后者 404）。`buildAaveV4HubUrl` 生成 hub 跳转：`/explore/hub/{hubId}`。

**Link Priority**:
Market chip 外链优先级：tydro > aaveV4MarketUrl (spoke) > aaveMarketUrl (V3)。`buildAaveUrl` 统一入口：V4 优先于 V3。

_Avoid_: `buildAavePro*`（已重命名为 `buildAaveV4*`），`AAVE_PRO_BASE`（已重命名为 `AAVE_V4_BASE`）

## Wallet Portfolio

**Onchain Fallback**:
SDK GraphQL（主路径，跨链）失败时，从 `@aave-dao/aave-address-book` 提取 chain ID 集合，逐链并行查 RPC 的 Pool/Spoke 合约。不硬编码链列表。
_Avoid_: private RPC（前端只用 public RPC）

**SDK Degradation Boundary**:
仅以下情况视为 SDK 故障并降级到 onchain fallback：(1) GraphQL 网络错误（5xx / timeout / fetch reject）；(2) hook 抛 JS 异常（type guard 失败 / 字段缺失）；(3) `AaveClient.create()` 初始化失败。空数组/空仓位 = 合法结果，不降级（见决议 #11：0 仓位 vs SDK 失败必须区分）。hook 返回 error + data 非空时：data 缺字段 → 归入 (2) 降级；error 仅 warning → 不降级。
_Avoid_: "SDK 挂了"（太模糊——需明确是基础设施故障还是合法空结果）

**V3 Fallback Path**:
`Pool.getUserReserveData(asset, user)` → `currentATokenBalance` / `currentStableDebt` / `currentVariableDebt`（直接值，零换算）。合约地址从 address-book 取。
_Avoid_: UiPoolDataProvider（缩放值需额外换算，已否决）

**V4 Fallback Path**:
Spoke 串行，同 Spoke 内 Multicall3 批量。`getUserSuppliedAssets`/`getUserDebt`（直接值零换算）。`totalDebtValueRay` 入口处统一 `/ RAY` 降精度。合约地址从 address-book 取。

**Spoke Discovery**:
遍历 address-book 中所有 Spoke，Multicall3 批量聚合查询。不做"先探再查"。
_Avoid_: 后端 reserves 推断（可能遗漏新 Spoke）

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
切换钱包地址（含 watch mode 切换）时：清空 Simulator 中 `source: 'wallet'` 的仓位，保留 `source: 'manual'` 仓位不动，然后 import 新地址的链上仓位。钱包仓位始终属于当前连接地址，切换 = 替换钱包部分。
_Avoid_: 混合多地址仓位（方案 α）、清空全部含手动仓位（方案 γ）

**Soft Delete**:
方案 A+沉底：灰+沉底+EyeOff 图标+点击恢复一步操作。Resync 时 hidden → 强制 unhidden。
_Avoid_: 完全隐藏（用户不知道仓位存在）、Undo 机制

**Watch Mode UI**:
Header + PortfolioPanel 两处入口。Header 图标点击 → RainbowKit 弹窗（watchMode connector 作为钱包选项嵌入）→ 选后弹窗关闭 → Header 地址区内联展开输入框 → Enter 确认 / ESC 取消。已连接状态：地址缩略 + 下拉菜单（disconnect/switch）。Watch mode 用 Eye 图标 + tooltip "Viewing" 区分于钱包连接的绿色点。输入框支持 ENS 实时解析（debounce 300ms + useEnsName）。移动端：圆形钱包图标（同 FAQ/Clock 按钮）+ 连接后缩略地址。
_Avoid_: 行内常驻输入框（占 Header 空间）、二次弹窗输入地址

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

# Handoff: Wallet + Merkl + Portfolio Import（已完结）

> **状态**: Epic 已完结。AAV-66/67/68/69/80 → Done，AAV-62 → Canceled。实现入口见 `docs/handoff-wallet-positions.md`。

## 决议

1. **连钱包 = 自动导入**（不需要 Import 按钮）
2. **不需要用户确认** — 永远静默 merge + toast（决议 #12）
3. **RainbowKit** 用于 wallet connection（决议 #11）
4. **链上仓位 inputMode = 'usd'**（USD 估值）
5. **Merge 冲突策略 = 替换（链上为准）**：同 token 同 side → 替换为链上值
6. **Undo 不可行**：时序问题，import 后用户又改了值，Undo 回到哪个状态？
7. **重新 import = 覆盖为链上值**
8. **Soft delete（方案 A+沉底）**：钱包同步仓位删除 → 原位变灰+自动沉底+点击行恢复（一步操作）；纯手动仓位删除 → 真删。EyeOff icon + "hidden" 标签
9. **Wallet Sync 按钮**：自定义 UI（RainbowKit 不提供），钱包已连时可见（未连时隐藏），放在地址旁，仅 icon（RefreshCw）无文字
10. **不做 PWA 自动 sync**：切回 tab 时不自动 sync，可加非侵入式提示（正式版考虑）
11. **0 仓位 vs SDK 失败必须区分**：0 仓位 = 确定性结果（绿色确认），SDK 失败 = 不确定性（橙色警告 + 重试）
12. **UI 文本全英文**：Connect / Disconnect / Restore / Hidden / Retry 等可见标签一律英文
13. **场景 9a 拆为 9a1 + 9a2**：9a1 = 空 Simulator + 0仓位（绿条）；9a2 = 已有手动仓位 + 0仓位（绿条 + 手动仓位保留）
14. **Hidden 灰行显示钱包标识**：soft delete 的灰行仍需显示🟢/🟡图标
15. **Resync 时 hidden 仓位 → 强制 unhidden**
16. **0 仓位提示 ~5s 后自动消失**
17. **SDK 失败提示持久显示**
18. **Wallet Sync ≠ Market Data Refresh**：两个不同概念，交叉触发（决议 #25）
19. **切回 tab / 刷新页面 = 同时更新两者**
20. **Sync 按钮状态设计规范**：idle / loading / has-update 遵循同一视觉规范
21. **Hidden 标识位置移到行末**：顺序 `[🟢/🟡 Wallet → EyeOff]`
22. ~~Sync 按钮具体状态规范~~：已被 #23 取代
23. **Sync has-update 视觉语言统一为 freshness dot**
24. **Manual 仓位列对齐**：不可见占位符 `w-3.5 h-3.5 shrink-0` + `aria-hidden`
25. **两个 Refresh 按钮保留，交叉触发**：各带独立 freshness dot，仅 icon 无文字
26. **Orphan 仓位可见但 simulate 灰掉**

## ReservesTable 准入标记设计决策

1. **行级 indicator**：不加 — 维持现状
2. **useCampaignAccess 与 whitelistMerklCampaignIds 联动**：静默覆盖 — 不修改用户手动勾选的 Set，计算激励值时强制 excluded
3. **提示形式**：灰显 + tooltip 顶部警告条
4. **代码接入点**：修改 `isMerklWhitelistBreakdownIncluded` — 加 `campaignAccessStatus` 参数

## Merge 语义

| 场景 | 语义 | 举例 |
|------|------|------|
| 同 token 同 side | **替换**为链上值 | 已有 USDC supply $2000 → import $5000 → 变 $5000 |
| 同 token 不同 side | 直接加缺失 side | 已有 USDC supply → import 含 USDC borrow → 加 borrow 行 |
| 全新 token | 直接加入 | 已有 USDC → import WETH → 加 WETH 行 |
| 链上没有但 Simulator 有 | 保留不动 | Simulator 有 DAI → 链上没有 → DAI 不变 |
| 找不到 reserveId | orphan：可见但 simulate 区域灰掉 | rETH 不在 reserves → 仓位可见，APY/奖励等灰 |

## 双值追踪模型

- `walletValue: number | null` — 钱包同步的链上值
- `currentValue: number` — Simulator 当前值
- `hidden: boolean` — soft delete 标记

三态视觉：🟢 synced（Wallet emerald）、🟡 modified（Wallet amber + dot）、⚪ manual（invisible placeholder `size-3.5`）

Minus 按钮条件逻辑：wallet 来源 → toggleHidden；manual 来源 → 真删 remove

## 11 个场景（全部验证通过 ✅）

场景 1-9b 全部 PASS（含 merge 逻辑、三态图标、soft delete 沉底+恢复、re-sync 覆盖、0仓位/SDK失败区分）。

## 已完成（按里程碑）

### M1: Watch Mode UI ✅ — AAV-485 closed
- `WatchAddressInput.tsx` + test
- `WalletButton.tsx` + test
- Header 集成 ✅：`Header.tsx` 已传 `onWatchSubmit={connectWatchAddress}`
- PortfolioPanel 集成 ✅：已传 `onWatchSubmit={connectWatchAddress}`
- watchModeConnector (wagmi v3 createConnector)

### M2: Portfolio Simulation Soft Delete ✅
- 双值追踪模型（walletValue / currentValue / hidden）
- Soft delete A+沉底（灰+沉底+EyeOff+点击恢复）
- 三态图标（🟢🟡⚪）
- Wallet Sync 按钮（仅 icon RefreshCw）
- 11 场景 Playwright 验证

### M3: ReservesTable 准入标记 ✅
- `isMerklWhitelistBreakdownIncluded` 加 `campaignAccessStatus` 第三参数 + 3 测试
- `IncentiveCalculationOptions` 加 `campaignAccessStatuses` 字段
- 全调用点更新（~22 处）：incentiveAggregation / rateSimulationCalculator / merklCampaigns / IncentiveTooltip
- IncentiveTooltip 警告条 UI：`hasIneligibleCampaigns` useMemo + 顶部警告条
- prop 透传链：ReservesTableTooltipOverlay → TopOpportunities → ReservesTable → **pages/Index.tsx**
- Index.tsx：`useCampaignAccess()` hook 调用 + `campaignAccessStatuses` 传给 `<ReservesTable>` + `<TopOpportunities>`
- 验证门全通过：tsc ✅ / test 2113 passed ✅ / build ✅

### M4: 旧 prototype 清理 ✅
- 删除 PortfolioImportModalProto.tsx + PortfolioImportProto.tsx + App.tsx 引用/路由

## Grill 验证结论（Session 2 完成）

### Q1: `chainIdLookup.ts` → ❌ 不需要
- `campaignId→reserveId` 关系已通过数据嵌套隐含（`reserve.merklSupplys[].breakdowns[].campaignId`）
- `campaignAccess` payload 按 `campaignId` 索引，IncentiveTooltip 直接查表
- `offsetReserveIds` 存的就是 reserveId 格式字符串，通过现有 `Map<reserveId, ReservePositions>` 做 O(1) 查找

### Q2: `PortfolioImportModal` → ❌ 不需要 Modal
- 连钱包 = 自动导入，静默 merge + toast，永远不需要用户确认
- **plan Phase 3（627-635 行）的预览 Modal + Merge/Replace/Append 三选一 + 确认按钮 → 必须删除**
- Prototype `PortfolioMergeProto.tsx` 10 个场景全部用 toast / inline 提示，无 Modal

### Q3: Merkl Rewards 展示区
- **位置**：PortfolioPanel 内，Portfolio 子区，钱包连接后才可见
- **形式**：详细行列表——每个 MerklClaimable 一行：token symbol + chain + claimable amount + 已领取/待结算 + breakdown 折叠
- **数据层** ✅：`merklUserClient.ts`
- **hook 层** ✅：`useUserClaimableRewardsSdk.ts`
- **UI 层** ✅：PortfolioPanel 内 `claimableRewards` prop 渲染

### Q4: SDK 首选路径 ✅ 完全确认

#### 降级策略 = 方案 B（按版本独立降级）
- V3 SDK 挂 → V3 走 viem；V4 SDK 挂 → V4 走 viem；各自独立
- 理由：V3 和 V4 是完全不同的 SDK 实例和 API，故障不相关

#### V3 SDK
- **前端包**：`@aave/react@^0.9.1`（npm `@latest` tag）— 封装了 `@aave/client@0.11.0` + React hooks + AaveProvider
- **后端包**：`@aave/client@^0.6.1`（纯 client，无 React）
- **官方 V3 前端同款**（`/Users/pabloli/Documents/code/interface/` 已验证：`@aave/react@0.9.1` + `@aave/graphql@0.12.0` + `@aave/contract-helpers@1.38.0`）
- **仓位路径 B（推荐）**：`userSupplies` + `userBorrows` 独立查询（字段完整：isCollateral/apy/balance.usd/debt.usd/currency）
- **仓位路径 A（补充）**：`markets({ chainIds, user })` → `Market.userState`（聚合指标：healthFactor/netAPY/netWorth）
- **Client 创建**：`AaveClient.create({ environment: production })`

#### V4 SDK
- **前端包**：`@aave/react@^4.2.0`（npm `@next` tag）— 封装了 `@aave/client@4.2.0` + React hooks + AaveProvider + Suspense/Pausable
- **后端包**：`@aave/client@^4.2.0`（aliased as `@aave/client-v4`，纯 client，无 React）
- **官方文档推荐 `@next`**，后端 repo 同策略
- **Client 创建**：`AaveClient.create()`（无需 environment 参数）
- **仓位 hook**：`useUserPositions` / `useUserSupplies` / `useUserBorrows`
- **摘要 hook**：`useUserSummary`（healthFactor/netApy/netBalance）
- **奖励 hook**：`useUserClaimableRewards` → `UserMerklClaimableReward`
- **V4 特有**：Suspense + Pausable + Action hooks + `@aave/react/viem` sub-path export

#### V3 vs V4 对比

| 维度 | V3 SDK | V4 SDK |
|---|---|---|
| 前端包 | `@aave/react@^0.9.1` (`@latest`) | `@aave/react@^4.2.0` (`@next`) |
| 后端包 | `@aave/client@^0.6.1` | `@aave/client@^4.2.0` |
| Client 创建 | `AaveClient.create({ environment: production })` | `AaveClient.create()` |
| 仓位 hook | `useUserSupplies` / `useUserBorrows` | `useUserSupplies` / `useUserBorrows` / `useUserPositions` |
| isCollateral | ✅ `MarketUserReserveSupplyPosition.isCollateral` | ✅ `UserSupplyItem.isCollateral` |
| USD 换算 | ✅ `TokenAmount.usd` | ✅ `Erc20Amount.exchange.value` |
| healthFactor | ✅ per-market `MarketUserState.healthFactor` | ✅ `UserPosition.healthFactor.current` / `UserSummary.lowestHealthFactor` |
| 奖励 | `useUserMeritRewards` | `useUserClaimableRewards` |
| Suspense/Pausable | ❌ | ✅ |
| Action hooks | ❌ | ✅ |
| viem sub-path | ❌ | ✅ `@aave/react/viem` |

#### V4 类型字段映射（从 graphql fragments 源码确认 ✅）

| SDK 类型 | 关键字段 | 映射到项目 |
|---|---|---|
| `UserSupplyItem` | `isCollateral: boolean`, `balance.exchange.value` (USD) | `WalletPosition.isCollateral`, `WalletPosition.amountUsd` |
| `UserBorrowItem` | `debt.exchange.value` (USD) | `WalletPosition.amountUsd` |
| `UserPosition` | `healthFactor.current`, `netApy`, `netBalance` | Portfolio 聚合指标 |
| `UserClaimableReward` | `claimable: Erc20Amount` (token+amount+exchange) | `MerklClaimable` |
| `UserSummary` | `lowestHealthFactor`, `netApy` | 全局摘要 |
| `Erc20Amount` | `amount.value`, `exchange.value` (USD), `token.info.symbol` | 金额+USD换算 |

#### 分工原则
- **前端用 `@aave/react`**（React hooks 封装），**后端用 `@aave/client`**（纯 Node.js client）
- 两条版本线一致（V3: 0.x / V4: 4.2.0），只是前端多了 React 层

## 剩余待做（按优先级，grill 后更新）

全部已完成 ✅

| # | Item | 状态 |
|---|------|------|
| 1 | **SDK 首选路径** — 安装 `@aave/react` + 实现 SDK hook + viem fallback | ✅ Slice 1~6 |
| 2 | **Portfolio 自动导入** — 连钱包=静默 merge + toast（无 Modal） | ✅ Slice 2 |
| 3 | **Merkl Rewards 展示区** — hook 层 + UI | ✅ Slice 4 |

## PRD & Linear

- PRD 已发布到 Linear（project id: `69e00ecd-f6fe-4218-a3e6-fc459cf19edc`），没有单独的 PRD 文档文件
- PRD Document id: `db0dfcab-e233-424d-8d6b-2a0cf435a8f6`

## 关键文件索引

### 用户仓位数据链路（SDK 实现重点）
- `src/hooks/useUserPositions.ts` — 当前只有 viem multicall，**需改为 SDK 首选 + onchain fallback**
- `src/lib/userData/userPositionMapper.ts` — WalletPosition 类型（已预留 `source: 'sdk'` 但未使用）
- `src/lib/userData/onchainPositionConverter.ts` — V3/V4 onchain → WalletPosition 转换（已完成）
- `src/lib/userData/aaveV3UserClient.ts` — V3 viem multicall（已完成，将降级为 fallback）
- `src/lib/userData/aave-v4UserClient.ts` — V4 viem multicall（已完成，将降级为 fallback）
- `src/lib/userData/merklUserClient.ts` — Merkl SDK API + Zod schema + MerklClaimable 类型（已完成）
- `package.json` — **需新增 `@aave/react@^0.9.1` + `@aave/react@^4.2.0`**

### Aave SDK 本地源码（只读参考）
- V3 官方前端：`/Users/pabloli/Documents/code/interface/`（`@aave/react@0.9.1` 用法参考）
- V4 SDK monorepo：`/Users/pabloli/Documents/code/aave-v4-sdk/`（4.2.0，hooks + fragments 源码）
  - `packages/graphql/src/fragments/` — V4 类型定义（user.ts / rewards.ts / common.ts / reserve.ts）
  - `packages/react/src/` — V4 React hooks（user.ts / rewards.ts）
- 后端 repo：`/Users/pabloli/Documents/code/aave-protocol-analysis/`（`@aave/client` dual-version 策略参考，后端 V3 用 `@aave/client@^0.6.1`，V4 用 `@aave/client@^4.2.0`，均为纯 client 非 React）

### 准入标记相关（M3）
- `src/hooks/useCampaignAccess.ts` (69行) — `getUserCampaignStatus()` + `useCampaignAccess()` hook
- `src/hooks/useCampaignAccess.test.ts` (61行) — 8 测试
- `src/lib/merklWhitelist.ts` — `isMerklWhitelistBreakdownIncluded(campaignId, whitelistSet, campaignAccessStatus)`
- `src/lib/merklWhitelist.test.ts` — 3 campaignAccessStatus 测试
- `src/lib/incentiveAggregation.ts` — `IncentiveCalculationOptions.campaignAccessStatuses`
- `src/lib/rateSimulationCalculator.ts` — 全签名+调用点已更新
- `src/lib/merklCampaigns.ts` — 签名+调用点+config 接口已更新
- `src/components/dashboard/IncentiveTooltip.tsx` — `hasIneligibleCampaigns` useMemo + 警告条
- `src/components/dashboard/ReservesTableTooltipOverlay.tsx` — `campaignAccessStatuses` prop + 透传
- `src/components/dashboard/TopOpportunities.tsx` — `campaignAccessStatuses` prop + 两处 IncentiveTooltip 透传
- `src/components/dashboard/ReservesTable.tsx` — `campaignAccessStatuses` prop + 两处 TooltipOverlay 透传
- `src/pages/Index.tsx` — `useCampaignAccess()` hook + prop 传递

### Portfolio 相关（M2）
- `src/types/portfolio.ts` — PortfolioPosition / PortfolioPositionResult / PortfolioSummary / PortfolioSnapshot / PortfolioState
- `src/hooks/usePortfolioSimulation.ts` — addPosition / removePosition / updateAmount / updateInputMode
- `src/lib/portfolioCalculator.ts`
- `src/components/dashboard/PortfolioPanel.tsx` / `PortfolioTokenRow.tsx`

### Watch Mode 相关（M1）
- `src/components/dashboard/WatchAddressInput.tsx` + test
- `src/components/dashboard/WalletButton.tsx` + test
- `src/components/dashboard/Header.tsx`
- `src/components/dashboard/PortfolioPanel.tsx` — ✅ AAV-485: View address 入口已完成

### 类型
- `src/types/aave.ts` — CampaignAccessEntry / CampaignAccessPayload / CampaignAccessStatus (`'allowed' | 'whitelist-blocked' | 'blacklisted'`)

## 关键约束

- `reserveId` 是 required canonical identity，不加 composite-key fallback
- `// Desktop` 注释不能删除（6 个 visual-gap 测试依赖）
- 组件测试需要 `// @vitest-environment happy-dom` pragma
- 前端不能硬编码私人 RPC key
- 前后端不抽共享包
- Hidden 仓位样式：`opacity-40 border-border/20 bg-muted/5` + `line-through`
- Wallet Sync 按钮：仅 icon（RefreshCw）无文字

## 依赖状态

- wagmi / viem / rainbowkit **已安装** ✅
- 项目：React + TypeScript + Vite + npm

## Prototype 文件 (已删除 — 决策已捕获到 CONTEXT.md 和正式代码)

- ~~`src/components/prototype/PortfolioMergeProto.tsx`~~ — 已删除 (commit 9198da23)
- ~~`src/pages/PortfolioMergeProto.tsx`~~ — 已删除
- ~~`src/components/prototype/PrototypeSwitcher.tsx`~~ — 已删除

## 主文档

- `docs/plans/linear-issues/aav_epic_wallet_merkl_portfolio_plan.md` (1082行) — 完整 plan
- `docs/design/frontend-interaction-guardrails.md` (L292-323) — Merkl whitelist-only campaigns 行为规则

## 切片实现完成状态（2026-06-01 更新）

### 全部 6 切片已完成 ✅

| 切片 | Linear Issue | 内容 | 状态 |
|------|-------------|------|------|
| 1 | AAV-469 | SDK hooks + AaveProviders + SdkErrorBoundary | ✅ Done |
| 2 | AAV-470 | SDK → WalletPosition 转换 + useWalletAutoImport | ✅ Done |
| 3 | AAV-471 | Index.tsx 集成 + degradation toasts | ✅ Done |
| 4 | AAV-472 | PortfolioPanel Merkl rewards 渲染 | ✅ Done |
| 5 | AAV-473 | Hidden 仓位样式 + WalletSyncIndicator | ✅ Done |
| 6 | AAV-474 | 架构守卫测试 + 类型扩展 | ✅ Done |

### Code Review 修复完成 ✅

**3 Critical + 5 Important 全部修复**（commit `0be6cd55`）：

- **C1** `useUserPositionsSdk.ts` — `address!` → conditional cast
- **C2** `useUserSummarySdk.ts` — unsafe cast → `__typename` type guard
- **C3** `useUserSummarySdk.ts` — falsy bug → `!= null` check
- **I3** `sdkPositionConverter.ts` — `extractChainId` NaN guard
- **I4** `sdkPositionConverter.ts` — `toSafeUsd()` 守卫
- **I5** `SdkErrorBoundary.tsx` — 重试按钮
- **I6** `SdkErrorBoundary.tsx` — amber → orange 配色
- **I7** `sdkPositionConverter.ts` — `decimalToWad` 空输入校验
- **I8** `useUserSummarySdk.ts` — `Number()` → `parseFloat()`

### PR #297 状态

- **OPEN / MERGEABLE** ✅（已解决与 main 的合并冲突）
- head: `538a73ab`（包含 code review 修复 + main merge）

### 已知遗留项（Nice-to-have，低优先级）

- **N1** `sdkPositionConverter.test.ts` — ✅ 已改善至 6 tests
- **N2** `useWalletAutoImport` — ✅ 已补钱包切换地址 + checksum 大小写测试（8 tests）
- **N3** `AaveProviders.tsx` client 创建在 module scope
- **N4** `walletSourceToPositionSource` 冗余 identity 函数
- **N5** `AaveProviders` JSX 缩进不一致
- **N6** `enrichV3/V4SupplyPositions` — ✅ 已补测试（6 tests，useUserPositionsSdk.test.ts）

### Reserve 匹配策略（补充实现 ✅）

详见 `docs/handoff-reserveId-matching.md`。核心变更：
- 从 `(chainId, tokenAddress)` 查找升级为 `composeReserveId(chainId, poolAddress, tokenAddress, hubName?)` 精确匹配 + chainToken fallback
- 测试 fixture 全部更新为真实 reserveId 格式
- ~~Linear AAV-489~~: ✅ 全面审查测试 fixture 真实性已完成

### 文档待做项（非功能缺失）

1. Phase 5 HF — 明确延后
2. 共享 chainId 真理表抽取 — 重构任务
3. Bundle size spike — 运维/性能任务
5. E2E Playwright wallet smoke test — 需真实钱包

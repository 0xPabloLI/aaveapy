# 联合方案 - 钱包连接 + Merkl 持仓 + Portfolio 导入

> **修订记录**
> - v7 (本版)：Phase 2a 新增 **V3 用户仓位获取方案** ——
>   * V3 与 V4 SDK hook 不同：V3 用 `allChainsUserPositions`（组合 `markets` + `userSupplies` + `userBorrows`），V4 用 `useUserPositions`（按 spoke 聚合）
>   * 新增 `allChainsUserPositions` client action + `useAllChainsUserPositions` React hook
>   * 关键发现：`markets()` 的 `ReserveUserState` 只有 `balance`（supply），**没有 `debt` 字段**——必须走 `userSupplies`/`userBorrows` 才能拿完整仓位
>   * V3 返回值按 **market + reserve** 拆分（vs V4 按 spoke 聚合），映射逻辑不同
> - v6：Phase 2 Aave 用户 Position 获取方案从 viem multicall 改为 **Aave 官方 SDK 首选 + viem multicall fallback** ——
>   * 新增依赖 `@aave/react` + `@aave/client`（SDK 提供 `useUserPositions` hook / `userPositions` action）
>   * SDK 自带跨链聚合、HF、netApy、排序，无需 Phase 2 自己实现
>   * 新增 `src/lib/userData/sdkPositionMapper.ts` 做 SDK Position[] → 项目 UserPosition[] 映射
>   * `src/lib/userData/aaveUserClient.ts` 降级为 fallback（SDK 不可用时自动降级）
>   * 数据流图更新：Aave 数据路径改为 SDK 首选 → fallback viem multicall
> - v5：与最新代码对齐 + grill 决议整合 ——
>   * AAV-66 前端消费部分已实现：[useCampaignAccess.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useCampaignAccess.ts)（**最终命名**，非草案中的 `useMerklCampaignAccess.ts`）+ [src/types/aave.ts](file:///Users/pabloli/Documents/code/aaveapy/src/types/aave.ts) `CampaignAccessEntry`/`CampaignAccessPayload`（已正式化，不再是 dead code）+ [src/lib/apiSchemas.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/apiSchemas.ts) zod schema + [src/hooks/useSideDataMeta.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useSideDataMeta.ts) `campaignAccess` 字段
>   * `@tanstack/react-query@^5.95.0` 已安装（移出"新增依赖"清单）
>   * 仍未做：wagmi/rainbowkit/viem 安装、`src/lib/wagmi/*`、`src/providers/Web3Provider.tsx`、`src/hooks/useWallet.ts`、`useUserPositions.ts`、`src/lib/userData/*`、`src/lib/userPositionMapper.ts`、`src/lib/abis/*`、chainId 真理表抽取、`useCampaignAccess.test.ts` co-located 单测
> - v4：根据 AAV-66 后端已实现（合并进 side-data 字段 `/api/meta/side-data.campaignAccess`，见 [aav_66_plan.md](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md)）+ AAV-69 Linear 描述（明确前端直调 `/v4/users/{addr}/rewards`）修订：拆分用户级数据 vs campaign 元数据的获取路径；删除 `/v0/positions` beta；补 claim 流程。
> - v3：根据 owner 回答简化 —— Custom Connector = read-only watch mode；数据获取全部在前端；HF 延后；KV-store 不做。
> - v2：根据真实后端结构修订。
> - v1：初稿。

## 聚合 Issue

| Issue | 角色 | 状态变更 |
|-------|------|---------|
| AAV-66 | 前置：钱包连接（含 watch-only 地址输入）+ Merkl 资格 | 保留为子任务 |
| AAV-69 | 核心：前端直连 Merkl + Aave RPC 读用户数据 | 保留为子任务 |
| AAV-62 | 入口：钱包自动导入 Portfolio | 保留为子任务，连钱包 → 自动导入 |
| AAV-67 | 合并：读取自己的 Portfolio | **关闭**，被 AAV-69+62 联合覆盖 |
| AAV-80 | 展示层：个人 Position/Liquidity | 保留为子任务 |

## 0. 关键决策（已 owner 确认）

| # | 决策 | 影响 |
|---|------|------|
| 1 | **Custom Connector = "Watch Mode"** —— 用户直接输入地址（read-only），不依赖真实钱包 | 大幅简化签名/链切换/交易风险；Phase 1 不需要 wagmi 的 `signMessage` / `sendTransaction` |
| 2a | **用户级实时数据（AAV-69）= 前端直调 Merkl API** | 后端 `aave-protocol-analysis` 对 AAV-69 零改动；前端调 `/v4/users/{addr}/rewards` + viem `readContract` 调 Aave Pool。理由：rate limit per-user 独立、隐私、无需后端基础设施 |
| 2b | **Campaign 元数据（AAV-66）= 后端 cron 聚合 + 前端消费 side-data** | v3→v4 修订：reserves 只暴露 `whitelistOnly` 布尔值，前端无法自算。后端已实现 `/api/meta/side-data.campaignAccess` 字段（合并进 side-data），详见 [aav_66_plan.md](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md) |
| 3 | Merkl 用户 rewards API 失败 → **报错** | AAV-69 用 `/v4/users/{addr}/rewards`（成熟，非 beta）；不做降级；删除 `/v0/positions` beta 调用计划 |
| 4 | **KV-store 黑名单 v1 不做** | 整体最优判断：增加 Merkl API key 外部依赖，多数 Aave campaign 用静态 `params.whitelist`；留作后续增强 |
| 5 | **支持链 = 网站当前支持的所有链** | wagmi config 的 `chains` 数组与 `/markets` 返回的 `chainId` 集合保持一致 |
| 6 | **HF 要，但延后** | 拆为 Phase 5，不阻塞 MVP |

## 1. 联合目标

用户通过 RainbowKit 连接真实钱包**或**直接输入地址（Watch Mode），一键读取自己在 Merkl 上的可领取奖励 + Aave 持仓，自动导入为 Portfolio positions，并在 Dashboard 展示个人 Position/Liquidity 汇总，同时根据 Merkl campaign 资格自动 opt-in 适用的白名单 campaign。

## 2. 数据流（全前端架构）

```
用户:
  ┌─ 选项 A: RainbowKit Connect Modal → 真实钱包签名连接
  └─ 选项 B: 输入地址框 → Watch Mode Custom Connector → 仅 address
       ↓
useAccount() → { address, chainId, isWatchMode }
       ↓
数据来源:
  ├─ useCampaignAccess()  ← 来自 useSideDataMeta() 的 campaignAccess 字段（后端 cron）
  │     getUserCampaignStatus(address, campaignId) → 'allowed' | 'whitelist-blocked' | 'blacklisted'
  │     → 驱动 ReservesTable 准入标记 + usePortfolioToggle 的 whitelistMerklCampaignIds
  │
  └─ 并行（基于 reserves 已加载的 chainIds 集合，逐链 fan-out）:
       ├─ useUserMerklRewards(address, chainIds[])    ← 前端直调 Merkl
       │     GET https://api.merkl.xyz/v4/users/{address}/rewards?chainId=1,42161,...
       │     → 一次拿所有链的 amount/pending/claimed/proofs/breakdowns
       │
       └─ useAaveUserPositions(address, chainIds[])   ← 首选 SDK，fallback viem multicall
             ┌─ 首选: @aave/react useUserPositions / @aave/client userPositions()
             │     → GraphQL 一次拿所有链 → SDK Position[]
             │     → sdkPositionMapper → 拆分 per-token + 回写 reserveId
             │     → 自带 healthFactor / netApy（Phase 5 直接用）
             │
             └─ fallback: viem multicall（SDK 不可用时自动降级）
                   for each chainId: Pool.getUserAccountData + getUserReserveData (multicall)
                   → 用本地 (chainId, tokenAddress) → reserveId 反查表回写 canonical reserveId
       ↓
聚合为 UserPosition[] + MerklClaimable[] → mapUserPositionsToPortfolioPositions
       ↓
预览 Modal (Merge / Replace / Append) → actions.addPosition() × N
       ↓
Portfolio 模拟 + 展示 Position/Liquidity 汇总
```

## 3. 分阶段实现

### Phase 1: 钱包连接 + Watch Mode + Merkl 资格 (AAV-66)

**新增依赖**（v5 更新：`@tanstack/react-query@^5.95.0` 已安装，余下仍需 install）：
- `@rainbow-me/rainbowkit@^2`
- `wagmi@^2`
- `viem@^2`
- ~~`@tanstack/react-query@^5`~~ ✅ 已存在于 `package.json`（v5 修订）

**前端新增**：

- **`src/lib/wagmi/chains.ts`（新增文件）** — 钱包支持链清单，**必须覆盖网站当前支持的所有链**。
  - 复用已存在的真理表 [src/lib/tokenPriceResolver.ts:30](file:///Users/pabloli/Documents/code/aaveapy/src/lib/tokenPriceResolver.ts#L30) 中的 `HARDCODED_PLATFORM_BY_CHAIN_ID`（21 条链）作为唯一对照。
  - **强烈建议**先把该 Record 提到共享文件（如 `src/lib/chains/supportedChainIds.ts`），让 `tokenPriceResolver` 和 wagmi config 共用，避免漂移。
  - 映射到 viem/chains 导出（viem@2.49.2 已覆盖 711 条链）：

  | chainId | 名称 | viem/chains 导出 | 备注 |
  |---|---|---|---|
  | 1 | Ethereum | `mainnet` | |
  | 10 | Optimism | `optimism` | |
  | 56 | BSC | `bsc` | |
  | 100 | Gnosis | `gnosis` | |
  | 137 | Polygon | `polygon` | |
  | 146 | Sonic | `sonic` | |
  | **196** | **X Layer** | `xLayer` | ✅ 必须包含 |
  | 250 | Fantom | `fantom` | |
  | 324 | zkSync Era | `zksync` | |
  | 1088 | Metis | `metis` | |
  | **1868** | **Soneium** | `soneium` | ✅ 必须包含 |
  | 4326 | MegaETH | `megaeth` | ✅ 已验证 viem 2.50.4 原生支持 |
  | 5000 | Mantle | `mantle` | |
  | 8453 | Base | `base` | ⚠️ 注意：viem 同时导出 `basePreconf`（preconfirmation 变体），用 `base` |
  | 9745 | Plasma | `plasma` | ✅ 已验证 viem 2.50.4 原生支持 |
  | 42161 | Arbitrum | `arbitrum` | |
  | 42220 | Celo | `celo` | |
  | 43114 | Avalanche | `avalanche` | |
  | **57073** | **Ink** | `ink` | ✅ 必须包含 |
  | 59144 | Linea | `linea` | |
  | 534352 | Scroll | `scroll` | |

  - **Spike 任务（Phase 1 启动前）**：实际安装 viem 后 `node -e "import('viem/chains').then(c => [196,1868,57073,4326,9745].forEach(id => console.log(id, Object.values(c).find(x => x?.id === id)?.name)))"` 确认 viem 真实导出情况；缺失的链用 `defineChain` 补齐。
  - 启动时用 reserves 实际返回的 chainId 集合校验：出现未声明 chainId → console.warn，避免静默漏链。
- `src/lib/wagmi/config.ts` — wagmi config（HTTP transports，从 `src/lib/publicRpcUrls.ts` 读取 per-chain public RPC 列表做 fallback）
- `src/lib/wagmi/watchModeConnector.ts` — **核心 Custom Connector**：
  ```ts
  // 用 wagmi v2 的 createConnector API
  // - 不持有 provider，所有签名方法抛 "Watch mode is read-only"
  // - 暴露 `setWatchAddress(addr)` 让 UI 注入用户输入的地址
  // - 持久化到 localStorage (key: 'wagmi.watchAddress')
  // - icon + name 在 RainbowKit modal 里显示为 "View any address"
  ```
- `src/providers/Web3Provider.tsx` — `WagmiProvider` + `QueryClientProvider` + `RainbowKitProvider`，嵌入 [App.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/App.tsx) 根
- `src/hooks/useWallet.ts` — 薄封装：`{ address, chainId, isConnected, isWatchMode, connect, disconnect }`
- `src/components/dashboard/Header.tsx` 集成：
  - RainbowKit `<ConnectButton />` 用于真实钱包
  - 自定义 "Watch any address" 入口，弹窗输入地址 + 校验（viem `isAddress` + ENS 解析） → 调 `watchModeConnector.setWatchAddress()`
- **Campaign 资格判定 = 消费后端 side-data**（v3 → v4 修订；v5 实施完成）：
  - **不再**前端遍历 reserves 自行计算 —— 实测 reserves 只暴露 `whitelistOnly` 布尔值，不含原始地址数组，前端自算不可行
  - 后端已实现 side-data 字段 `GET /api/meta/side-data` → `payload.campaignAccess`，返回完整 `Record<campaignId, { chainId, whitelist[], blacklist[] }>`，~30KB gzip
  - 详细实现见 **[aav_66_plan.md](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md)** 子方案。涉及文件实际落地状态（v5 校对）：
    - ✅ [src/types/aave.ts](file:///Users/pabloli/Documents/code/aaveapy/src/types/aave.ts) — `CampaignAccessEntry` / `CampaignAccessPayload` 已正式化（注：草案中 `MerklCampaignAccessPayload` 命名未采用）
    - ✅ [src/hooks/useSideDataMeta.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useSideDataMeta.ts) — 已扩展响应类型，包含 `campaignAccess?: CampaignAccessPayload`
    - ✅ [src/lib/apiSchemas.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/apiSchemas.ts) — zod schema 已加 `campaignAccess`
    - ✅ **[src/hooks/useCampaignAccess.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useCampaignAccess.ts)（最终命名）** — `getUserCampaignStatus(addr, campaignId, campaigns)` 已实现，返回 `'allowed' | 'whitelist-blocked' | 'blacklisted'`
    - ⚠️ `src/lib/cache.ts` 中 `setCachedCampaignAccess` / `getCachedCampaignAccess` —— 视当前缓存策略决定是否仍需要（campaignAccess 已随 side-data 一起缓存）
    - ❌ `src/components/dashboard/ReservesTable.tsx` 准入标记 UI —— **未做**
    - ❌ co-located 单测 `useCampaignAccess.test.ts` —— **未做**（验收 Gate 要求）
  - 与 [usePortfolioToggle.whitelistMerklCampaignIds](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/reserves-table/usePortfolioToggle.ts) 联动：根据每个 campaign 的 status 决定是否计入用户的有效 APR（联动尚未接入）

**关键事实更正**：
- Merkl whitelist/blacklist 是 **per-campaign**，不存在 "用户全局状态" 单 boolean
- 数据来源是**后端 side-data**（已 cron 聚合），不是前端自行 fetch Merkl API
- KV-store 动态黑名单 v1 不处理（决策 #4）；后端方案也只覆盖 `params.whitelist/blacklist` 静态字段

**Bundle 评估**：RainbowKit + wagmi + viem 约 +200KB gzip。需对照 `vite build` 输出确认 chunk 分裂阈值。

> **注意**：Phase 2 将新增 `@aave/react` + `@aave/client`（Aave 官方 SDK），建议在 Step 0 B 依赖安装时一并安装，避免后续单独 `npm i`。SDK bundle 影响评估见 §10 #5。

**验收**：
- 真实钱包：MetaMask / Coinbase Wallet 连接成功，Header 显示缩略地址 + ENS
- Watch Mode：输入 `0x...` 或 `vitalik.eth`，连接后所有 read-only 数据生效；任何签名调用立即抛 "Watch mode is read-only"
- Watch Mode 持久化：刷新页面后保留
- `useCampaignAccess`（v5：最终命名；aav_66_plan.md）能正确判定连接地址在每个 campaign 的 status，UI 显示准入标记
- 切链 / 断开 / 重连流程不报错

### Phase 2: 用户数据 fetch (AAV-69)

**前端纯实现，零后端改动。**已在 Linear AAV-69 中明确方案 = 前端直调 Merkl API（理由：rate limit 按用户独立 / 隐私 / 无需后端基础设施）。

#### 2a. Aave 用户 Position 获取 —— SDK 首选 + viem multicall fallback

**方案 A（首选）：Aave 官方 SDK**

> 优势：自带跨链聚合、HF/netApy/排序、GraphQL 一次拿所有链；无需自己实现 multicall + 聚合逻辑。
> 劣势：新增 `@aave/react` + `@aave/client` 两个大包；返回结构与本项目 `UserPosition` 类型需映射层；依赖 Aave 官方 GraphQL 可用性。

**新增依赖**（Phase 2 新增，与 Phase 1 的 wagmi/viem/rainbowkit 并列）：
- `@aave/react` — React hook `useUserPositions`
- `@aave/client` — 命令式 `AaveClient` + `userPositions` action

**React Hook 用法**（接入 `src/hooks/useUserPositions.ts`）：

```tsx
import { useUserPositions, evmAddress, chainId, OrderDirection } from '@aave/react';

// useUserPositions 内部实现示例（由 useUserPositions.ts 封装）：
function useAaveSdkPositions({ userAddress, chainIds }) {
  const { data: positions, loading, error } = useUserPositions({
    user: evmAddress(userAddress),
    filter: { chainIds: chainIds.map(id => chainId(id)) },
    orderBy: { balance: OrderDirection.Desc },
  });
  // positions: SDK Position[] — 见下方字段表
}
```

**命令式 API 用法**（fallback / SSR / 测试用）：

```ts
import { AaveClient, evmAddress, chainId, OrderDirection } from '@aave/client';
import { userPositions } from '@aave/client/actions';

const client = new AaveClient({ url: 'https://api.aave.com/graphql' });
const result = await userPositions(client, {
  user: evmAddress('0x742d35cc6634C0532e0e4a8b…'),
  filter: { chainIds: [chainId(1), chainId(137), chainId(42161)] },
  orderBy: { balance: OrderDirection.Desc },
});
```

**SDK Position 对象主要字段**：

| 字段 | 说明 |
|---|---|
| `id` | Position 唯一标识 |
| `spoke.name` / `spoke.chain.name` | 所在 Spoke 和链 |
| `totalSupplied` | 总供应（`.current.value.toDisplayString(2)` / `.current.symbol`） |
| `totalCollateral` | 总抵押 |
| `totalDebt` | 总借贷 |
| `netBalance` | 净余额 |
| `netApy` | 净 APY（`.value`） |
| `healthFactor` | 健康因子（`.current`）—— **Phase 5 直接用，无需额外 viem 调用** |

**SDK 可用排序字段**：`balance` | `netApy` | `healthFactor` | `created` | `netCollateral`

**SDK → 项目 `UserPosition` 映射层**（`src/lib/userData/sdkPositionMapper.ts`）：

```ts
// 将 SDK Position[] 映射为项目内部 UserPosition[] + MerklClaimable[]
// 核心挑战：SDK Position 按 spoke 聚合（一个 Position = 一个 spoke 上的总仓位）
//   需按 token 拆分为多条 UserPosition（reserveId 回写仍用 chainIdLookup）
//   healthFactor / netApy 直接透传，无需 Phase 5 额外计算
function mapSdkPositionsToUserPositions(
  sdkPositions: SdkPosition[],
  reserveIdLookup: Map<string, string>
): { positions: UserPosition[]; healthFactor?: number; netApy?: number }
```

#### 2a-v3. Aave V3 SDK 用户仓位获取

> V3 SDK 与 V4 不同：V3 没有 `useUserPositions`，需组合 `markets` + `userSupplies` + `userBorrows` 三个 action。
> 关键发现：`markets()` 的 `ReserveUserState` 仅有 `balance`（supply），**没有 `debt` 字段**——必须走 `userSupplies` / `userBorrows` 才能拿到完整仓位。

**架构**（2 次网络请求）：

```
markets()                    → 所有 reserve 的基础信息 + 用户 supply 余额
batch(userSupplies, userBorrows) → 用户的完整 supply/borrow 明细
```

**核心 client action**（`src/lib/userData/aaveV3UserPositions.action.ts`）：

```ts
// 参考 @aave/client-v3 的 allChainsUserPositions
import { allChainsUserPositions } from '@aave/client-v3'

export async function fetchV3UserPositions(userAddress: string) {
  // useAaveChains 提供 chainIds（urql 缓存，仅首次网络请求）
  const { data: chains } = await getAaveChains()
  const chainIds = chains.map(c => c.id)

  // 1. markets() — reserve 基础信息 + ReserveUserState.balance（仅 supply）
  // 2. batch(userSupplies, userBorrows) — 完整 supply/borrow 明细
  // SDK batch 上限 10，当前仅用 2，远低于上限
  return allChainsUserPositions({ userAddress, chainIds })
}
```

**React hook**（`useAsyncTask` 模式，与 `useAaveHealthFactorPreview` 一致）：

```ts
// src/hooks/useV3UserPositions.ts
export function useV3UserPositions(userAddress: string | undefined) {
  return useAsyncTask(
    userAddress ? () => fetchV3UserPositions(userAddress) : undefined
  )
}
```

**V3 → 项目 `UserPosition` 映射层**（`src/lib/userData/sdkV3PositionMapper.ts`）：

```ts
// V3 映射比 V4 简单：reserve 级 1:1，无需 spoke→token 拆分
function mapV3PositionsToUserPositions(
  v3Positions: V3UserPosition[],  // markets + userSupplies + userBorrows 组合结果
  reserveIdLookup: Map<string, string>
): { positions: UserPosition[]; healthFactor?: number }
// V3 特有字段：isCollateral（reserve 级，V4 spoke 级无法表达）
// V3 healthFactor 是 per-market（V4 是 per-spoke）
```

**V3 vs V4 SDK 差异汇总**：

| 维度 | V3 SDK | V4 SDK |
|---|---|---|
| 核心 hook | `markets` + `batch(userSupplies, userBorrows)` | `useUserPositions` |
| 网络请求 | 2 次（markets + batch） | 1 次（按 spoke 聚合） |
| 映射复杂度 | 低（reserve 级 1:1） | 高（spoke→token 拆分） |
| isCollateral | ✅ 有（reserve 级） | ❌ 无（spoke 级无法表达） |
| healthFactor | per-market | per-spoke |
| netApy | ❌ 需自算 | ✅ SDK 自带 |
| SDK 包 | `@aave/client-v3` | `@aave/client-v4` / `@aave/react-v4` |

**约束**：
- SDK GraphQL API 覆盖 V3（**不覆盖 V2**），V2 仍需走 viem RPC
- `useAaveChains` 有 urql 缓存，仅首次发请求
- `isCollateral` 需映射到 `UserPosition.isCollateral`（V4 无此字段，设为 `undefined`）

---

**方案 B（fallback）：viem multicall 直读链上合约**

> 当 SDK GraphQL 不可用（宕机 / CORS 阻断 / 新链未上线）时自动降级。
> 优势：零外部 API 依赖，链上数据实时。
> 劣势：需自实现 multicall + 聚合 + HF 计算；per-chain 并行 fan-out 复杂度高。

##### B-v3：V3 Pool.getUserReserveData multicall（零换算）

V3 架构单一 Pool 合约。**方案决议**：用 `Pool.getUserReserveData(asset, user)` 直接读取 **含利息的实际余额**（`currentATokenBalance`/`currentVariableDebt`），**零换算**。reserve 列表从后端 API 已有的 reserves 数组获取，无需链上发现。

| 合约 | 地址来源 | ABI 来源 | 关键函数 |
|------|---------|---------|---------|
| `Pool` | `@aave-dao/aave-address-book` AaveV3Ethereum.POOL | `IPool_ABI` ✅（address-book） | `getUserReserveData(asset, user)` → 单 reserve 用户仓位（含利息直接值） |
| `Pool`（账户汇总） | 同上 | 同上 | `getUserAccountData(user)` → HF / totalCollateral / totalDebt |

**`getUserReserveData(asset, user)` 返回值**（**直接值，零换算**）：
```
UserReserveData struct:
  .currentATokenBalance       → 含利息供应量（uint256，直接值 ✅）
  .currentStableDebt          → stable 借款量（uint256，直接值 ✅）
  .currentVariableDebt        → 含利息 variable 借款量（uint256，直接值 ✅）
  .principalStableDebt        → stable 借款本金
  .scaledVariableDebt         → 缩放值（忽略，用 currentVariableDebt 代替）
  .stableBorrowRate           → stableBorrowRate
  .variableBorrowRate         → variableBorrowRate
  .liquidityRate              → liquidityRate
  .usageAsCollateralEnabled   → isCollateral（bool）
  .stableRateLastUpdated      → timestamp
  .isActive                   → reserve 是否活跃
```

**`getUserAccountData(user)` 返回值**：
```
  .totalCollateralBase        → 总抵押值（WAD 精度）
  .totalDebtBase              → 总债务值（WAD 精度）
  .availableBorrowsBase       → 可借额度
  .currentLiquidationThreshold → 当前清算阈值
  .ltv                        → LTV
  .healthFactor               → 健康因子（WAD 精度，1e18 = 1.0）
```

> **为什么选 Pool 而非 UiPoolDataProvider**：UiPoolDataProvider 的 `getUserReservesData` 返回 `scaledATokenBalance`（缩放值），需额外调 `getReservesData()` 拿 `liquidityIndex`/`variableBorrowIndex` 再做 `scaled × index / RAY` 换算。Pool 的 `getUserReserveData` 直接返回 `currentATokenBalance`（已含利息），**零换算，逻辑更简单**。
>
> **reserve 列表来源**：后端 API `/markets` 返回的 `reserves[].underlyingAsset` 地址列表，不依赖链上调用。如果后端 API 不可用，SDK GraphQL 大概率也不可用，此时走 fallback 本身就无意义。

**Multicall 编排**（per-chain）：
1. 从后端 API 获取 `reserves[].underlyingAsset` 地址列表
2. 构造 N 个 `Pool.getUserReserveData(asset, user)` 调用 + 1 个 `Pool.getUserAccountData(user)` 调用
3. 用 Multicall3 合并为 **1 次 RPC**

```ts
// src/lib/userData/aaveV3UserClient.ts
import { IPool_ABI } from '@aave-dao/aave-address-book/abis'

interface V3UserPositionRaw {
  underlyingAsset: Address
  currentATokenBalance: bigint    // 含利息供应量，直接值 ✅
  currentVariableDebt: bigint     // 含利息借款量，直接值 ✅
  currentStableDebt: bigint       // stable 借款量，直接值 ✅
  usageAsCollateralEnabled: boolean
  liquidityRate: bigint
  stableBorrowRate: bigint
  variableBorrowRate: bigint
}

interface V3AccountData {
  totalCollateralBase: bigint      // WAD
  totalDebtBase: bigint            // WAD
  healthFactor: bigint             // WAD (1e18 = 1.0)
  currentLiquidationThreshold: bigint
  ltv: bigint
}

async function fetchV3UserPositionsOnchain(
  user: Address,
  chainId: number,
  poolAddress: Address,
  reserveAssets: Address[],       // from backend API reserves[].underlyingAsset
  publicClient: PublicClient,
): Promise<{ positions: V3UserPositionRaw[]; accountData: V3AccountData }>
```

**V3 fallback 特点**：
- 余额模型：**直接值，零换算**（`currentATokenBalance`/`currentVariableDebt` 已含利息）
- reserve 列表从后端 API 获取，无需链上 `getReservesData()`
- N 个 `getUserReserveData` + 1 个 `getUserAccountData` 通过 Multicall3 合并为 1 次 RPC
- `usageAsCollateralEnabled` 为 bool，直接映射 `isCollateral`
- 有 stable debt（V4 无此概念）
- `healthFactor` 为 uint256 1e18 精度，需除以 1e18 得 float
- **ABI 来源**：`@aave-dao/aave-address-book/abis` 官方导出，零维护成本

##### B-v4：V4 Hub + Spoke multicall

V4 Hub/Spoke 架构无单一 Pool，需按 **spoke** 分别读用户仓位。**Grill Q2a 决议：用 `getUserSuppliedAssets`/`getUserDebt` 直接读取 assets，跳过 shares 换算**。

| 合约 | 地址来源 | ABI 来源 | 关键函数 |
|------|---------|---------|---------|
| `ISpoke`（用户函数） | `@aave-dao/aave-address-book` AaveV4Ethereum.MAIN_SPOKE 等 | **自写 human-readable ABI** ⚠️ | `getUserSuppliedAssets(reserveId, user)`, `getUserDebt(reserveId, user)`, `getUserAccountData(user)`, `getUserReserveStatus(reserveId, user)` |

> **Grill Q5 决议**：前端 fallback **不需要** IHub 市场函数（`getAsset`/`getAssetCount`/`getSpokeCount`）和 ISpoke 市场函数（`getReserve`）。reserveId 列表直接从后端 API 已有的 reserves 数组获取，无需链上发现。

> ⚠️ `@aave-dao/aave-address-book` 的 `ISpokeV4_ABI` 只含 3-4 个市场函数，**不含用户仓位函数**。V4 用户函数需自写 human-readable ABI 放入 `src/abi/aaveV4.ts`。

**`getUserSuppliedAssets(reserveId, user)` → uint256**（Grill Q2a 决议：直接 assets，零换算）：
```
返回值即为用户在该 reserve 的供应量（assets 单位），无需任何换算
```

**`getUserDebt(reserveId, user)` → (drawn: uint256, premium: uint256)**（Grill Q2a 决议：直接 assets，零换算）：
```
drawn   → 借款本金（assets 单位，零换算）
premium → 利息部分（assets 单位，零换算）
totalDebt = drawn + premium
```

**`getUserAccountData(user)` 返回 `UserAccountData` struct**（Grill Q3 决议：入口处统一降精度）：
```
healthFactor            → healthFactor（WAD = 1e18 精度）
totalCollateralValue    → totalCollateralValue（Value 单位，WAD 精度）
totalDebtValueRay       → ⚠️ RAY = 1e27 精度！入口处 / RAY 降为 Value（WAD 精度）
activeCollateralCount   → 活跃 collateral 计数
borrowCount             → 活跃 borrow 计数
```

**`getUserReserveStatus(reserveId, user)`** 替代 V3 的 `usageAsCollateralEnabled`：
```
返回 (usingAsCollateral: bool, isBorrowed: bool)
usingAsCollateral       → isCollateral
```

**Multicall 编排**（Grill Q2b 决议：**用后端已有 reserves 列表，跳过 getAssetCount/getReserveCount 步骤**；Grill Q4 决议：**Spoke 间串行，同一 Spoke 内 Multicall3 批量**）：
1. 从后端 `/markets` 返回的 reserves 列表提取该 chain 所有 spoke 的 reserveId 集合（**零链上调用**）
2. 对每个 spoke（**串行**，避免 ECONNRESET）：
   a. 同一 spoke 内所有 reserveId 的 `getUserSuppliedAssets` + `getUserDebt` + `getUserReserveStatus` → **Multicall3 批量为 1 次 RPC**
   b. `getUserAccountData(user)` → 1 次单独调用
3. 对每个 spoke 的 accountData：入口处 `totalDebtValue = totalDebtValueRay / RAY`（Grill Q3 精度归一化）

```ts
// src/lib/userData/aaveV4UserClient.ts
import { spokeUserAbi } from '@/abi/aaveV4'  // 自写 human-readable ABI

const RAY = 10n ** 27n

interface V4UserPositionRaw {
  reserveId: bigint
  spokeAddress: Address
  suppliedAssets: bigint      // getUserSuppliedAssets 直接返回，零换算
  drawnDebt: bigint           // getUserDebt.drawn，零换算
  premiumDebt: bigint         // getUserDebt.premium，零换算
  usingAsCollateral: boolean  // getUserReserveStatus
  isBorrowed: boolean         // getUserReserveStatus
}

interface V4AccountDataRaw {
  healthFactor: bigint            // WAD (1e18)
  totalCollateralValue: bigint    // Value (WAD)
  totalDebtValueRay: bigint       // RAY (1e27) — 入口处降精度
}

interface V4AccountDataNormalized {
  healthFactor: bigint            // WAD
  totalCollateralValue: bigint    // Value (WAD)
  totalDebtValue: bigint          // Value (WAD) = totalDebtValueRay / RAY
  activeCollateralCount: bigint
  borrowCount: bigint
}

// 入口处统一降精度（Grill Q3 决议）
function normalizeV4AccountData(raw: V4AccountDataRaw): V4AccountDataNormalized {
  return {
    healthFactor: raw.healthFactor,
    totalCollateralValue: raw.totalCollateralValue,
    totalDebtValue: raw.totalDebtValueRay / RAY,
    activeCollateralCount: raw.activeCollateralCount,
    borrowCount: raw.borrowCount,
  }
}

async function fetchV4UserPositionsOnchain(
  user: Address,
  chainId: number,
  spokeReserveIds: Map<Address, bigint[]>,  // 后端 reserves 列表 → spoke → reserveIds
  publicClient: PublicClient,
): Promise<{ positions: V4UserPositionRaw[]; accountDataMap: Map<Address, V4AccountDataNormalized> }>
```

**V4 fallback 特点**：
- **Assets 直接模型**（Grill Q2a 决议）：`getUserSuppliedAssets`/`getUserDebt` 直接返回 assets，**无需 shares→assets 换算**（区别于 `getUserPosition` 的 shares 模型）
- **多 Spoke 架构**：一个 chain 可能有 10+ spoke（MAIN / BLUECHIP / ETHENA_CORRELATED / ETHENA_ECOSYSTEM / FOREX / GOLD / LOMBARD_BTC / ETHERFI_ES / KELP_ES / LIDO_ES），需按 spoke 分别读
- **Spoke 间串行 + Spoke 内 Multicall3**（Grill Q4 决议）：与后端架构一致，避免 ECONNRESET
- **后端 reserves 列表跳过链上发现**（Grill Q2b 决议）：reserveId 从后端 `/markets` 获取，零额外 RPC
- **RAY 精度归一化**（Grill Q3 决议）：`totalDebtValueRay / RAY` 入口处降为 Value 单位，下游全用 WAD 精度
- **无 stable debt**：只有 drawn + premium 两种债
- **`getUserReserveStatus`** 返回元组替代 V3 的 `usageAsCollateralEnabled` bool
- **reserveId** 为 uint256（V3 用 asset address 作标识）
- **ABI 来源**：V4 用户函数需**自写 human-readable ABI**（address-book 不含）

##### 降级策略

`useUserPositions.ts` 先尝试 SDK → 失败则按 protocolVersion 分流到 B-v3 或 B-v4 → **Grill Q5 决议：partial results + retry 按钮，不白屏不报错**。

```ts
// src/hooks/useUserPositions.ts（降级分流示意）
type DegradedResult =
  | { status: 'success'; data: UserPositionsData }
  | { status: 'partial'; data: Partial<UserPositionsData>; failedSources: string[]; retry: () => void }
  | { status: 'error'; error: Error; retry: () => void }

async function fetchUserPositions(user: Address, chainId: number, protocolVersion: 'v3' | 'v4'): Promise<DegradedResult> {
  // 1. SDK 优先
  const sdkResult = await trySdkFetch(user, chainId, protocolVersion)
  if (sdkResult) return { status: 'success', data: sdkResult }

  // 2. Onchain fallback（per-protocol 分流）
  const onchainResult = protocolVersion === 'v3'
    ? await fetchV3UserPositionsOnchain(user, chainId, pool, poolDataProvider, client)
    : await fetchV4UserPositionsOnchain(user, chainId, spokeReserveIds, client)

  // 3. Partial results：部分 spoke/chain 成功即可用，失败部分显示 retry
  if (onchainResult.partialFailures.length > 0) {
    return { status: 'partial', data: onchainResult.data, failedSources: onchainResult.partialFailures, retry: fetchUserPositions }
  }
  return { status: 'success', data: onchainResult.data }
}
```

**降级 UI 行为**（Grill Q5）：
- `status: 'success'` → 正常显示
- `status: 'partial'` → 已获取的数据正常显示 + 失败部分灰色占位 + retry 按钮
- `status: 'error'` → 全部失败 → 错误提示 + retry 按钮（**不白屏**）

---

#### 2b. Merkl 用户 rewards 获取

**核心端点**（v3 → v4 修订：与 Linear 描述对齐，从 `/v4/claim` 改为 `/v4/users/{address}/rewards`）：

```
GET https://api.merkl.xyz/v4/users/{address}/rewards?chainId={chainIds}
```

- `chainIds` 多个用逗号分隔（如 `1,42161,8453`）—— **一次请求覆盖所有支持链**
- 返回：`amount`（已累计总额）、`pending`（待结算，~2h 更新，未上链不可 claim）、`claimed`（已领取）、`proofs`（merkle proof，claim 用）、`breakdowns`（按 campaign 归属明细）
- **可领取 = amount − claimed**
- 匿名限流：**10 req/s per user**（无需 API key；per-user 独立配额，不互相影响）
- 文档：https://developers.merkl.xyz/integrate/user-rewards

**新增文件**（v6 修订：SDK 首选后的文件清单）：

- `src/lib/userData/chainIdLookup.ts`：
  ```ts
  // 从已 fetch 的 reserves 构建：(chainId, lowercaseTokenAddress) → reserveId
  // 注意：这不是 "composite-key fallback for reserveId identity"
  //      （AGENTS.md 禁止的是当 reserveId 缺失时用 composite key 替代）
  // 这里是给 Merkl/Aave 返回的外部数据回写 canonical reserveId，结果仍是后端权威的 reserveId
  export function buildReserveIdLookup(reserves: ReserveWithSpread[]): Map<string, string>
  export function lookupReserveId(lookup, chainId, tokenAddress): string | null
  ```
- `src/lib/userData/merklUserClient.ts`：
  ```ts
  // 一次拿所有链的 rewards + proofs + breakdowns
  fetchUserMerklRewards(address, chainIds: number[]): Promise<MerklUserRewardsResponse>
  // 不再调 /v4/claim 或 /v0/positions beta —— /v4/users/{addr}/rewards 已包含所需全部信息
  ```
- `src/lib/userData/sdkPositionMapper.ts`（**新增**）：
  ```ts
  // SDK Position[] → 项目 UserPosition[] + healthFactor + netApy
  // 核心挑战：SDK Position 按 spoke 聚合，需按 token 拆分为多条 UserPosition
  mapSdkPositionsToUserPositions(sdkPositions, reserveIdLookup): MappedResult
  ```
- `src/lib/userData/sdkV3PositionMapper.ts`（**新增**）：
  ```ts
  // V3 SDK 仓位 → 项目 UserPosition[]（reserve 级 1:1，比 V4 映射简单）
  // V3 特有：isCollateral（reserve 级）、healthFactor per-market
  mapV3PositionsToUserPositions(v3Positions, reserveIdLookup): MappedResult
  ```
- `src/lib/userData/aaveV3UserPositions.action.ts`（**新增**）：
  ```ts
  // V3 client action：markets + batch(userSupplies, userBorrows)
  fetchV3UserPositions(userAddress): Promise<V3UserPosition[]>
  ```
- `src/lib/userData/aaveUserClient.ts`（**降级为 fallback**）：
  ```ts
  // viem multicall fallback —— SDK 不可用时使用
  fetchAaveUserPositions(address, chainId, poolAddress, reserveAddresses): Promise<AaveUserPositionRaw[]>
  ```
- `src/hooks/useUserPositions.ts` —— React Query hook：
  - `queryKey: ['user-positions', address, chainIdsSorted]`
  - **首选**：SDK `useUserPositions` / `userPositions()` 拿 Aave Position
  - **并行**：Merkl rewards 调用（多链合并）
  - **fallback**：SDK 失败 → viem multicall per-chain fan-out
  - 聚合 + 回写 reserveId → `UserPosition[]`
  - 5min 缓存；地址变化自动失效
- `src/lib/userPositionMapper.ts`：纯函数 `mapUserPositionsToPortfolioPositions(positions, reserves) → PortfolioPosition[]`

**Claim 流程已移出本 Epic，另开独立 issue**（涉及 writeContract、ABI、tx 追踪，与 Phase 2 数据读取层关注点不同）。

**链选择策略**：从 `reserves` 提取 distinct chainIds，传入 Merkl `chainId` 参数 + SDK `filter.chainIds`；fallback 时 Aave per-chain 并行 fan-out，某链失败不阻塞其他。

**验收**：
- 连接钱包/输入地址后，前端能拉到 Merkl rewards（amount/pending/claimed/proofs/breakdowns）+ Aave 持仓
- SDK 首选路径正常工作；SDK 不可用时自动降级到 viem multicall，UI 无感
- `reserveId` 回写成功率 = 100%（如果 token 在 reserves 中存在）
- 链失败容错：mainnet OK + arbitrum 失败 → UI 显示部分数据 + 失败链 banner

### Phase 3: 钱包自动导入 Portfolio (AAV-62)

**连钱包 = 自动导入**，不需要文件导入。

- `src/lib/userPositionMapper.ts`：纯函数 `mapUserPositionsToPortfolioPositions(positions, reserves) → PortfolioPosition[]`
- `src/components/dashboard/PortfolioImportModal.tsx` — 预览 Modal：
  - 列表显示将导入的 N 条 positions（symbol、chain、side、USD）
  - 单选：**Merge**（默认）/ **Replace** / **Append all**
  - 确认 → `actions.addPosition() × N`

**触发时机**：
- 用户进入 Portfolio 模式时检查连接状态 → 已连接则自动触发 `useUserPositions()` → 弹出预览 Modal
- 非 Portfolio 模式下连接钱包不触发（避免不必要的 RPC 调用）
- 钱包切换时不自动覆盖现有 portfolio，由用户在 Modal 中决定

**验收**：
- 连钱包（含 Watch Mode）后自动弹出预览 Modal
- 三种模式（Merge/Replace/Append all）正确执行
- 钱包切换后不自动覆盖现有 portfolio

### Phase 4: Position/Liquidity 展示 (AAV-80)

**前端新增 / 复用**：
- **复用** [PortfolioSummaryCard.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioSummaryCard.tsx) + [PortfolioPanel.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioPanel.tsx)，**不另建并行面板**
- 在 Portfolio 模式下，若已连接（含 Watch Mode），注入：
  - "Wallet" 标签条：连接源（real / watching）+ 缩略地址 + ENS
  - "Merkl Rewards" 区：来自 `useUserPositions` 的 `merklClaimables` 数据，按 token + chain 列出（纯展示，Claim 流程另开独立 issue）
- 集成入 [Index.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/pages/Index.tsx) 的 Portfolio 模式

**验收**：
- 连接后 Portfolio 自动显示个人 Position 汇总（数值与 `usePortfolioSimulation` 输出一致）
- Watch Mode 与真实钱包视觉一致，差别只在 "watching" 标签
- 未连接钱包时所有手动 Portfolio 功能保持现状不变（regression-free）

### Phase 5: 健康因子 HF (延后)

**决策 #6**：HF 是 must-have，但 v1 后做。

- 扩展 [PortfolioSummary](file:///Users/pabloli/Documents/code/aaveapy/src/types/portfolio.ts) 添加 `healthFactor?: number`
- **数据来源（双路径）**：
  - **SDK 首选路径**：`SdkPosition.healthFactor` 已在 Phase 2 透传至 `UserPosition.healthFactor`，**零额外 RPC 调用**
  - **viem fallback 路径**：调 `Pool.getUserAccountData(address)` → `healthFactor` (1e18 wei)，仅 SDK GraphQL 不可用时触发
- 显示位置：`PortfolioSummaryCard` 加 HF row（颜色阶梯：>2 green / 1.5-2 yellow / <1.5 red / <1.1 critical）
- 单独立 Linear issue，依赖 Phase 4 完成

## 4. 依赖关系

```
Phase 1 (AAV-66) ──→ Phase 2 (AAV-69) ──→ Phase 3 (AAV-62 钱包导入) ──→ Phase 4 (AAV-80) ──→ Phase 5 (HF, 延后)
  钱包连接+Watch       前端用户数据         Portfolio 自动导入              展示层               健康因子
```

**可独立 ship 的里程碑**：
- Phase 1 ship：可连钱包 / 输入地址 → 资格反映在模拟器
- Phase 2 ship：技术 ready，UI 未暴露（dev tool 可见）
- Phase 3 ship：钱包导入 MVP 完整
- Phase 4 ship：Position/Liquidity 完整体验
- Phase 5 ship：HF 上线

**外部依赖**：
- Merkl `/v4/users/{addr}/rewards`（成熟稳定，前端直调）
- 公共 RPC（mainnet/base/arbitrum 等）—— 从后端 `@aave-shared-config` 提取 per-chain public RPC 列表（`src/lib/publicRpcUrls.ts`），wagmi fallback transport 配置；**仅用 public 端点，不注入 API key**
- RainbowKit / wagmi v2 / viem v2 LTS 版本（用 context7 skill 确认）

## 5. 类型设计

### MerklCampaignAccess（后端 side-data 类型，前端消费）

详见 [aav_66_plan.md §4.1](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md)。前端使用：

```ts
// 来自 /api/meta/side-data 的 campaignAccess 字段
interface MerklCampaignAccessPayload {
  campaigns: Record<string, {
    chainId: number;
    whitelist: string[];   // 空数组 = 无白名单限制
    blacklist: string[];   // 空数组 = 无黑名单
  }>;
  updatedAt: string;
}

// useCampaignAccess hook 返回（最终命名，非 useMerklCampaignAccess）
type CampaignAccessStatus = 'allowed' | 'whitelist-blocked' | 'blacklisted';

getUserCampaignStatus(addr: string, campaignId: string): CampaignAccessStatus;
```

### MerklUserRewards（AAV-69 前端直调 Merkl API 返回）

```ts
interface MerklUserRewards {
  // 来自 GET /v4/users/{address}/rewards?chainId=...
  rewards: Array<{
    chainId: number;
    rewards: Array<{
      token: { address: string; symbol: string; decimals: number; chainId: number };
      amount: string;        // 累计总额 (raw, 待 format)
      pending: string;       // 待结算 (~2h 更新)
      claimed: string;       // 已领取
      proofs: string[];      // merkle proof, claim 用
      breakdowns: Array<{
        campaignId: string;
        amount: string;
        reason: string;
      }>;
    }>;
  }>;
}
```

### SdkPosition（Aave 官方 SDK 返回类型，前端映射源）

```ts
// 来自 @aave/react useUserPositions / @aave/client userPositions
// SDK Position 按 spoke 聚合，一个 Position = 一个 spoke 上总仓位
interface SdkPosition {
  id: string;
  spoke: { name: string; chain: { name: string; id: number } };
  totalSupplied: { current: { value: { toDisplayString(n: number): string }; symbol: string } };
  totalCollateral: { current: { value: { toDisplayString(n: number): string }; symbol: string } };
  totalDebt: { current: { value: { toDisplayString(n: number): string }; symbol: string } };
  netBalance: { current: { value: { toDisplayString(n: number): string }; symbol: string } };
  netApy: { value: number };
  healthFactor: { current: number };
}
```

### UserPosition（前端聚合）

```ts
interface UserPosition {
  /** 通过 (chainId, tokenAddress) 反查得到的 canonical reserveId */
  reserveId: string;
  chainId: number;
  tokenSymbol: string;
  tokenAddress: string;
  side: 'supply' | 'borrow';
  amount: string;            // Token amount, decimal string
  amountUsd: number;
  isCollateral?: boolean;
  /** SDK 首选时直接可用；fallback viem multicall 时为 undefined（需 Phase 5 额外调用） */
  healthFactor?: number;
  /** SDK 首选时直接可用；fallback 时需自行计算 */
  netApy?: number;
}
// 注意：chainName / marketName 不在 UserPosition 上，映射时从 reserve 注入（避免漂移）

/** 纯 Merkl claimable reward（不 merge 进 UserPosition，避免 side 语义混乱）。
 *  Phase 4 展示时独立 "Merkl Rewards" 区使用。
 *  Claim 流程另开独立 issue，proofs 暂不入类型。 */
interface MerklClaimable {
  chainId: number;
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;            // 累计总额 (raw)
  pending: string;           // 待结算
  claimed: string;           // 已领取
  claimable: string;         // = amount − claimed, 前端计算
  breakdowns: Array<{ campaignId: string; amount: string; reason: string }>;
}

interface UserPositionsResult {
  address: string;
  positions: UserPosition[];
  /** Merkl claimable rewards, 独立于 Aave positions */
  merklClaimables: MerklClaimable[];
  /** 无法回写 reserveId 的孤立场（token 在 Merkl/Aave 返回中但不在 reserves 里）。
   *  Phase 2 只做 console.warn；Phase 4 展示时再决定 UI 策略。 */
  orphanPositions: UserPosition[];
  /** SDK 首选时直接从 SdkPosition.healthFactor 透传；fallback 时需 Phase 5 viem 调用 */
  healthFactor?: number;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  /** 每链 fetch 结果摘要 */
  perChain: Array<{
    chainId: number;
    chainName: string;
    aaveStatus: 'ok' | 'error';
    merklRewardsStatus: 'ok' | 'error';
    errors?: string[];
  }>;
}
```

### 映射到 PortfolioPosition

```ts
function mapUserPositionToPortfolioPosition(
  pos: UserPosition,
  reserves: ReserveWithSpread[]
): PortfolioPosition | null {
  const reserve = reserves.find(r => r.reserveId === pos.reserveId);
  if (!reserve) return null;

  return {
    positionId: crypto.randomUUID(),
    reserveId: reserve.reserveId,
    marketName: reserve.marketName,
    chainName: reserve.chainName,
    tokenSymbol: pos.tokenSymbol,
    side: pos.side,
    amount: String(pos.amountUsd),
    inputMode: 'usd',
    // SDK 首选路径直接透传；fallback 路径为 undefined，待 Phase 5 viem 补填
    healthFactor: pos.healthFactor,
    netApy: pos.netApy,
  };
}
```

> **注意**：SDK 首选时 `healthFactor` / `netApy` 由 `sdkPositionMapper` 从 `SdkPosition` 透传，无需额外 RPC。Fallback 路径这两个字段为 `undefined`，Phase 5 按 fallback 路径单独补 viem `getUserAccountData` 调用。

## 6. Campaign Access 联动

**决议**：不新增 `blacklistMerklCampaignIds` 字段。统一通过 `whitelistMerklCampaignIds` 处理：

- 连钱包后，`useCampaignAccess.getUserStatus(addr, campaignId)` 对每个 campaign 返回 `'allowed' | 'whitelist-blocked' | 'blacklisted'`
- **只传 `status === 'allowed'` 的 campaignIds** 给 [usePortfolioToggle](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/reserves-table/usePortfolioToggle.ts) 的 `whitelistMerklCampaignIds: Set<string>`
- `whitelist-blocked` 和 `blacklisted` 效果相同：该 campaign 的 APR 不计入用户模拟
- 未连钱包时，`whitelistMerklCampaignIds` 保持用户手动 toggle 行为不变（探索模式："如果我符合白名单，APR 会变成多少？"）

这样两种模式自然分离：
- **资格模式**（连钱包）：`useCampaignAccess` 自动判定 → 只传 allowed ids → 模拟结果 = 真实资格 → **用户 toggle 被完全替换（变 read-only，不可 override）**
- **探索模式**（未连钱包）：用户手动 toggle → 模拟结果 = 假设性预览

**UI 行为**：连钱包后，ReservesTable 中 Merkl campaign 的 toggle 应显示为 disabled + 锁定图标 + tooltip "Determined by wallet eligibility"

## 7. 安全与合规

- **Watch Mode 安全模型**：
  - 不持有 private key，不签任何交易
  - 输入框校验 viem `isAddress`，避免 invalid input
  - localStorage 持久化只存 address（字面值），不存任何 secret
  - UI 必须明显标注 "watching" / "view-only" 视觉差异，避免用户误以为已授权
- **真实钱包安全**：
  - 不要求任何 signMessage / sendTransaction（仅只读读链）
  - RainbowKit `coolMode` / `appInfo` 不存敏感信息
- **API 调用**：
  - Merkl API 是公开端点，无需 key
  - 公共 RPC：仅使用 public 端点（从后端 `@aave-shared-config` 的 `AAVE_RPC_URLS_BY_CHAIN_KEY` 提取，去掉需 API key 的 Alchemy/Infura/Ankr），存入 `src/lib/publicRpcUrls.ts`；**不用 Vite 环境变量注入**（VITE_* 会编译进 bundle 等于公开）
- **CORS**：Merkl `api.merkl.xyz` 已配置 `Access-Control-Allow-Origin: *`（需上线前验证）

## 8. 复杂度评估

**Medium**（v2 是 Medium-High，简化后降一档）

简化原因：
- ✅ 后端零改动 —— 移除 "user-triggered fetch 例外" 决策需求
- ✅ Watch Mode 移除签名 / 链切换 / tx 复杂度
- ✅ HF 延后 —— Phase 1-4 不动 `PortfolioSummary` 类型
- ✅ KV-store 不做 —— 移除 Merkl 团队沟通依赖

剩余风险：
- ⚠️ React Query 是新依赖（评估见 §10）
- ✅ Merkl `/v4/users/{addr}/rewards` 成熟稳定，已 CORS 实测通过
- ⚠️ Bundle size +200KB（钱包栈）+ SDK 大包（`@aave/react` + `@aave/client`，预估 +300-500KB gzip）—— 需 build 后实测，超阈值则动态 import
- ⚠️ 多链并行 fetch 错误处理 —— UI 设计要清晰展示部分失败状态
- ⚠️ SDK GraphQL 端点可用性 —— 有 fallback viem multicall 兜底，但需监控降级频率

## 9. AAV-67 关闭

AAV-67 诉求（连钱包 → 读持仓 → 展示）被 Phase 1-4 完全覆盖。关闭前在 Linear @ AAV-67 reporter 确认。

## 10. 待办前置研究（非 blocker）

这些不阻塞动工，但 Phase 1 启动前的 spike：

1. **React Query 与现有 hooks 兼容性**（v5 更新：RQ 已安装，且 `useSideDataMeta` 已迁到 RQ）：
   - ✅ `@tanstack/react-query@^5.95.0` 已装；[useSideDataMeta.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useSideDataMeta.ts) 已在使用 `QUERY_STALE_TIMES`/RQ
   - 新增 user-data 相关 hooks 全部走 RQ
   - 仍是手写 fetch 的 hooks（如 [useAaveMarkets](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useAaveMarkets.ts)）保持不动，避免大规模重构
   - 两者通过 RQ `QueryClientProvider` 共存即可（QueryClientProvider 入口尚未确认，Phase 1 Step 0 C 须挂上）
2. **`viem/chains` 与网站支持链匹配** ✅ **已验证（viem 2.50.4，2026-05）**：
   - 网站现支持的 21 条链 viem 全部原生导出，无需 `defineChain`
   - 唯一注意点：chainId 8453 同时存在 `base` 和 `basePreconf`（preconfirmation 变体），用 `base`
   - 复现命令（如需重测新 viem 版本）：
     ```bash
     cd /tmp && mkdir -p viem-spike && cd viem-spike && npm i viem --silent
     node --input-type=module -e "
       import * as c from 'viem/chains';
       const want = [1,10,56,100,137,146,196,250,324,1088,1868,4326,5000,8453,9745,42161,42220,43114,57073,59144,534352];
       const byId = new Map();
       for (const [n,ch] of Object.entries(c)) if (ch?.id) byId.set(ch.id, n);
       want.forEach(id => console.log(id, byId.get(id) ?? 'MISSING'));
     "
     ```
3. **CORS 验证** ✅ **已验证 `/v4/claim` + `/v0/positions/*` + `/v4/users/{addr}/rewards`（2026-05）**：
   - 三个端点统一行为：HTTP 200/404 都正确返回 CORS 头（vitalik 地址 + chainId=1 实测 200）
   - **注意**：Merkl 不返回 `*`，而是**回显请求 Origin**（`access-control-allow-origin: https://aaveapy.com`），且 `access-control-allow-credentials: true`
   - 前端 `fetch` 调用必须用 `credentials: 'omit'`（默认），不要用 `'include'`，否则跨域 cookie 携带会失败
   - 复测命令：
     ```bash
     curl -sI -H "Origin: https://aaveapy.com" \
       "https://api.merkl.xyz/v4/users/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/rewards?chainId=1" \
       | grep -iE "^(HTTP|access-control)"
     ```
 4. **共享 chainId 真理表抽取**（重构子任务，建议 Phase 1 启动时一起做）：
    - 当前真理表在 [src/lib/tokenPriceResolver.ts:30](file:///Users/pabloli/Documents/code/aaveapy/src/lib/chains/src/lib/tokenPriceResolver.ts#L30) 的 `HARDCODED_PLATFORM_BY_CHAIN_ID`
    - 抽到新文件 `src/lib/chains/supportedChainIds.ts`，导出：
      ```ts
      export const SUPPORTED_CHAIN_IDS = [1, 10, 56, 100, 137, 146, 196, 250, 324, 1088, 1868, 4326, 5000, 8453, 9745, 42161, 42220, 43114, 57073, 59144, 534352] as const;
      export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[number];
      /** chainId → Coingecko platform slug（原 HARDCODED_PLATFORM_BY_CHAIN_ID） */
      export const COINGECKO_PLATFORM_BY_CHAIN_ID: Record<SupportedChainId, string> = { ... };
      /** chainId → 人类可读名 */
      export const CHAIN_NAME_BY_ID: Record<SupportedChainId, string> = { ... };
      ```
    - `tokenPriceResolver.ts` 改为 `import` 该 Record
    - 新增 `src/lib/wagmi/chains.ts` 也基于 `SUPPORTED_CHAIN_IDS` 构造 wagmi config
    - 收益：避免未来漂移；新加链只改一处
    - 风险：`tokenPriceResolver` 是热路径，需跑现有单测确认无回归
 5. **Aave SDK bundle size spike**（Phase 2 启动前必做）：
    - `@aave/react` + `@aave/client` 是大包，需实测 gzip 后增量
    - 命令：`npm i @aave/react @aave/client && npm run build`，对比前后 chunk 大小
    - 超阈值（如 >300KB gzip）→ 用动态 `import()` 将 SDK 延迟加载，仅在用户连接钱包时才拉
    - 同时检查 tree-shaking 是否生效：SDK 是否整体打入还是只打进使用的 export
 6. **Aave SDK GraphQL CORS 验证**（Phase 2 启动前必做）：
    - SDK 内部走 `https://api.aave.com/graphql`（或可配置端点）
    - 需从浏览器前端 `fetch` 该端点验证 CORS 头（同 §10 #3 的 Merkl 验证方式）
    - 若 CORS 阻断 → 方案 B（fallback viem multicall）成为实际首选，SDK 降级为 SSR/后端代理方案
    - 复测命令：
      ```bash
      curl -sI -H "Origin: https://aaveapy.com" \
        -H "Content-Type: application/json" \
        -X POST \
        -d '{"query":"{ __typename }"}' \
        "https://api.aave.com/graphql" \
        | grep -iE "^(HTTP|access-control)"
      ```
  7. **V3 SDK `@aave/client-v3` 依赖验证**（Phase 2 启动前必做）：
     - 确认 `@aave/client-v3` 包存在且导出 `allChainsUserPositions` / `markets` / `userSupplies` / `userBorrows`
     - 验证 V3 GraphQL 端点 CORS（同 #6 方式）
     - 若 `@aave/client-v3` 不存在或 API 不稳定 → V3 走方案 B（viem multicall fallback）

## 11. 执行建议

进入实现阶段时按以下顺序与并行策略推进：

### Step 0 — 并行预备工作（同一 PR / 多 agent 可分头）

| 任务 | 文件 | 负责范围 |
|---|---|---|
| **A. chainId 真理表抽取** | 新建 [src/lib/chains/supportedChainIds.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/chains/supportedChainIds.ts)；修 [src/lib/tokenPriceResolver.ts:30](file:///Users/pabloli/Documents/code/aaveapy/src/lib/tokenPriceResolver.ts#L30) 改 import | 见 §10 #4；改完跑 `npm test -- tokenPriceResolver` 确保无回归 |
 | **B. 钱包栈 + SDK 依赖安装** | `package.json` 加 `@rainbow-me/rainbowkit`、`wagmi@^2`、`viem@^2`、`@aave/react`、`@aave/client`（**v5：`@tanstack/react-query@^5.95.0` 已装，跳过**） | 用 context7 skill 拉最新 LTS；`npm i` 后跑 `npm run build` 看 bundle 增量；SDK bundle spike 见 §10 #5 |
| **C. Web3Provider 骨架** | 新建 [src/lib/wagmi/chains.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/wagmi/chains.ts)、[src/lib/wagmi/config.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/wagmi/config.ts)、[src/providers/Web3Provider.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/providers/Web3Provider.tsx)；嵌入 [src/App.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/App.tsx) | 依赖 A、B 完成 |

A、B 完全独立，可并行；C 需等 A+B。

### Step 1 — Phase 1 (AAV-66)

按 §3 Phase 1 实现：
1. [src/lib/wagmi/watchModeConnector.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/wagmi/watchModeConnector.ts) — Watch Mode connector + 单测
2. [src/hooks/useWallet.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useWallet.ts) — 薄封装 + 单测
3. [src/components/dashboard/Header.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/Header.tsx) — 集成 `<ConnectButton />` + Watch 入口
4. ✅ [src/hooks/useCampaignAccess.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useCampaignAccess.ts) **已实现**（v5：最终命名，从 `useSideDataMeta().campaignAccess` 消费；草案中 `useMerklCampaignAccess.ts` 命名未采用）。**剩余子任务**：补 co-located 单测 `useCampaignAccess.test.ts`；接 ReservesTable 准入标记 UI
5. 联动 [src/hooks/reserves-table/usePortfolioToggle.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/reserves-table/usePortfolioToggle.ts) 的 `whitelistMerklCampaignIds`

**Phase 1 Definition of Done**：
- 验证 Gate（§11）4 项全绿
- 手测 Watch Mode：输入 `vitalik.eth` → 资格反映到 UI；输入随机地址 → 资格清空
- 手测真实钱包：MetaMask 连接 + 切链 + 断开

### Step 2 — Phase 2 (AAV-69)

按 §3 Phase 2 实现。**Phase 2 不暴露 UI**（数据层 ready 即可），便于独立 ship 与回归。

**SDK 首选路径实现顺序**：
1. [src/lib/userData/sdkPositionMapper.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userData/sdkPositionMapper.ts) — `mapSdkPositionsToUserPositions` + 单测（核心挑战：SDK Position 按 spoke 聚合，需按 token 拆分）
2. [src/lib/userData/chainIdLookup.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userData/chainIdLookup.ts) — reserveId 回写 + 单测
3. [src/lib/userData/merklUserClient.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userData/merklUserClient.ts) — Merkl API 客户端 + zod 校验 + 单测
4. [src/lib/userData/aaveUserClient.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userData/aaveUserClient.ts) — viem multicall fallback + 单测
5. [src/hooks/useUserPositions.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useUserPositions.ts) — React Query hook（SDK 首选 → fallback → 报错）+ 单测

### Step 3 — Phase 3 (AAV-62)

依赖 Phase 2。连钱包 → 自动导入：
1. [src/lib/userPositionMapper.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userPositionMapper.ts) — `mapUserPositionsToPortfolioPositions` + 单测
2. [src/components/dashboard/PortfolioImportModal.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioImportModal.tsx) — 预览 Modal（Merge/Replace/Append）
3. [src/hooks/useWallet.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useWallet.ts) 或上层组件 — 监听连接事件，Portfolio 模式内触发 `useUserPositions()` → Modal

### Step 4 — Phase 4 (AAV-80)

依赖 Phase 3。**强制复用** [PortfolioPanel.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioPanel.tsx) + [PortfolioSummaryCard.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioSummaryCard.tsx)，禁止新建并行面板。

### Step 5 — Phase 5 (HF, 单独 Linear Issue)

新开 Linear issue，依赖 Phase 4 完成。扩展 [src/types/portfolio.ts](file:///Users/pabloli/Documents/code/aaveapy/src/types/portfolio.ts) 的 `PortfolioSummary` 加 `healthFactor?: number`。

### 多 agent 并行原则

- **Step 0 A / B** 可分两个 PR 并行（无文件冲突）
- **Step 0 C** 必须串行在 A+B 之后
- Phase 1-5 严格串行（前一个 Definition of Done 通过才进下一个）
- Phase 3 内部的"预览 Modal UI 重构" 与"导入逻辑"可拆 2 个 sub-agent 并行（前者改 [PortfolioPanel.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioPanel.tsx)，后者改 [src/lib/userPositionMapper.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userPositionMapper.ts)）

### Linear issue 拆解建议

| Linear Issue | Step | 估时 | 备注 |
|---|---|---|---|
| 新 sub-issue：chainId 真理表抽取 | Step 0 A | 2-4h | 重构，必须先做 |
| 新 sub-issue：钱包栈依赖 + bundle 评估 | Step 0 B | 2-4h | 含 bundle size 报告 |
| **AAV-66 前端** | Step 0 C + Step 1 | 1-2d | Web3Provider + Watch Mode + 消费 `/api/meta/side-data.campaignAccess`（后端已实现，见 [aav_66_plan.md](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md)） |
| AAV-69 | Step 2 | 1-2d | SDK 首选（`@aave/react` useUserPositions）+ viem multicall fallback |
| **AAV-62** | Step 3 | 0.5-1d | 连钱包 → 自动导入 Portfolio，预览 Modal |
| AAV-80 | Step 4 | 0.5-1d | 复用现有面板 |
| 新 sub-issue：HF | Step 5 | 0.5d | 延后 |

### 风险快查

| 风险 | 影响 | 缓解 |
|---|---|---|
| Bundle size +200KB 超阈值 | 警告 / 加载变慢 | Step 0 B 完成立即测；超阈值则用动态 import 把 RainbowKit 延迟加载 |
| React Query 与现有 hooks 行为冲突 | 数据不一致 | 严格按 §10 #1 隔离策略：新代码用 RQ，旧 hooks 不动 |
| Merkl `/v4/users/{addr}/rewards` schema 变更 | Phase 2 中断 | 在 [src/lib/userData/merklUserClient.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userData/merklUserClient.ts) 加 zod 校验；变更立即 throw |
| Watch Mode 被误用做交易 | 用户混淆 | UI 强制 "watching" 标签 + 任何签名 hook 抛 throw |
| 多链 fetch 部分失败 | UX 不清晰 | `UserPositionsResult.perChain[]` 明确每链状态，UI 显示失败链 banner |
| SDK GraphQL 宕机 / CORS 阻断 | Phase 2 SDK 路径不可用 | 自动降级至 viem multicall fallback；`useUserPositions` 内部 catch → 切换路径；CORS 需 §10 #6 浏览器实测确认 |
| SDK bundle 超阈值 (+300-500KB gzip) | 加载变慢 / LCP 恶化 | §10 #5 spike 实测；超阈值则 `@aave/react` 动态 import + React.lazy；fallback 路径零 SDK 依赖 |
| SDK Position 按 spoke 聚合，需拆分 | 映射复杂度高 / 拆分逻辑错误 | `sdkPositionMapper.ts` 纯函数 + co-located 单测覆盖：单 spoke 多 token、跨链 spoke、空仓位 |

## 12. 验证 Gate

每个 Phase 完成后必须：

```bash
npm run lint && npm test && npm run build && npx tsc --noEmit
```

另对照 [docs/conventions/frontend-regression-checklist.md](file:///Users/pabloli/Documents/code/aaveapy/docs/conventions/frontend-regression-checklist.md)。

新增的 hook / lib 必须有 co-located 单测（[reserves-table/](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/reserves-table) 模式）：
- `useWallet.test.ts`
- `useCampaignAccess.test.ts`（v5：最终命名；含 whitelist hit/miss、blacklist hit/miss、空数据 fallback）
- `useUserMerklRewards.test.ts`
- `useUserPositions.test.ts`
- `userPositionMapper.test.ts`
- `chainIdLookup.test.ts`
- `watchModeConnector.test.ts`

### 12.1 端到端对比测试：SDK vs ABI User Position 一致性

> **Grill Q4 决议**：必须验证 SDK GraphQL 获得的 User Position 与 ABI 链上 multicall 获得的 User Position 是否一致，确保 fallback 行为正确。

**测试策略**：

| 版本 | 对比字段 | 精度容差 | 说明 |
|------|---------|---------|------|
| V3 | `supplied = scaledATokenBalance × liquidityIndex / RAY` vs SDK `totalDeposits.raw` | 1e-6（相对） | 缩放值还原后应与 SDK 已换算值一致 |
| V3 | `borrowed = scaledVariableDebt × variableBorrowIndex / RAY` vs SDK `totalBorrows.raw` | 1e-6（相对） | 同上 |
| V3 | `healthFactor` vs SDK `healthFactor` | 1e-4（相对） | HF 由合约计算，精度略低 |
| V4 | `getUserSuppliedAssets(reserveId, user)` vs SDK `supplied.amount.onChainValue` | 0（精确匹配） | V4 直接 assets，零换算，应精确一致 |
| V4 | `getUserDebt(reserveId, user)` vs SDK `borrowed.amount.onChainValue` | 0（精确匹配） | 同上 |
| V4 | `getUserAccountData(user).totalDebtValue` vs SDK `totalDebtValue` | 1e-4（相对） | totalDebtValueRay 降精度后可能有 RAY 截断误差 |

**测试文件**：`src/test/userPositionConsistency.test.ts`

**执行方式**：
- 需要 real chain RPC（用 public RPC，非 mock）
- 选定 3-5 个已知有仓位的钱包地址做快照对比
- CI 中标记为 `@integration`，日常 lint/test 不跑，手动或定时触发
- 对比失败时输出双方原始值 + 差值 + 相对误差，便于定位
